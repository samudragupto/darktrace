// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {SimulationRegistry} from "../src/SimulationRegistry.sol";
import {RebateVault} from "../src/RebateVault.sol";

/**
 * @title DeployArcEscrowScript
 * @notice Deploys the Phase 3 Escrow Dispute Window + Claim Expiry SimulationRegistry and RebateVault
 *         on Arc Testnet and executes an on-chain escrow dispute/resolution lifecycle for verification.
 */
contract DeployArcEscrowScript is Script {
    address public constant ARC_USDC = 0x3600000000000000000000000000000000000000;
    address public constant VICTIM_BENEFICIARY = 0x524e061C89036b12a4f377bD8999038Da3A551Db;
    string constant OUT = "deployments/arc-v2-escrow.json";

    function run() external {
        vm.startBroadcast();
        address owner = msg.sender;

        // 1. Deploy upgraded SimulationRegistry & RebateVault (Dispute Window + Claim Expiry)
        SimulationRegistry registry = new SimulationRegistry(owner);
        RebateVault vault = new RebateVault(ARC_USDC, address(registry), owner);

        // 2. Exercise on-chain Dispute Window + Challenge + Resolution lifecycle
        registry.setDisputeWindow(300); // 5-minute escrow window
        bytes32 demoSimHash = keccak256("darktrace.arc.escrow.sim.v2");
        bytes32 demoReceiptHash = keccak256("darktrace.arc.escrow.receipt.v2");
        registry.recordSimulation(demoSimHash, demoReceiptHash, 1_250_000, VICTIM_BENEFICIARY);
        registry.flagDispute(demoReceiptHash, "escrow challenge verification");
        registry.resolveDispute(demoReceiptHash, true, 1_250_000);
        registry.setDisputeWindow(0);

        vm.stopBroadcast();

        console.log("SimulationRegistry (v2 Escrow + Expiry):", address(registry));
        console.log("RebateVault        (v2 Escrow + Expiry):", address(vault));
        console.log("Owner:                                  ", owner);

        string memory j = "arcescrow";
        vm.serializeAddress(j, "simulationRegistry", address(registry));
        vm.serializeAddress(j, "rebateVault", address(vault));
        string memory json = vm.serializeAddress(j, "owner", owner);
        vm.writeJson(json, OUT);
    }
}
