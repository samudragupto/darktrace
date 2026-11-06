# Specification 08: DarkTraceHook Threat Model & v1 → v2 Evolution

## 1. Threat Model & Detection Scope

`DarkTraceHook` executes synchronously inside `PoolManager.swap` (`beforeSwap` and `afterSwap`). Because a hook only sees one swap at a time and cannot inspect unexecuted future transactions in the block, it operates as an **on-chain attribution and fingerprinting engine** (`ExtractionDetected`), paired with off-chain deterministic constant-product (`x * y = k`) counterfactual loss calculation and on-chain restitution settlement.

---

## 2. False-Positive Analysis & Mitigations in Hook v2

| Scenario | v1 Behavior (`0xBCC9…80c0`) | v2 Mitigation |
| :--- | :--- | :--- |
| **1. Three independent traders (`Trader A → Victim B → Arbitrageur C`)** | **False positive:** v1 checked `s.victimCandidate != sender` on the opposing swap (`C != B`) without verifying that the backrunner was the same actor who executed the frontrun (`C == A`). | **Fixed in v2:** Case A requires `actor == s.frontrunSender` in addition to `actor != s.victimCandidate`. An independent arbitrageur `C != A` reversing the pool price after two directional swaps does not trigger `ExtractionDetected` (`test_FalsePositive_IndependentArbitrageurDoesNotTrigger`). |
| **2. Unprofitable round-trip / rebalance (`Searcher A → Trader B → Searcher A` with net loss)** | **False positive:** v1 checked only tick inversion (`>= 30%` of push) and ignored `BalanceDelta` in `afterSwap`, emitting even when the searcher lost money after paying `2 × 0.30%` LP fees. | **Fixed in v2:** `_isProfitableToken0(s.frontrunAmount0, delta.amount0())` verifies `int256(frontrunAmount0) + int256(backrunAmount0) > 0` using the swap's realized `BalanceDelta` (`test_FalsePositive_UnprofitableRoundTripDoesNotTrigger`). |
| **3. Immediate self-reversal without a victim (`Trader A` buys then immediately sells)** | **No event:** `s.victimCandidate` remains `address(0)` because `s.frontrunSender != actor` is false on the second swap. | **Preserved & cleared in v2:** When `actor` reverses without a victim candidate, v2 clears transient state (`_clearTransientState`) unless the reversal itself exceeds `minTickDeltaThreshold` (`test_FalsePositive_ImmediateSelfReversalWithoutVictimDoesNotTrigger`). |
| **4. JIT (Just-In-Time) liquidity (`addLiquidity → Victim Swap → removeLiquidity`)** | **No event:** `beforeAddLiquidity` and `afterRemoveLiquidity` permissions are disabled (`false`), and liquidity changes do not invoke `beforeSwap`/`afterSwap` or shift `slot0.tick`. | **Out of sandwich scope by design:** JIT LP provisioning improves victim execution price (negative injected slippage); DarkTrace targets extractive price-impact sandwiches. |
| **5. Shared aggregator / universal router batching** | **Collision / false negative:** In Uniswap v4, `afterSwap`'s `sender` is the router contract (`msg.sender` to `PoolManager`). If two traders use the same router, `lastSender == sender`. Furthermore, v1 shifted `lastSender` by `120` bits in `slotA`, truncating the top 24 bits of 160-bit addresses. | **Fixed in v2:** (a) Full 160-bit addresses are stored in `slotA` (`48 + 8 + 24 + 160 = 240` bits) and `slotB` (`96 + 160 = 256` bits) with zero truncation; (b) `_resolveActor(sender, hookData)` supports an optional `tx.origin`-free `hookData` attribution flag (`0x01 \|\| abi.encode(address)` or 32-byte `abi.encode(address)`) so routers can opt into per-user attribution (`test_HookDataOptInVictimAttribution_SharedRouter`). |

---

## 3. False-Negative Boundaries (Known Limitations)

1. **Sybil searcher contracts (`Searcher Contract A` frontruns, `Searcher Contract B` backruns):**
   - Because Hook v2 enforces `actor == s.frontrunSender` to eliminate independent-arbitrageur false positives, a sophisticated searcher splitting its frontrun and backrun across two distinct router contracts (`A != B`) will evade single-hook matching unless both contracts pass the same attributed searcher identity in `hookData`.
