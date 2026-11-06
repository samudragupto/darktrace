// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {DarkTraceHook} from "../src/DarkTraceHook.sol";
import {SearcherRegistry} from "../src/SearcherRegistry.sol";

/**
 * @title DeployBaseSepoliaScript
 * @notice Salt-mining CREATE2 deployment script for DarkTraceHook and SearcherRegistry on Base Sepolia.
 */
contract DeployBaseSepoliaScript is Script {
    // Official Base Sepolia Uniswap v4 PoolManager deployment
    address public constant BASE_SEPOLIA_POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    int24 public constant DEFAULT_MIN_TICK_DELTA = 15;

    // Required hook permission flags: BEFORE_SWAP (bit 7) and AFTER_SWAP (bit 6)
    uint160 public constant REQUIRED_FLAGS = uint160((1 << 7) | (1 << 6)); // 0x00C0
    uint160 public constant HOOK_MASK = uint160((1 << 14) - 1); // 0x3FFF

    // Canonical CREATE2 Deployer used by Foundry on EVM networks
    address public constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external returns (address hookAddress, address registryAddress) {
        uint256 deployerPrivateKey = vm.envOr(
            "DEPLOYER_PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== DarkTrace Base Sepolia Deployment ===");
        console.log("Deployer:", deployer);
        console.log("PoolManager:", BASE_SEPOLIA_POOL_MANAGER);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy SearcherRegistry
        SearcherRegistry registry = new SearcherRegistry(deployer);
        registryAddress = address(registry);
        console.log("SearcherRegistry deployed at:", registryAddress);

        // 2. Mine CREATE2 salt for DarkTraceHook matching 0x00C0 flags
        bytes memory creationCode = type(DarkTraceHook).creationCode;
        bytes memory constructorArgs = abi.encode(
            IPoolManager(BASE_SEPOLIA_POOL_MANAGER),
            DEFAULT_MIN_TICK_DELTA,
            deployer
        );
        bytes memory bytecode = abi.encodePacked(creationCode, constructorArgs);
        bytes32 bytecodeHash = keccak256(bytecode);

        bytes32 minedSalt;
        address predictedAddress;
        bool found = false;

        for (uint256 i = 0; i < 100000; i++) {
            bytes32 salt = bytes32(i);
            // CREATE2 prediction formula from canonical Foundry CREATE2 deployer
            predictedAddress = address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                CREATE2_DEPLOYER,
                                salt,
                                bytecodeHash
                            )
                        )
                    )
                )
            );

            if ((uint160(predictedAddress) & HOOK_MASK) == REQUIRED_FLAGS) {
                minedSalt = salt;
                found = true;
                break;
            }
        }

        require(found, "Could not find salt matching 0x00C0 hook flags within 100k iterations");
        console.log("Found salt for 0x00C0 flags:", vm.toString(minedSalt));
        console.log("Target Hook Address:", predictedAddress);

        // 3. Deploy DarkTraceHook via CREATE2
        DarkTraceHook hook = new DarkTraceHook{salt: minedSalt}(
            IPoolManager(BASE_SEPOLIA_POOL_MANAGER),
            DEFAULT_MIN_TICK_DELTA,
            deployer
        );
        hookAddress = address(hook);
        require(hookAddress == predictedAddress, "Address mismatch");
        console.log("DarkTraceHook successfully deployed at:", hookAddress);

        vm.stopBroadcast();

        console.log("==========================================");
        console.log("Deployment verified on Base Sepolia.");
    }
}
