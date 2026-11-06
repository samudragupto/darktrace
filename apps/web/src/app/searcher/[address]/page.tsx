import Link from "next/link";
import { HashDisplay } from "@/components/ui/HashDisplay";
import { DemoData } from "@/components/ui/DemoData";
import { ArkivSource } from "@/components/arkiv/ArkivSource";
import { ReceiptsTable } from "@/components/arkiv/ReceiptsTable";
import { fromArkiv, sumUSDC, toViewsWithClaims, writerAddress } from "@/lib/arkiv";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

interface SearcherPageProps {
  params: {
    address: string;
  };
}

export default async function SearcherPage({ params }: SearcherPageProps) {
  const valid = /^0x[0-9a-fA-F]{40}$/.test(params.address);
  const res = valid
    ? await fromArkiv(async (sdk) => toViewsWithClaims(sdk, await sdk.listReceiptsBySearcher(params.address)))
    : { ok: false as const, error: "not a valid address", queriedAt: new Date().toISOString() };
  const searcherReceipts = res.ok ? res.data : [];
  const totalExtracted = sumUSDC(searcherReceipts);

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Surveillance Matrix
        </Link>
      </div>

      {/* Searcher Header */}
      <div className="border border-border bg-surface p-6 rounded space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-accent uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-accent" />
              Searcher Reputation & Bond Ledger
            </div>
            <h1 className="text-xl font-bold font-mono text-text mt-1">
              Searcher Profile
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-mono text-muted">Bot Address:</span>
              <HashDisplay hash={params.address} truncate={false} className="text-xs" />
            </div>
          </div>
          {searcherReceipts.length > 0 && (
            <div className="px-3 py-1 border border-danger/40 bg-danger/10 text-danger rounded text-xs font-mono font-semibold">
              TOXIC ARBITRAGE PROFILE
            </div>
          )}
        </div>

        {/* Reputation Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border text-xs font-mono">
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">Total Extractions</div>
            <div className="text-text font-bold mt-1 tabular-nums">
              {searcherReceipts.length}
            </div>
          </div>
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">Total Extracted</div>
            <div className="text-danger font-bold mt-1 tabular-nums">
              ${totalExtracted}
            </div>
          </div>
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">Collateral Bond (Base Sepolia)</div>
            <div className="text-good font-bold mt-1 tabular-nums">
              <DemoData>$25.00 USDC</DemoData>
            </div>
          </div>
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">bond reduced (Base Sepolia, forensic only)</div>
            <div className="text-danger font-bold mt-1 tabular-nums">
              <DemoData>$2.10 USDC</DemoData>
            </div>
            <div className="text-[10px] text-muted mt-1">
              Local Base Sepolia attestation; does not settle or fund Arc vault
            </div>
          </div>
        </div>
      </div>

      {/* Observed Extractions */}
      <div className="space-y-3">
        <div className="text-xs font-mono font-semibold text-text uppercase tracking-wider">
          Observed Sandwich Attacks ({searcherReceipts.length})
        </div>

        <ArkivSource
          ok={res.ok}
          queriedAt={res.queriedAt}
          error={res.ok ? undefined : res.error}
          query={`select * from receipts where searcher = ${params.address.slice(0, 10)}… ownedBy(writer)`}
          count={res.ok ? searcherReceipts.length : undefined}
          writer={writerAddress()}
        />
        <ReceiptsTable
          receipts={searcherReceipts}
          columns={["pool", "victim"]}
          emptyText="No extraction receipts attributed to this searcher on Arkiv."
        />
      </div>
    </div>
  );
}

