import Link from "next/link";
import { MOCK_POOLS } from "@/data/mockData";
import { StatusPill } from "@/components/ui/StatusPill";
import { WalletLookup } from "@/components/ui/WalletLookup";
import { HashDisplay } from "@/components/ui/HashDisplay";
import { AddressAvatar } from "@/components/ui/AddressAvatar";
import { ArkivSource } from "@/components/arkiv/ArkivSource";
import { ReceiptsTable } from "@/components/arkiv/ReceiptsTable";
import { fromArkiv, sumUSDC, toViewsWithClaims, writerAddress } from "@/lib/arkiv";
import { getVaultReserveUSDC } from "@/lib/arc";

// Always read Arkiv at request time — never bake receipts into the build.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [res, vaultReserve] = await Promise.all([
    fromArkiv(async (sdk) => toViewsWithClaims(sdk, await sdk.listRecentReceipts(25))),
    getVaultReserveUSDC(),
  ]);
  const receipts = res.ok ? res.data : [];
  const totalExtracted = sumUSDC(receipts);
  const extractedByPool = (poolId: string) =>
    sumUSDC(receipts.filter((r) => r.poolId.toLowerCase() === poolId.toLowerCase()));

  // Aggregate Searcher Leaderboard from live Arkiv receipts
  const leaderboardMap = new Map<
    string,
    {
      searcher: string;
      extractions: number;
      totalExtracted: number;
      rebatedCount: number;
      lastSeenBlock: number;
      isSynthetic: boolean;
    }
  >();
  for (const r of receipts) {
    const key = r.searcher.toLowerCase();
    const cur = leaderboardMap.get(key) ?? {
      searcher: r.searcher,
      extractions: 0,
      totalExtracted: 0,
      rebatedCount: 0,
      lastSeenBlock: 0,
      isSynthetic: r.isSynthetic,
    };
    cur.extractions += 1;
    cur.totalExtracted += parseFloat(r.extractedUSDC) || 0;
    if (r.status === "REBATED") cur.rebatedCount += 1;
    if (r.blockNumber > cur.lastSeenBlock) cur.lastSeenBlock = r.blockNumber;
    leaderboardMap.set(key, cur);
  }
  const leaderboard = Array.from(leaderboardMap.values()).sort(
    (a, b) => Number(a.isSynthetic) - Number(b.isSynthetic) || b.totalExtracted - a.totalExtracted
  );

  const maxExtracted = leaderboard.reduce((m, row) => Math.max(m, row.totalExtracted), 0);

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col gap-3 lg:gap-4">
      {/* Header Info: wallet-style headline balance */}
      <section className="bg-surface border border-border rounded-card shadow-card p-5 sm:p-7 space-y-6">
        <div className="max-w-[70ch]">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text text-balance">
            Surveillance &amp; Detection Matrix
          </h1>
          <p className="text-sm text-muted mt-2">
            Active surveillance of Uniswap v4 pools on Base Sepolia • Arc Testnet Settlement
          </p>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            Receipts and extraction totals are read live from Arkiv; the vault reserve is read live from Arc. Only real hooked pools (plus the labeled SDK fixture) are listed.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 border-t border-border pt-6">
          <dl>
            <dt className="text-sm text-muted">Extracted (Arkiv)</dt>
            <dd className="mt-1 text-5xl font-semibold tracking-tight tabular-nums text-text">${totalExtracted}</dd>
          </dl>
          <dl className="flex flex-wrap items-center gap-2 text-sm">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-surface-2">
              <dt className="text-muted">Vault Reserve (Arc)</dt>
              {vaultReserve === null ? (
                <dd className="text-muted tabular-nums">unavailable</dd>
              ) : (
                <dd className="text-good font-semibold tabular-nums">${vaultReserve} USDC</dd>
              )}
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-surface-2">
              <dt className="text-muted">Receipts on Arkiv</dt>
              <dd className="text-accent font-semibold tabular-nums">{res.ok ? receipts.length : "—"}</dd>
            </div>
          </dl>
        </div>

        {/* Wallet / receipt lookup */}
        <div className="max-w-xl">
          <WalletLookup />
        </div>
      </section>

      {/* Monitored Pools: wallet-style asset list */}
      <section className="space-y-2.5">
        <h2 className="px-1 text-base font-semibold tracking-tight text-text">Monitored Uniswap v4 Pools</h2>
        <ul className="border border-border rounded-card bg-surface shadow-card divide-y divide-border overflow-hidden">
          {MOCK_POOLS.map((pool) => (
            <li key={pool.id} className="group flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 hover:bg-surface-2/60 transition-colors">
              <AddressAvatar address={pool.id} size={40} />
              <div className="min-w-0 flex-1 space-y-1">
                <Link href={`/pool/${pool.id}`} className="inline-flex flex-wrap items-baseline gap-x-2 hover:underline">
                  <span className="text-sm font-semibold text-text">{pool.name}</span>
                  <span className="text-muted text-xs font-mono font-normal">({pool.id.slice(0, 8)}…)</span>
                </Link>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span>
                    Fee <span className="font-mono text-text">{pool.feeTier}</span>
                  </span>
                  {pool.hookAddress ? (
                    <a
                      href={`https://sepolia.basescan.org/address/${pool.hookAddress}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-text underline decoration-border hover:decoration-text whitespace-nowrap"
                    >
                      DarkTraceHook {pool.hook}{" "}
                      <span className="font-mono">
                        ({pool.hookAddress.slice(0, 6)}…{pool.hookAddress.slice(-4)})
                      </span>
                      <span className="sr-only"> (BaseScan, opens in a new tab)</span>
                    </a>
                  ) : (
                    <span className="italic">test fixture</span>
                  )}
                </div>
              </div>
              <div className="w-full sm:w-auto pl-[52px] sm:pl-0 shrink-0 flex flex-row sm:flex-col flex-wrap items-center sm:items-end justify-between sm:justify-start gap-1.5 sm:text-right">
                <span className="text-sm font-semibold tabular-nums text-danger whitespace-nowrap">
                  ${extractedByPool(pool.id)}
                  <span className="font-normal text-xs text-muted"> extracted (Arkiv)</span>
                </span>
                <StatusPill status={extractedByPool(pool.id) !== "0.00" ? "DETECTED" : "CLEAN"} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Forensic Receipts Table */}
      <section className="space-y-2.5">
        <div className="px-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-base font-semibold tracking-tight text-text">Recent Forensic Extraction Receipts</h2>
          <p className="text-xs text-muted">Select a sandwich to open its full receipt</p>
        </div>
        <ArkivSource
          ok={res.ok}
          queriedAt={res.queriedAt}
          error={res.ok ? undefined : res.error}
          query="select * from receipts ownedBy(writer) orderBy blockNumber desc limit 25 · lp_claims"
          count={res.ok ? receipts.length : undefined}
          writer={writerAddress()}
        />
        <ReceiptsTable
          receipts={receipts}
          columns={["pool", "searcher", "victim"]}
          emptyText="No extraction receipts on Arkiv yet."
        />
      </section>

      {/* Searcher Leaderboard (aggregated from Arkiv receipts): dark activity panel */}
      <section className="ink rounded-card shadow-float overflow-hidden">
        <div className="px-5 pt-5 pb-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <h2 className="text-base font-semibold tracking-tight text-text">
            Searcher Leaderboard (Live from Arkiv Receipts)
          </h2>
          <p className="text-xs text-muted">Ranked by cumulative extracted USDC across monitored pools</p>
        </div>
        {leaderboard.length === 0 ? (
          <div className="border-t border-border p-8 text-center text-sm text-muted">
            No searcher activity recorded on Arkiv.
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted text-xs select-none">
                  <th scope="col" className="py-3 px-5 font-medium">Rank</th>
                  <th scope="col" className="py-3 px-4 font-medium">Searcher Bot</th>
                  <th scope="col" className="py-3 px-4 font-medium text-right">Sandwiches</th>
                  <th scope="col" className="py-3 px-4 font-medium text-right">Total Extracted</th>
                  <th scope="col" className="py-3 px-4 font-medium text-right">Rebated to Victims</th>
                  <th scope="col" className="py-3 px-5 font-medium text-right">Last Seen Block</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leaderboard.map((row, idx) => (
                  <tr key={row.searcher} className="hover:bg-surface transition-colors">
                    <td className="py-3 px-5 text-muted font-mono tabular-nums">#{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Link href={`/searcher/${row.searcher}`} className="hover:underline">
                          <HashDisplay hash={row.searcher} className="text-text" />
                        </Link>
                        {row.isSynthetic && (
                          <span className="px-2 py-0.5 text-[11px] border border-accent/30 bg-accent/10 text-accent rounded-full font-semibold uppercase">
                            FIXTURE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-text font-semibold font-mono tabular-nums">
                      {row.extractions}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span
                          aria-hidden="true"
                          className="hidden sm:block w-24 h-1.5 rounded-full bg-surface-2 overflow-hidden"
                        >
                          <span
                            className="block h-full rounded-full bg-danger"
                            style={{ width: `${maxExtracted > 0 ? Math.max(4, (row.totalExtracted / maxExtracted) * 100) : 0}%` }}
                          />
                        </span>
                        <span className="text-danger font-semibold font-mono tabular-nums whitespace-nowrap">
                          ${row.totalExtracted.toFixed(2)} USDC
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-good font-mono tabular-nums">
                      {row.rebatedCount} / {row.extractions}
                    </td>
                    <td className="py-3 px-5 text-right text-muted font-mono tabular-nums">#{row.lastSeenBlock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
