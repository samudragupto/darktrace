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
  - `RebateVault` v2: `0x238dE56E52A3F6C6708952052e6a20E5102b4d5b` ([Explorer](https://explorer.testnet.arc.io/address/0x238dE56E52A3F6C6708952052e6a20E5102b4d5b), funded with `1.428417 USDC` migrated from v1 in tx `0xb8ac54e9d1c3cd73804330d6fe0e67f5712056768a9d7ca8b36089c13e3d36fa`)
- **Foundry v1 deployment (retired — used by Verified Run #1):**
  - `SimulationRegistry` v1: `0xb8416cb4d82BA72b70C3EC55d7AC66b5DB415CF8` (attested `3.571583 USDC` in tx `0x50ab85caa05a7e52e9b9e5b498faf8c67981c1ba013060a068f7ef43cfd9eec9`)
  - `RebateVault` v1: `0x2ab745F51002Ce236A9A2dA81cDaA553B87f28CD` (funded with 5.00 USDC via tx `0x4289870dba2b919eac9e654e853ff45f38a03bb9a66e0be3d6da8d8e07deab9d`; paid `3.571583 USDC` in tx `0x4202622d97af28edd3439a8f3f5ab773524755362357aa22d4c6bfb100a4963f`; remaining `1.428417 USDC` withdrawn in tx `0xacb28962d8b908e7a74ecea07f0fb036dfa4b694dba63fac1e47a89eb755c503`)
- **Note:** "Contracts generated, tested, and deployed via Arc Studio (`0x52794Da13E573c9e73D32248a286843418Ba2983`, `0x676065eb7c72ddf2048f21e6cb2ca6721827c1de`). Studio's deployer key is non-exportable, so the live app settles on our funded Foundry v2 deployment (`0xd501D47b246438A18C8a0BFFCF10338CfBB661a2`, `0x238dE56E52A3F6C6708952052e6a20E5102b4d5b`), which adds beneficiary-gated claims (`NotBeneficiary`)."
