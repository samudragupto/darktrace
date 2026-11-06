# DarkTrace — 2:45 Video Recording Script & Tab Runbook

Before you hit **Record**, open these **8 browser tabs from left to right** so you never wait for a page to load during the recording—just press `Ctrl + Tab` to move from Tab 1 to Tab 8!

---

## Step 0: Open These 8 Tabs in Order (Left → Right)

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

## Timestamped Script (`0:00` → `2:45`)

### Scene 1 — `0:00 – 0:20` (20s): The Problem & Core Idea
- **Active Tab:** **Tab 1** (`https://darktrace-lovat.vercel.app`)
- **What to do on screen:**
  - Start on the top of the **Overview** page.
  - Hover over the **`$13.18` Extracted Volume (Arkiv)** counter, the **`Latest sandwich`** card on the right (`Block #55162450 · tUSDC / tWETH (Hook v2)`), and the **`RebateVault v2 Reserve (Arc): $1.46 USDC`** readout.
- **Voiceover (Read verbatim):**
  > *"Swappers and liquidity providers lose over a billion dollars a year to MEV sandwich attacks. Most Uniswap v4 defenses try to block or tax swaps inside `beforeSwap`, which adds gas to every normal trade and breaks aggregator routing when volatility spikes. DarkTrace takes the opposite approach: we never block or slow down a swap. Instead, our Uniswap v4 hook passively fingerprints sandwich attacks on Base Sepolia, our counterfactual engine computes the exact dollar loss off-chain, Arkiv seals an immutable forensic receipt, and Arc Testnet refunds the victim in native USDC."*

---

### Scene 2 — `0:20 – 0:55` (35s): Uniswap v4 Hook v2 on Base Sepolia
- **Active Tab:** Switch to **Tab 2** (`https://base-sepolia.blockscout.com/tx/0xef694630199a91f86c1b8cdae55b0f3192373d7e776d7d3032fd2aa120a051c8?tab=logs`)
- **What to do on screen:**
  - Highlight the transaction hash `0xef694630…20a051c8` in Block `55,162,450`.
  - Scroll slightly to point at the `Swap` events on `PoolManager` followed by the **`ExtractionDetected`** event emitted by `DarkTraceHook` v2 (`0xCeF7a999885D93f23Beeb7D319A83F2949B2c0c0`).
- **Voiceover (Read verbatim):**
  > *"Here is a real sandwich transaction on Base Sepolia in block 55,162,450 against our CREATE2-mined `DarkTraceHook` v2 at `0xCeF7…c0c0`. In Hook v2, `beforeSwap` stores the pre-swap tick in EIP-1153 transient storage (`tstore`), while cross-transaction state in `afterSwap` uses a block-scoped fallback only when price impact crosses our threshold—cutting clean-swap gas overhead by 53.7%. To eliminate false positives from normal arbitrage, `afterSwap` checks Uniswap v4's `BalanceDelta` and only emits `ExtractionDetected` when the same searcher reverses direction around a victim AND nets a strictly positive round-trip token delta. And if a searcher splits their frontrun and backrun across two different contracts signed by the same EOA, our indexer's linked-origin scanner catches it off-chain."*

---

### Scene 3 — `0:55 – 1:25` (30s): Replaying the 3-Tx Sandwich on `/demo`
- **Active Tab:** Switch to **Tab 3** (`https://darktrace-lovat.vercel.app/demo`)
- **What to do on screen:**
  - Point to the **`1. Replay Verified On-Chain Runs (Real Data)`** tab at the top.
  - Click **`Verified Run #2 (Separate EOA · Arc v2)`** (Block `#55,152,258`) and click the **`Replay Verified Run`** button on the right.
  - Hover over the 3 separate Base Sepolia transaction hashes (`Tx 1 Frontrun 0xa9a12ef2…`, `Tx 2 Victim Swap 0x23984ec7…`, `Tx 3 Backrun 0x6dd63c93…`) and the **Counterfactual Decomposition** card (`+35 bps` Injected MEV vs `90 bps` Natural Slippage = `$3.54 USDC` lost).
- **Voiceover (Read verbatim):**
  > *"On `/demo`, judges can replay all three of our verified on-chain runs. In Verified Run #2 at block 55,152,258, the searcher EOA and the victim EOA are two separate wallets signing three separate transactions in one block. Our counterfactual simulator reconstructs the pool's pre-attack reserves from `PoolManager` events and prices the victim's 1,000 USDC swap twice: 90 basis points was normal liquidity slippage, and 35 basis points—or $3.54 USDC—was injected directly by the searcher's frontrun."*

