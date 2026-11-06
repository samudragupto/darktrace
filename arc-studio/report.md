# Arc Studio deployment record

- **Studio project URL:** [https://studio.arc.io/app/c3240360-99a1-4a97-b03e-5e547be78a32](https://studio.arc.io/app/c3240360-99a1-4a97-b03e-5e547be78a32?thread=c19d8800-048f-459f-8329-54f1e7b50d34) (Project: DarkTrace MEV Restitution)
- **SimulationRegistry (Studio):** `0x52794Da13E573c9e73D32248a286843418Ba2983`
  - Explorer: [https://explorer.testnet.arc.io/address/0x52794Da13E573c9e73D32248a286843418Ba2983](https://explorer.testnet.arc.io/address/0x52794Da13E573c9e73D32248a286843418Ba2983)
- **RebateVault (Studio):** `0x676065eb7c72ddf2048f21e6cb2ca6721827c1de`
  - Explorer: [https://explorer.testnet.arc.io/address/0x676065eb7c72ddf2048f21e6cb2ca6721827c1de](https://explorer.testnet.arc.io/address/0x676065eb7c72ddf2048f21e6cb2ca6721827c1de)
- **Deployer / Owner:** `0x5B12Ce46C7194aD57d143bC22847224047b1Ef42`
- **Arc Native USDC:** `0x3600000000000000000000000000000000000000`
- **Test suite results inside Studio:** **60 passing** (unit, fuzz, invariant, reentrancy)
- **Foundry v2 deployment (active settlement):**
  - `SimulationRegistry` v2: `0xd501D47b246438A18C8a0BFFCF10338CfBB661a2` ([Explorer](https://explorer.testnet.arc.io/address/0xd501D47b246438A18C8a0BFFCF10338CfBB661a2))
  - `RebateVault` v2: `0x238dE56E52A3F6C6708952052e6a20E5102b4d5b` ([Explorer](https://explorer.testnet.arc.io/address/0x238dE56E52A3F6C6708952052e6a20E5102b4d5b), funded with `1.428417 USDC` migrated from v1 in tx `0xb8ac54e9d1c3cd73804330d6fe0e67f5712056768a9d7ca8b36089c13e3d36fa`, topped up to `5.00 USDC` in tx `0x001aa60f8d4338aa66c25ff981d6c960b17e6f11bcaa9dcc2b61693ad55563de`, paid `3.539977 USDC` in Verified Run #2 tx `0xb72bd280acafa1f1cec3f6738066070e1bc0940408348ed530fb54b39df1fd00`)
- **Foundry v2 Escrow + Claim Expiry deployment (Phase 3 advanced stablecoin logic):**
  - `SimulationRegistry` (v2 Escrow + Expiry): `0x31d51d7d05CE62030CBABF57D0f5376b86C70E77` ([Explorer](https://explorer.testnet.arc.io/address/0x31d51d7d05CE62030CBABF57D0f5376b86C70E77), deploy tx `0x9ee632790f62f36e0c2238af48a4cc5bf3d3a02170a26fc8c757631974dc6eb5`)
  - `RebateVault` (v2 Escrow + Expiry): `0x0897Cc21DaD8aC9Fe5Deb4971e2f8c390E7BE104` ([Explorer](https://explorer.testnet.arc.io/address/0x0897Cc21DaD8aC9Fe5Deb4971e2f8c390E7BE104), deploy tx `0x6c0f3daa5ca7529078f2fc186107616c47db43be36bc4c59f951e07d7ff1c08c`)
  - **On-chain Escrow Challenge & Resolution Proof:**
    1. `setDisputeWindow(300)` (`5 min` escrow challenge window): tx [`0x5f858712f594e689444cdbe11ba57e1742af70afbd01f73ef1ff3946230f3d34`](https://explorer.testnet.arc.io/tx/0x5f858712f594e689444cdbe11ba57e1742af70afbd01f73ef1ff3946230f3d34)
    2. `recordSimulation` (`1.25 USDC` to `0x524e…51Db`): tx [`0xa33e49ff3c6b7230024a5756ac10dbcc51aa32a617efcbfc82e741f53b34c270`](https://explorer.testnet.arc.io/tx/0xa33e49ff3c6b7230024a5756ac10dbcc51aa32a617efcbfc82e741f53b34c270)
    3. `flagDispute` (`"escrow challenge verification"`): tx [`0x0915cb01c4c655e6d219d6c31c6b67edbd0d6eb8d12743aae1b81cfb55daba60`](https://explorer.testnet.arc.io/tx/0x0915cb01c4c655e6d219d6c31c6b67edbd0d6eb8d12743aae1b81cfb55daba60)
    4. `resolveDispute(receiptHash, true, 1250000)` (upheld & unpaused): tx [`0x8aa763876c395f41829a1e5ffcfbe1acda5d567401615f2669b20fa96f91801d`](https://explorer.testnet.arc.io/tx/0x8aa763876c395f41829a1e5ffcfbe1acda5d567401615f2669b20fa96f91801d)
    5. `setDisputeWindow(0)` (instant settlement restored): tx [`0x90b6eede38cb15d80ed6651fed78f134e5e8c653e3b8af7f2ba3fda29e688203`](https://explorer.testnet.arc.io/tx/0x90b6eede38cb15d80ed6651fed78f134e5e8c653e3b8af7f2ba3fda29e688203)
- **Foundry v1 deployment (retired — used by Verified Run #1):**
  - `SimulationRegistry` v1: `0xb8416cb4d82BA72b70C3EC55d7AC66b5DB415CF8` (attested `3.571583 USDC` in tx `0x50ab85caa05a7e52e9b9e5b498faf8c67981c1ba013060a068f7ef43cfd9eec9`)
  - `RebateVault` v1: `0x2ab745F51002Ce236A9A2dA81cDaA553B87f28CD` (funded with 5.00 USDC via tx `0x4289870dba2b919eac9e654e853ff45f38a03bb9a66e0be3d6da8d8e07deab9d`; paid `3.571583 USDC` in tx `0x4202622d97af28edd3439a8f3f5ab773524755362357aa22d4c6bfb100a4963f`; remaining `1.428417 USDC` withdrawn in tx `0xacb28962d8b908e7a74ecea07f0fb036dfa4b694dba63fac1e47a89eb755c503`)
- **Why the live app settles on Foundry v2 (`0xd501…61a2` / `0x238d…4d5b`) rather than the Studio custodial deployment (`0x5279…` / `0x6760…`):**
  - Arc Studio's cloud environment deploys from an internal custodial address (`0x5B12Ce46C7194aD57d143bC22847224047b1Ef42`) whose private key cannot be exported and which does not expose an interactive post-deploy console to call `transferOwnership(0xb491fe5846DE735B6Cb03a677A3C6296FAB0aDA5)`.
  - Because `SimulationRegistry.recordSimulation` is `onlyOwner`, the live DarkTrace indexer (`0xb491…aDA5`) settles on our self-custodied Foundry v2 deployment (`0xd501D47b246438A18C8a0BFFCF10338CfBB661a2` / `0x238dE56E52A3F6C6708952052e6a20E5102b4d5b`) while keeping [`arc-studio/prompt.md`](prompt.md) synchronized with all v2 Escrow Dispute Window and Claim Expiry invariants (`19/19` Foundry `RebateVaultTest` tests passing).
