// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title SimulationRegistry
 * @notice On-chain registry on Arc holding cryptographic attestations of counterfactual simulations.
 * @dev Sits between the off-chain Arc simulator worker and RebateVault.sol.
 *      v2: every attestation names the `beneficiary`, the only address RebateVault lets claim it.
 */
contract SimulationRegistry {
    address public owner;

    struct Attestation {
        bytes32 simulationHash;
        uint256 extractedUSDC; // 6 decimals
        uint64 blockNumber;
        bool exists;
        address beneficiary; // wallet that signed the victim swap; sole claimant in RebateVault
    }

    mapping(bytes32 => Attestation) public attestations;

    event SimulationRecorded(
        bytes32 indexed simulationHash,
        bytes32 indexed receiptHash,
        uint256 extractedUSDC,
        uint64 blockNumber,
        address indexed beneficiary
    );

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error Unauthorized();
    error ZeroHash();
    error AlreadyRecorded();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
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

        attestations[receiptHash] = Attestation({
            simulationHash: simulationHash,
            extractedUSDC: extractedUSDC,
            blockNumber: uint64(block.number),
            exists: true,
            beneficiary: beneficiary
        });

        emit SimulationRecorded(simulationHash, receiptHash, extractedUSDC, uint64(block.number), beneficiary);
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
