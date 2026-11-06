# DarkTrace Clickable Link & Network Endpoint Verification Matrix

**Audited:** 2026-11-06  
**Auditor:** Senior Release Engineer & Submission Auditor  
**Project:** DarkTrace (ETHGlobal Mumbai 2026)  
**Scope:** All URLs, block explorer routes, RPC endpoints, and deep-links across repository code, documentation, and web app.

---

## 1. Network Explorer & Contract Endpoints

| Resource | Target URL | HTTP Code | Status | Verification Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Base Sepolia PoolManager** | `https://sepolia.basescan.org/address/0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` | 200 (browser) / 403 (bot-gate) | Verified | Official Uniswap v4 PoolManager deployment on Base Sepolia |
| **DarkTraceHook** | `https://sepolia.basescan.org/address/0xBCC9e1C474Ed195b3791f2c41EdAC2a25c5b80c0` | 200 (browser) / 403 (bot-gate) | Verified | Deployed hook address with CREATE2 salt `0x139d` (`0x00C0` flags) |
| **SearcherRegistry** | `https://sepolia.basescan.org/address/0x24A2669C706CCE71BAea24a4De18D9D215713551` | 200 (browser) / 403 (bot-gate) | Verified | Searcher bond registration and slashing ledger (Base Sepolia) |
| **Foundry SimulationRegistry v2** | `https://explorer.testnet.arc.io/address/0xd501D47b246438A18C8a0BFFCF10338CfBB661a2` | 200 | Verified | Active beneficiary-gated attestation registry on Arc Testnet |
| **Foundry RebateVault v2** | `https://explorer.testnet.arc.io/address/0x238dE56E52A3F6C6708952052e6a20E5102b4d5b` | 200 | Verified | Active settlement vault on Arc Testnet; holds 1.428417 USDC reserve |
| **Foundry SimulationRegistry v1 (retired)** | `https://explorer.testnet.arc.io/address/0xb8416cb4d82BA72b70C3EC55d7AC66b5DB415CF8` | 200 | Verified | Retired v1 registry used by Verified Run #1 (`0x50ab85ca…d9eec9`) |
| **Foundry RebateVault v1 (retired)** | `https://explorer.testnet.arc.io/address/0x2ab745F51002Ce236A9A2dA81cDaA553B87f28CD` | 200 | Verified | Retired v1 vault used by Verified Run #1 (`0x4202622d…a4963f`) |
| **Foundry Vault Funding Tx** | `https://explorer.testnet.arc.io/tx/0x4289870dba2b919eac9e654e853ff45f38a03bb9a66e0be3d6da8d8e07deab9d` | 200 | Verified | On-chain tx funding 5.00 USDC into RebateVault v1 |
| **Foundry V1 → V2 Reserve Deposit Tx** | `https://explorer.testnet.arc.io/tx/0xb8ac54e9d1c3cd73804330d6fe0e67f5712056768a9d7ca8b36089c13e3d36fa` | 200 | Verified | On-chain tx depositing 1.428417 USDC into RebateVault v2 |
| **Verified Run #1 Sandwich Tx** | `https://base-sepolia.blockscout.com/tx/0x1adc35cf1d5c726c853dea8de8401cc52d07689e7c52770b5b543c1ea3a410b4` | 200 | Verified | Base Sepolia block 55,113,190 sandwich emitting `ExtractionDetected` |
| **Verified Run #1 Arkiv Receipt** | `https://rabdi.explorer.arkiv.network/entity/0x837ad00cd5fba8b67ba3976cbbca64de32d4ddac8483bb6b56b6866f67b432a8` | 200 | Verified | Sealed `ExtractionReceipt` (`0xdf3305cb…dee4e681`, $3.57 loss) |
| **Verified Run #1 Arkiv LPClaim** | `https://rabdi.explorer.arkiv.network/entity/0x20d3a7149d2912642cc7dedf994454a48dc6c1f480bb81bf007de5c788985fd5` | 200 | Verified | Sealed `LPClaim` linking receipt `0xdf33…` to Arc claim `0x4202…` |
| **Arc Studio SimulationRegistry**| `https://explorer.testnet.arc.io/address/0x52794Da13E573c9e73D32248a286843418Ba2983` | 200 | Verified | Deployed via Arc Studio browser IDE |
| **Arc Studio RebateVault** | `https://explorer.testnet.arc.io/address/0x676065eb7c72ddf2048f21e6cb2ca6721827c1de` | 200 | Verified | Provenance contract compiled in Arc Studio (60/60 tests pass) |
| **Arc Native USDC ERC-20** | `https://explorer.testnet.arc.io/token/0x3600000000000000000000000000000000000000` | 200 | Verified | Canonical 6-decimal USDC on Arc Testnet |
| **Arkiv Rabdi Testnet Explorer** | `https://rabdi.explorer.arkiv.network` | 200 | Verified | Official block and entity explorer for Rabdi testnet |
| **Arkiv Entity Deep-Link** | `https://rabdi.explorer.arkiv.network/entity/0xc327d5db4aa3098b80dc8729d090317408f98d19e1e19c13d6cf83494a05f8ca` | 200 | Verified | Canonical `$key` entity on Arkiv Rabdi testnet |
| **Arkiv Rabdi Write Tx** | `https://rabdi.explorer.arkiv.network/tx/0x544ee730bb736cdbafcd837bad62f857c8ed0e0eaedf7afce807ffb060c6e0f6` | 200 | Verified | Testnet EVM write tx for entity insertion |

