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
    address public attacker = address(0xBAD);

    bytes32 public constant SAMPLE_SIM_HASH = keccak256("simulation.sample.123");
    bytes32 public constant SAMPLE_RECEIPT_HASH = keccak256("receipt.sample.456");
    uint256 public constant ATTESTED_USDC = 142_500_000; // 142.50 USDC (6 decimals)
    uint256 public constant VAULT_FUNDS = 10_000_000_000; // 10,000 USDC

    function setUp() public {
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

    // ── The fixed vulnerability: knowing a receipt hash is not enough ──────────

    function test_RevertWhen_AttackerClaimsToThemselves() public {
        _attest();
        vm.prank(attacker);
        vm.expectRevert(RebateVault.NotBeneficiary.selector);
        vault.claimRebate(SAMPLE_RECEIPT_HASH, attacker, ATTESTED_USDC, "");
        assertEq(usdc.balanceOf(attacker), 0);
        assertFalse(vault.claimedReceipts(SAMPLE_RECEIPT_HASH));
    }

    function test_RevertWhen_AttackerClaimsOnBehalfOfVictim() public {
        // Even paying the victim, a third party cannot burn the victim's one-time claim.
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
        // An attacker cannot name themselves beneficiary of a fresh attestation either.
        vm.prank(attacker);
        vm.expectRevert(SimulationRegistry.Unauthorized.selector);
        registry.recordSimulation(SAMPLE_SIM_HASH, SAMPLE_RECEIPT_HASH, ATTESTED_USDC, attacker);
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
