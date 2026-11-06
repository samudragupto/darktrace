import Link from "next/link";
import { HashDisplay } from "@/components/ui/HashDisplay";
import { AddressAvatar } from "@/components/ui/AddressAvatar";
import { getSearcherBond, SEARCHER_REGISTRY } from "@/lib/base";
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
  const bond = valid ? await getSearcherBond(params.address) : null;
  const extractionsCount = profile ? profile.extractions : searcherReceipts.length;
  const lastSeenBlock = profile
    ? profile.lastSeenBlock
    : searcherReceipts[0]?.blockNumber ?? null;

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col gap-3 lg:gap-4">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted shadow-card hover:text-text transition-colors"
        >
          <ArrowLeft aria-hidden="true" className="w-4 h-4" />
          Back to Surveillance Matrix
        </Link>
      </div>

      {/* Searcher Header */}
      <div className="border border-border bg-surface shadow-card p-5 sm:p-7 rounded-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <AddressAvatar address={params.address} size={56} className="mt-0.5" />
            <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text">
              Searcher Profile
            </h1>
            <p className="mt-1.5 text-sm text-muted flex items-center gap-1.5">
              <AlertTriangle aria-hidden="true" className="w-4 h-4 text-accent" />
              Searcher Reputation & Bond Ledger
            </p>
              <div className="mt-3 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-surface-2 border border-border pl-3 pr-2 py-1.5">
                <span className="text-xs text-muted">Bot Address:</span>
                <HashDisplay hash={params.address} truncate={false} className="text-xs" />
              </div>
            </div>
          </div>
          {extractionsCount > 0 && (
            <div className="px-3 py-1.5 border border-danger/30 bg-danger/10 text-danger rounded-full text-xs font-semibold self-start whitespace-nowrap">
              TOXIC ARBITRAGE PROFILE
            </div>
          )}
        </div>

        {/* Live SearcherProfile Entity Metadata from Arkiv */}
        {profile && (
          <div className="px-4 py-3 border border-arkiv/20 bg-arkiv/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-text">
              <Database aria-hidden="true" className="w-3.5 h-3.5 text-arkiv" />
              <span className="font-semibold text-arkiv">Arkiv SearcherProfile Entity:</span>
              <a
                href={profile.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-arkiv underline decoration-arkiv/40 hover:decoration-arkiv"
              >
                {profile.arkivEntityKey.slice(0, 10)}…{profile.arkivEntityKey.slice(-6)}
                <ExternalLink aria-hidden="true" className="w-3 h-3" />
              </a>
            </div>
            <div className="text-muted font-mono tabular-nums">
              extractions: <span className="text-text font-semibold">{profile.extractions}</span> · lastSeenBlock:{" "}
              <span className="text-text font-semibold">#{profile.lastSeenBlock}</span> · expires Arkiv block{" "}
              <span className="text-text">#{profile.expiresAtBlock.toString()}</span>
            </div>
          </div>
        )}

        {/* Reputation Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-6 border-t border-border text-sm">
          <div className="p-4 rounded-2xl bg-surface-2">
            <div className="text-muted text-sm">Total Extractions (Arkiv)</div>
            <div className="text-text font-semibold mt-1.5 text-xl tabular-nums">
              {extractionsCount}
            </div>
            <div className="text-xs text-muted mt-1.5 leading-relaxed">
              {profile ? "From SearcherProfile entity" : "Counted from receipts"}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-surface-2">
            <div className="text-muted text-sm">Last Seen Block (Arkiv)</div>
            <div className="text-text font-semibold mt-1.5 text-xl tabular-nums">
              {lastSeenBlock ? `#${lastSeenBlock}` : "—"}
            </div>
            <div className="text-xs text-muted mt-1.5 leading-relaxed">
              Base Sepolia block height
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-surface-2">
            <div className="text-muted text-sm">Total Extracted</div>
            <div className="text-danger font-semibold mt-1.5 text-xl tabular-nums">
              ${totalExtracted}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-surface-2">
            <div className="text-muted text-sm">Collateral Bond (Base Sepolia)</div>
            <div className="text-good font-semibold mt-1.5 text-xl tabular-nums">
              {bond === null ? <span className="text-muted">unavailable</span> : `${bond.bondEth} ETH`}
            </div>
            <div className="text-xs text-muted mt-1.5 leading-relaxed">
              {bond && bond.bondEth === "0.0000" ? "No bond posted. " : ""}Live read of{" "}
              <a
                href={`https://sepolia.basescan.org/address/${SEARCHER_REGISTRY}`}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-text"
              >
                SearcherRegistry
              </a>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-surface-2">
            <div className="text-muted text-sm">Bond slashed (Base Sepolia)</div>
            <div className="text-danger font-semibold mt-1.5 text-xl tabular-nums">
              {bond === null ? <span className="text-muted">unavailable</span> : `${bond.slashedEth} ETH`}
            </div>
            <div className="text-xs text-muted mt-1.5 leading-relaxed">
              Local Base Sepolia attestation; does not settle or fund Arc vault
            </div>
          </div>
        </div>
      </div>

      {/* Observed Extractions */}
      <div className="space-y-2.5">
        <h2 className="px-1 text-base font-semibold tracking-tight text-text">
          Observed Sandwich Attacks ({searcherReceipts.length})
        </h2>

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

