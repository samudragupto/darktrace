# How DarkTrace Uses Arkiv

**Protocol:** DarkTrace
**Namespace:** `darktrace.v1`
**Network:** Arkiv Rabdi Testnet (Chain ID `7794095`)
**SDK:** `@arkiv-network/sdk@1.0.1`. One module, [`lib/arkiv/sdk.ts`](../lib/arkiv/sdk.ts), is the only code that talks to Arkiv.

---

## 1. Data Flow

```
Base Sepolia hook ── ExtractionDetected ──▶ indexer ──createEntity──▶ Arkiv Rabdi ◀──select/where── web app (server components)
                                         (apps/indexer)                 (receipts)                (apps/web)
```

- **Write:** [`apps/indexer/src/pipeline.ts`](../apps/indexer/src/pipeline.ts) calls `ArkivClient.writeExtractionReceipt()`. That calls `ArkivSdk.writeReceipt()`, which runs `walletClient.createEntity(ReceiptsSchema, …)`. The indexer refuses to start without `ARKIV_PRIVATE_KEY`, unless `ARKIV_DEV_MODE=memory` is set explicitly.
- **Read:** every receipt the web app displays comes from an Arkiv query run server-side on each request (`dynamic = "force-dynamic"`). If a query fails, the page shows a red error strip and **no fallback data**.

---

## 2. Query Patterns (all in [`lib/arkiv/sdk.ts`](../lib/arkiv/sdk.ts))

Every read is filtered with `.ownedBy(writer)`. Anyone can write an entity named `receipts`, so DarkTrace trusts only entities owned by its writer wallet.

| Method | Query |
| :--- | :--- |
| `getReceiptByHash` | `select().from(Receipts).where(eq("receiptHash", h)).ownedBy(writer).limit(1)` |
| `getReceiptByEntityKey` | `getEntity($key, Receipts)` plus an owner check |
| `listRecentReceipts` | `select().from(Receipts).ownedBy(writer).orderBy(desc("blockNumber")).limit(n)` |
| `listReceiptsByPool` | `…where(eq("poolId", id))…orderBy(desc("blockNumber"))` |
| `listReceiptsBySearcher` | `…where(eq("searcher", addr(a)))…` |
| `listReceiptsByParty` | `…where(eq("victim", addr(a)))` ∪ `…where(eq("lp", addr(a)))` |
| `getSearcherProfile` / `listSearcherProfiles` | `select().from(SearcherProfiles).where(eq("searcher", addr(a))).ownedBy(writer)` / `.orderBy(desc("lastSeenBlock"))` |
| `listLPClaims` / `claimForReceipt` | `select().from(LPClaims).where(eq("lp" \| "receiptHash", …)).ownedBy(writer)` |
| `extendOpenReceiptExpiry` | Checks `claimForReceipt(receiptHash) === null`, then calls `walletClient.extendEntity({ entityKey, expiration: ExpirationTime.fromDays(90) })` |

---

## 3. User-Facing Features That Read Arkiv

Each page shows a purple **"Live from Arkiv Rabdi"** strip naming the query it ran, the number of entities returned, the trusted owner, and when the query ran. Every receipt row links to its entity on `rabdi.explorer.arkiv.network`.

| Route | File | Arkiv read |
| :--- | :--- | :--- |
| `/dashboard` | [`apps/web/src/app/dashboard/page.tsx`](../apps/web/src/app/dashboard/page.tsx) | `listRecentReceipts(25)` joined with `listLPClaims()` (claimed receipts show `REBATED`), total extracted, searcher leaderboard, and each pool's "Extracted (Arkiv)" column |
| `/receipt/[hash]` | [`apps/web/src/app/receipt/[hash]/page.tsx`](../apps/web/src/app/receipt/[hash]/page.tsx) | `getReceiptByHash` (falls back to `getEntityKey`) plus `claimForReceipt`. Renders `$key`, `$owner`, created/expiry block (`EXTENDED TO 90d` badge if extended), amounts, and the decoded `txHashes` |
| `/pool/[id]` | [`apps/web/src/app/pool/[id]/page.tsx`](../apps/web/src/app/pool/[id]/page.tsx) | `listReceiptsByPool` joined with `listLPClaims()` plus per-pool extraction block timeline |
| `/searcher/[address]` | [`apps/web/src/app/searcher/[address]/page.tsx`](../apps/web/src/app/searcher/[address]/page.tsx) | `getSearcherProfile(address)` (renders `$key`, `extractions`, `lastSeenBlock`, `$expiresAt`) alongside `listReceiptsBySearcher` joined with `listLPClaims()` |
| `/lp/[address]` | [`apps/web/src/app/lp/[address]/page.tsx`](../apps/web/src/app/lp/[address]/page.tsx) | `listReceiptsByParty` plus `listLPClaims` (matches claims by `receiptHash` and `lp` so a receipt with a claim shows as `REBATED`) |
| `/api/stats` | [`apps/web/src/app/api/stats/route.ts`](../apps/web/src/app/api/stats/route.ts) | `listRecentReceipts(100)` aggregate, with `arkivSource: "rabdi" \| "unreachable"` |

