// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {SimulationRegistry} from "../src/SimulationRegistry.sol";
import {RebateVault} from "../src/RebateVault.sol";

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

/**
 * @title DeployArcV2Script
 * @notice Deploys the beneficiary-gated SimulationRegistry + RebateVault (v2) on Arc Testnet and moves
 *         the remaining USDC reserve out of the v1 vault (whose claims were not caller-restricted).
 * @dev Run with the owner of the v1 vault (the DarkTrace writer wallet 0xb491…aDA5):
 *      forge script script/DeployArcV2.s.sol:DeployArcV2Script --rpc-url https://rpc.testnet.arc.network \
 *        --private-key $PRIVATE_KEY --broadcast --slow
 *      Set MIGRATE=false to deploy without moving funds.
 */
contract DeployArcV2Script is Script {
    address public constant ARC_USDC = 0x3600000000000000000000000000000000000000;
    address public constant V1_VAULT = 0x2ab745F51002Ce236A9A2dA81cDaA553B87f28CD;
    string constant OUT = "deployments/arc-v2.json";

    function run() external returns (address registryV2, address vaultV2) {
        bool migrate = vm.envOr("MIGRATE", true);

        vm.startBroadcast();
        address owner = msg.sender;

        SimulationRegistry registry = new SimulationRegistry(owner);
        RebateVault vault = new RebateVault(ARC_USDC, address(registry), owner);
        registryV2 = address(registry);
        vaultV2 = address(vault);

        uint256 moved;
        if (migrate) {
            moved = IERC20(ARC_USDC).balanceOf(V1_VAULT);
            if (moved > 0) {
                RebateVault(V1_VAULT).emergencyWithdraw(owner, moved);
                IERC20(ARC_USDC).approve(vaultV2, moved);
                vault.depositFunds(moved);
            }
        }
        vm.stopBroadcast();

        console.log("SimulationRegistry v2:", registryV2);
        console.log("RebateVault v2:       ", vaultV2);
        console.log("USDC moved from v1 (raw):", moved);

        string memory j = "arcv2";
        vm.serializeAddress(j, "simulationRegistry", registryV2);
        vm.serializeAddress(j, "rebateVault", vaultV2);
        vm.serializeUint(j, "migratedUSDC", moved);
        string memory json = vm.serializeAddress(j, "owner", owner);
        vm.writeJson(json, OUT);
    }
}
