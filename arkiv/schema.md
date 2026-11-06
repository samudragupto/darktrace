# Arkiv Schema — darktrace.v1

Technical specification for the three entity schemas indexed on the Arkiv Rabdi testnet (Chain ID `7794095`) under the `darktrace.v1` namespace.

The source of truth is the `defineSchema(...)` calls in [`lib/arkiv/sdk.ts`](../lib/arkiv/sdk.ts). The indexer writes and the web app reads through those same schemas.

| Logical entity | SDK schema name (`arkiv.schema` tag) |
| :--- | :--- |
| `ExtractionReceipt` | `receipts` |
| `SearcherProfile` | `darktrace.searcher_profiles` |
| `LPClaim` | `darktrace.lp_claims` |

---

## 1. Protocol Entity Schemas

### 1.1 `ExtractionReceipt` (Forensic MEV Proof)
- **Owner Wallet:** `0xb491fe5846DE735B6Cb03a677A3C6296FAB0aDA5` (authorized DarkTrace indexer worker).
- **Expiration Policy:**
  - **Default TTL (`RECEIPT_TTL_DAYS = 30`):** Created with `ExpirationTime.fromDays(30)`.
  - **Open-Claim Extension (`OPEN_CLAIM_TTL_DAYS = 90`):** Receipts with an unclaimed rebate (`claimForReceipt(receiptHash) === null`) have their expiration deliberately extended to **90 days** via `walletClient.extendEntity({ entityKey, expiration: ExpirationTime.fromDays(90) })` (`ArkivSdk.extendOpenReceiptExpiry`) so forensic proof never expires while an attestation remains claimable on Arc.
  - *Verified Live Extension:* Open-claim Hook v2 receipt `$key 0x259dc2884aab483503458ce1ebb716c4e90bf156eadfaaa2e9761d2ec60b0fd2` (`receiptHash 0x2d992c83…ef1c`) was extended from block `#1,580,336` to `#4,172,852` in Rabdi tx `0x03512e4f36a5d7b9e88be1f496d1353f59972f56cf1df54c030de4f1d3548744`.
- **Indexed Fields:**
  - `poolId`: `str().indexed()` — Enables O(1) query of all historical extractions for a specific Uniswap v4 pool.
  - `searcher`: `addr().indexed()` — Enables aggregating extractions into searcher reputation dossiers.
  - `victim`: `addr().indexed()` — Enables liquidity providers and victim swappers to discover compensable MEV losses.
  - `lp`: `addr().indexed()` — Enables pro-rata LP claim routing.
  - `blockNumber`: `u64().indexed()` — Enables range queries across blocks.
  - `receiptHash`: `str().indexed()` — Enables canonical point lookups matching on-chain `bytes32 receiptHash` in `SimulationRegistry.sol`.
- **Stored Non-Indexed Attributes:**
  - `extractedUSDC`: `dec()` — Quantified USDC extracted by injected slippage (6 decimals).
  - `simulationHash`: `str()` — Hash of counterfactual CPMM inputs.
  - `txHashes`: `bytes()` — Serialized JSON array containing the 3-transaction sandwich footprint (`[frontrunTx, victimTx, backrunTx]`).
  - `injectedSlippageBps`: `u64().optional()` — Slippage attributed to the frontrun.
  - `legitSlippageBps`: `u64().optional()` — Clean-market slippage from the CPMM counterfactual.
  - `createdAtMs`: `u64().optional()` — Receipt creation time. Together with the fields above, it lets anyone recompute `receiptHash` from Arkiv data alone.
  - *Why optional:* the sample entity below was written before these columns existed. Optional columns let it still match the schema, so it isn't silently skipped on reads. New writes always fill them in.

#### Verified Live On-Chain Example (Arkiv Rabdi Testnet)
The following record was created and verified on-chain via transaction `0x544ee730bb736cdbafcd837bad62f857c8ed0e0eaedf7afce807ffb060c6e0f6`:
```json
{
  "$key": "0xc327d5db4aa3098b80dc8729d090317408f98d19e1e19c13d6cf83494a05f8ca",
  "$owner": "0xb491fe5846DE735B6Cb03a677A3C6296FAB0aDA5",
  "receiptHash": "0xe9e56b6adbf0cae90f08b28a0ae3dccd9fc4ece42eb7b0126e4f208646eae6ce",
  "poolId": "0x835c24ae58a98118715d7541b2c5f0df8f11ca328b8e9c9c3850441c632e8d21",
  "searcher": "0x1111111111111111111111111111111111111111",
  "victim": "0x2222222222222222222222222222222222222222",
  "lp": "0x3333333333333333333333333333333333333333",
  "blockNumber": 12489201,
  "extractedUSDC": "1.25",
  "simulationHash": "0xc9ddedeba69e600924875d3ce6c3e2cd554170c510cec4bfd5016182dc156309",
  "txHashes": "[\"0xaaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111\",\"0xbbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222\",\"0xcccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333\"]"
}
```

---

### 1.2 `SearcherProfile` (Reputation Dossier)
- **Owner Wallet:** `0xb491fe5846DE735B6Cb03a677A3C6296FAB0aDA5`.
- **Expiration Policy:** 30 days (`ExpirationTime.fromDays(30)`).
- **Indexed Fields:**
  - `searcher`: `addr().indexed()` — Lookup key for searcher reputation profiles.
  - `lastSeenBlock`: `u64().indexed()` — Recency filter for active searcher monitoring.