The shared data layer is [`apps/web/src/lib/arkiv.ts`](../apps/web/src/lib/arkiv.ts) (`fromArkiv()` wraps every read with an 8 s timeout and reports failures honestly). The provenance strip is [`components/arkiv/ArkivSource.tsx`](../apps/web/src/components/arkiv/ArkivSource.tsx).

---

## 4. Permissions, Ownership & Deliberate Expiration Policy

- **Writer:** `0xb491fe5846DE735B6Cb03a677A3C6296FAB0aDA5` (override with `ARKIV_WRITER_ADDRESS`). Reads ignore entities from any other owner.
- **Default Expiration (`RECEIPT_TTL_DAYS = 30`):** New receipts, searcher profiles, and LP claims are created with `ExpirationTime.fromDays(30)`.
- **Open-Claim Expiration Extension (`OPEN_CLAIM_TTL_DAYS = 90`):** When an `ExtractionReceipt` has an open (unclaimed) rebate (`claimForReceipt(receiptHash) === null`), `ArkivSdk.extendOpenReceiptExpiry(receiptHash, 90)` extends its lifetime to **90 days** via `walletClient.extendEntity({ entityKey, expiration: ExpirationTime.fromDays(90) })` so a victim's forensic receipt never expires while its attestation is still claimable on Arc.
  - **Verified Live Extension on Rabdi:** Open-claim Hook v2 receipt [`$key 0x259dc288…0fd2`](https://rabdi.explorer.arkiv.network/entity/0x259dc2884aab483503458ce1ebb716c4e90bf156eadfaaa2e9761d2ec60b0fd2) (`receiptHash 0x2d992c83…ef1c`) had its `$expiresAt` extended from block `#1,580,336` (30d) to block **`#4,172,852`** (90d) in Rabdi tx `0x03512e4f36a5d7b9e88be1f496d1353f59972f56cf1df54c030de4f1d3548744`. The UI surfaces a `90d TTL` / `EXTENDED TO 90d (OPEN CLAIM)` badge on any receipt with an extended lifetime (`expiresAtBlock - createdAtBlock > 2,000,000`).

---

## 5. Data Quality: Real vs. Synthetic Entities on Rabdi

Every entity owned by `0xb491…aDA5` on Arkiv Rabdi is accounted for below. Because [`scripts/arkiv-write-test.ts`](../scripts/arkiv-write-test.ts) writes a deterministic smoke-test receipt using placeholder addresses (`0x1111…1111` / `0x2222…2222`) and placeholder transaction hashes (`0xaaaa1111…`), `isSyntheticReceipt()` in [`lib/arkiv/sdk.ts`](../lib/arkiv/sdk.ts) detects those smoke-test fixtures and the UI labels them with an explicit **`FIXTURE`** badge in [`ReceiptsTable.tsx`](../apps/web/src/components/arkiv/ReceiptsTable.tsx) and a Data Quality Notice on [`/receipt/[hash]`](../apps/web/src/app/receipt/[hash]/page.tsx).

| Entity Type | Arkiv `$key` | Provenance | UI Label |
| :--- | :--- | :--- | :--- |
| `ExtractionReceipt` | [`0x259dc288…0fd2`](https://rabdi.explorer.arkiv.network/entity/0x259dc2884aab483503458ce1ebb716c4e90bf156eadfaaa2e9761d2ec60b0fd2) | **Real on-chain** — Hook v2 (`0xCeF7…c0c0`) sandwich on Base Sepolia block `55,162,450` (tx `0xef694630…20a051c8`, `3.57 USDC`, open claim extended to 90d TTL in tx `0x03512e4f…8744`) | `ARCHIVED` + `90d TTL` |
| `ExtractionReceipt` | [`0x2286e8a0…5d27`](https://rabdi.explorer.arkiv.network/entity/0x2286e8a00e389f51ea21e3d5280f2078b54b4b2456842783962416c1a9dd5d27) | **Real on-chain** — Verified Run #2 (3-tx sandwich in Base Sepolia block `55,152,258`, separate Victim EOA `0x524e…51Db`, `3.54 USDC`) | `REBATED` |
| `ExtractionReceipt` | [`0x837ad00c…32a8`](https://rabdi.explorer.arkiv.network/entity/0x837ad00cd5fba8b67ba3976cbbca64de32d4ddac8483bb6b56b6866f67b432a8) | **Real on-chain** — Verified Run #1 (Base Sepolia block `55,113,190`, tx `0x1adc35cf…a410b4`, `3.57 USDC`) | `REBATED` |
| `ExtractionReceipt` | [`0xc327d5db…f8ca`](https://rabdi.explorer.arkiv.network/entity/0xc327d5db4aa3098b80dc8729d090317408f98d19e1e19c13d6cf83494a05f8ca) | **Synthetic fixture** — Initial `pnpm arkiv:write-test` SDK smoke test (`0x1111…`, `0xaaaa1111…`, `1.25 USDC`) | `FIXTURE` + `ARCHIVED` |
| `ExtractionReceipt` | [`0x6cc9605f…11a7`](https://rabdi.explorer.arkiv.network/entity/0x6cc9605f853971275f2f1c5f0327ca3ae3de1d7b6db58d223016f0b7a03f11a7) | **Synthetic fixture** — Second `pnpm arkiv:write-test` SDK smoke test (`0x1111…`, `0xaaaa1111…`, `1.25 USDC`) | `FIXTURE` + `ARCHIVED` |
| `SearcherProfile` | [`0x42a19bb6…9b9d`](https://rabdi.explorer.arkiv.network/entity/0x42a19bb65560786c947020b82467ea65bf6373f26455e9a88dce82ee84959b9d) | **Real on-chain** — Searcher `0xc31545299093C46d87752cD6378A811BFDD9940D` (`extractions: 3`, `lastSeenBlock: 55162450`) | Displayed on `/searcher/0xc315…` |
| `LPClaim` | [`0x45dcfc2d…9a35`](https://rabdi.explorer.arkiv.network/entity/0x45dcfc2de3a9b1e6738ef67dcfa323c202f28683da820c35cf0f27d3b6d89a35) | **Real on-chain** — Victim EOA `0x524e…51Db` claim on Arc v2 (tx `0xb72bd280…f1fd00` for receipt `0xe191f885…959a`) | Marks Run #2 `REBATED` |
| `LPClaim` | [`0x20d3a714…5fd5`](https://rabdi.explorer.arkiv.network/entity/0x20d3a7149d2912642cc7dedf994454a48dc6c1f480bb81bf007de5c788985fd5) | **Real on-chain** — Run #1 claim on Arc v1 (tx `0x4202622d…a4963f` for receipt `0xdf3305cb…e681`) | Marks Run #1 `REBATED` |

---

## 5. What Does NOT Come From Arkiv

- **Pool metadata** (pair name, fee tier, and the illustrative TVL/volume marked `[DEMO]`): static config in `apps/web/src/data/mockData.ts`.
- **The `/demo` walkthrough:** a client-side animation of the pipeline. It does not read or write Arkiv.
- **Counterfactual math:** computed off-chain in [`lib/simulator/counterfactual.ts`](../lib/simulator/counterfactual.ts). Arkiv stores the result.

---

## 6. Verify It Yourself

```bash
pnpm arkiv:verify            # read-only: resolves the sample receipt + pool/searcher/recent queries on Rabdi
pnpm arkiv:write-test        # needs ARKIV_PRIVATE_KEY: writes one receipt, reads it back by receiptHash
```
