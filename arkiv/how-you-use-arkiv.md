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
| `getSearcherProfile` | `select().from(SearcherProfiles).where(eq("searcher", addr(a)))` |
| `listLPClaims` / `claimForReceipt` | `select().from(LPClaims).where(eq("lp" \| "receiptHash", …))` |

---

## 3. User-Facing Features That Read Arkiv

Each page shows a purple **"Live from Arkiv Rabdi"** strip naming the query it ran, the number of entities returned, the trusted owner, and when the query ran. Every receipt row links to its entity on `rabdi.explorer.arkiv.network`.

| Route | File | Arkiv read |
| :--- | :--- | :--- |
| `/dashboard` | [`apps/web/src/app/dashboard/page.tsx`](../apps/web/src/app/dashboard/page.tsx) | `listRecentReceipts(25)` joined with `listLPClaims()` (claimed receipts show `REBATED`), total extracted, and each pool's "Extracted (Arkiv)" column |
| `/receipt/[hash]` | [`apps/web/src/app/receipt/[hash]/page.tsx`](../apps/web/src/app/receipt/[hash]/page.tsx) | `getReceiptByHash` (falls back to `getEntityKey`) plus `claimForReceipt`. Renders `$key`, `$owner`, created/expiry block, amounts, and the decoded `txHashes` |
| `/pool/[id]` | [`apps/web/src/app/pool/[id]/page.tsx`](../apps/web/src/app/pool/[id]/page.tsx) | `listReceiptsByPool` joined with `listLPClaims()` |
| `/searcher/[address]` | [`apps/web/src/app/searcher/[address]/page.tsx`](../apps/web/src/app/searcher/[address]/page.tsx) | `listReceiptsBySearcher` joined with `listLPClaims()` |
| `/lp/[address]` | [`apps/web/src/app/lp/[address]/page.tsx`](../apps/web/src/app/lp/[address]/page.tsx) | `listReceiptsByParty` plus `listLPClaims` (matches claims by `receiptHash` and `lp` so a receipt with a claim shows as `REBATED`) |
| `/api/stats` | [`apps/web/src/app/api/stats/route.ts`](../apps/web/src/app/api/stats/route.ts) | `listRecentReceipts(100)` aggregate, with `arkivSource: "rabdi" \| "unreachable"` |

The shared data layer is [`apps/web/src/lib/arkiv.ts`](../apps/web/src/lib/arkiv.ts) (`fromArkiv()` wraps every read with an 8 s timeout and reports failures honestly). The provenance strip is [`components/arkiv/ArkivSource.tsx`](../apps/web/src/components/arkiv/ArkivSource.tsx).

---

## 4. Permissions, Ownership & Expiration

- **Writer:** `0xb491fe5846DE735B6Cb03a677A3C6296FAB0aDA5` (override with `ARKIV_WRITER_ADDRESS`). Reads ignore entities from any other owner.
- **Expiration:** 30 days (`ExpirationTime.fromDays(30)`). This matches the restitution claim window. After that, settlement is governed by the `bytes32 receiptHash` attested in `SimulationRegistry.sol` on Arc.

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
