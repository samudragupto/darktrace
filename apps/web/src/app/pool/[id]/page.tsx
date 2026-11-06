import Link from "next/link";
import { MOCK_POOLS } from "@/data/mockData";
import { HashDisplay } from "@/components/ui/HashDisplay";
import { StatusPill } from "@/components/ui/StatusPill";
import { DemoData } from "@/components/ui/DemoData";
import { ArkivSource } from "@/components/arkiv/ArkivSource";
import { ReceiptsTable } from "@/components/arkiv/ReceiptsTable";
import { fromArkiv, sumUSDC, toViewsWithClaims, writerAddress } from "@/lib/arkiv";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

interface PoolPageProps {
  params: {
    id: string;
  };
}

export default async function PoolPage({ params }: PoolPageProps) {
  const pool = MOCK_POOLS.find((p) => p.id.toLowerCase() === params.id.toLowerCase()) || {
    id: params.id,
    name: "Custom Uniswap v4 Pool",
    feeTier: "0.05%",
    tvl: "$500.00",
    volume24h: "$120.00",
    extracted24h: "$0.00",
    status: "CLEAN" as const,
    token0: "0x4200000000000000000000000000000000000006",
    token1: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  };

  const res = await fromArkiv(async (sdk) => toViewsWithClaims(sdk, await sdk.listReceiptsByPool(params.id)));
  const poolReceipts = res.ok ? res.data : [];
  const extracted = sumUSDC(poolReceipts);

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Surveillance Matrix
        </Link>
      </div>

      {/* Pool Header */}
      <div className="border border-border bg-surface p-6 rounded space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-accent uppercase tracking-wider">
              Uniswap v4 Pool Inspector
            </div>
            <h1 className="text-xl font-bold font-mono text-text mt-1">{pool.name}</h1>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-mono text-muted">Pool ID:</span>
              <HashDisplay hash={pool.id} truncate={false} className="text-xs" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={poolReceipts.length > 0 ? "DETECTED" : "CLEAN"} />
          </div>
        </div>

        {/* Pool Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border text-xs font-mono">
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">Fee Tier</div>
            <div className="text-text font-bold mt-1">{pool.feeTier}</div>
          </div>
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">Pool TVL</div>
            <div className="text-text font-bold mt-1 tabular-nums">
              <DemoData>{pool.tvl}</DemoData>
            </div>
          </div>
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">24h Volume</div>
            <div className="text-muted font-bold mt-1 tabular-nums">
              <DemoData>{pool.volume24h}</DemoData>
            </div>
          </div>
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">Extracted (Arkiv)</div>
            <div className="text-danger font-bold mt-1 tabular-nums">${extracted}</div>
          </div>
        </div>
      </div>

      {/* Receipts in this Pool */}
      <div className="space-y-3">
        <div className="text-xs font-mono font-semibold text-text uppercase tracking-wider">
          Detected Extractions in this Pool ({poolReceipts.length})
        </div>

        <ArkivSource
          ok={res.ok}
          queriedAt={res.queriedAt}
          error={res.ok ? undefined : res.error}
          query={`select * from receipts where poolId = ${params.id.slice(0, 10)}… ownedBy(writer)`}
          count={res.ok ? poolReceipts.length : undefined}
          writer={writerAddress()}
        />
        <ReceiptsTable
          receipts={poolReceipts}
          columns={["searcher", "victim"]}
          emptyText="No extraction receipts for this pool on Arkiv."
        />
      </div>
    </div>
  );
}

