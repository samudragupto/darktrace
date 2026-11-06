# DarkTrace — Complete Booth & Judge Q&A Guide

**Tone**: Direct, honest about scope, zero marketing adjectives.  
**Evidence**: Every answer cites exact contract mechanisms, live transactions, test cases, or spec sections.

---

## Part 1 — Core Booth Q&A (Partner & Main Track Fundamentals)

### Q1 (False Positives): "What if two normal traders or an arbitrageur trigger the hook by coincidence?"
In Hook v1, any 3-swap tick inversion above `thresholdBps` emitted an alert. In **Hook v2 (`0xCeF7…c0c0`)**, we added a `BalanceDelta` profit-consistency check inside `afterSwap`: a candidate backrun only triggers `ExtractionDetected` if:
1. `tx3` is sent by the same searcher router/actor as `tx1` (`actor == s.frontrunSender`),
2. `tx2` was sent by a distinct address (`s.victimCandidate != actor` and `s.frontrunSender != actor`),
3. The tick reverses by at least `minTickDeltaThreshold` and recovers $\ge 30\%$ of the frontrun push (`_isInversionSignificant`), and
4. The searcher's net `currency0` (`amount0()`) round-trip delta across `tx1 + tx3` is strictly positive (`frontrunAmount0 + backrunAmount0 > 0`).

Unit tests in `contracts/test/DarkTraceHook.t.sol` (`test_FalsePositive_IndependentArbitrageurDoesNotTrigger` and `test_FalsePositive_UnprofitableRoundTripDoesNotTrigger`) prove that independent arbitrageurs and unprofitable round-trips do not fire.

---