- **Stored Non-Indexed Attributes:**
  - `extractions`: `u64()` — Total cumulative sandwich events detected.
  - `bondedUSDC`: `dec()` — Forensic bond on Base Sepolia (starts at `0`; no invented default).
  - `slashedUSDC`: `dec()` — Cumulative bond reduced on Base Sepolia.
- **Upsert:** the indexer `patchEntity`s the existing profile owned by the writer, or `createEntity`s the first one.

#### Verified Live On-Chain `SearcherProfile` (Arkiv Rabdi Testnet)
```json
{
  "$key": "0x42a19bb65560786c947020b82467ea65bf6373f26455e9a88dce82ee84959b9d",
  "$owner": "0xb491fe5846DE735B6Cb03a677A3C6296FAB0aDA5",
  "searcher": "0xc31545299093C46d87752cD6378A811BFDD9940D",
  "extractions": 3,
  "bondedUSDC": "0",
  "slashedUSDC": "0",
  "lastSeenBlock": 55162450
}
```

---

### 1.3 `LPClaim` (Restitution Proof)
- **Owner Wallet:** `0xb491fe5846DE735B6Cb03a677A3C6296FAB0aDA5`.
- **Expiration Policy:** 30 days (`ExpirationTime.fromDays(30)`).
- **Indexed Fields:**
  - `lp`: `addr().indexed()` — Queries all historical USDC restitution claims by an LP.
  - `receiptHash`: `str().indexed()` — Ensures one-to-one claim mapping.
- **Stored Non-Indexed Attributes:**
  - `claimTx`: `str()` — On-chain Arc Testnet transaction hash settling the USDC transfer.
  - `createdAtMs`: `u64()` — Epoch timestamp (ms) of claim execution.

#### Verified Live On-Chain `LPClaim` (Arkiv Rabdi Testnet — Verified Run #2)
```json
{
  "$key": "0x45dcfc2de3a9b1e6738ef67dcfa323c202f28683da820c35cf0f27d3b6d89a35",
  "$owner": "0xb491fe5846DE735B6Cb03a677A3C6296FAB0aDA5",
  "receiptHash": "0xe191f885168d1d06b6c7d27ef00504d58f7661c7da5adc8c3a79aaf8bb72959a",
  "lp": "0x524e061C89036b12a4f377bD8999038Da3A551Db",
  "claimTx": "0xb72bd280acafa1f1cec3f6738066070e1bc0940408348ed530fb54b39df1fd00"
}
```

---

## 2. Read Path & Data Quality in DarkTrace Application

Every read is filtered `.ownedBy(writer)`. The web routes below run on the server and query Arkiv on every request:

1. [`apps/web/src/app/dashboard/page.tsx`](../apps/web/src/app/dashboard/page.tsx): `receipts` ordered by `blockNumber desc` joined with `darktrace.lp_claims`.
2. [`apps/web/src/app/receipt/[hash]/page.tsx`](../apps/web/src/app/receipt/[hash]/page.tsx): `receipts where receiptHash = …` (or `getEntity($key)`), plus `darktrace.lp_claims where receiptHash = …`.
3. [`apps/web/src/app/pool/[id]/page.tsx`](../apps/web/src/app/pool/[id]/page.tsx): `receipts where poolId = …` joined with `darktrace.lp_claims`.
4. [`apps/web/src/app/searcher/[address]/page.tsx`](../apps/web/src/app/searcher/[address]/page.tsx): `darktrace.searcher_profiles where searcher = …` (`getSearcherProfile`) plus `receipts where searcher = …` joined with `darktrace.lp_claims`.
5. [`apps/web/src/app/lp/[address]/page.tsx`](../apps/web/src/app/lp/[address]/page.tsx): `receipts where victim = …` ∪ `where lp = …`, plus `darktrace.lp_claims`.
6. [`apps/web/src/app/api/stats/route.ts`](../apps/web/src/app/api/stats/route.ts): aggregate count and USDC sum over `receipts`.

### Data Quality Note (Real On-Chain Entities vs. Synthetic SDK Fixtures)
- **Real On-Chain Receipts (3):** `$key 0x259dc288…0fd2` (Hook v2 pool `0x5d78af67…1afc63df`, Base Sepolia block `55,162,450`, `3.57 USDC`, open claim extended to 90d TTL), `$key 0x2286e8a0…5d27` (Verified Run #2, block `55,152,258`, `3.54 USDC`, `REBATED`), and `$key 0x837ad00c…32a8` (Verified Run #1, block `55,113,190`, `3.57 USDC`, `REBATED`).
- **Synthetic Smoke-Test Fixtures (2):** `$key 0xc327d5db…f8ca` and `$key 0x6cc9605f…11a7` were written by [`scripts/arkiv-write-test.ts`](../scripts/arkiv-write-test.ts) using placeholder addresses (`0x1111…` / `0x2222…`) and synthetic tx hashes (`0xaaaa1111…`). `isSyntheticReceipt()` detects these fixtures and labels them with a **`FIXTURE`** badge in the UI so judges can distinguish SDK smoke tests from real Base Sepolia extractions at a glance.
