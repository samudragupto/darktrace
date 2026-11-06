import Link from "next/link";
import { MOCK_POOLS } from "@/data/mockData";
import { HashDisplay } from "@/components/ui/HashDisplay";
import { StatusPill } from "@/components/ui/StatusPill";
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
  const known = MOCK_POOLS.find((p) => p.id.toLowerCase() === params.id.toLowerCase());
  const pool = known ?? {
    id: params.id,
    name: "Unregistered pool",
    feeTier: "—",
    hook: undefined,
    hookAddress: undefined,
    initTx: undefined,
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
            <div className="text-muted text-[11px]">Hook</div>
            <div className="text-text font-bold mt-1 break-all">
              {pool.hookAddress ? (
                <a
                  href={`https://sepolia.basescan.org/address/${pool.hookAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  DarkTraceHook {pool.hook}
                </a>
              ) : pool.hook === "fixture" ? (
                <span className="text-muted">SDK test fixture</span>
              ) : (
                <span className="text-muted">not a DarkTrace pool</span>
              )}
            </div>
          </div>
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">Receipts (Arkiv)</div>
            <div className="text-text font-bold mt-1 tabular-nums">{poolReceipts.length}</div>
          </div>
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">Extracted (Arkiv)</div>
            <div className="text-danger font-bold mt-1 tabular-nums">${extracted}</div>
          </div>
        </div>
      </div>

      {/* Per-Pool Extraction Timeline */}
      {poolReceipts.length > 0 && (
        <div className="border border-border bg-surface p-5 rounded space-y-4 text-xs font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="font-semibold text-text uppercase tracking-wider">
              Per-Pool Extraction Timeline (Ordered by Block)
            </div>
            <div className="text-[11px] text-muted">
              Chronological sequence of sandwich extractions recorded on Arkiv for this pool
            </div>
          </div>

          <div className="relative pl-4 border-l-2 border-accent/40 space-y-3">
            {[...poolReceipts]
              .sort((a, b) => a.blockNumber - b.blockNumber)
              .map((r) => {
                const maxVal = Math.max(
                  ...poolReceipts.map((x) => parseFloat(x.extractedUSDC) || 0),
                  1
                );
                const pct = Math.min(
                  100,
                  Math.max(12, Math.round(((parseFloat(r.extractedUSDC) || 0) / maxVal) * 100))
                );
                return (
                  <div key={r.arkivEntityKey} className="relative p-3 border border-border rounded bg-bg space-y-2">
                    <span className="absolute -left-[21px] top-4 w-2.5 h-2.5 rounded-full bg-accent border-2 border-bg" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-accent font-bold tabular-nums">Block #{r.blockNumber}</span>
                        <span className="text-muted">·</span>
                        <Link href={`/receipt/${r.receiptHash}`} className="hover:underline">
                          <HashDisplay hash={r.receiptHash} />
                        </Link>
                        {r.isSynthetic && (
                          <span className="px-1.5 py-0.5 text-[10px] border border-accent/40 bg-accent/10 text-accent rounded font-semibold uppercase">
                            FIXTURE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-danger font-bold tabular-nums">${r.extractedUSDC} USDC</span>
                        <StatusPill status={r.status} />
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-[#15181E] rounded overflow-hidden">
                      <div className="h-full bg-danger rounded" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
                      <span>
                        Searcher: <span className="text-text">{r.searcher.slice(0, 10)}…</span> → Victim:{" "}
                        <span className="text-text">{r.victim.slice(0, 10)}…</span>
                      </span>
                      <span className="tabular-nums">
                        {r.injectedSlippageBps !== null
                          ? `Injected: +${r.injectedSlippageBps} bps · Legit: ${r.legitSlippageBps ?? 0} bps`
                          : "Legacy entity"}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Receipts in this Pool */}
      <div className="space-y-3">
        <div className="text-xs font-mono font-semibold text-text uppercase tracking-wider">
          Detected Extractions in this Pool ({poolReceipts.length})
        </div>

        <ArkivSource
          ok={res.ok}
          queriedAt={res.queriedAt}
          error={res.ok ? undefined : res.error}
          query={`select * from receipts where poolId = ${params.id.slice(0, 10)}… ownedBy(writer) · lp_claims`}
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