2. **Split / salami frontruns (multiple micro-swaps each below `minTickDeltaThreshold`):**
   - A searcher splitting a frontrun into many small swaps that each move the tick by `< minTickDeltaThreshold` (`15` ticks) will not arm `frontrunTickDelta`, though doing so incurs repeated base transaction / callback overhead.
3. **Cross-pool / multi-hop sandwiches:**
   - State is keyed by `PoolId` (`keccak256(abi.encode(poolId, ...))`). A frontrun on `Pool 1` (e.g. `USDC/WETH 0.05%`) paired with a backrun on `Pool 2` (`USDC/WETH 0.30%`) is not correlated on-chain by a single pool's hook state.

---

## 4. Storage Layout & Gas Optimization (`v1` vs. `v2`)

### Why `sstore` Exists Alongside `tstore`
EIP-1153 transient storage (`tstore` / `tload`) is cleared at the end of every **transaction**, whereas an on-chain sandwich spans **three separate transactions** (`tx1` frontrun, `tx2` victim, `tx3` backrun) within the same **block**. Consequently, cross-transaction intra-block state requires persistent storage (`sstore` / `sload`) gated by `lastBlock == uint48(block.number)`.

### What v1 Wasted
1. **`beforeSwap` `sstore` on every swap:** v1 executed both `tstore(preTickSlot, packedTick)` and `sstore(preTickSlot, packedTick)` in `beforeSwap`. Because `beforeSwap` and `afterSwap` always execute inside the same `PoolManager.swap` call frame, `preTickSlot` never crosses a transaction boundary; writing it via `sstore` wasted a cold/warm storage write on every swap.
2. **Unconditional `sstore(slotA)` and `sstore(slotB)` on sub-threshold swaps:** v1 wrote both state slots at the end of `afterSwap` even when `abs(tickDelta) < minTickDeltaThreshold` and no candidate existed in the current block.
3. **Unowned threshold bug:** v1 set `owner = msg.sender` in its constructor. When deployed via Foundry's canonical `CREATE2_DEPLOYER` (`0x4e59b44847b379578588920cA78FbF26c0B4956C`), `owner` became the keyless CREATE2 factory, permanently locking `minTickDeltaThreshold`.

### How v2 Fixes All Three
1. **`beforeSwap` is 100% `tstore`-only:** `preTickSlot` uses `tstore`/`tload` exclusively (`0` `sstore`s).
2. **Lazy block-scoped `sstore` & post-detection clearing:**
   - Clean swaps (`abs(tickDelta) < minTickDeltaThreshold` with no active same-block push) perform **zero `sstore` writes**.
   - Victim swaps (Case B) update only `slotB` (`victimCandidate`), leaving `slotA` untouched.
   - When `ExtractionDetected` fires (Case A), `_clearTransientState` zeroes both `slotA` and `slotB`, earning the EVM storage-clearing gas refund.
3. **Explicit `owner` constructor parameter:** `constructor(IPoolManager _poolManager, int24 _minTickDeltaThreshold, address _owner)` sets the deployer/governance wallet as `owner` even under `CREATE2`.

### Gas Benchmark Snapshot (`DarkTraceHookTest`)

| Benchmark Case | Hook v1 (`0xBCC9…80c0`) | Hook v2 | Delta |
| :--- | ---: | ---: | ---: |
| `test_CleanSwap_NoExtractionDetected` (non-sandwich swap) | `86,612` gas (`158,233` isolated) | `40,110` gas | **`-46,502` gas (`-53.7%`)** |
| `test_SandwichAttack_EmitsExtractionDetected` (full 3-swap detection) | `155,412` gas (`390,928` isolated) | `88,155` gas | **`-67,257` gas (`-43.3%`)** |
| `test_DefensiveFallback_OpposingSwapsAcrossDifferentBlocks_NoEvent` | `151,890` gas (`384,245` isolated) | `110,466` gas | **`-41,424` gas (`-27.3%`)** |

