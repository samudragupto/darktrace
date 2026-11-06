// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";

contract MockPoolManager {
    using PoolIdLibrary for PoolKey;

    bytes32 constant POOLS_SLOT = bytes32(uint256(6)); // standard mapping slot
    mapping(bytes32 => bytes32) public slots;

    function setSlot0(PoolId poolId, uint160 sqrtPriceX96, int24 tick) public {
        bytes32 stateSlot = keccak256(abi.encodePacked(PoolId.unwrap(poolId), bytes32(uint256(6))));

        // Pack: tick in bits [160..183], sqrtPriceX96 in bits [0..159]
        bytes32 packedData = bytes32((uint256(uint24(tick)) << 160) | uint256(sqrtPriceX96));
        slots[stateSlot] = packedData;
    }

    /**
     * @notice Executes `beforeSwap`, updates `slot0`, and executes `afterSwap` within a single
     *         top-level call frame (matching real `PoolManager.swap`), ensuring EIP-1153
     *         transient storage (`tstore`) persists from `beforeSwap` to `afterSwap` across
     *         all Foundry / revm versions.
     */
    function simulateSwap(
        IHooks hook,
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        uint160 postSqrtPriceX96,
        int24 postTick,
        BalanceDelta delta,
        bytes calldata hookData
    ) external {
        hook.beforeSwap(sender, key, params, hookData);
        setSlot0(key.toId(), postSqrtPriceX96, postTick);
        hook.afterSwap(sender, key, params, delta, hookData);
    }

    function extsload(bytes32 slot) external view returns (bytes32) {
        return slots[slot];
    }

    function extsload(bytes32 startSlot, uint256 nSlots) external view returns (bytes32[] memory res) {
        res = new bytes32[](nSlots);
        for (uint256 i = 0; i < nSlots; i++) {
            res[i] = slots[bytes32(uint256(startSlot) + i)];
        }
    }
}
