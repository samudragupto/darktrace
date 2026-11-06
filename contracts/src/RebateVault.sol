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
 *      v2: only the attestation's `beneficiary` may claim; it chooses where the USDC is sent.
 */
contract RebateVault {
    IERC20Minimal public immutable usdc;
    SimulationRegistry public immutable simulationRegistry;
    address public owner;

    uint256 private _status;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    mapping(bytes32 => bool) public claimedReceipts;

    event RebateClaimed(bytes32 indexed receiptHash, address indexed recipient, uint256 amountUSDC);
    event FundsDeposited(address indexed sender, uint256 amount);
    event EmergencyWithdrawn(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error ReentrancyGuardReentrantCall();
    error AlreadyClaimed();
    error UnverifiedReceipt();
    error NotBeneficiary();
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
     *      so knowing a receipt hash is not enough to take its rebate.
     * @param receiptHash Cryptographic identifier of the ExtractionReceipt.
     * @param recipient Address the beneficiary wants the USDC sent to (e.g. itself or a fresh wallet).
     * @param amountUSDC Amount requested (must not exceed attested extracted value).
     * @param proofBundle Optional cryptographic payload for auditing.
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

        (bool verified, uint256 attestedAmount, ) = simulationRegistry.getAttestation(receiptHash);
        if (!verified) revert UnverifiedReceipt();
        if (msg.sender != simulationRegistry.beneficiaryOf(receiptHash)) revert NotBeneficiary();
        if (amountUSDC > attestedAmount) revert AmountExceedsAttestation();

        if (usdc.balanceOf(address(this)) < amountUSDC) revert InsufficientVaultBalance();

        // Mark receipt as claimed before external call (Checks-Effects-Interactions)
        claimedReceipts[receiptHash] = true;

        bool success = usdc.transfer(recipient, amountUSDC);
        if (!success) revert TransferFailed();

        emit RebateClaimed(receiptHash, recipient, amountUSDC);
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