### Q2 (Vault Funding): "Who actually funds the `RebateVault` in production? Where does the insurance money come from?"
- **In this Hackathon Demo (Testnet Reality):** On Arc Testnet, `RebateVault` v2 (`0x238d…4d5b`) is pre-funded with `5.00 USDC` by the protocol operator so judges can verify real on-chain USDC settlement (`3.539977 USDC` claimed by the Victim EOA in Verified Run #2; `1.460023 USDC` live reserve remaining).
- **In Production (3 Self-Sustaining Sources documented in `specs/03-arc-simulator.md`):**
  1. **Sandwich Bot Swap Fees (Primary Source):** Every 3-tx sandwich (`Frontrun + Victim + Backrun`) pays three `0.30%` pool swap fees into the Uniswap v4 pool. A hooked pool routes a share of swap fees (or dynamic hook fees collected during high-impact blocks) into the restitution reserve—meaning the fees the sandwich bot paid to execute the attack fund the victim's rebate.
  2. **Slashed Solver Collateral (`SearcherRegistry.sol`):** Institutional solvers stake bonds in `SearcherRegistry` (`0x24A2…3551` on Base Sepolia) to certify clean order flow; violations slash their bond.
  3. **Unclaimed Rebate Recycling (`expireUnclaimedRebate`):** In `RebateVault.sol`, rebates not claimed before `claimExpirySeconds` are recycled back into the active reserve (`totalExpiredUSDC`).

---

### Q3 (Why Arkiv vs. Postgres): "Why store receipts on Arkiv Rabdi instead of a standard database?"
If receipts lived in a private Postgres database, the operator could silently alter historical slippage numbers, backdate claims, or serve different records to the UI than what was attested on Arc. On **Arkiv Rabdi (`chainId 7794095`)**, every `ExtractionReceipt`, `SearcherProfile`, and `LPClaim` is an on-chain entity signed by our verified writer wallet (`0xb491…aDA5`), queryable by anyone without an API key, and content-addressed via canonical `receiptHash`. Furthermore, we use Arkiv's **block-based entity expiry (`expiresIn`)** deliberately: standard receipts expire after **30 days**, while receipts with an **open, unclaimed Arc attestation** are extended to **90 days** (`extendOpenReceiptExpiry`, verified in Rabdi tx `0x03512e4f…8744`) so evidence never disappears while a victim can still claim.

---

### Q4 (Why Arc): "Why settle rebates on Arc Testnet instead of paying on Base?"
Arc provides native 6-decimal USDC (`0x3600000000000000000000000000000000000000`) at the protocol level and sub-cent deterministic execution, making micro-rebates (such as `$3.54 USDC` in Verified Run #2) economically viable without L2 gas eating the restitution. Our Arc contracts (`SimulationRegistry` + `RebateVault`, generated in Arc Studio and upgraded in v2) implement programmable stablecoin guardrails:
- **`NotBeneficiary` recipient gating:** Proven on-chain when operator claim tx `0xef11bca9…` reverted before victim claim tx `0xb72bd280…` succeeded.
- **Escrow dispute windows (`flagDispute` / `resolveDispute`):** Deployed & verified on Arc Testnet at `0x31d5…0E77` / `0x0897…E104`.
- **Claim expiry reserve recycling (`expireUnclaimedRebate`):** Recycles unclaimed USDC liabilities back into the vault reserve after `claimExpirySeconds`.

---

### Q5 (Why a Uniswap v4 Hook): "Why use a v4 Hook instead of an off-chain mempool/event bot?"
First, Base Sepolia (and OP-stack rollups generally) has a sequencer without a public P2P mempool, and routers batch multiple user swaps inside a single transaction. Inside `DarkTraceHook` (`beforeSwap` / `afterSwap`), we:
1. Read exact `Slot0` ticks before and after each swap inside `PoolManager.swap`,
2. Consume `BalanceDelta` directly from `PoolManager` to verify searcher round-trip profitability on-chain,
3. Support **opt-in `hookData` victim attribution** (`0x01 || abi.encode(victimAddress)`) so aggregators sharing a single router contract can pass the true end-user address on-chain without relying on `tx.origin`, and
4. Use EIP-1153 `tstore` in `beforeSwap` and lazy `sstore` cleanup in `afterSwap`, cutting clean-swap gas overhead by **53.7%** (`58,522 → 27,085` gas).

---

### Q6 (Scripted-Attack Disclosure): "Were the sandwiches on Base Sepolia organic or scripted?"
They are **real on-chain transactions** triggered by our verification script (`pnpm e2e:real` / `apps/indexer/src/e2e-sandwich.ts`), because nobody organically sandwiches a testnet pool. We disclose this prominently in the README and UI:
- **Verified Run #2 (Block `55,152,258`)** broadcasts 3 separate transactions (`tx1` `0xa9a12ef2…`, `tx2` `0x23984ec7…`, `tx3` `0x6dd63c93…`) from **two separate funded EOAs**: Searcher/Operator `0xb491…aDA5` and Victim EOA `0x524e…51Db` (`beneficiary ≠ operator`).
- **Hook v2 Run (Block `55,162,450`)** fires `ExtractionDetected` on `DarkTraceHook` v2 (`0xCeF7…c0c0`, tx `0xef694630…`).
- **2 earlier SDK smoke-test fixtures** on Arkiv Rabdi (`0xe9e56b6a…` and `0x9fe7bf2c…`) are automatically detected by `isSyntheticReceipt()` and labeled **`SYNTHETIC [DEMO]`** in the UI.

---

## Part 2 — Insurance Fraud & Sybil Collusion ("Self-Sandwiching")

### Q7: "What stops a user from creating two wallets (Wallet A = Searcher, Wallet B = Victim), sandwiching themselves on purpose, and claiming the insurance rebate to drain `RebateVault`?"
This is the classic **Self-Sandwich / Insurance Fraud** attack. DarkTrace defends against it across **4 layers** (from on-chain rules to negative-EV pool fee math):

1. **Layer 1 — Same-Actor & Shared-Router Rejection in `DarkTraceHook.sol`:**
   - Inside `afterSwap`, the hook enforces `s.frontrunSender != actor` (on `tx2`) and `s.victimCandidate != actor` (on `tx3`). If the same address or `hookData`-attributed trader acts as both searcher and victim, the hook never emits `ExtractionDetected` (tested in `test_FalsePositive_ImmediateSelfReversalWithoutVictimDoesNotTrigger`).
2. **Layer 2 — Linked-Origin & Funding-Graph Filter in the Indexer (`linked-scanner.ts` & `onchain.ts`):**
   - The indexer inspects `getTransaction(tx1).from`, `getTransaction(tx2).from`, and `getTransaction(tx3).from`. If the searcher and victim share an EOA origin or funding link, it is flagged as self-dealing.
3. **Layer 3 — The "Insurance Deductible" Negative-EV Rule (Mathematical Guarantee):**
   - Why don't people crash their own car into their second car to collect insurance? Because the **deductible** exceeds the profit.
   - In any 3-swap sandwich (`Frontrun + Victim + Backrun`), the two wallets must pay **three `0.30%` pool swap fees** to the pool plus 3 transactions of gas. Look at Verified Run #2 on Base Sepolia:
     - Victim (`Wallet B`) lost **`-$3.54 USDC`** (`injectedSlippage`).
     - Searcher (`Wallet A`) only gained **`+$2.43 USDC`** net after paying the pool's `0.30%` swap fees—meaning **`$1.11 USDC` was burned to pool fees**.
   - When the vault caps unbonded rebates at the **pool fee burn (`Deductible = Searcher Gross Profit`, so `Max Unbonded Rebate <= Victim Loss - Searcher Net Profit = $1.11 USDC`)**, **Self-Sandwiching is strictly negative-EV ($\text{Net Profit} < 0$) even if an attacker uses 1,000 completely unlinked wallets**:
     $$\text{Attacker Net} = (+\$2.43\text{ on Wallet A}) + (-\$3.54\text{ on Wallet B}) + (\le +\$1.11\text{ Rebate}) - \text{Gas} < \$0$$
4. **Layer 4 — On-Chain Escrow Dispute Window (`flagDispute` & `resolveDispute` in `SimulationRegistry.sol`):**
   - In the Escrow registry/vault (`0x31d5…0E77` / `0x0897…E104`), attestations cannot be claimed until `disputeWindowSeconds` elapses. If a challenger flags a wash-trading cluster via `flagDispute(receiptHash, reason)`, the payout is frozen (`AttestationDisputed`), and `resolveDispute` either revokes the attestation (`uphold = false`) or applies a deductible haircut (`adjustedExtractedUSDC`) (tested in `test_DisputeWindow_ChallengerFlagsAndOwnerRevokes` and `test_DisputeWindow_ChallengerFlagsAndOwnerUpholdsWithAdjustedAmount`).

---

## Part 3 — All Technical Edge Cases

### Q8: "What happens if a searcher uses Contract A for the frontrun and Contract B for the backrun (Split-Contract Evasion)?"
Against Hook v2 alone, `afterSwap` requires `actor == s.frontrunSender` so it stays silent to avoid false positives on independent arbitrageurs (documented in `specs/08-hook-threat-model.md` §3). Our indexer's **off-chain linked-origin scanner (`apps/indexer/src/linked-scanner.ts`)** closes this gap: it scans every `Swap` log in the block and links `Contract A` and `Contract B` when their transactions were signed by the same EOA (`tx.from`). You can reproduce this against the real deployed Hook v2 with `./scripts/fork-proof-v2.sh` (Scenario B: hook stays silent, scanner catches the split-contract sandwich and seals `detectionPath = "offchain-linked"`).

---

### Q9: "What if all traders route through a single aggregator contract (like Universal Router)?"
If every swap enters `PoolManager` via the same router contract without `hookData`, `msg.sender` to `PoolManager` is identical. DarkTrace handles this in two ways:
1. **On-Chain Opt-In `hookData`:** Aggregators can pass `0x01 || abi.encode(traderAddress)` in `hookData`, which `_resolveActor` in `DarkTraceHook.sol` decodes so the hook attributes the true trader and victim on-chain without `tx.origin` (tested in `test_HookDataOptInVictimAttribution_SharedRouter`).
2. **Off-Chain `tx.from` Resolution:** For routers that pass empty `hookData`, `reconstructSandwich` in `apps/indexer/src/onchain.ts` resolves `victimOrigin = getTransaction(tx2).from` so the Arc attestation still names the true Victim EOA as `beneficiary`.

---

### Q10: "What if someone watches the Arkiv explorer and front-runs the victim's `claimRebate` transaction on Arc?"
They revert with `NotBeneficiary`. In `SimulationRegistry` v2 (`0xd501…61a2`) and `RebateVault` v2 (`0x238d…4d5b`), every attestation locks in `beneficiary = victimEOA`, and `claimRebate` checks `if (msg.sender != beneficiary) revert NotBeneficiary(msg.sender, beneficiary)`. Knowing a public `receiptHash` gives an attacker zero ability to claim its USDC (proven on-chain in revert tx `0xef11bca9…`).

---

### Q11: "What breaks first at scale?"
Two things break first at high throughput:
1. **Single candidate slot per pool per block in the hook:** `DarkTraceHook` stores one active `PoolTransientState` (`frontrunSender`, `victimCandidate`) per `poolId` per block. Once `tx2` sets `victimCandidate`, Hook v2 protects that slot from being overwritten by another same-direction push until `tx3` completes and clears the slot (`_clearTransientState`), but two *interleaved* sandwiches inside the same pool in the same block will collide in the hook (though `linked-scanner.ts` still reconstructs full block logs off-chain).
2. **Single-range CPMM counterfactual math:** `computeCounterfactual` uses `x * y = k` within the active liquidity range, which is exact inside one tick interval but drifts when a whale swap crosses multiple initialized tick boundaries.

---

## Part 4 — Hardest Judge Questions (Rehearse Verbatim)

### Q12: "The `SimulationRegistry` writer is a single EOA — why trust it?"
Honest answer: today you do trust it. One owner key (`0xb491…aDA5`) attests, and the same key owns the vault and can `emergencyWithdraw`. What you get instead of blind trust:
1. **Public Recomputability:** Every attestation points to an Arkiv `ExtractionReceipt` with the exact Base Sepolia tx hashes. The loss is rebuilt from `PoolManager`'s own `Swap` events, so anyone can recompute it (`pnpm --filter @darktrace/indexer process-tx <tx> --dry-run`) and compare with the attested amount.
2. **Recipient Containment:** In the live vault (v2, `0x238d…4d5b`), only the attested victim wallet (`beneficiary`) can claim.
3. **Dispute Window & Roadmap:** The escrow registry/vault (`0x31d5…0E77` / `0x0897…E104`) adds an on-chain dispute window (`flagDispute`) and claim expiry (`expireUnclaimedRebate`). Long term: optimistic or ZK proofs of the counterfactual simulation.

---

### Q13: "MEVictim Rebate did this at ETHGlobal NY 2023, and Angstrom / MEV Blocker exist. What's new?"
- **vs. MEVictim Rebate (ETHGlobal NY 2023):** They proved victimhood with Axiom ZK proofs and minted a soulbound NFT, but swap-fee rebates were never built. DarkTrace **paid real native USDC twice on Arc Testnet** (`3.57 USDC` in Run #1 and `3.54 USDC` in Run #2), the second time to a separate Victim EOA after the operator's claim reverted on-chain.
- **vs. MEV Blocker / Angstrom:** Prevention requires users to switch RPCs or pools to adopt batch auctions. DarkTrace is **post-execution restitution**, complementing prevention for standard Uniswap v4 pools that want a verifiable "victims get repaid" guarantee without adding latency or blocking swaps.

---

### Q14: "Is the live vault built in Arc Studio?"
The contract design and 60-test suite were generated and run in **Arc Studio** (`0x5279…2983` / `0x6760…c1de`). However, Arc Studio deploys from a cloud-custodied key (`0x5B12…Ef42`) that cannot be exported and provides no console to call `transferOwnership(0xb491…aDA5)`. Because `recordSimulation` is `onlyOwner`, our live indexer and web app settle against our self-custodied Foundry v2 deployment (`0xd501…61a2` / `0x238d…4d5b`), as documented in `README.md` and `arc-studio/report.md`.

---

## Part 5 — Executable Test Case Matrix for Live Q&A (`pnpm contracts:test` & `pnpm test`)

If a judge asks *"Did you actually test that edge case?"*, point them to these exact passing tests (`36/36` Foundry + `27/27` TypeScript):

| Category | Test Name | File | What It Proves |
| :--- | :--- | :--- | :--- |
| **Clean Swap Gas** | `test_CleanSwap_NoExtractionDetected` | `contracts/test/DarkTraceHook.t.sol` | Sub-threshold swap emits 0 events, writes 0 `sstore` slots (`27,085` gas, `-53.7%`). |
| **Hook Sandwich** | `test_SandwichAttack_EmitsExtractionDetected` | `contracts/test/DarkTraceHook.t.sol` | 3-swap sandwich (`SEARCHER → VICTIM → SEARCHER`) emits `ExtractionDetected`. |
| **Cross-Block Guard** | `test_DefensiveFallback_OpposingSwapsAcrossDifferentBlocks_NoEvent` | `contracts/test/DarkTraceHook.t.sol` | Frontrun in Block 100 + backrun in Block 101 never fires a false positive. |
| **False Positive #1** | `test_FalsePositive_IndependentArbitrageurDoesNotTrigger` | `contracts/test/DarkTraceHook.t.sol` | Independent arbitrageur (`ARBITRAGEUR != SEARCHER`) backrunning does not trigger. |
| **False Positive #2** | `test_FalsePositive_UnprofitableRoundTripDoesNotTrigger` | `contracts/test/DarkTraceHook.t.sol` | Searcher round-trip with net negative `amount0()` (`-0.03 ETH` after fees) does not trigger. |
| **Self-Sandwich Guard** | `test_FalsePositive_ImmediateSelfReversalWithoutVictimDoesNotTrigger` | `contracts/test/DarkTraceHook.t.sol` | Searcher buying and selling without a distinct victim in between does not trigger. |
| **Shared Router `hookData`** | `test_HookDataOptInVictimAttribution_SharedRouter` | `contracts/test/DarkTraceHook.t.sol` | Swaps via `SHARED_ROUTER` attribute `SEARCHER` and `VICTIM` from `hookData`. |
| **Hook Invariant Fuzz** | `testFuzz_SandwichProfitAndDirectionInvariants` | `contracts/test/DarkTraceHook.t.sol` | 256 fuzz runs over random deltas, ticks, and callers verify all 5 hook invariants. |
| **Real v4 `PoolManager`** | `test_RealPoolManager_ReproducesRun1Sandwich` | `contracts/test/DarkTraceHook.t.sol` | Replays Run #1 (`200 → 1,000 → backrun`) against real `PoolManager` (`+$2.428787 USDC` searcher profit). |
| **Stolen Receipt Guard** | `test_RevertWhen_AttackerClaimsToThemselves` | `contracts/test/RebateVault.t.sol` | Non-beneficiary claim reverts with `NotBeneficiary`. |
| **Owner Cannot Steal** | `test_RevertWhen_OwnerClaimsAsNonBeneficiary` | `contracts/test/RebateVault.t.sol` | Even registry/vault `owner` reverts with `NotBeneficiary` when claiming a victim's receipt. |
| **Escrow Cooling Period** | `test_DisputeWindow_BlocksEarlyClaimThenSucceedsAfterWindow` | `contracts/test/RebateVault.t.sol` | Early claim reverts `DisputeWindowActive`; succeeds after `disputeWindowSeconds`. |
| **Fraud Revocation** | `test_DisputeWindow_ChallengerFlagsAndOwnerRevokes` | `contracts/test/RebateVault.t.sol` | Challenger flags suspicious attestation (`AttestationDisputed`); owner revokes it permanently. |
| **Deductible Haircut** | `test_DisputeWindow_ChallengerFlagsAndOwnerUpholdsWithAdjustedAmount` | `contracts/test/RebateVault.t.sol` | Owner resolves dispute with reduced payout cap (`100 → 75 USDC`). |
| **Expiry Recycling** | `test_ClaimExpiry_RevertsAfterExpiryAndRecyclesToReserve` | `contracts/test/RebateVault.t.sol` | Expired claim reverts `ClaimExpired`; `expireUnclaimedRebate` recycles USDC to reserve. |
| **Double-Claim Guard** | `test_RevertWhen_ReplayClaim` | `contracts/test/RebateVault.t.sol` | Second claim on same `receiptHash` reverts `AlreadyClaimed`. |
| **Split-Contract Scanner** | `linked-origin scanner catches a 2-contract sandwich` | `apps/indexer/src/linked.test.ts` | Catches sandwich where frontrun and backrun use different contracts signed by same EOA. |
| **Fake Claim Tx Filter** | `verifyArcClaimTransaction` | `apps/web/src/lib/claims.test.ts` | `/api/claims/record` rejects any tx that didn't emit `RebateClaimed` on `RebateVault` v2. |
