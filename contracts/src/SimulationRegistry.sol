// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title SimulationRegistry
 * @notice On-chain registry on Arc holding cryptographic attestations of counterfactual simulations.
 * @dev Sits between the off-chain Arc simulator worker and RebateVault.sol.
 *      v2+: every attestation names the `beneficiary` (sole claimant in RebateVault) and tracks
 *      an optional escrow dispute window (`disputeWindowSeconds`) and claim expiry (`claimExpirySeconds`).
 */
contract SimulationRegistry {
    address public owner;

    /// @notice Seconds after attestation before a rebate becomes claimable (0 = immediate).
    uint64 public disputeWindowSeconds;

    /// @notice Seconds after attestation (plus dispute window) before an unclaimed rebate expires.
    uint64 public claimExpirySeconds = 30 days;

    struct Attestation {
        bytes32 simulationHash;
        uint256 extractedUSDC; // 6 decimals
        uint64 blockNumber;
        bool exists;
        address beneficiary; // wallet that signed the victim swap; sole claimant in RebateVault
        uint64 attestedAt;
        uint64 claimableAt;
        uint64 expiresAt;
        bool disputed;
    }

    mapping(bytes32 => Attestation) public attestations;
    mapping(address => bool) public challengers;

    event SimulationRecorded(
        bytes32 indexed simulationHash,
        bytes32 indexed receiptHash,
        uint256 extractedUSDC,
        uint64 blockNumber,
        address indexed beneficiary
    );

    event DisputeWindowUpdated(uint64 oldWindowSeconds, uint64 newWindowSeconds);
    event ClaimExpiryUpdated(uint64 oldExpirySeconds, uint64 newExpirySeconds);
    event ChallengerUpdated(address indexed challenger, bool authorized);
    event AttestationDisputed(bytes32 indexed receiptHash, address indexed challenger, string reason);
    event DisputeResolved(bytes32 indexed receiptHash, bool upheld, uint256 finalUSDC);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error Unauthorized();
    error ZeroHash();
    error AlreadyRecorded();
    error ZeroAddress();
    error InvalidExpiry();
    error UnknownAttestation();
    error DisputeWindowClosed();
    error NotDisputed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyChallengerOrOwner() {
        if (msg.sender != owner && !challengers[msg.sender]) revert Unauthorized();
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
    }

    /**
     * @notice Records an attested simulation result for a forensic receipt hash.
     * @param beneficiary The victim wallet entitled to the restitution (only it can claim).
     */
    function recordSimulation(
        bytes32 simulationHash,
        bytes32 receiptHash,
        uint256 extractedUSDC,
        address beneficiary
    ) external onlyOwner {
        if (simulationHash == bytes32(0) || receiptHash == bytes32(0)) revert ZeroHash();
        if (beneficiary == address(0)) revert ZeroAddress();
        if (attestations[receiptHash].exists) revert AlreadyRecorded();

        uint64 nowTs = uint64(block.timestamp);
        uint64 claimableTs = nowTs + disputeWindowSeconds;
        uint64 expiryTs = claimableTs + claimExpirySeconds;

        attestations[receiptHash] = Attestation({
            simulationHash: simulationHash,
            extractedUSDC: extractedUSDC,
            blockNumber: uint64(block.number),
            exists: true,
            beneficiary: beneficiary,
            attestedAt: nowTs,
            claimableAt: claimableTs,
            expiresAt: expiryTs,
            disputed: false
        });

        emit SimulationRecorded(simulationHash, receiptHash, extractedUSDC, uint64(block.number), beneficiary);
    }

    /**
     * @notice Flags an attestation during its active dispute window, pausing claims until resolved.
     */
    function flagDispute(bytes32 receiptHash, string calldata reason) external onlyChallengerOrOwner {
        Attestation storage a = attestations[receiptHash];
        if (!a.exists) revert UnknownAttestation();
        if (uint64(block.timestamp) > a.claimableAt) revert DisputeWindowClosed();

        a.disputed = true;
        emit AttestationDisputed(receiptHash, msg.sender, reason);
    }

    /**
     * @notice Resolves a flagged attestation: either upholds it (with optional adjusted USDC amount)
     *         or revokes it completely.
     */
    function resolveDispute(bytes32 receiptHash, bool uphold, uint256 adjustedUSDC) external onlyOwner {
        Attestation storage a = attestations[receiptHash];
        if (!a.exists) revert UnknownAttestation();
        if (!a.disputed) revert NotDisputed();

        if (uphold) {
            a.disputed = false;
            a.extractedUSDC = adjustedUSDC;
            emit DisputeResolved(receiptHash, true, adjustedUSDC);
        } else {
            delete attestations[receiptHash];
            emit DisputeResolved(receiptHash, false, 0);
        }
    }

    function setDisputeWindow(uint64 newWindowSeconds) external onlyOwner {
        emit DisputeWindowUpdated(disputeWindowSeconds, newWindowSeconds);
        disputeWindowSeconds = newWindowSeconds;
    }

    function setClaimExpiry(uint64 newExpirySeconds) external onlyOwner {
        if (newExpirySeconds == 0) revert InvalidExpiry();
        emit ClaimExpiryUpdated(claimExpirySeconds, newExpirySeconds);
        claimExpirySeconds = newExpirySeconds;
    }

    function setChallenger(address challenger, bool authorized) external onlyOwner {
        if (challenger == address(0)) revert ZeroAddress();
        challengers[challenger] = authorized;
        emit ChallengerUpdated(challenger, authorized);
    }

    /**
     * @notice Returns attestation status and verified amount for a receipt hash.
     */
    function getAttestation(bytes32 receiptHash)
        external
        view
        returns (bool verified, uint256 amountUSDC, bytes32 simHash)
    {
        Attestation memory a = attestations[receiptHash];
        return (a.exists, a.extractedUSDC, a.simulationHash);
    }

    /**
     * @notice Returns escrow timing and dispute state for a receipt hash.
     */
    function getEscrowState(bytes32 receiptHash)
        external
        view
        returns (uint64 attestedAt, uint64 claimableAt, uint64 expiresAt, bool disputed)
    {
        Attestation memory a = attestations[receiptHash];
        return (a.attestedAt, a.claimableAt, a.expiresAt, a.disputed);
    }

    /**
     * @notice The only address allowed to claim the restitution for `receiptHash` (zero if unattested).
     */
    function beneficiaryOf(bytes32 receiptHash) external view returns (address) {
        return attestations[receiptHash].beneficiary;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
