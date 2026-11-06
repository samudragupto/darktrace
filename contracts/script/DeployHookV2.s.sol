// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {DarkTraceHook} from "../src/DarkTraceHook.sol";
import {SandwichBundle} from "./E2ESandwich.s.sol";

/**
 * @title DeployHookV2Script
 * @notice Mines a CREATE2 salt for DarkTraceHook v2 (with explicit owner parameter), deploys it on
 *         Base Sepolia, initializes a new tUSDC/tWETH pool attached to Hook v2, adds liquidity,
 *         and executes an on-chain sandwich bundle to verify v2 detection live.
 */
contract DeployHookV2Script is Script {
    using PoolIdLibrary for PoolKey;

    IPoolManager constant MANAGER = IPoolManager(0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408);
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    uint160 constant REQUIRED_FLAGS = uint160((1 << 7) | (1 << 6)); // 0x00C0 (BEFORE_SWAP | AFTER_SWAP)
    uint160 constant HOOK_MASK = uint160((1 << 14) - 1); // 0x3FFF
    int24 constant DEFAULT_MIN_TICK_DELTA = 15;

    uint24 constant FEE = 3000;
    int24 constant TICK_SPACING = 60;
    int24 constant START_TICK = 196260;
    int24 constant RANGE = 1200;
    uint128 constant LIQUIDITY = 2e15;

    uint256 constant FRONTRUN_IN = 200e6;
    uint256 constant VICTIM_IN = 1_000e6;

    string constant E2E_JSON = "deployments/e2e-base-sepolia.json";
    string constant OUT_JSON = "deployments/hook-v2-base-sepolia.json";

    function run() external {
        string memory e2e = vm.readFile(E2E_JSON);
        address token0 = vm.parseJsonAddress(e2e, ".token0");
        address token1 = vm.parseJsonAddress(e2e, ".token1");
        PoolModifyLiquidityTest lpRouter = PoolModifyLiquidityTest(vm.parseJsonAddress(e2e, ".lpRouter"));
        SandwichBundle bundle = SandwichBundle(vm.parseJsonAddress(e2e, ".bundle"));

        vm.startBroadcast();
        address owner = msg.sender;

        // 1. Mine CREATE2 salt for DarkTraceHook v2 with explicit owner
        bytes memory initCode = abi.encodePacked(
            type(DarkTraceHook).creationCode,
            abi.encode(MANAGER, DEFAULT_MIN_TICK_DELTA, owner)
        );
        bytes32 initCodeHash = keccak256(initCode);

        bytes32 minedSalt;
        address predicted;
        bool found;
        for (uint256 i = 0; i < 100_000; i++) {
            bytes32 s = bytes32(i);
            address cand = vm.computeCreate2Address(s, initCodeHash, CREATE2_DEPLOYER);
            if ((uint160(cand) & HOOK_MASK) == REQUIRED_FLAGS) {
                minedSalt = s;
                predicted = cand;
                found = true;
                break;
            }
        }
        require(found, "no 0x00C0 salt found");

        DarkTraceHook hookV2 = new DarkTraceHook{salt: minedSalt}(MANAGER, DEFAULT_MIN_TICK_DELTA, owner);
        require(address(hookV2) == predicted, "hookV2 address mismatch");
        require(hookV2.owner() == owner, "hookV2 owner mismatch");

        // 2. Initialize new v4 pool attached to Hook v2 & add concentrated liquidity
        PoolKey memory keyV2 = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(hookV2))
        });
        MANAGER.initialize(keyV2, TickMath.getSqrtPriceAtTick(START_TICK));

        lpRouter.modifyLiquidity(
            keyV2,
            IPoolManager.ModifyLiquidityParams({
                tickLower: START_TICK - RANGE,
                tickUpper: START_TICK + RANGE,
                liquidityDelta: int256(uint256(LIQUIDITY)),
                salt: bytes32(0)
            }),
            ""
        );

        // 3. Execute real sandwich through Hook v2 -> emits ExtractionDetected
        int256 pnl0 = bundle.execute(keyV2, FRONTRUN_IN, VICTIM_IN);
        vm.stopBroadcast();

        PoolId poolIdV2 = keyV2.toId();
        console.log("DarkTraceHook v2:", address(hookV2));
        console.log("Hook v2 owner:   ", hookV2.owner());
        console.log("Mined salt:      ", vm.toString(minedSalt));
        console.log("PoolId v2:       ", vm.toString(PoolId.unwrap(poolIdV2)));
        console.log("Searcher PnL0:   ", pnl0);

        string memory j = "hookv2";
        vm.serializeAddress(j, "hookV2", address(hookV2));
        vm.serializeAddress(j, "owner", hookV2.owner());
        vm.serializeBytes32(j, "salt", minedSalt);
        string memory out = vm.serializeBytes32(j, "poolIdV2", PoolId.unwrap(poolIdV2));
        vm.writeJson(out, OUT_JSON);
    }
}

