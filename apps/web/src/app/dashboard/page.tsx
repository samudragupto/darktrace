import Link from "next/link";
import { MOCK_POOLS } from "@/data/mockData";
import { StatusPill } from "@/components/ui/StatusPill";
import { DemoData } from "@/components/ui/DemoData";
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

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 gap-3">
        <div>
          <h1 className="text-lg font-mono font-bold text-text uppercase tracking-wider">
            Surveillance & Detection Matrix
          </h1>
          <p className="text-xs text-muted font-mono mt-0.5">
            Active surveillance of Uniswap v4 pools on Base Sepolia • Arc Testnet Settlement
          </p>
          <p className="text-[11px] text-muted font-mono mt-1">
            Receipts and extraction totals are read live from Arkiv. Pool TVL/volume are illustrative.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3 py-1 border border-border bg-surface rounded text-xs font-mono">
            <span className="text-muted">Extracted (Arkiv): </span>
            <span className="text-danger font-bold tabular-nums">${totalExtracted}</span>
          </div>
          <div className="px-3 py-1 border border-border bg-surface rounded text-xs font-mono">
            <span className="text-muted">Vault Reserve (Arc): </span>
            {vaultReserve === null ? (
              <span className="text-muted tabular-nums">unavailable</span>
            ) : (
              <span className="text-good font-bold tabular-nums">${vaultReserve} USDC</span>
            )}
          </div>
          <div className="px-3 py-1 border border-border bg-surface rounded text-xs font-mono">
            <span className="text-muted">Receipts on Arkiv: </span>
            <span className="text-accent font-bold tabular-nums">{res.ok ? receipts.length : "—"}</span>
          </div>
        </div>
      </div>

      {/* Monitored Pools Table */}
      <div className="space-y-2">
        <div className="text-xs font-mono font-semibold text-text uppercase tracking-wider">
          Monitored Uniswap v4 Pools
        </div>
        <div className="border border-border rounded bg-surface overflow-x-auto">
          <table className="w-full text-xs font-mono text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-muted bg-[#15181E] select-none">
                <th className="py-2.5 px-3 font-semibold">Pool Pair</th>
                <th className="py-2.5 px-3 font-semibold">Fee</th>
                <th className="py-2.5 px-3 font-semibold text-right">TVL</th>
                <th className="py-2.5 px-3 font-semibold text-right">24h Volume</th>
                <th className="py-2.5 px-3 font-semibold text-right">Extracted (Arkiv)</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {MOCK_POOLS.map((pool) => (
                <tr
                  key={pool.id}
                  className="hover:bg-[#181B20] transition-colors cursor-pointer group"
                >
                  <td className="py-2.5 px-3">
                    <Link href={`/pool/${pool.id}`} className="flex items-center gap-2 group-hover:text-accent">
                      <span className="font-bold text-text">{pool.name}</span>
                      <span className="text-muted text-[11px] font-normal">
                        ({pool.id.slice(0, 8)}…)
                      </span>
                    </Link>
                  </td>
                  <td className="py-2.5 px-3 text-muted">{pool.feeTier}</td>
                  <td className="py-2.5 px-3 text-right text-text tabular-nums">
                    <DemoData>{pool.tvl}</DemoData>
                  </td>
                  <td className="py-2.5 px-3 text-right text-muted tabular-nums">
                    <DemoData>{pool.volume24h}</DemoData>
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-danger">
                    ${extractedByPool(pool.id)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <StatusPill status={extractedByPool(pool.id) !== "0.00" ? "DETECTED" : "CLEAN"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Forensic Receipts Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-mono font-semibold text-text uppercase tracking-wider">
            Recent Forensic Extraction Receipts
          </div>
          <div className="text-[11px] font-mono text-muted">Click a receipt hash for the full record</div>
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
      </div>
    </div>
  );
}
