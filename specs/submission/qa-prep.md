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
Honest answer: today you do trust it. One owner key (`0xb491…aDA5`) attests, and the same key owns the vault and can `emergencyWithdraw`. What you get instead of blind trust:
1. **Verifiability.** Every attestation points to an Arkiv `ExtractionReceipt` with the exact Base Sepolia tx hashes. The loss is rebuilt from the PoolManager's own `Swap` events, so anyone can recompute it (`pnpm --filter @darktrace/indexer process-tx <tx> --dry-run`) and compare with the attested amount.
2. **Containment.** In the live vault (v2, `0x238d…4d5b`) only the attested victim wallet can claim, so a stolen receipt hash is worthless.
3. **Next step, already written.** The escrow registry/vault (`0x31d5…0E77` / `0x0897…E104`) adds a dispute window and claim expiry. It is deployed and tested but **not live**: it holds 0 USDC and the app does not use it. Long term: optimistic or ZK proofs of the loss.

---

### Q9: "What breaks first at scale?"
Two things break first at high throughput. First, our hook tracks one active `victimCandidate` and `frontrunTickDelta` per pool per block; if multiple independent sandwiches interleave inside the same pool during the same block, later swaps overwrite the earlier candidate slot. Second, our counterfactual engine uses single-range constant-product pricing (`x * y = k`), which is exact within one active v4 tick interval but drifts when a whale swap crosses multiple initialized tick boundaries.

---

## Part 3 — Hardest Questions (rehearse these out loud)

### Q10: "MEVictim Rebate did this at ETHGlobal NY 2023. What's new?"
They proved victimhood with Axiom ZK proofs and minted a soulbound NFT, but the swap-fee rebates were never built. DarkTrace **paid USDC twice** (3.57 and 3.54 on Arc), the second time to the victim's own wallet after the operator's claim **reverted on-chain**, and every step is a public tx or Arkiv entity. Their proof model is stronger than our single attester; that is our roadmap, not our claim.

### Q11: "Can't a searcher just backrun from a second contract?"
Against hook v2 alone, yes: v2 requires the same actor on both legs to avoid false positives (threat model §3). The indexer's **linked-origin scanner** closes it: it links frontrun and backrun by the EOA that signed them. `./scripts/fork-proof-v2.sh` shows it on the real hook v2: the hook stays silent, the scanner flags the sandwich, and the receipt names the victim's wallet (`detection=linked-origin`). Not caught: searchers using different EOAs *and* contracts, which look like two independent traders.

### Q12: "Who pays for this?"
Testnet: the operator funded the vault. The design routes slashed `SearcherRegistry` bonds and a share of hook fees into it; neither is built yet, and no searcher has posted a bond (the UI reads `0.0000 ETH` live). meva funds victims from a bot tax; that is the model we would converge on.

### Q13: "Why not just prevent it? MEV Blocker and Angstrom exist."
Prevention needs the user to switch RPC or venue. DarkTrace gives a pool a verifiable restitution guarantee for the flow that still gets sandwiched. It complements prevention; we don't claim to replace it.

### Q14: "Were both wallets in run #2 yours?"
Yes. The victim is a separate EOA (`0x524e…51Db`) that signed its own swap and its own claim, but its key is derived from the operator key. The contracts can't tell the difference; the point of the run is that only the attested beneficiary could claim, which the reverted operator claim proves.

### Q15: "Is the live vault built in Arc Studio?"
No. The Studio deployment (`0x5279…` / `0x6760…`) is our v1 schema and its deployer key can't be exported or used to transfer ownership, so the app settles on our Foundry deployment of the evolved design. Show the Studio project for the design and tests; don't claim it pays out.

### Q16: "This is a lot of code in two days. How much is AI?"
A lot, and it's disclosed per file in `AI_ATTRIBUTION.md`. What we can show is that it's verified: 36 contract tests, TypeScript tests from real chain data, two on-chain runs, and fork proofs anyone can rerun.

