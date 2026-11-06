// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {SimulationRegistry} from "./SimulationRegistry.sol";

interface IERC20Minimal {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title RebateVault
 * @notice Restitution settlement vault on Arc Testnet holding USDC collateral.
 * @dev Distributes restitution to victim LPs verified against SimulationRegistry attestations.
 *      Enforces:
 *        - Beneficiary-only claims (`NotBeneficiary`)
 *        - Escrow dispute window (`DisputeWindowActive`, `AttestationDisputed`)
 *        - Claim expiry & on-chain reserve recycling (`ClaimExpired`, `expireUnclaimedRebate`)
 */
contract RebateVault {
    IERC20Minimal public immutable usdc;
    SimulationRegistry public immutable simulationRegistry;
    address public owner;

    uint256 private _status;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    mapping(bytes32 => bool) public claimedReceipts;
    mapping(bytes32 => bool) public expiredReceipts;

    /// @notice Cumulative USDC paid out to victim beneficiaries.
    uint256 public totalClaimedUSDC;

    /// @notice Cumulative USDC from expired attestations returned to the active vault reserve.
    uint256 public totalExpiredUSDC;

    event RebateClaimed(bytes32 indexed receiptHash, address indexed recipient, uint256 amountUSDC);
    event RebateExpiredToReserve(bytes32 indexed receiptHash, uint256 expiredAmountUSDC, uint256 vaultReserveUSDC);
    event FundsDeposited(address indexed sender, uint256 amount);
    event EmergencyWithdrawn(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error ReentrancyGuardReentrantCall();
    error AlreadyClaimed();
    error AlreadyExpired();
    error UnverifiedReceipt();
    error NotBeneficiary();
    error DisputeWindowActive(uint64 claimableAt);
    error AttestationDisputed();
    error ClaimExpired(uint64 expiresAt);
    error ClaimNotYetExpired(uint64 expiresAt);
    error AmountExceedsAttestation();
    error InvalidRecipient();
    error SelfPayoutBlocked();
    error InsufficientVaultBalance();
    error TransferFailed();
    error Unauthorized();
    error ZeroAddress();

    modifier nonReentrant() {
        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(address _usdc, address _simulationRegistry, address initialOwner) {
        if (_usdc == address(0) || _simulationRegistry == address(0) || initialOwner == address(0)) {
            revert ZeroAddress();
        }
        usdc = IERC20Minimal(_usdc);
        simulationRegistry = SimulationRegistry(_simulationRegistry);
        owner = initialOwner;
        _status = _NOT_ENTERED;
    }

    /**
     * @notice Lets the attested victim claim USDC restitution against a forensic receipt.
     * @dev Reverts with NotBeneficiary unless msg.sender is the beneficiary recorded in SimulationRegistry,
     *      with DisputeWindowActive / AttestationDisputed during an active or flagged escrow window,
     *      and with ClaimExpired if the claim window has elapsed.
     */
    function claimRebate(
        bytes32 receiptHash,
        address recipient,
        uint256 amountUSDC,
        bytes calldata proofBundle
    ) external nonReentrant {
        if (proofBundle.length > 0) {
            // Optional proof payload verification hook
        }
        if (recipient == address(0)) revert InvalidRecipient();
        if (recipient == address(this)) revert SelfPayoutBlocked();
        if (claimedReceipts[receiptHash]) revert AlreadyClaimed();
        if (expiredReceipts[receiptHash]) revert AlreadyExpired();

        (bool verified, uint256 attestedAmount, ) = simulationRegistry.getAttestation(receiptHash);
        if (!verified) revert UnverifiedReceipt();
        if (msg.sender != simulationRegistry.beneficiaryOf(receiptHash)) revert NotBeneficiary();

        (, uint64 claimableAt, uint64 expiresAt, bool disputed) = simulationRegistry.getEscrowState(receiptHash);
        if (disputed) revert AttestationDisputed();
        if (uint64(block.timestamp) < claimableAt) revert DisputeWindowActive(claimableAt);
        if (expiresAt != 0 && uint64(block.timestamp) > expiresAt) revert ClaimExpired(expiresAt);

        if (amountUSDC > attestedAmount) revert AmountExceedsAttestation();
        if (usdc.balanceOf(address(this)) < amountUSDC) revert InsufficientVaultBalance();

        // Mark receipt as claimed before external call (Checks-Effects-Interactions)
        claimedReceipts[receiptHash] = true;
        totalClaimedUSDC += amountUSDC;

        bool success = usdc.transfer(recipient, amountUSDC);
        if (!success) revert TransferFailed();

        emit RebateClaimed(receiptHash, recipient, amountUSDC);
    }

    /**
     * @notice Recycles an unclaimed attestation back to the vault's active USDC reserve after `expiresAt`.
     */
    function expireUnclaimedRebate(bytes32 receiptHash) external nonReentrant {
        if (claimedReceipts[receiptHash]) revert AlreadyClaimed();
        if (expiredReceipts[receiptHash]) revert AlreadyExpired();

        (bool verified, uint256 attestedAmount, ) = simulationRegistry.getAttestation(receiptHash);
        if (!verified) revert UnverifiedReceipt();

        (, , uint64 expiresAt, ) = simulationRegistry.getEscrowState(receiptHash);
        if (expiresAt == 0 || uint64(block.timestamp) <= expiresAt) revert ClaimNotYetExpired(expiresAt);

        expiredReceipts[receiptHash] = true;
        totalExpiredUSDC += attestedAmount;

        emit RebateExpiredToReserve(receiptHash, attestedAmount, usdc.balanceOf(address(this)));
    }

    /**
     * @notice Deposit USDC funds into the RebateVault.
     */
    function depositFunds(uint256 amount) external {
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();
        emit FundsDeposited(msg.sender, amount);
    }

    /**
     * @notice Emergency administrative withdrawal of unused vault funds.
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        bool success = usdc.transfer(to, amount);
        if (!success) revert TransferFailed();
        emit EmergencyWithdrawn(to, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