---

### Scene 4 — `1:25 – 2:00` (35s): Live Arkiv Rabdi Proof Ledger & 90-Day TTL
- **Active Tab:** Switch to **Tab 4** (`/dashboard`), then **Tab 5** (`/receipt/0xe191…`), then **Tab 6** (Arkiv Rabdi Explorer `0x2286e8a0…`)
- **What to do on screen:**
  1. On **Tab 4 (`/dashboard`)**: Hover over the purple **`Live from Arkiv Rabdi · chain 7794095`** strip showing the live `select * from receipts ownedBy(writer)` query.
  2. Switch to **Tab 5 (`/receipt/0xe191…`)**: Point to the 4-step progress bar (`Detected → Sealed on Arkiv → Attested on Arc → Rebated $3.54 USDC`), and scroll down to the **Claim Rebate** panel and the Arkiv Entity Key (`$key 0x2286e8a0…5d27`).
  3. Switch briefly to **Tab 6 (`rabdi.explorer.arkiv.network/entity/0x2286e8a0…`)**: Show the raw entity on the Arkiv Rabdi block explorer.
- **Voiceover (Read verbatim):**
  > *"Every page in DarkTrace reads directly from Arkiv Rabdi Testnet—chain 7794095—with zero mock fallbacks, filtered to our writer wallet `0xb491…aDA5`. We strictly separate the canonical `receiptHash` used for contract attestation from the Arkiv `$key` used on the Rabdi explorer. We also use Arkiv's entity expiry deliberately: standard receipts expire in 30 days, while receipts with an open, unclaimed rebate are extended to a 90-day TTL via `extendEntity`—verified on Rabdi in transaction `0x03512e4f…`—so a victim's forensic proof never expires before they claim."*

---

### Scene 5 — `2:00 – 2:30` (30s): Arc Testnet Native USDC Restitution & `NotBeneficiary` Guard
- **Active Tab:** Switch to **Tab 7** (Arc Revert Tx `0xef11bca9…`), then **Tab 8** (Arc Claim Tx `0xb72bd280…`)
- **What to do on screen:**
  1. On **Tab 7 (`explorer.testnet.arc.io/tx/0xef11bca9…`)**: Point to the red **Reverted / Failed** status showing the operator wallet (`0xb491…aDA5`) getting blocked by `NotBeneficiary`.
  2. Switch to **Tab 8 (`explorer.testnet.arc.io/tx/0xb72bd280…`)**: Point to the green **Success** status and the **`3.539977 USDC`** transfer from `RebateVault` v2 (`0x238d…4d5b`) to the Victim EOA (`0x524e…51Db`).
- **Voiceover (Read verbatim):**
  > *"Finally, settlement happens on Arc Testnet using native 6-decimal USDC. Because micro-rebates like $3.54 would be eaten by mainnet gas, Arc's sub-cent USDC execution makes per-swap restitution viable. We generated our contract suite and 60 passing tests in Arc Studio and deployed our beneficiary-gated v2 vault on Arc Testnet. Each attestation in `SimulationRegistry` v2 locks in the victim's wallet as `beneficiary`. Here in transaction `0xef11bca9…`, when the operator wallet tried to claim the victim's rebate, `RebateVault` v2 reverted on-chain with `NotBeneficiary`. Seconds later, in transaction `0xb72bd280…`, the victim's own wallet claimed the exact $3.539977 USDC payout, and our escrow deployment adds dispute windows and unclaimed expiry recycling."*

---

### Scene 6 — `2:30 – 2:45` (15s): Honest Scope & Wrap-Up
- **Active Tab:** Switch back to **Tab 1** (`https://darktrace-lovat.vercel.app`)
- **What to do on screen:**
  - Show the main Overview dashboard one last time.
- **Voiceover (Read verbatim):**
  > *"We're transparent about our testnet boundaries: our attacks are scripted on-chain runs for repeatable verification, our counterfactual math models single-range constant-product liquidity, and moving from a single-key attester to optimistic or ZK proofs is our production roadmap. DarkTrace: Uniswap v4 hooks detect it, Arkiv seals it, and Arc pays it back in native USDC. Thank you!"*
