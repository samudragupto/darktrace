# DarkTrace — Partner Booth Strategy & Video Demo Links

Visit the three partner booths in this exact sequence: **1. Uniswap Foundation → 2. Arc → 3. Arkiv**.
*(For the full 2:45 video recording script with timestamps, see [`specs/06-demo-script.md`](../06-demo-script.md).)*

---

## Quick-Open Browser Tabs (In Order for Video & Booth Demo)

1. **Tab 1 — Overview Page (`/`):**
   https://darktrace-lovat.vercel.app
2. **Tab 2 — Base Sepolia Hook v2 `ExtractionDetected` Tx (Blockscout Logs tab):**
   https://base-sepolia.blockscout.com/tx/0xef694630199a91f86c1b8cdae55b0f3192373d7e776d7d3032fd2aa120a051c8?tab=logs
3. **Tab 3 — Interactive Forensic Terminal (`/demo`):**
   https://darktrace-lovat.vercel.app/demo
4. **Tab 4 — Surveillance Dashboard (`/dashboard`):**
   https://darktrace-lovat.vercel.app/dashboard
5. **Tab 5 — Verified Run #2 Receipt Page (`/receipt/0xe191…`):**
   https://darktrace-lovat.vercel.app/receipt/0xe191f885168d1d06b6c7d27ef00504d58f7661c7da5adc8c3a79aaf8bb72959a
6. **Tab 6 — Arkiv Rabdi Explorer (Verified Run #2 Receipt Entity `$key`):**
   https://rabdi.explorer.arkiv.network/entity/0x2286e8a00e389f51ea21e3d5280f2078b54b4b2456842783962416c1a9dd5d27
7. **Tab 7 — Arc Testnet Explorer (`NotBeneficiary` Revert Proof Tx):**
   https://explorer.testnet.arc.io/tx/0xef11bca9a7f4b64983a2404834cdf1c817c1aeda334a73f0958cfa3aeddca8eb
8. **Tab 8 — Arc Testnet Explorer (Victim EOA `$3.54 USDC` Claim Tx):**
   https://explorer.testnet.arc.io/tx/0xb72bd280acafa1f1cec3f6738066070e1bc0940408348ed530fb54b39df1fd00

---

## 1. Uniswap Foundation Booth

- **Pre-Load Tabs Before Approaching**:
  - **Tab 2:** `https://base-sepolia.blockscout.com/tx/0xef694630199a91f86c1b8cdae55b0f3192373d7e776d7d3032fd2aa120a051c8?tab=logs`
  - **Code:** [`contracts/src/DarkTraceHook.sol`](../../contracts/src/DarkTraceHook.sol) (lines `124–246`) and [`FEEDBACK.md`](../../FEEDBACK.md)
- **30-Second Pitch**:
  > *"We built and deployed `DarkTraceHook` v1 (`0xBCC9…80c0`) and v2 (`0xCeF7…c0c0`, mined for `0x00C0` flags) on Base Sepolia. Instead of adding latency or reverting swaps in `beforeSwap`, our hook uses EIP-1153 `tstore` in `beforeSwap` and a lazy block-scoped fallback in `afterSwap`—cutting clean-swap gas by 53.7%. It verifies searcher round-trip profitability using `BalanceDelta`, supports opt-in `hookData` victim attribution, and emits `ExtractionDetected` for post-block USDC restitution."*

---

## 2. Arc Booth

- **Pre-Load Tabs Before Approaching**:
  - **Tab 3:** `https://darktrace-lovat.vercel.app/demo`
  - **Tab 7 & Tab 8:** `NotBeneficiary` Revert Tx (`0xef11bca9…`) and Victim EOA Claim Tx (`0xb72bd280…`)
  - **Arc Studio:** `https://studio.arc.io/app/c3240360-99a1-4a97-b03e-5e547be78a32`
- **30-Second Pitch**:
  > *"We generated and tested `SimulationRegistry` and `RebateVault` in Arc Studio (60/60 tests passing) and settled two real native 6-decimal USDC rebates (`$3.57` and `$3.54 USDC`) on Arc Testnet. In Verified Run #2, our v2 vault proved on-chain that an unauthorized operator claim reverts with `NotBeneficiary` (`0xef11bca9…`), and only the Victim EOA (`0x524e…51Db`) succeeded in claiming `$3.539977 USDC` (`0xb72bd280…`). We also deployed an escrow dispute window (`flagDispute` / `resolveDispute`) and claim-expiry reserve recycling (`expireUnclaimedRebate`)."*

---

## 3. Arkiv Booth

- **Pre-Load Tabs Before Approaching**:
  - **Tab 4:** `https://darktrace-lovat.vercel.app/dashboard`
  - **Tab 5:** `https://darktrace-lovat.vercel.app/receipt/0xe191f885168d1d06b6c7d27ef00504d58f7661c7da5adc8c3a79aaf8bb72959a`
  - **Tab 6:** `https://rabdi.explorer.arkiv.network/entity/0x2286e8a00e389f51ea21e3d5280f2078b54b4b2456842783962416c1a9dd5d27`
- **30-Second Pitch**:
  > *"DarkTrace uses Arkiv Rabdi (`chain 7794095`, `darktrace.v1` namespace) via `@arkiv-network/sdk` as its sole, zero-mock forensic database across three schemas: `ExtractionReceipt`, `SearcherProfile`, and `LPClaim`. Every UI page queries Arkiv live filtered to our writer wallet (`ownedBy`), strictly separates canonical `receiptHash` from `arkivEntityKey` (`$key`), and uses `extendEntity` to extend receipts with open, unclaimed rebates from a 30-day TTL to a 90-day TTL (verified on Rabdi in tx `0x03512e4f…8744`)."*
