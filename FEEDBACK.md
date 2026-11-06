# DarkTrace — Uniswap Foundation Feedback

Submitted to the Uniswap Hackathon Feedback Form on [DATE — I will fill in].

## How we used the Uniswap stack

In [`contracts/src/DarkTraceHook.sol`](./contracts/src/DarkTraceHook.sol), I implemented `IHooks` with `beforeSwap` and `afterSwap` permissions and mined CREATE2 salts via Foundry's canonical `CREATE2_DEPLOYER` (`0x4e59b44847b379578588920cA78FbF26c0B4956C`) so both deployed hook addresses on Base Sepolia—v1 at `0xBCC9e1C474Ed195b3791f2c41EdAC2a25c5b80c0` (salt `0x139d`) and v2 at `0xCeF7a999885D93f23Beeb7D319A83F2949B2c0c0` (salt `0x180d`)—satisfy the `0x00C0` (`BEFORE_SWAP_FLAG | AFTER_SWAP_FLAG`) bitmask.

Building and iterating from v1 to v2 surfaced four concrete engineering friction points in Uniswap v4 hook development:

1. **Intra-transaction vs. intra-block state (`tstore` vs. `sstore`):** EIP-1153 transient storage clears at the end of each transaction, whereas a sandwich spans three separate transactions (frontrun, victim, backrun) within the same block. In v1, we wrote `preTickSlot`, `stateA`, and `stateB` to both `tstore` and `sstore` on every swap (`158,233` gas isolated / `86,612` gas in-frame per clean swap). In v2, we realized `beforeSwap` and `afterSwap` always execute inside the same `PoolManager.swap` call frame, so `preTickSlot` uses `tstore`/`tload` exclusively (`0` `sstore`s), and sub-threshold clean swaps (`abs(tickDelta) < minTickDeltaThreshold`) skip `sstore` completely. Combined with clearing `stateA`/`stateB` after detection (`_clearTransientState`), clean-swap hook execution dropped to **`40,110` gas (`-53.7%`)**.
2. **Hook `sender` is the router contract, not the end user:** In `PoolManager.swap`, the `sender` passed to `afterSwap` is `msg.sender` to `PoolManager` (the router contract). When two traders use the same universal router, `sender` collides. In v2, we added `_resolveActor(sender, hookData)` so routers can opt into a `tx.origin`-free attribution path (`0x01 || abi.encode(address)` or 32-byte `abi.encode(address)`), and we fixed a v1 bit-packing bug where `uint160(lastSender) << 120` truncated the upper 24 bits of 160-bit addresses.
3. **False positives without `BalanceDelta` profit-consistency:** Checking tick inversion alone fires when an independent arbitrageur (`Trader C != Frontrunner A`) reverses the price after two directional swaps, or when a round-trip loses money after paying `2 × 0.30%` LP fees. In v2, `afterSwap` enforces both `actor == s.frontrunSender` and `_isProfitableToken0(s.frontrunAmount0, delta.amount0())` (`frontrunAmount0 + backrunAmount0 > 0`) directly from v4's `BalanceDelta`.
4. **CREATE2 salt-mining traps `owner = msg.sender`:** Deploying a hook through `0x4e59b44847b379578588920cA78FbF26c0B4956C` makes `msg.sender` inside the constructor the keyless CREATE2 factory, which permanently locked `minTickDeltaThreshold` on v1 (`0xBCC9…80c0`). Hook v2 (`0xCeF7…c0c0`) takes an explicit `address _owner` constructor argument (and folds `owner` into the CREATE2 initcode hash before salt mining).

## Repo pointers
- Hook v2 (profit-consistent, `tstore`-optimized, opt-in `hookData` attribution): [`contracts/src/DarkTraceHook.sol`](./contracts/src/DarkTraceHook.sol)
  - `beforeSwap` (`tstore`-only): lines 124-141
  - `afterSwap` (`BalanceDelta` profit check + state clearing): lines 146-243
  - `_resolveActor` (`tx.origin`-free `hookData` attribution): lines 256-265
  - Block-scoped state packing (`slotA` 240 bits, `slotB` 256 bits): lines 296-378
- Threat model & gas benchmarks: [`specs/08-hook-threat-model.md`](./specs/08-hook-threat-model.md)
- Tests (unit, false-positive guards, fuzz, and real `PoolManager` Run #1 reproduction): [`contracts/test/DarkTraceHook.t.sol`](./contracts/test/DarkTraceHook.t.sol)
- Bond registry: [`contracts/src/SearcherRegistry.sol`](./contracts/src/SearcherRegistry.sol)
- Deployed hooks (Base Sepolia):
  - Hook v2 (active, owned): `0xCeF7a999885D93f23Beeb7D319A83F2949B2c0c0`
  - Hook v1 (retained for Verified Runs #1 & #2): `0xBCC9e1C474Ed195b3791f2c41EdAC2a25c5b80c0`

## Feature requests
1. An optional `afterBlock` checkpoint callback on `PoolManager`—or a canonical `TransientRingBuffer` in `v4-periphery`—for block-scoped MEV lookback across transactions.
2. A first-class `hookData` trader-attribution convention in `v4-periphery` routers so hooks can identify end-user beneficiaries without `tx.origin`.
3. A `HookMiner` warning in template scripts reminding developers never to use `owner = msg.sender` inside a `CREATE2`-mined hook constructor.

## Not covered here
Economic and settlement design on Arc and the forensic proof ledger on Arkiv are documented in [`specs/submission/partner-feedback.md`](./specs/submission/partner-feedback.md) and `/arkiv/*.md`.