---

## 2. Public Application & Health Routes

| Route | Target URL | HTTP Code | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Web App Home** | `https://darktrace-lovat.vercel.app/` | 200 | PASS | Live Vercel production deployment |
| **Interactive MEV Demo** | `https://darktrace-lovat.vercel.app/demo` | 200 | PASS | Interactive split-view terminal and counterfactual simulation |
| **Forensics Dashboard** | `https://darktrace-lovat.vercel.app/dashboard` | 200 | PASS | Monitored pools and forensic receipt table |
| **Canonical Receipt View** | `https://darktrace-lovat.vercel.app/receipt/0xe9e56b6adbf0cae90f08b28a0ae3dccd9fc4ece42eb7b0126e4f208646eae6ce` | 200 | PASS | Forensic detail card for canonical benchmark scenario |
| **Searcher Dossier View** | `https://darktrace-lovat.vercel.app/searcher/0x1111111111111111111111111111111111111111` | 200 | PASS | Searcher profile, bond status, and attack history |
| **LP Restitution View** | `https://darktrace-lovat.vercel.app/lp/0x3333333333333333333333333333333333333333` | 200 | PASS | LP restitution balance and claim ledger |
| **Public Stats API** | `https://darktrace-lovat.vercel.app/api/stats` | 200 | PASS | JSON endpoint reading live on-chain vault reserves |
| **Service Status API** | `https://darktrace-lovat.vercel.app/api/status` | 200 | PASS | Health check probe route |

---

## 3. Remote RPC & API Services

| Endpoint | Protocol / URL | HTTP Code | Status | Usage Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Arc Testnet RPC** | `https://rpc.testnet.arc.io` | 200 (POST) | Active | Official Arc Testnet JSON-RPC endpoint (Chain ID `5042002`) |
| **Base Sepolia RPC** | `https://sepolia.base.org` | 200 (POST) | Active | Public Base Sepolia RPC endpoint (Chain ID `84532`) |
| **Arkiv Rabdi Testnet RPC** | `https://rpc.rabdi.db-chain.testnet.arkiv.network` | 200 (POST) | Active | Arkiv Rabdi JSON-RPC endpoint (Chain ID `7794095`) |

---

## 4. Remediated & Invalid Links

| Original Erroneous Link | Discovered Location | Failure Mode | Correct Replacement | Remediation Status |
| :--- | :--- | :--- | :--- | :--- |
| `https://explorer.testnet.arc.network/...` | `apps/web/.../Footer.tsx` | DNS resolution failure | `https://explorer.testnet.arc.io/...` | **Fixed** in commit `81617a4` |
| `https://rpc.testnet.arc.network` | `docker-compose.yml`, `chains.ts` | Obsolete domain | `https://rpc.testnet.arc.io` | **Fixed** in commits `81617a4` and `1d37af7` |
| `https://rabdi.explorer.arkiv.network/entity/0xe9e5...` | Arkiv explorer buttons | 404 / Empty query | `https://rabdi.explorer.arkiv.network/entity/0xc327...` | **Fixed** in commit `cf857ec` |
| `https://rpc.arkiv.network` | Docker configs | Invalid host | `https://rpc.rabdi.db-chain.testnet.arkiv.network` | **Fixed** in commit `1d37af7` |

