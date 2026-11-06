import Link from "next/link";
import { MOCK_POOLS } from "@/data/mockData";
import { HashDisplay } from "@/components/ui/HashDisplay";
import { AddressAvatar } from "@/components/ui/AddressAvatar";
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
    <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col gap-3 lg:gap-4">
      {/* Back button */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted shadow-card hover:text-text transition-colors"
        >
          <ArrowLeft aria-hidden="true" className="w-4 h-4" />
          Back to Surveillance Matrix
        </Link>
      </div>

      {/* Pool Header */}
      <div className="border border-border bg-surface shadow-card p-5 sm:p-7 rounded-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <AddressAvatar address={pool.id} size={56} className="mt-0.5" />
            <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text">{pool.name}</h1>
            <p className="mt-1.5 text-sm text-muted">Uniswap v4 Pool Inspector</p>
              <div className="mt-3 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-surface-2 border border-border pl-3 pr-2 py-1.5">
                <span className="text-xs text-muted">Pool ID:</span>
                <HashDisplay hash={pool.id} truncate={false} className="text-xs" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={poolReceipts.length > 0 ? "DETECTED" : "CLEAN"} />
          </div>
        </div>

        {/* Pool Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-6 border-t border-border text-sm">
          <div className="p-4 rounded-2xl bg-surface-2">
            <div className="text-muted text-sm">Fee Tier</div>
            <div className="text-text font-semibold mt-1.5 text-xl">{pool.feeTier}</div>
          </div>
          <div className="p-4 rounded-2xl bg-surface-2">
            <div className="text-muted text-sm">Hook</div>
            <div className="text-text font-semibold mt-1.5 text-base break-all">
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
          <div className="p-4 rounded-2xl bg-surface-2">
            <div className="text-muted text-sm">Receipts (Arkiv)</div>
            <div className="text-text font-semibold mt-1.5 text-xl tabular-nums">{poolReceipts.length}</div>
          </div>
          <div className="p-4 rounded-2xl bg-surface-2">
            <div className="text-muted text-sm">Extracted (Arkiv)</div>
            <div className="text-danger font-semibold mt-1.5 text-xl tabular-nums">${extracted}</div>
          </div>
        </div>
      </div>

      {/* Per-Pool Extraction Timeline */}
      {poolReceipts.length > 0 && (
        <div className="ink rounded-card shadow-float p-5 sm:p-7 space-y-5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
            <h2 className="text-base font-semibold tracking-tight text-text">
              Per-Pool Extraction Timeline (Ordered by Block)
            </h2>
            <div className="text-xs text-muted">
              Chronological sequence of sandwich extractions recorded on Arkiv for this pool
            </div>
          </div>

          <div className="relative ml-1 pl-5 border-l border-border space-y-2.5">
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
                  <div key={r.arkivEntityKey} className="relative px-4 py-3.5 rounded-2xl bg-surface space-y-2.5 font-mono">
                    <span aria-hidden="true" className="absolute -left-[26px] top-5 w-2.5 h-2.5 rounded-full bg-accent ring-4 ring-bg" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-accent font-bold tabular-nums">Block #{r.blockNumber}</span>
                        <span aria-hidden="true" className="text-muted">·</span>
                        <Link href={`/receipt/${r.receiptHash}`} className="hover:underline">
                          <HashDisplay hash={r.receiptHash} />
                        </Link>
                        {r.isSynthetic && (
                          <span className="px-2 py-0.5 text-[11px] font-sans border border-accent/30 bg-accent/10 text-accent rounded-full font-semibold uppercase">
                            FIXTURE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-danger font-bold tabular-nums">${r.extractedUSDC} USDC</span>
                        <StatusPill status={r.status} />
                      </div>
                    </div>
                    <div aria-hidden="true" className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
                      <div className="h-full bg-danger rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
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
      <div className="space-y-2.5">
        <h2 className="px-1 text-base font-semibold tracking-tight text-text">
          Detected Extractions in this Pool ({poolReceipts.length})
        </h2>

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

