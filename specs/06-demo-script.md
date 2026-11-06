# DarkTrace — 2:30–3:00 Video Demo Script

**Event**: ETHGlobal Mumbai 2026  
**Format**: ~2:45, 1080p, real voiceover (no text-to-speech, no video speedup)  
**Target Prizes**: Uniswap Foundation, Arc, Arkiv, ETHGlobal Top-10 Finalist

---

## Pre-Recording Browser Tabs (in order)
1. **Tab 1 — Live App Dashboard:** `https://darktrace-lovat.vercel.app/dashboard`
2. **Tab 2 — Base Sepolia 3-Tx Sandwich (Block #55,152,258) & Hook v2 (Block #55,162,450):**
   - Backrun + `ExtractionDetected` event: `https://base-sepolia.blockscout.com/tx/0x6dd63c93a3945d7f737b64350f480cbafc3a5032b0442b3dbef4c6d72f84f5d9`
   - Hook v2 detection: `https://base-sepolia.blockscout.com/tx/0xef694630199a91f86c1b8cdae55b0f3192373d7e776d7d3032fd2aa120a051c8`
3. **Tab 3 — Live Receipt Page ("Live from Arkiv Rabdi"):**
   - Verified Run #2 (`REBATED`): `https://darktrace-lovat.vercel.app/receipt/0xe191f885168d1d06b6c7d27ef00504d58f7661c7da5adc8c3a79aaf8bb72959a`
   - Hook v2 Open-Claim Receipt (`ARCHIVED`, 90d TTL): `https://darktrace-lovat.vercel.app/receipt/0x2d992c83c11668835db493c4637772c03166a7f89ef82e2e3cec057493ffef1c`
4. **Tab 4 — Arkiv Rabdi Explorer:** `https://rabdi.explorer.arkiv.network/entity/0x2286e8a00e389f51ea21e3d5280f2078b54b4b2456842783962416c1a9dd5d27`
5. **Tab 5 — Arc Testnet Explorer & Arc Studio:**
   - `NotBeneficiary` revert proof: `https://explorer.testnet.arc.io/tx/0xef11bca9a7f4b64983a2404834cdf1c817c1aeda334a73f0958cfa3aeddca8eb`
   - Victim EOA `3.539977 USDC` claim: `https://explorer.testnet.arc.io/tx/0xb72bd280acafa1f1cec3f6738066070e1bc0940408348ed530fb54b39df1fd00`
   - Arc Studio project: `https://studio.arc.io/app/c3240360-99a1-4a97-b03e-5e547be78a32`

---

### [0:00 – 0:10] Problem Statement (5–10s)
* **Visual**: Start on `/dashboard` showing live counters (`Extracted (Arkiv)`, `Vault Reserve (Arc)`, `Receipts on Arkiv`) and the Searcher Leaderboard.
* **Voiceover**:
  > *"Uniswap LPs and traders lose over a billion dollars a year to sandwich MEV. Existing hooks try to block swaps in `beforeSwap`, adding latency and false positives. DarkTrace separates detection from execution: our Uniswap v4 hook fingerprints sandwiches on-chain, Arkiv seals a verifiable receipt, and victims claim USDC restitution on Arc."*

---

### [0:10 – 0:45] Real Sandwich Tx on Base Sepolia & Hook v2 Event
* **Visual**: Switch to **Tab 2** (Base Sepolia Block `#55,152,258` and Hook v2 `#55,162,450` on Blockscout/Basescan). Highlight the 3 transactions in one block (`0xa9a12ef2…` frontrun by operator `0xb491…aDA5`, `0x23984ec7…` victim swap by separate Victim EOA `0x524e…51Db`, and `0x6dd63c93…` backrun) and the `ExtractionDetected` event log.
* **Voiceover**:
  > *"Here on Base Sepolia block 55,152,258 is a real 3-transaction sandwich where the searcher and victim are two separate wallets. Inside `beforeSwap` and `afterSwap`, `DarkTraceHook` uses EIP-1153 `tstore` to measure intra-swap tick displacement without touching swap execution. In Hook v2 at `0xCeF7…c0c0`, we cut clean-swap gas by 53.7 percent and enforce a `BalanceDelta` profit-consistency check so two independent traders or an unprofitable round-trip never trigger a false positive."*

---

### [0:45 – 1:25] Receipt Page ("Live from Arkiv Rabdi") & Counterfactual Math
* **Visual**: Switch to **Tab 3** (`/receipt/0xe191f885…959a` and `/receipt/0x2d992c83…ef1c`) and **Tab 4** (`rabdi.explorer.arkiv.network`). Point out the purple **"Live from Arkiv Rabdi · chain 7794095"** provenance strip, the slippage decomposition (`+35 bps` injected vs `90 bps` natural = `$3.54 USDC` lost), the `$key` link (`0x2286e8a0…5d27`), and the `EXTENDED TO 90d (OPEN CLAIM)` badge on the unclaimed Hook v2 receipt (`$key 0x259dc288…0fd2`).
* **Voiceover**:
  > *"Our indexer reconstructs the pre-attack pool state from `PoolManager` `Swap` logs and prices the victim trade twice with the constant-product counterfactual formula. The victim lost 3.54 USDC to injected frontrun slippage. That receipt is sealed on Arkiv Rabdi with `@arkiv-network/sdk` and read back live on every page. Unclaimed receipts have their Arkiv entity expiry deliberately extended from 30 to 90 days via `extendEntity`, and our Searcher Profile page reads the live `SearcherProfile` entity directly from Arkiv."*

---

### [1:25 – 2:05] Arc USDC Rebate Claim, `NotBeneficiary` Guard & Escrow Logic
* **Visual**: Scroll to the **Settlement · Arc Testnet RebateVault v2** panel on `/receipt` and switch to **Tab 5** (Arc Explorer + Arc Studio). Show:
  1. Attestation tx `0xf4e1fa19…744ca4` binding `beneficiary = 0x524e…51Db`.
  2. Reverted tx `0xef11bca9…dca8eb` where the operator tried to claim and reverted with `NotBeneficiary`.
  3. Successful claim tx `0xb72bd280…f1fd00` where the Victim EOA claimed `3.539977 USDC`.
  4. The Arc Studio project and Escrow Dispute Window (`flagDispute` / `resolveDispute` in tx `0x0915cb01…` and `0x8aa76387…`) + `expireUnclaimedRebate`.
* **Voiceover**:
  > *"On Arc Testnet, `SimulationRegistry` v2 binds the attestation to the victim's wallet address. When the operator wallet attempted `claimRebate` in tx `0xef11bca9…`, `RebateVault` v2 reverted on-chain with `NotBeneficiary`. When the victim wallet signed `claimRebate` in tx `0xb72bd280…`, the vault paid out 3.539977 native USDC and sealed the `LPClaim` on Arkiv. We also deployed an escrow dispute window and claim-expiry reserve recycling on Arc."*

---

### [2:05 – 2:45] Why Each Partner Is Essential & Honest Limits
* **Visual**: Click `/demo` and toggle **"1. Replay Verified On-Chain Runs (Real Data)"** vs **"2. Browser Simulation Sandbox [DEMO]"**. Show the README table of verified transactions and honest disclosures.
* **Voiceover**:
  > *"Why are all three partners essential? Only a Uniswap v4 hook sees exact intra-block pre- and post-swap ticks and `BalanceDelta` at execution time. Only Arkiv provides a decentralized, owner-verifiable entity ledger with programmable TTLs so receipts aren't trapped in a private database. And Arc gives victims sub-second native 6-decimal USDC restitution. To be completely transparent about scope: our testnet attacks are scripted from two separate wallets for reproducible verification, single-range CPMM math is used off-chain, and Base Sepolia searcher bonds do not bridge across chains—the Arc vault is pre-funded on testnet. DarkTrace: hooks detect it, Arkiv seals it, and Arc pays it back."*
