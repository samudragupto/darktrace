# Final Submission Freeze Checklist — DarkTrace

Comprehensive evidence checklist verifying submission qualification across the three target partner prizes and ETHGlobal top-10 finalist criteria for ETHGlobal Mumbai 2026. Every item is marked `✅` (backed by an exact file path, command, or transaction hash) or `⚠️` (with explicit reason).

---

## 1. Uniswap Foundation — Build with Uniswap (`$5,000`)

- [x] ✅ `/FEEDBACK.md` exists at repo root and documents Hook v1 → v2 engineering friction: [`FEEDBACK.md`](../../FEEDBACK.md)
- [x] ✅ Threat model & gas benchmark specification: [`specs/08-hook-threat-model.md`](../../specs/08-hook-threat-model.md) (`-53.7%` gas on clean swaps: `58,522 → 27,085` gas)
- [x] ✅ `DarkTraceHook` v2 deployed & verified on Base Sepolia (`84532`):
  - **Hook v2 (`0x00C0` flags, salt `0x180d`):** [`0xCeF7a999885D93f23Beeb7D319A83F2949B2c0c0`](https://sepolia.basescan.org/address/0xCeF7a999885D93f23Beeb7D319A83F2949B2c0c0) (deploy tx [`0x7cb7e1763a456aaeaaa83a0c7927f451ffd530dcb3062b42e01613108fb48210`](https://sepolia.basescan.org/tx/0x7cb7e1763a456aaeaaa83a0c7927f451ffd530dcb3062b42e01613108fb48210))
  - **Pool v2 (`PoolId`):** `0x5d78af67b033875696613c57b5a68f4a62eba0d98095844b0e9c8c691afc63df`
  - **Live Hook v2 `ExtractionDetected` Tx (Block `55,162,450`):** [`0xef694630199a91f86c1b8cdae55b0f3192373d7e776d7d3032fd2aa120a051c8`](https://base-sepolia.blockscout.com/tx/0xef694630199a91f86c1b8cdae55b0f3192373d7e776d7d3032fd2aa120a051c8)
  - **Features verified:** Explicit `_owner` constructor argument (`setThreshold` works), `BalanceDelta` profit-consistency check (`net0 > 0`), `tstore`-only `beforeSwap` + lazy `sstore` cleanup, and opt-in `hookData` (`abi.encode(victimAddress)`) router attribution.
- [x] ✅ `DarkTraceHook` v1 retained & documented for historical runs:
  - **Hook v1 (`0x00C0` flags, salt `0x139d`):** [`0xBCC9e1C474Ed195b3791f2c41EdAC2a25c5b80c0`](https://sepolia.basescan.org/address/0xBCC9e1C474Ed195b3791f2c41EdAC2a25c5b80c0)
  - **Verified Run #2 3-Tx Sandwich (Block `55,152,258`):** Frontrun [`0xa9a12ef2…`](https://sepolia.basescan.org/tx/0xa9a12ef232d1df4a38a56cf10ef5566f71a36798b4b4109eebf89a05658ba48c) → Victim (`0x524e…51Db`) [`0x23984ec7…`](https://sepolia.basescan.org/tx/0x23984ec70d7fc514697be40d8bb7500941ecbed350181a75b7fcb79e7ea772c4) → Backrun [`0x6dd63c93…`](https://sepolia.basescan.org/tx/0x6dd63c93a3945d7f737b64350f480cbafc3a5032b0442b3dbef4c6d72f84f5d9)
  - **Verified Run #1 Sandwich (Block `55,113,190`):** [`0x1adc35cf…`](https://sepolia.basescan.org/tx/0x1adc35cf1d5c726c853dea8de8401cc52d07689e7c52770b5b543c1ea3a410b4)
- [x] ✅ Foundry Hook Test Suite (`13/13` passing in `contracts/test/DarkTraceHook.t.sol`, including false-positive unit tests, 256-run fuzz test, and real `PoolManager` Run #1 reproduction).
- [ ] ⚠️ **HUMAN STEP REQUIRED:** Submit Uniswap Developer Feedback Form at `https://developers.uniswap.org/hackathon-feedback` and replace `[DATE — I will fill in]` in [`FEEDBACK.md`](../../FEEDBACK.md) line 4.

---

## 2. Arc — Best Smart Contracts with Advanced Stablecoin Logic in Arc Studio (`$5,000`)

- [x] ✅ `/arc-studio/prompt.md` and `/arc-studio/report.md` complete with v1, v2 beneficiary-gated, and v2 Escrow + Claim Expiry contracts:
  - [`arc-studio/prompt.md`](../../arc-studio/prompt.md)
  - [`arc-studio/report.md`](../../arc-studio/report.md)
  - Studio project URL: [`https://studio.arc.io/app/c3240360-99a1-4a97-b03e-5e547be78a32`](https://studio.arc.io/app/c3240360-99a1-4a97-b03e-5e547be78a32?thread=c19d8800-048f-459f-8329-54f1e7b50d34)
  - Studio deployed contracts: `SimulationRegistry` [`0x52794Da13E573c9e73D32248a286843418Ba2983`](https://explorer.testnet.arc.io/address/0x52794Da13E573c9e73D32248a286843418Ba2983), `RebateVault` [`0x676065eb7c72ddf2048f21e6cb2ca6721827c1de`](https://explorer.testnet.arc.io/address/0x676065eb7c72ddf2048f21e6cb2ca6721827c1de) (60/60 Studio tests passing; honest explanation of Studio's non-exportable cloud deployer key `0x5B12…Ef42` documented in `README.md` and `arc-studio/report.md`).
- [x] ✅ Active Beneficiary-Gated v2 Settlement Deployment (Foundry, Chain `5042002`):
  - `SimulationRegistry` v2: [`0xd501D47b246438A18C8a0BFFCF10338CfBB661a2`](https://explorer.testnet.arc.io/address/0xd501D47b246438A18C8a0BFFCF10338CfBB661a2)
  - `RebateVault` v2: [`0x238dE56E52A3F6C6708952052e6a20E5102b4d5b`](https://explorer.testnet.arc.io/address/0x238dE56E52A3F6C6708952052e6a20E5102b4d5b)
  - **Verified Run #2 Attestation (`3.539977 USDC` to Victim `0x524e…51Db`):** [`0xf4e1fa19d88a7151ba7c2d43a525daafecffca1e29d290a7eb4059d521744ca4`](https://explorer.testnet.arc.io/tx/0xf4e1fa19d88a7151ba7c2d43a525daafecffca1e29d290a7eb4059d521744ca4)
  - **On-Chain `NotBeneficiary` Revert Proof (Operator `0xb491…aDA5` blocked):** [`0xef11bca9a7f4b64983a2404834cdf1c817c1aeda334a73f0958cfa3aeddca8eb`](https://explorer.testnet.arc.io/tx/0xef11bca9a7f4b64983a2404834cdf1c817c1aeda334a73f0958cfa3aeddca8eb)
  - **On-Chain Victim EOA Claim (`3.539977 USDC` paid to `0x524e…51Db`, reserve `5.00 → 1.460023 USDC`):** [`0xb72bd280acafa1f1cec3f6738066070e1bc0940408348ed530fb54b39df1fd00`](https://explorer.testnet.arc.io/tx/0xb72bd280acafa1f1cec3f6738066070e1bc0940408348ed530fb54b39df1fd00)
- [x] ✅ Advanced Stablecoin Logic (Escrow Dispute Window + Claim Expiry Reserve Recycling) Deployed & Verified on Arc Testnet:
  - `SimulationRegistry` v2 Escrow + Expiry: [`0x31d51d7d05CE62030CBABF57D0f5376b86C70E77`](https://explorer.testnet.arc.io/address/0x31d51d7d05CE62030CBABF57D0f5376b86C70E77) (deploy tx [`0x9ee63279…`](https://explorer.testnet.arc.io/tx/0x9ee632790f62f36e0c2238af48a4cc5bf3d3a02170a26fc8c757631974dc6eb5))
  - `RebateVault` v2 Escrow + Expiry: [`0x0897Cc21DaD8aC9Fe5Deb4971e2f8c390E7BE104`](https://explorer.testnet.arc.io/address/0x0897Cc21DaD8aC9Fe5Deb4971e2f8c390E7BE104) (deploy tx [`0x6c0f3daa…`](https://explorer.testnet.arc.io/tx/0x6c0f3daa5ca7529078f2fc186107616c47db43be36bc4c59f951e07d7ff1c08c))
  - Live escrow dispute & resolution txs: `setDisputeWindow(300)` [`0x5f858712…`](https://explorer.testnet.arc.io/tx/0x5f858712f594e689444cdbe11ba57e1742af70afbd01f73ef1ff3946230f3d34) → `recordSimulation` [`0xa33e49ff…`](https://explorer.testnet.arc.io/tx/0xa33e49ff3c6b7230024a5756ac10dbcc51aa32a617efcbfc82e741f53b34c270) → `flagDispute` [`0x0915cb01…`](https://explorer.testnet.arc.io/tx/0x0915cb01c4c655e6d219d6c31c6b67edbd0d6eb8d12743aae1b81cfb55daba60) → `resolveDispute` [`0x8aa76387…`](https://explorer.testnet.arc.io/tx/0x8aa763876c395f41829a1e5ffcfbe1acda5d567401615f2669b20fa96f91801d)
- [x] ✅ Foundry Vault Test Suite (`19/19` passing in `contracts/test/RebateVault.t.sol`; `36/36` total Foundry tests passing).

---

## 3. Arkiv — Build on Arkiv from Scratch (`$5,000`)

- [x] ✅ All required submission files exist and reflect every query, TTL policy, and data-quality rule:
  - [`/arkiv/schema.md`](../../arkiv/schema.md)
  - [`/arkiv/how-you-use-arkiv.md`](../../arkiv/how-you-use-arkiv.md)
  - [`/arkiv/why-arkiv.md`](../../arkiv/why-arkiv.md)
  - [`/arkiv/reach.md`](../../arkiv/reach.md)
  - [`/arkiv/friction.md`](../../arkiv/friction.md)
  - [`/arkiv/README.md`](../../arkiv/README.md)
- [x] ✅ Writer wallet & live entities verified on Rabdi (`chainId 7794095`):
  - Writer wallet: `0xb491fe5846DE735B6Cb03a677A3C6296FAB0aDA5`
  - **Verified Run #2 Receipt (`3.54 USDC`, `lp = 0x524e…51Db`):** [`$key 0x2286e8a00e389f51ea21e3d5280f2078b54b4b2456842783962416c1a9dd5d27`](https://rabdi.explorer.arkiv.network/entity/0x2286e8a00e389f51ea21e3d5280f2078b54b4b2456842783962416c1a9dd5d27)
  - **Verified Run #2 `LPClaim` (`REBATED`):** [`$key 0x45dcfc2de3a9b1e6738ef67dcfa323c202f28683da820c35cf0f27d3b6d89a35`](https://rabdi.explorer.arkiv.network/entity/0x45dcfc2de3a9b1e6738ef67dcfa323c202f28683da820c35cf0f27d3b6d89a35)
  - **Hook v2 Open-Claim Receipt (`3.54 USDC`, extended to 90-day TTL at block `#4,172,852` via `extendEntity` tx `0x03512e4f…8744`):** [`$key 0x259dc2884aab483503458ce1ebb716c4e90bf156eadfaaa2e9761d2ec60b0fd2`](https://rabdi.explorer.arkiv.network/entity/0x259dc2884aab483503458ce1ebb716c4e90bf156eadfaaa2e9761d2ec60b0fd2)
  - **Live `SearcherProfile` entity (`extractions = 3`, `lastSeenBlock = 55162450`):** [`$key 0x42a19bb65560786c947020b82467ea65bf6373f26455e9a88dce82ee84959b9d`](https://rabdi.explorer.arkiv.network/entity/0x42a19bb65560786c947020b82467ea65bf6373f26455e9a88dce82ee84959b9d)
  - **Verified Run #1 Receipt & Claim:** [`$key 0x837ad00c…32a8`](https://rabdi.explorer.arkiv.network/entity/0x837ad00cd5fba8b67ba3976cbbca64de32d4ddac8483bb6b56b6866f67b432a8) & [`$key 0x20d3a714…5fd5`](https://rabdi.explorer.arkiv.network/entity/0x20d3a7149d2912642cc7dedf994454a48dc6c1f480bb81bf007de5c788985fd5)
- [x] ✅ `pnpm arkiv:verify` passes (`RECENT_OK 5 receipt(s) (3 real on-chain, 2 fixture)`, `CLAIMS_OK 2 claim(s)`, `PROFILE_OK`).
- [x] ✅ Real vs. Synthetic data labeling (`ON-CHAIN` vs. `SYNTHETIC [DEMO]`) enforced in `ReceiptsTable`, `/receipt/[hash]`, and `/pool/[id]`.

---

## 4. Product Polish & ETHGlobal Finalist Readiness

- [x] ✅ **Live Wagmi Claim Rebate Panel (`ClaimRebatePanel.tsx`):** On `/receipt/[hash]`, connects wallet, checks `beneficiary` on `SimulationRegistry` v2 (`0xd501…61a2`), displays a clear `NotBeneficiary` warning if a non-beneficiary wallet is connected, switches to Arc Testnet (`5042002`), calls `claimRebate` on `RebateVault` v2 (`0x238d…4d5b`), and seals `LPClaim` on Arkiv via `POST /api/claims/record`.
- [x] ✅ **`/demo` Replay Verified On-Chain Runs:** Added **"1. Replay Verified On-Chain Runs (Real Data)"** mode driven by Verified Run #2 (`0xe191f885…`), Hook v2 Run (`0x2d992c83…`), and Verified Run #1 (`0xdf3305cb…`), alongside clearly labeled **"2. Browser Simulation Sandbox [DEMO]"**.
- [x] ✅ **Searcher Leaderboard & Per-Pool Extraction Timeline:** Live on `/dashboard` and `/pool/[id]`, reading directly from Arkiv Rabdi receipts and `SearcherProfile` entities.
- [x] ✅ **2–3 Minute Video Script & Booth Q&A Sheet:** [`specs/06-demo-script.md`](../06-demo-script.md) and [`specs/submission/qa-prep.md`](qa-prep.md).

---

## 5. Submission Form Values (Paste Ready)

- **Project name:** `DarkTrace`
- **Tagline:** `MEV forensics for Uniswap v4 LPs. Hooks detect it, Arkiv seals it, and Arc pays it back in native USDC.`
- **Category:** `DeFi`
- **Emoji:** `🌘`
- **Target Partner Prizes:**
  1. **Uniswap Foundation:** `Build with Uniswap`
  2. **Arc:** `Best Smart Contracts with Advanced Stablecoin Logic (Arc Studio)`
  3. **Arkiv:** `Build on Arkiv (from scratch)`
