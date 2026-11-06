# Arc Studio prompt — DarkTrace RebateVault + SimulationRegistry (v2 Escrow & Claim Expiry)

Please generate two Solidity smart contracts and comprehensive Foundry unit and fuzz tests for an MEV restitution protocol on Arc Testnet (Chain ID 5042002):

---

## 1. Contract Specifications

### Contract 1: `SimulationRegistry`
An on-chain attestation registry that stores cryptographic commitments of off-chain counterfactual MEV simulations, binding each attestation to its victim `beneficiary` and enforcing a configurable escrow dispute window (`disputeWindowSeconds`) and claim expiry (`claimExpirySeconds`).
- **Compiler Version:** `pragma solidity 0.8.26;`
- **Ownership & Governance:** Ownable (`owner` set via constructor) with `transferOwnership(address newOwner) external onlyOwner` and authorized challengers (`mapping(address => bool) public challengers`).
- **Data Model:**
  ```solidity
  struct Attestation {
      bytes32 simulationHash;
      uint256 extractedUSDC; // 6 decimals
      uint64 blockNumber;
      bool exists;
      address beneficiary;   // sole claimant in RebateVault
      uint64 attestedAt;
      uint64 claimableAt;    // attestedAt + disputeWindowSeconds
      uint64 expiresAt;      // claimableAt + claimExpirySeconds
      bool disputed;
  }
  mapping(bytes32 => Attestation) public attestations;
  ```
- **Public API:**
  - `function recordSimulation(bytes32 simulationHash, bytes32 receiptHash, uint256 extractedUSDC, address beneficiary) external onlyOwner;`
    - Reverts with `ZeroHash()`, `ZeroAddress()`, or `AlreadyRecorded()`.
    - Computes `claimableAt = uint64(block.timestamp) + disputeWindowSeconds` and `expiresAt = claimableAt + claimExpirySeconds`.
    - Emits `SimulationRecorded(simulationHash, receiptHash, extractedUSDC, uint64(block.number), beneficiary)`.
  - `function flagDispute(bytes32 receiptHash, string calldata reason) external onlyChallengerOrOwner;`
    - Flags an attestation during its active dispute window (`block.timestamp <= claimableAt`), setting `disputed = true` and emitting `AttestationDisputed(receiptHash, msg.sender, reason)`.
  - `function resolveDispute(bytes32 receiptHash, bool uphold, uint256 adjustedUSDC) external onlyOwner;`
    - Either upholds the attestation with an adjusted USDC amount (`disputed = false`, `extractedUSDC = adjustedUSDC`) or deletes/revokes it.
  - `function getAttestation(bytes32 receiptHash) external view returns (bool verified, uint256 amountUSDC, bytes32 simHash);`
  - `function getEscrowState(bytes32 receiptHash) external view returns (uint64 attestedAt, uint64 claimableAt, uint64 expiresAt, bool disputed);`
  - `function beneficiaryOf(bytes32 receiptHash) external view returns (address);`

---

### Contract 2: `RebateVault`
A collateral vault on Arc holding native USDC (`0x3600000000000000000000000000000000000000`, 6 decimals) and distributing restitution exclusively to attested victim beneficiaries after the escrow dispute window and before claim expiry.
- **Compiler Version:** `pragma solidity 0.8.26;`
- **Security & Reentrancy:** `nonReentrant` modifier and strict Checks-Effects-Interactions (CEI).
- **State:**
  - `mapping(bytes32 => bool) public claimedReceipts;`
  - `mapping(bytes32 => bool) public expiredReceipts;`
  - `uint256 public totalClaimedUSDC;`
  - `uint256 public totalExpiredUSDC;`
- **Public API:**
  - `function claimRebate(bytes32 receiptHash, address recipient, uint256 amountUSDC, bytes calldata proofBundle) external nonReentrant;`
    - Reverts with `InvalidRecipient()`, `SelfPayoutBlocked()`, `AlreadyClaimed()`, `AlreadyExpired()`, `UnverifiedReceipt()`.
    - Reverts with `NotBeneficiary()` unless `msg.sender == simulationRegistry.beneficiaryOf(receiptHash)`.
    - Queries `simulationRegistry.getEscrowState(receiptHash)`:
      - Reverts with `AttestationDisputed()` if `disputed == true`.
      - Reverts with `DisputeWindowActive(claimableAt)` if `block.timestamp < claimableAt`.
      - Reverts with `ClaimExpired(expiresAt)` if `block.timestamp > expiresAt`.
    - Reverts with `AmountExceedsAttestation()` or `InsufficientVaultBalance()`.
    - Marks `claimedReceipts[receiptHash] = true` and increments `totalClaimedUSDC` before transferring USDC to `recipient`.
  - `function expireUnclaimedRebate(bytes32 receiptHash) external nonReentrant;`
    - Callable after `block.timestamp > expiresAt` if unclaimed; marks `expiredReceipts[receiptHash] = true`, increments `totalExpiredUSDC`, and emits `RebateExpiredToReserve(receiptHash, attestedAmount, usdc.balanceOf(address(this)))`.
  - `function depositFunds(uint256 amount) external;`
  - `function emergencyWithdraw(address to, uint256 amount) external onlyOwner nonReentrant;`

---

## 2. Test Suite Requirements
Generate full Foundry unit and fuzz tests covering:
1. **Beneficiary-Only Claim:** Victim EOA claims `142.50 USDC`; any non-beneficiary caller (including attacker or admin) reverts with `NotBeneficiary()`.
2. **Escrow Dispute Window:** Early claims revert with `DisputeWindowActive(claimableAt)`; challenger flags pause claims with `AttestationDisputed()`; owner resolution upholds or revokes.
3. **Claim Expiry & Reserve Recycling:** Post-expiry claims revert with `ClaimExpired(expiresAt)` and `expireUnclaimedRebate` recycles the unclaimed rebate to the active reserve (`totalExpiredUSDC`).
4. **Double-Claim & Amount Cap Prevention:** Replays revert with `AlreadyClaimed()`; over-claims revert with `AmountExceedsAttestation()`.
