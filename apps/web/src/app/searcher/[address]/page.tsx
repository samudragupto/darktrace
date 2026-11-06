import Link from "next/link";
import { HashDisplay } from "@/components/ui/HashDisplay";
import { DemoData } from "@/components/ui/DemoData";
import { ArkivSource } from "@/components/arkiv/ArkivSource";
import { ReceiptsTable } from "@/components/arkiv/ReceiptsTable";
import { fromArkiv, sumUSDC, toViewsWithClaims, writerAddress } from "@/lib/arkiv";
import { ArrowLeft, AlertTriangle, ExternalLink, Database } from "lucide-react";

export const dynamic = "force-dynamic";

interface SearcherPageProps {
  params: {
    address: string;
  };
}

export default async function SearcherPage({ params }: SearcherPageProps) {
  const valid = /^0x[0-9a-fA-F]{40}$/.test(params.address);
  const res = valid
    ? await fromArkiv(async (sdk) => {
        const [profile, rawReceipts] = await Promise.all([
          sdk.getSearcherProfile(params.address),
          sdk.listReceiptsBySearcher(params.address),
        ]);
        const receipts = await toViewsWithClaims(sdk, rawReceipts);
        return { profile, receipts };
      })
    : { ok: false as const, error: "not a valid address", queriedAt: new Date().toISOString() };

  const profile = res.ok ? res.data.profile : null;
  const searcherReceipts = res.ok ? res.data.receipts : [];
  const totalExtracted = sumUSDC(searcherReceipts);
  const extractionsCount = profile ? profile.extractions : searcherReceipts.length;
  const lastSeenBlock = profile
    ? profile.lastSeenBlock
    : searcherReceipts[0]?.blockNumber ?? null;

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
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-muted">Bot Address:</span>
              <HashDisplay hash={params.address} truncate={false} className="text-xs" />
            </div>
          </div>
          {extractionsCount > 0 && (
            <div className="px-3 py-1 border border-danger/40 bg-danger/10 text-danger rounded text-xs font-mono font-semibold self-start sm:self-center">
              TOXIC ARBITRAGE PROFILE
            </div>
          )}
        </div>

        {/* Live SearcherProfile Entity Metadata from Arkiv */}
        {profile && (
          <div className="p-3 border border-[#BC8CFF]/30 bg-[#BC8CFF]/5 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-2 text-text">
              <Database className="w-3.5 h-3.5 text-[#BC8CFF]" />
              <span className="font-semibold text-[#BC8CFF]">Arkiv SearcherProfile Entity:</span>
              <a
                href={profile.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                {profile.arkivEntityKey.slice(0, 10)}…{profile.arkivEntityKey.slice(-6)}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="text-muted text-[11px] tabular-nums">
              extractions: <span className="text-text font-semibold">{profile.extractions}</span> · lastSeenBlock:{" "}
              <span className="text-text font-semibold">#{profile.lastSeenBlock}</span> · expires Arkiv block{" "}
              <span className="text-text">#{profile.expiresAtBlock.toString()}</span>
            </div>
          </div>
        )}

        {/* Reputation Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-border text-xs font-mono">
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">Total Extractions (Arkiv)</div>
            <div className="text-text font-bold mt-1 tabular-nums">
              {extractionsCount}
            </div>
            <div className="text-[10px] text-muted mt-1">
              {profile ? "From SearcherProfile entity" : "Counted from receipts"}
            </div>
          </div>
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">Last Seen Block (Arkiv)</div>
            <div className="text-text font-bold mt-1 tabular-nums">
              {lastSeenBlock ? `#${lastSeenBlock}` : "—"}
            </div>
            <div className="text-[10px] text-muted mt-1">
              Base Sepolia block height
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
          query={`select * from darktrace.searcher_profiles where searcher = ${params.address.slice(0, 10)}…; select * from receipts where searcher = ${params.address.slice(0, 10)}…`}
          count={res.ok ? searcherReceipts.length + (profile ? 1 : 0) : undefined}
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

