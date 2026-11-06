// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {DarkTraceHook} from "../src/DarkTraceHook.sol";
import {MockPoolManager} from "./mocks/MockPoolManager.sol";
import {PoolManager} from "v4-core/PoolManager.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {BalanceDelta, toBalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {E2EToken} from "../script/E2ESandwich.s.sol";

contract DarkTraceHookTest is Test {
    using PoolIdLibrary for PoolKey;

    MockPoolManager public mockManager;
    DarkTraceHook public hook;
    PoolKey public testKey;
    PoolId public testPoolId;

    address public constant OWNER = address(0xA11CE);
    address public constant SEARCHER = address(0x1111111111111111111111111111111111111111);
    address public constant VICTIM = address(0x2222222222222222222222222222222222222222);
    address public constant TRADER_CLEAN = address(0x3333333333333333333333333333333333333333);
    address public constant ARBITRAGEUR = address(0x4444444444444444444444444444444444444444);
    address public constant SHARED_ROUTER = address(0x5555555555555555555555555555555555555555);

    // Target hook address with BEFORE_SWAP (bit 7) and AFTER_SWAP (bit 6) set: 0x00C0
    address public constant VALID_HOOK_ADDRESS = address(uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG));

    event ExtractionDetected(
        PoolId indexed poolId,
        address indexed searcher,
        address indexed victim,
        uint256 extractedValue,
        bytes32 proofHash
    );

    function setUp() public {
        mockManager = new MockPoolManager();

        testKey = PoolKey({
            currency0: Currency.wrap(address(0x1000)),
            currency1: Currency.wrap(address(0x2000)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(VALID_HOOK_ADDRESS)
        });
        testPoolId = testKey.toId();

        // Deploy hook v2 with explicit OWNER
        deployCodeTo(
            "DarkTraceHook.sol",
            abi.encode(IPoolManager(address(mockManager)), int24(5), OWNER),
            VALID_HOOK_ADDRESS
        );
        hook = DarkTraceHook(VALID_HOOK_ADDRESS);

        // Initial pool state: tick = 100, price = 1 << 96
        mockManager.setSlot0(testPoolId, uint160(1 << 96), 100);
    }

    function test_HookPermissionsValidation() public view {
        Hooks.Permissions memory perms = hook.getHookPermissions();
        assertTrue(perms.beforeSwap);
        assertTrue(perms.afterSwap);
        assertFalse(perms.beforeInitialize);
        assertFalse(perms.afterInitialize);
        assertFalse(perms.beforeDonate);
    }

    function test_ExplicitOwnerAndThresholdGovernance() public {
        assertEq(hook.owner(), OWNER);

        vm.prank(SEARCHER);
        vm.expectRevert(DarkTraceHook.Unauthorized.selector);
        hook.setMinTickDeltaThreshold(25);

        vm.prank(OWNER);
        hook.setMinTickDeltaThreshold(25);
        assertEq(hook.minTickDeltaThreshold(), 25);

        address newOwner = address(0xB0B);
        vm.prank(OWNER);
        hook.transferOwnership(newOwner);
        assertEq(hook.owner(), newOwner);
    }

    function test_CleanSwap_NoExtractionDetected() public {
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: -1 ether,
            sqrtPriceLimitX96: 0
        });

        // Normal market slippage: tick moves 100 -> 98 (delta = -2, below threshold 5)
        vm.recordLogs();
        mockManager.simulateSwap(
            hook,
            TRADER_CLEAN,
            testKey,
            params,
            uint160(1 << 96),
            98,
            toBalanceDelta(-1 ether, 1 ether),
            ""
        );

        // Assert no ExtractionDetected events emitted and zero persistent storage written
        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 0);
    }

    function test_SandwichAttack_EmitsExtractionDetected() public {
        // --- TX 1: Searcher Frontrun (zeroForOne = true, sells 5 token0, pushes tick 100 -> 80, delta = -20) ---
        IPoolManager.SwapParams memory frontrunParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: -5 ether,
            sqrtPriceLimitX96: 0
        });
        mockManager.simulateSwap(
            hook,
            SEARCHER,
            testKey,
            frontrunParams,
            uint160(1 << 96),
            80,
            toBalanceDelta(-5 ether, 5 ether),
            ""
        );

        // --- TX 2: Victim Swap (zeroForOne = true, sells 10 token0, tick 80 -> 76, delta = -4) ---
        IPoolManager.SwapParams memory victimParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: -10 ether,
            sqrtPriceLimitX96: 0
        });
        mockManager.simulateSwap(
            hook,
            VICTIM,
            testKey,
            victimParams,
            uint160(1 << 96),
            76,
            toBalanceDelta(-10 ether, 10 ether),
            ""
        );

        // --- TX 3: Searcher Backrun (zeroForOne = false, sells 5 token1 for 5.2 token0, net +0.2 token0 > 0) ---
        IPoolManager.SwapParams memory backrunParams = IPoolManager.SwapParams({
            zeroForOne: false,
            amountSpecified: -5 ether,
            sqrtPriceLimitX96: 0
        });

        vm.expectEmit(true, true, true, false, address(hook));
        emit ExtractionDetected(
            testPoolId,
            SEARCHER,
            VICTIM,
            0,
            bytes32(0)
        );

        mockManager.simulateSwap(
            hook,
            SEARCHER,
            testKey,
            backrunParams,
            uint160(1 << 96),
            98,
            toBalanceDelta(5.2 ether, -5 ether),
            ""
        );
    }

    function test_DefensiveFallback_OpposingSwapsAcrossDifferentBlocks_NoEvent() public {
        vm.roll(100);
        IPoolManager.SwapParams memory params1 = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: -5 ether,
            sqrtPriceLimitX96: 0
        });
        mockManager.simulateSwap(
            hook,
            SEARCHER,
            testKey,
            params1,
            uint160(1 << 96),
            80,
            toBalanceDelta(-5 ether, 5 ether),
            ""
        );

        IPoolManager.SwapParams memory params2 = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: -10 ether,
            sqrtPriceLimitX96: 0
        });
        mockManager.simulateSwap(
            hook,
            VICTIM,
            testKey,
            params2,
            uint160(1 << 96),
            76,
            toBalanceDelta(-10 ether, 10 ether),
            ""
        );

        // Backrun in next block (Block 101)
        vm.roll(101);
        IPoolManager.SwapParams memory params3 = IPoolManager.SwapParams({
            zeroForOne: false,
            amountSpecified: -5 ether,
            sqrtPriceLimitX96: 0
        });

        vm.recordLogs();
        mockManager.simulateSwap(
            hook,
            SEARCHER,
            testKey,
            params3,
            uint160(1 << 96),
            98,
            toBalanceDelta(5.2 ether, -5 ether),
            ""
        );

        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 0);
    }

    // ── False-Positive Guards ──────────────────────────────────────────────────

    function test_FalsePositive_IndependentArbitrageurDoesNotTrigger() public {
        // Trader 1 (SEARCHER) pushes price down
        IPoolManager.SwapParams memory p1 = IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -5 ether, sqrtPriceLimitX96: 0});
        mockManager.simulateSwap(hook, SEARCHER, testKey, p1, uint160(1 << 96), 80, toBalanceDelta(-5 ether, 5 ether), "");

        // Trader 2 (VICTIM) swaps in same direction
        IPoolManager.SwapParams memory p2 = IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -10 ether, sqrtPriceLimitX96: 0});
        mockManager.simulateSwap(hook, VICTIM, testKey, p2, uint160(1 << 96), 76, toBalanceDelta(-10 ether, 10 ether), "");

        // Trader 3 (ARBITRAGEUR != SEARCHER) swaps in opposite direction
        IPoolManager.SwapParams memory p3 = IPoolManager.SwapParams({zeroForOne: false, amountSpecified: -5 ether, sqrtPriceLimitX96: 0});
        vm.recordLogs();
        mockManager.simulateSwap(hook, ARBITRAGEUR, testKey, p3, uint160(1 << 96), 98, toBalanceDelta(5.2 ether, -5 ether), "");

        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 0);
    }

    function test_FalsePositive_UnprofitableRoundTripDoesNotTrigger() public {
        // Searcher frontruns -5 ether token0
        IPoolManager.SwapParams memory p1 = IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -5 ether, sqrtPriceLimitX96: 0});
        mockManager.simulateSwap(hook, SEARCHER, testKey, p1, uint160(1 << 96), 80, toBalanceDelta(-5 ether, 5 ether), "");

        // Victim swaps in same direction
        IPoolManager.SwapParams memory p2 = IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: 0});
        mockManager.simulateSwap(hook, VICTIM, testKey, p2, uint160(1 << 96), 79, toBalanceDelta(-1 ether, 1 ether), "");

        // Searcher reverses, receiving only +4.97 ether token0 (net -0.03 ether <= 0 after fees)
        IPoolManager.SwapParams memory p3 = IPoolManager.SwapParams({zeroForOne: false, amountSpecified: -5 ether, sqrtPriceLimitX96: 0});
        vm.recordLogs();
        mockManager.simulateSwap(hook, SEARCHER, testKey, p3, uint160(1 << 96), 99, toBalanceDelta(4.97 ether, -5 ether), "");

        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 0);
    }

    function test_FalsePositive_ImmediateSelfReversalWithoutVictimDoesNotTrigger() public {
        IPoolManager.SwapParams memory p1 = IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -5 ether, sqrtPriceLimitX96: 0});
        mockManager.simulateSwap(hook, SEARCHER, testKey, p1, uint160(1 << 96), 80, toBalanceDelta(-5 ether, 5 ether), "");

        IPoolManager.SwapParams memory p2 = IPoolManager.SwapParams({zeroForOne: false, amountSpecified: -5 ether, sqrtPriceLimitX96: 0});
        vm.recordLogs();
        mockManager.simulateSwap(hook, SEARCHER, testKey, p2, uint160(1 << 96), 100, toBalanceDelta(5.1 ether, -5 ether), "");

        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 0);
    }

    function test_HookDataOptInVictimAttribution_SharedRouter() public {
        bytes memory searcherData = abi.encodePacked(uint8(0x01), abi.encode(SEARCHER));
        bytes memory victimData = abi.encodePacked(uint8(0x01), abi.encode(VICTIM));

        // All 3 swaps enter via SHARED_ROUTER, but opt-in hookData attributes SEARCHER and VICTIM
        IPoolManager.SwapParams memory p1 = IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -5 ether, sqrtPriceLimitX96: 0});
        mockManager.simulateSwap(hook, SHARED_ROUTER, testKey, p1, uint160(1 << 96), 80, toBalanceDelta(-5 ether, 5 ether), searcherData);

        IPoolManager.SwapParams memory p2 = IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -10 ether, sqrtPriceLimitX96: 0});
        mockManager.simulateSwap(hook, SHARED_ROUTER, testKey, p2, uint160(1 << 96), 76, toBalanceDelta(-10 ether, 10 ether), victimData);

        IPoolManager.SwapParams memory p3 = IPoolManager.SwapParams({zeroForOne: false, amountSpecified: -5 ether, sqrtPriceLimitX96: 0});
        vm.expectEmit(true, true, true, false, address(hook));
        emit ExtractionDetected(testPoolId, SEARCHER, VICTIM, 0, bytes32(0));

        mockManager.simulateSwap(hook, SHARED_ROUTER, testKey, p3, uint160(1 << 96), 98, toBalanceDelta(5.2 ether, -5 ether), searcherData);
    }

    function testFuzz_SandwichProfitAndDirectionInvariants(
        int64 frontrunAmt0,
        int64 backrunAmt0,
        int16 pushTicksRaw,
        int16 pullTicksRaw,
        address backrunCaller
    ) public {
        vm.assume(backrunCaller != address(0) && backrunCaller != VICTIM);
        int24 pushTicks = int24(int16(bound(pushTicksRaw, -500, -1)));
        int24 pullTicks = int24(int16(bound(pullTicksRaw, 1, 500)));

        // 1. Frontrun
        IPoolManager.SwapParams memory p1 = IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -5 ether, sqrtPriceLimitX96: 0});
        mockManager.simulateSwap(hook, SEARCHER, testKey, p1, uint160(1 << 96), 100 + pushTicks, toBalanceDelta(int128(frontrunAmt0), 5 ether), "");

        // 2. Victim
        IPoolManager.SwapParams memory p2 = IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -10 ether, sqrtPriceLimitX96: 0});
        mockManager.simulateSwap(hook, VICTIM, testKey, p2, uint160(1 << 96), 100 + pushTicks - 4, toBalanceDelta(-10 ether, 10 ether), "");

        // 3. Backrun
        IPoolManager.SwapParams memory p3 = IPoolManager.SwapParams({zeroForOne: false, amountSpecified: -5 ether, sqrtPriceLimitX96: 0});
        vm.recordLogs();
        mockManager.simulateSwap(hook, backrunCaller, testKey, p3, uint160(1 << 96), 100 + pushTicks - 4 + pullTicks, toBalanceDelta(int128(backrunAmt0), -5 ether), "");

        Vm.Log[] memory entries = vm.getRecordedLogs();
        int24 absPush = -pushTicks;
        bool shouldEmit = (
            backrunCaller == SEARCHER &&
            absPush >= 5 &&
            pullTicks >= 5 &&
            (int256(pullTicks) * 100) / int256(absPush) >= 30 &&
            int256(frontrunAmt0) + int256(backrunAmt0) > 0
        );
        assertEq(entries.length, shouldEmit ? 1 : 0);
    }

    function test_RealPoolManager_ReproducesRun1Sandwich() public {
        PoolManager realManager = new PoolManager(address(this));
        address hookAddr = address(uint160(0x4000 | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG));
        deployCodeTo(
            "DarkTraceHook.sol",
            abi.encode(IPoolManager(address(realManager)), int24(15), OWNER),
            hookAddr
        );

        E2EToken weth = new E2EToken("tWETH", "tWETH", 18, address(this), 10_000e18);
        E2EToken usdc = new E2EToken("tUSDC", "tUSDC", 6, address(this), 10_000_000e6);
        (Currency c0, Currency c1) = address(usdc) < address(weth)
            ? (Currency.wrap(address(usdc)), Currency.wrap(address(weth)))
            : (Currency.wrap(address(weth)), Currency.wrap(address(usdc)));

        // Match Run #1 pool parameters when token0 = tUSDC (6 dp) and token1 = tWETH (18 dp)
        if (Currency.unwrap(c0) != address(usdc)) {
            // Ensure usdc address sorts below weth
            address lowAddr = address(0x0000000000000000000000000000000000000100);
            deployCodeTo(
                "E2ESandwich.s.sol:E2EToken",
                abi.encode("tUSDC", "tUSDC", uint8(6), address(this), uint256(10_000_000e6)),
                lowAddr
            );
            usdc = E2EToken(lowAddr);
            c0 = Currency.wrap(address(usdc));
            c1 = Currency.wrap(address(weth));
        }

        PoolKey memory key = PoolKey({
            currency0: c0,
            currency1: c1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(hookAddr)
        });
        int24 startTick = 196260;
        realManager.initialize(key, TickMath.getSqrtPriceAtTick(startTick));

        PoolModifyLiquidityTest lpRouter = new PoolModifyLiquidityTest(realManager);
        usdc.approve(address(lpRouter), type(uint256).max);
        weth.approve(address(lpRouter), type(uint256).max);
        lpRouter.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({
                tickLower: startTick - 1200,
                tickUpper: startTick + 1200,
                liquidityDelta: int256(uint256(2e15)),
                salt: bytes32(0)
            }),
            ""
        );

        PoolSwapTest searcherRouter = new PoolSwapTest(realManager);
        PoolSwapTest victimRouter = new PoolSwapTest(realManager);
        usdc.approve(address(searcherRouter), type(uint256).max);
        weth.approve(address(searcherRouter), type(uint256).max);
        usdc.approve(address(victimRouter), type(uint256).max);
        weth.approve(address(victimRouter), type(uint256).max);

        PoolSwapTest.TestSettings memory s = PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false});

        // 1. Frontrun: 200 tUSDC
        BalanceDelta d1 = searcherRouter.swap(
            key,
            IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -200e6, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            s,
            ""
        );
        // 2. Victim: 1,000 tUSDC
        victimRouter.swap(
            key,
            IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -1_000e6, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            s,
            ""
        );
        // 3. Backrun: sell exact tWETH bought in frontrun
        uint256 backrunIn = uint256(uint128(d1.amount1()));
        vm.expectEmit(true, true, true, false, hookAddr);
        emit ExtractionDetected(key.toId(), address(searcherRouter), address(victimRouter), 0, bytes32(0));

        BalanceDelta d3 = searcherRouter.swap(
            key,
            IPoolManager.SwapParams({zeroForOne: false, amountSpecified: -int256(backrunIn), sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1}),
            s,
            ""
        );

        int256 netProfit0 = int256(d1.amount0()) + int256(d3.amount0());
        assertEq(netProfit0, 2_428_787); // +2.428787 tUSDC exact Run #1 searcher profit
    }
}
