// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";

/**
 * @title DarkTraceHook
 * @notice Uniswap v4 Hook (v2) that detects MEV sandwich extraction footprints via block-scoped
 *         transient/persistent state and BalanceDelta profit-consistency verification.
 * @dev Improvements over v1 (0xBCC9…80c0):
 *      1. Explicit `owner` constructor parameter (fixes CREATE2 deployer ownership lock).
 *      2. `beforeSwap` uses EIP-1153 `tstore` exclusively (no `sstore` for intra-tx pre-swap tick).
 *      3. Sub-threshold clean swaps skip `sstore` completely; state is cleared (`0`) upon detection.
 *      4. Profit-consistency check: backrun must reverse frontrun direction, match `frontrunSender`,
 *         and yield strictly positive net `token0` delta (`frontrunAmount0 + backrunAmount0 > 0`).
 *      5. Full 160-bit address packing (fixes 24-bit address shift truncation in v1).
 *      6. Optional `afterSwap` `hookData` attribution flag (`0x01 || abi.encode(address)` or 32-byte
 *         ABI-encoded address) so routers can opt into trader/victim attribution without `tx.origin`.
 */
contract DarkTraceHook is IHooks {
    using PoolIdLibrary for PoolKey;
    using Hooks for IHooks;
    using StateLibrary for IPoolManager;

    IPoolManager public immutable poolManager;
    address public owner;

    // Dynamic minimum tick delta threshold (defensive check to ignore normal micro-volatility)
    int24 public minTickDeltaThreshold;

    // Slot A (240 bits): lastBlock (48) | frontrunDirection (8) | frontrunTickDelta (24) | frontrunSender (160)
    // Slot B (256 bits): frontrunAmount0 (96) | victimCandidate (160)
    struct PoolTransientState {
        uint48 lastBlock;
        uint8 frontrunDirection; // 1 = zeroForOne, 2 = oneForZero
        int24 frontrunTickDelta;
        address frontrunSender;
        int96 frontrunAmount0;
        address victimCandidate;
    }

    event ExtractionDetected(
        PoolId indexed poolId,
        address indexed searcher,
        address indexed victim,
        uint256 extractedValue,
        bytes32 proofHash
    );

    event ThresholdUpdated(int24 oldThreshold, int24 newThreshold);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotPoolManager();
    error Unauthorized();
    error ZeroAddress();
    error HookNotImplemented();

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(IPoolManager _poolManager, int24 _minTickDeltaThreshold, address _owner) {
        if (_owner == address(0)) revert ZeroAddress();
        poolManager = _poolManager;
        owner = _owner;
        minTickDeltaThreshold = _minTickDeltaThreshold;

        // Enforce that deployed address has valid BEFORE_SWAP and AFTER_SWAP flags
        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());
    }

    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function setMinTickDeltaThreshold(int24 newThreshold) external onlyOwner {
        emit ThresholdUpdated(minTickDeltaThreshold, newThreshold);
        minTickDeltaThreshold = newThreshold;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // SWAP HOOKS
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Records pre-swap tick into EIP-1153 transient storage (`tstore` only).
     * @dev `beforeSwap` and `afterSwap` always execute inside the same `PoolManager.swap` frame,
     *      so `preTickSlot` never crosses a transaction boundary and never needs `sstore`.
     */
    function beforeSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        PoolId poolId = key.toId();
        (, int24 currentTick,,) = poolManager.getSlot0(poolId);

        bytes32 preTickSlot = _getPreTickSlot(poolId);
        bytes32 packedTick = bytes32(uint256(uint24(currentTick)) | (1 << 24));
        assembly {
            tstore(preTickSlot, packedTick)
        }

        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    /**
     * @notice Compares realized tick impact and BalanceDelta against prior intra-block swaps.
     */
    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external override onlyPoolManager returns (bytes4, int128) {
        PoolId poolId = key.toId();
        (, int24 postTick,,) = poolManager.getSlot0(poolId);

        bytes32 preTickSlot = _getPreTickSlot(poolId);
        bytes32 rawPreTick;
        assembly {
            rawPreTick := tload(preTickSlot)
        }
        int24 preTick = int24(int256(uint256(rawPreTick) & 0x00FFFFFF));
        int24 tickDelta = postTick - preTick;

        address actor = _resolveActor(sender, hookData);
        uint8 currentDirection = params.zeroForOne ? 1 : 2;
        uint48 currentBlock = uint48(block.number);

        PoolTransientState memory s = _loadTransientState(poolId);

        if (s.lastBlock == currentBlock) {
            // Case A: Backrun candidate in the opposite direction
            if (currentDirection != s.frontrunDirection) {
                if (
                    s.victimCandidate != address(0) &&
                    s.victimCandidate != actor &&
                    actor == s.frontrunSender &&
                    _isInversionSignificant(s.frontrunTickDelta, tickDelta) &&
                    _isProfitableToken0(s.frontrunAmount0, delta.amount0())
                ) {
                    uint256 estimatedExtracted = _estimateExtractedValue(
                        params.amountSpecified,
                        s.frontrunTickDelta,
                        tickDelta
                    );
                    bytes32 proofHash = keccak256(
                        abi.encodePacked(
                            poolId,
                            actor,
                            s.victimCandidate,
                            block.number,
                            preTick,
                            postTick,
                            block.timestamp
                        )
                    );

                    emit ExtractionDetected(
                        poolId,
                        actor,
                        s.victimCandidate,
                        estimatedExtracted,
                        proofHash
                    );

                    // Clear state after detection (sstore zeroing refund)
                    _clearTransientState(poolId);
                    return (IHooks.afterSwap.selector, 0);
                }

                // Opposing swap that was not a valid profitable backrun by frontrunSender:
                // if this opposing swap itself is a significant push, start a new frontrun candidate;
                // otherwise clear stale intra-block state.
                if (_isPushSignificant(tickDelta)) {
                    _storeFrontrunPush(poolId, currentBlock, currentDirection, tickDelta, actor, delta.amount0());
                } else {
                    _clearTransientState(poolId);
                }
                return (IHooks.afterSwap.selector, 0);
            }

            // Same direction as frontrun:
            // Case B: Victim swap by a distinct actor following a significant frontrun push
            if (
                s.frontrunSender != address(0) &&
                s.frontrunSender != actor &&
                _isPushSignificant(s.frontrunTickDelta)
            ) {
                s.victimCandidate = actor;
                _storeSlotB(poolId, s.frontrunAmount0, actor);
                return (IHooks.afterSwap.selector, 0);
            }

            // Same actor pushing again before a victim swap, or replacing a push:
            if (s.victimCandidate == address(0) && _isPushSignificant(tickDelta)) {
                _storeFrontrunPush(poolId, currentBlock, currentDirection, tickDelta, actor, delta.amount0());
            }
            return (IHooks.afterSwap.selector, 0);
        }

        // New block context: only write state if this swap is a significant potential frontrun push!
        // Clean sub-threshold swaps perform ZERO sstore operations.
        if (_isPushSignificant(tickDelta)) {
            _storeFrontrunPush(poolId, currentBlock, currentDirection, tickDelta, actor, delta.amount0());
        }

        return (IHooks.afterSwap.selector, 0);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // DETECTION HEURISTICS & ATTRIBUTION (Pure / View)
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Resolves the effective trader/victim identity without `tx.origin`.
     * @dev Opt-in `hookData` formats:
     *      - 33 bytes: `0x01` flag followed by `abi.encode(address trader)`
     *      - 32 bytes: `abi.encode(address trader)`
     *      Falls back to `sender` (the router contract) if `hookData` is empty or decodes to `address(0)`.
     */
    function _resolveActor(address sender, bytes calldata hookData) internal pure returns (address) {
        if (hookData.length == 33 && hookData[0] == 0x01) {
            address attributed = abi.decode(hookData[1:33], (address));
            if (attributed != address(0)) return attributed;
        } else if (hookData.length == 32) {
            address attributed = abi.decode(hookData, (address));
            if (attributed != address(0)) return attributed;
        }
        return sender;
    }

    function _isPushSignificant(int24 tickDelta) internal view returns (bool) {
        int24 absDelta = tickDelta < 0 ? -tickDelta : tickDelta;
        return absDelta >= minTickDeltaThreshold;
    }

    function _isInversionSignificant(int24 pushDelta, int24 pullDelta) internal view returns (bool) {
        if ((pushDelta > 0 && pullDelta > 0) || (pushDelta < 0 && pullDelta < 0)) return false;

        int24 absPush = pushDelta < 0 ? -pushDelta : pushDelta;
        int24 absPull = pullDelta < 0 ? -pullDelta : pullDelta;

        if (absPush < minTickDeltaThreshold || absPull < minTickDeltaThreshold) return false;
        return (absPull * 100) / absPush >= 30;
    }

    /**
     * @notice Profit-consistency check: verifies the searcher's net `token0` delta across
     *         frontrun + backrun is strictly positive (`frontrunAmount0 + backrunAmount0 > 0`).
     */
    function _isProfitableToken0(int96 frontrunAmount0, int128 backrunAmount0) internal pure returns (bool) {
        return int256(frontrunAmount0) + int256(backrunAmount0) > 0;
    }

    function _toInt96(int128 x) internal pure returns (int96) {
        if (x > type(int96).max) return type(int96).max;
        if (x < type(int96).min) return type(int96).min;
        return int96(x);
    }

    function _estimateExtractedValue(
        int256 amountSpecified,
        int24 pushDelta,
        int24 pullDelta
    ) internal pure returns (uint256) {
        uint256 volume = amountSpecified < 0 ? uint256(-amountSpecified) : uint256(amountSpecified);
        int24 absPush = pushDelta < 0 ? -pushDelta : pushDelta;
        int24 absPull = pullDelta < 0 ? -pullDelta : pullDelta;

        uint256 impactBps = uint256(uint24(absPush < absPull ? absPush : absPull)) * 2;
        if (impactBps > 1000) impactBps = 1000;

        return (volume * impactBps) / 10000;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // BLOCK-SCOPED TRANSIENT / PERSISTENT STATE MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────────

    function _getPreTickSlot(PoolId poolId) internal pure returns (bytes32) {
        return keccak256(abi.encode(poolId, "darktrace.tstore.pretick"));
    }

    function _getStateSlotA(PoolId poolId) internal pure returns (bytes32) {
        return keccak256(abi.encode(poolId, "darktrace.tstore.stateA"));
    }

    function _getStateSlotB(PoolId poolId) internal pure returns (bytes32) {
        return keccak256(abi.encode(poolId, "darktrace.tstore.stateB"));
    }

    function _loadTransientState(PoolId poolId) internal view returns (PoolTransientState memory s) {
        bytes32 slotA = _getStateSlotA(poolId);
        bytes32 valA;
        assembly {
            valA := tload(slotA)
            if iszero(valA) {
                valA := sload(slotA)
            }
        }

        s.lastBlock = uint48(uint256(valA));
        if (s.lastBlock != uint48(block.number)) {
            return s;
        }

        s.frontrunDirection = uint8(uint256(valA >> 48));
        s.frontrunTickDelta = int24(int256(uint256(valA >> 56)));
        s.frontrunSender = address(uint160(uint256(valA >> 80)));

        bytes32 slotB = _getStateSlotB(poolId);
        bytes32 valB;
        assembly {
            valB := tload(slotB)
            if iszero(valB) {
                valB := sload(slotB)
            }
        }
        s.frontrunAmount0 = int96(int256(uint256(valB)));
        s.victimCandidate = address(uint160(uint256(valB >> 96)));
    }

    function _storeFrontrunPush(
        PoolId poolId,
        uint48 currentBlock,
        uint8 direction,
        int24 tickDelta,
        address sender,
        int128 amount0
    ) internal {
        bytes32 slotA = _getStateSlotA(poolId);
        bytes32 slotB = _getStateSlotB(poolId);

        bytes32 valA = bytes32(
            uint256(currentBlock) |
            (uint256(direction) << 48) |
            (uint256(uint24(tickDelta)) << 56) |
            (uint256(uint160(sender)) << 80)
        );
        int96 clamped0 = _toInt96(amount0);
        bytes32 valB = bytes32(uint256(uint96(clamped0)));

        assembly {
            tstore(slotA, valA)
            sstore(slotA, valA)
            tstore(slotB, valB)
            sstore(slotB, valB)
        }
    }

    function _storeSlotB(PoolId poolId, int96 frontrunAmount0, address victimCandidate) internal {
        bytes32 slotB = _getStateSlotB(poolId);
        bytes32 valB = bytes32(
            uint256(uint96(frontrunAmount0)) |
            (uint256(uint160(victimCandidate)) << 96)
        );
        assembly {
            tstore(slotB, valB)
            sstore(slotB, valB)
        }
    }

    function _clearTransientState(PoolId poolId) internal {
        bytes32 slotA = _getStateSlotA(poolId);
        bytes32 slotB = _getStateSlotB(poolId);
        assembly {
            tstore(slotA, 0)
            sstore(slotA, 0)
            tstore(slotB, 0)
            sstore(slotB, 0)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // UNUSED HOOKS
    // ─────────────────────────────────────────────────────────────────────────────

    function beforeInitialize(address, PoolKey calldata, uint160) external pure override returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure override returns (bytes4) {
        revert HookNotImplemented();
    }

    function beforeAddLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, bytes calldata) external pure override returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterAddLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata) external pure override returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, bytes calldata) external pure override returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterRemoveLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata) external pure override returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure override returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure override returns (bytes4) {
        revert HookNotImplemented();
    }
}
