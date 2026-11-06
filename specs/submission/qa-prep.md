# DarkTrace — Booth & Judge Q&A Sheet

**Tone**: Direct, honest about scope, zero marketing adjectives.  
**Evidence**: Every answer cites exact contract mechanisms, live transactions, or spec sections.

---

## Part 1 — Core Booth Q&A (Required Judge Topics)

### 1. False Positives: "What if two normal traders or an arbitrageur trigger the hook by coincidence?"
In Hook v1, any 3-swap tick inversion above `thresholdBps` emitted an alert. In **Hook v2 (`0xCeF7…c0c0`)**, we added a `BalanceDelta` profit-consistency check inside `afterSwap`: a candidate backrun only triggers `ExtractionDetected` if (a) `tx3` is sent by the same searcher router as `tx1`, (b) `tx2` was sent by a different address, (c) the tick reverses by at least `thresholdBps`, and (d) the searcher's net `currency0` (`amount0()`) round-trip delta across `tx1 + tx3` is strictly positive (`> 0`). Unit tests in `DarkTraceHook.t.sol` prove that independent arbitrageurs and unprofitable round-trips do not fire. On top of that, `SimulationRegistry` v2 on Arc enforces an **escrow dispute window (`flagDispute`)** before any payout is claimable.

---

### 2. Vault Funding: "Who actually funds the `RebateVault` in production?"
On testnet, `RebateVault` v2 (`0x238d…4d5b`) is pre-funded with native Arc USDC by the protocol operator (`5.00 USDC` total funded; `3.54 USDC` claimed by the Victim EOA in Verified Run #2; `1.460023 USDC` currently available). In production, restitution is funded from three sources documented in `specs/03-arc-simulator.md`: (1) an LP protection fee share collected by hooked pools, (2) slashed solver collateral from `SearcherRegistry.sol` on Base Sepolia (settled asynchronously, never via a fake cross-chain bridge), and (3) **on-chain claim expiry recycling (`expireUnclaimedRebate`)** in `RebateVault`, which returns unclaimed rebates to `availableReserve()` after `claimExpirySeconds`.

---

### 3. Why Arkiv vs. Postgres: "Why store receipts on Arkiv Rabdi instead of a standard database?"
If receipts lived in a private Postgres database, the operator could silently alter historical slippage numbers, backdate claims, or serve different records to the UI than what was attested on Arc. On **Arkiv Rabdi (`chainId 7794095`)**, every `ExtractionReceipt`, `SearcherProfile`, and `LPClaim` is an on-chain entity signed by our verified writer wallet (`0xb491…aDA5`), queryable by anyone without an API key, and content-addressed via canonical `receiptHash`. Furthermore, we use Arkiv's **block-based entity expiry (`expiresIn`)** deliberately: standard receipts expire after 30 days, while receipts with an **open, unclaimed Arc attestation** are extended to **90 days** (`extendOpenReceiptExpiry`, verified in Rabdi tx `0x03512e4f…8744`) so evidence never disappears while a victim can still claim.

---

### 4. Why Arc: "Why settle rebates on Arc Testnet instead of paying on Base?"
Arc provides native 6-decimal USDC (`0x3600000000000000000000000000000000000000`) at the protocol level and sub-cent deterministic execution, making micro-rebates (such as `$3.54 USDC` in Verified Run #2) economically viable without L2 gas eating the restitution. Our Arc contracts (`SimulationRegistry` + `RebateVault`, generated in Arc Studio and upgraded in v2) implement programmable stablecoin guardrails: **`NotBeneficiary` recipient gating** (proven on-chain when operator claim tx `0xef11bca9…` reverted before victim claim tx `0xb72bd280…` succeeded), **escrow dispute windows (`flagDispute` / `resolveDispute`)**, and **claim expiry reserve recycling (`expireUnclaimedRebate`)**.

---

### 5. Why a Uniswap v4 Hook: "Why use a v4 Hook instead of an off-chain mempool/event bot?"
First, Base Sepolia (and OP-stack rollups generally) has a sequencer without a public P2P mempool, and routers batch multiple user swaps inside a single transaction. An external log poller only sees post-facto `Swap` events and cannot distinguish router-internal sub-swaps or read transient in-transaction state. Inside `DarkTraceHook` (`beforeSwap` / `afterSwap`), we read exact `Slot0` ticks before and after each swap, consume `BalanceDelta` directly from `PoolManager`, and support **opt-in `hookData` victim attribution** (`abi.encode(victimAddress)`) so aggregators sharing a single router contract can pass the true end-user address on-chain without relying on `tx.origin`. Plus, Hook v2 uses `tstore` in `beforeSwap` and lazy `sstore` cleanup in `afterSwap`, cutting clean-swap gas overhead by **53.7%**.

---

### 6. Scripted-Attack Disclosure: "Were the sandwiches on Base Sepolia organic or scripted?"
They are **real on-chain transactions** triggered by our verification script (`pnpm e2e:real` / `apps/indexer/src/e2e-sandwich.ts`), because nobody organically sandwiches a testnet pool. We disclose this prominently in the README and UI:
- **Verified Run #2 (Block `55,152,258`)** broadcasts 3 separate transactions (`tx1` `0xa9a12ef2…`, `tx2` `0x23984ec7…`, `tx3` `0x6dd63c93…`) from **two separate funded EOAs**: Searcher/Operator `0xb491…aDA5` and Victim EOA `0x524e…51Db` (`beneficiary ≠ operator`).
- **Hook v2 Run (Block `55,162,450`)** fires `ExtractionDetected` on `DarkTraceHook` v2 (`0xCeF7…c0c0`, tx `0xef694630…`).
- **2 earlier SDK smoke-test fixtures** on Arkiv Rabdi (`0xe9e56b6a…` and `0x9fe7bf2c…`) are automatically detected by `isSyntheticReceipt()` and labeled **`SYNTHETIC [DEMO]`** in the UI.

---

## Part 2 — Deep-Dive Technical Q&A

### Q7: "What's actually novel here?"
Most Uniswap v4 MEV hooks try to prevent extraction inside `beforeSwap` by adding dynamic fee spikes, auctions, or swap reverts, which adds latency and breaks aggregator routing. DarkTrace separates attribution from execution: our hook never blocks or taxes a swap. Instead, it fingerprints same-block tick inversions via transient and block-scoped storage, offloads constant-product counterfactual math off-chain, seals an indexed receipt on Arkiv, and settles LP restitution asynchronously in USDC on Arc against verifiable receipts.

---

### Q8: "The SimulationRegistry writer is a single EOA — why trust it?"
In this hackathon build, you do not have to trust the writer blindly because:
1. Every `SimulationRegistry` attestation references an immutable Arkiv `ExtractionReceipt` containing the exact Base Sepolia transaction hashes, pre-attack reserves, and deterministic `keccak256` simulation hash. Anyone can re-run `computeCounterfactual` against those inputs and verify the digest matches.
2. `SimulationRegistry` v2 Escrow (`0x31d5…0E77`) includes an on-chain **dispute window (`flagDispute`)** allowing authorized challengers to freeze any contested attestation before `claimableAt` expires.

---

### Q9: "What breaks first at scale?"
Two things break first at high throughput. First, our hook tracks one active `victimCandidate` and `frontrunTickDelta` per pool per block; if multiple independent sandwiches interleave inside the same pool during the same block, later swaps overwrite the earlier candidate slot. Second, our counterfactual engine uses single-range constant-product pricing (`x * y = k`), which is exact within one active v4 tick interval but drifts when a whale swap crosses multiple initialized tick boundaries.
