// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {RebateVault} from "../src/RebateVault.sol";
import {SimulationRegistry} from "../src/SimulationRegistry.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract RebateVaultTest is Test {
    MockUSDC public usdc;
    SimulationRegistry public registry;
    RebateVault public vault;

    address public admin = address(0xAA);
    address public victimLP = address(0xBB);
    address public challenger = address(0xCC);
    address public attacker = address(0xBAD);

    bytes32 public constant SAMPLE_SIM_HASH = keccak256("simulation.sample.123");
    bytes32 public constant SAMPLE_RECEIPT_HASH = keccak256("receipt.sample.456");
    uint256 public constant ATTESTED_USDC = 142_500_000; // 142.50 USDC (6 decimals)
    uint256 public constant VAULT_FUNDS = 10_000_000_000; // 10,000 USDC

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new MockUSDC();
        registry = new SimulationRegistry(admin);
        vault = new RebateVault(address(usdc), address(registry), admin);
        usdc.mint(address(vault), VAULT_FUNDS);
    }

    function _attest() internal {
        vm.prank(admin);
        registry.recordSimulation(SAMPLE_SIM_HASH, SAMPLE_RECEIPT_HASH, ATTESTED_USDC, victimLP);
    }

    // ── Happy paths ────────────────────────────────────────────────────────────

    function test_HappyPathClaim() public {
        _attest();
        vm.prank(victimLP);
        vault.claimRebate(SAMPLE_RECEIPT_HASH, victimLP, ATTESTED_USDC, "");

        assertEq(usdc.balanceOf(victimLP), ATTESTED_USDC);
        assertEq(usdc.balanceOf(address(vault)), VAULT_FUNDS - ATTESTED_USDC);
        assertEq(vault.totalClaimedUSDC(), ATTESTED_USDC);
        assertTrue(vault.claimedReceipts(SAMPLE_RECEIPT_HASH));
    }

    function test_BeneficiaryCanRouteToAnotherWallet() public {
        _attest();
        address freshWallet = address(0xF00D);
        vm.prank(victimLP);
        vault.claimRebate(SAMPLE_RECEIPT_HASH, freshWallet, ATTESTED_USDC, "");
        assertEq(usdc.balanceOf(freshWallet), ATTESTED_USDC);
    }

    function test_RegistryRecordsBeneficiary() public {
        _attest();
        assertEq(registry.beneficiaryOf(SAMPLE_RECEIPT_HASH), victimLP);
        assertEq(registry.beneficiaryOf(keccak256("unknown")), address(0));
    }

    // ── Beneficiary-only access control ────────────────────────────────────────

    function test_RevertWhen_AttackerClaimsToThemselves() public {
        _attest();
        vm.prank(attacker);
        vm.expectRevert(RebateVault.NotBeneficiary.selector);
        vault.claimRebate(SAMPLE_RECEIPT_HASH, attacker, ATTESTED_USDC, "");
        assertEq(usdc.balanceOf(attacker), 0);
        assertFalse(vault.claimedReceipts(SAMPLE_RECEIPT_HASH));
    }

    function test_RevertWhen_AttackerClaimsOnBehalfOfVictim() public {
        _attest();
        vm.prank(attacker);
        vm.expectRevert(RebateVault.NotBeneficiary.selector);
        vault.claimRebate(SAMPLE_RECEIPT_HASH, victimLP, 1, "");
        assertFalse(vault.claimedReceipts(SAMPLE_RECEIPT_HASH));
    }

    function test_RevertWhen_OwnerClaimsAsNonBeneficiary() public {
        _attest();
        vm.prank(admin);
        vm.expectRevert(RebateVault.NotBeneficiary.selector);
        vault.claimRebate(SAMPLE_RECEIPT_HASH, admin, ATTESTED_USDC, "");
    }

    function testFuzz_OnlyBeneficiaryCanClaim(address caller) public {
        vm.assume(caller != victimLP);
        _attest();
        vm.prank(caller);
        vm.expectRevert(RebateVault.NotBeneficiary.selector);
        vault.claimRebate(SAMPLE_RECEIPT_HASH, caller == address(0) ? address(1) : caller, ATTESTED_USDC, "");
        assertEq(usdc.balanceOf(address(vault)), VAULT_FUNDS);
    }

    function test_RevertWhen_RecordingZeroBeneficiary() public {
        vm.prank(admin);
        vm.expectRevert(SimulationRegistry.ZeroAddress.selector);
        registry.recordSimulation(SAMPLE_SIM_HASH, SAMPLE_RECEIPT_HASH, ATTESTED_USDC, address(0));
    }

    function test_RevertWhen_NonOwnerAttests() public {
        vm.prank(attacker);
        vm.expectRevert(SimulationRegistry.Unauthorized.selector);
        registry.recordSimulation(SAMPLE_SIM_HASH, SAMPLE_RECEIPT_HASH, ATTESTED_USDC, attacker);
    }

    // ── Advanced USDC Feature 1: Escrow Dispute Window ─────────────────────────

    function test_DisputeWindow_BlocksEarlyClaimThenSucceedsAfterWindow() public {
        vm.prank(admin);
        registry.setDisputeWindow(10 minutes);

        _attest();
        uint64 expectedClaimableAt = uint64(block.timestamp) + 10 minutes;

        // Claim before dispute window elapses reverts with DisputeWindowActive
        vm.warp(block.timestamp + 5 minutes);
        vm.prank(victimLP);
        vm.expectRevert(abi.encodeWithSelector(RebateVault.DisputeWindowActive.selector, expectedClaimableAt));
        vault.claimRebate(SAMPLE_RECEIPT_HASH, victimLP, ATTESTED_USDC, "");

        // Claim after dispute window elapses succeeds
        vm.warp(expectedClaimableAt);
        vm.prank(victimLP);
        vault.claimRebate(SAMPLE_RECEIPT_HASH, victimLP, ATTESTED_USDC, "");
        assertEq(usdc.balanceOf(victimLP), ATTESTED_USDC);
    }

    function test_DisputeWindow_ChallengerFlagsAndOwnerUpholdsWithAdjustedAmount() public {
        vm.startPrank(admin);
        registry.setDisputeWindow(15 minutes);
        registry.setChallenger(challenger, true);
        registry.recordSimulation(SAMPLE_SIM_HASH, SAMPLE_RECEIPT_HASH, ATTESTED_USDC, victimLP);
        vm.stopPrank();

        // Challenger flags attestation during the window
        vm.prank(challenger);
        registry.flagDispute(SAMPLE_RECEIPT_HASH, "slippage reserve mismatch");

        // Even after window elapses, disputed attestation cannot be claimed until resolved
        vm.warp(block.timestamp + 20 minutes);
        vm.prank(victimLP);
        vm.expectRevert(RebateVault.AttestationDisputed.selector);
        vault.claimRebate(SAMPLE_RECEIPT_HASH, victimLP, ATTESTED_USDC, "");

        // Owner resolves dispute upholding a corrected amount (100 USDC)
        uint256 correctedUSDC = 100_000_000;
        vm.prank(admin);
        registry.resolveDispute(SAMPLE_RECEIPT_HASH, true, correctedUSDC);

        vm.prank(victimLP);
        vault.claimRebate(SAMPLE_RECEIPT_HASH, victimLP, correctedUSDC, "");
        assertEq(usdc.balanceOf(victimLP), correctedUSDC);
    }

    function test_DisputeWindow_ChallengerFlagsAndOwnerRevokes() public {
        vm.startPrank(admin);
        registry.setDisputeWindow(15 minutes);
        registry.setChallenger(challenger, true);
        registry.recordSimulation(SAMPLE_SIM_HASH, SAMPLE_RECEIPT_HASH, ATTESTED_USDC, victimLP);
        vm.stopPrank();

        vm.prank(challenger);
        registry.flagDispute(SAMPLE_RECEIPT_HASH, "false positive");

        vm.prank(admin);
        registry.resolveDispute(SAMPLE_RECEIPT_HASH, false, 0);

        vm.warp(block.timestamp + 20 minutes);
        vm.prank(victimLP);
        vm.expectRevert(RebateVault.UnverifiedReceipt.selector);
        vault.claimRebate(SAMPLE_RECEIPT_HASH, victimLP, ATTESTED_USDC, "");
    }

    function test_RevertWhen_UnauthorizedChallengerFlags() public {
        vm.prank(admin);
        registry.setDisputeWindow(15 minutes);
        _attest();

        vm.prank(attacker);
        vm.expectRevert(SimulationRegistry.Unauthorized.selector);
        registry.flagDispute(SAMPLE_RECEIPT_HASH, "spam");
    }

    // ── Advanced USDC Feature 2: Claim Expiry & Reserve Recycling ──────────────

    function test_ClaimExpiry_RevertsAfterExpiryAndRecyclesToReserve() public {
        vm.prank(admin);
        registry.setClaimExpiry(7 days);

        _attest();
        uint64 expectedExpiresAt = uint64(block.timestamp) + 7 days;

        // Before expiry, expireUnclaimedRebate reverts
        vm.warp(block.timestamp + 3 days);
        vm.expectRevert(abi.encodeWithSelector(RebateVault.ClaimNotYetExpired.selector, expectedExpiresAt));
        vault.expireUnclaimedRebate(SAMPLE_RECEIPT_HASH);

        // After expiry, victim claim reverts with ClaimExpired
        vm.warp(expectedExpiresAt + 1);
        vm.prank(victimLP);
        vm.expectRevert(abi.encodeWithSelector(RebateVault.ClaimExpired.selector, expectedExpiresAt));
        vault.claimRebate(SAMPLE_RECEIPT_HASH, victimLP, ATTESTED_USDC, "");

        // Recycling unclaimed rebate updates totalExpiredUSDC and marks receipt expired
        vault.expireUnclaimedRebate(SAMPLE_RECEIPT_HASH);
        assertTrue(vault.expiredReceipts(SAMPLE_RECEIPT_HASH));
        assertEq(vault.totalExpiredUSDC(), ATTESTED_USDC);
        assertEq(usdc.balanceOf(address(vault)), VAULT_FUNDS);

        // Cannot expire twice
        vm.expectRevert(RebateVault.AlreadyExpired.selector);
        vault.expireUnclaimedRebate(SAMPLE_RECEIPT_HASH);
    }

    function testFuzz_DisputeAndExpiryLifecycle(uint32 windowSec, uint32 expirySec, uint32 claimOffsetSec) public {
        uint64 win = uint64(bound(windowSec, 60, 1 days));
        uint64 exp = uint64(bound(expirySec, 1 hours, 30 days));
        uint64 offset = uint64(bound(claimOffsetSec, 0, 40 days));

        vm.startPrank(admin);
        registry.setDisputeWindow(win);
        registry.setClaimExpiry(exp);
        registry.recordSimulation(SAMPLE_SIM_HASH, SAMPLE_RECEIPT_HASH, ATTESTED_USDC, victimLP);
        vm.stopPrank();

        uint64 startTs = uint64(block.timestamp);
        uint64 claimableAt = startTs + win;
        uint64 expiresAt = claimableAt + exp;

        vm.warp(startTs + offset);
        vm.prank(victimLP);
        if (startTs + offset < claimableAt) {
            vm.expectRevert(abi.encodeWithSelector(RebateVault.DisputeWindowActive.selector, claimableAt));
            vault.claimRebate(SAMPLE_RECEIPT_HASH, victimLP, ATTESTED_USDC, "");
        } else if (startTs + offset > expiresAt) {
            vm.expectRevert(abi.encodeWithSelector(RebateVault.ClaimExpired.selector, expiresAt));
            vault.claimRebate(SAMPLE_RECEIPT_HASH, victimLP, ATTESTED_USDC, "");
        } else {
            vault.claimRebate(SAMPLE_RECEIPT_HASH, victimLP, ATTESTED_USDC, "");
            assertEq(usdc.balanceOf(victimLP), ATTESTED_USDC);
        }
    }

    // ── Existing guards still hold ─────────────────────────────────────────────

    function test_RevertWhen_ReplayClaim() public {
        _attest();
        vm.prank(victimLP);
        vault.claimRebate(SAMPLE_RECEIPT_HASH, victimLP, ATTESTED_USDC, "");

        vm.prank(victimLP);
        vm.expectRevert(RebateVault.AlreadyClaimed.selector);
        vault.claimRebate(SAMPLE_RECEIPT_HASH, victimLP, ATTESTED_USDC, "");
    }

    function test_RevertWhen_SelfPayout() public {
        _attest();
        vm.prank(victimLP);
        vm.expectRevert(RebateVault.SelfPayoutBlocked.selector);
        vault.claimRebate(SAMPLE_RECEIPT_HASH, address(vault), ATTESTED_USDC, "");
    }

    function test_RevertWhen_UnverifiedReceipt() public {
        vm.prank(victimLP);
        vm.expectRevert(RebateVault.UnverifiedReceipt.selector);
        vault.claimRebate(keccak256("fake.receipt.hash"), victimLP, ATTESTED_USDC, "");
    }

    function test_RevertWhen_ClaimExceedsAttestation() public {
        _attest();
        vm.prank(victimLP);
        vm.expectRevert(RebateVault.AmountExceedsAttestation.selector);
        vault.claimRebate(SAMPLE_RECEIPT_HASH, victimLP, ATTESTED_USDC + 1, "");
    }
}
