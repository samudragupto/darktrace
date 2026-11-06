import Link from "next/link";
import { HashDisplay } from "@/components/ui/HashDisplay";
import { AddressAvatar } from "@/components/ui/AddressAvatar";
import { ArkivSource } from "@/components/arkiv/ArkivSource";
import { ReceiptsTable } from "@/components/arkiv/ReceiptsTable";
import { fromArkiv, sumUSDC, toView, writerAddress } from "@/lib/arkiv";
import { ArrowLeft, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

interface LPPageProps {
  params: {
    address: string;
  };
}

export default async function LPPage({ params }: LPPageProps) {
  const valid = /^0x[0-9a-fA-F]{40}$/.test(params.address);
  const res = valid
    ? await fromArkiv(async (sdk) => {
        const [partyReceipts, allClaims] = await Promise.all([
          sdk.listReceiptsByParty(params.address),
          sdk.listLPClaims(),
        ]);
        const byHash = new Map(partyReceipts.map((r) => [r.receiptHash.toLowerCase(), r]));
        const addrLower = params.address.toLowerCase();
        for (const c of allClaims) {
          if (c.lp.toLowerCase() === addrLower && !byHash.has(c.receiptHash.toLowerCase())) {
            const extra = await sdk.getReceiptByHash(c.receiptHash);
            if (extra) byHash.set(extra.receiptHash.toLowerCase(), extra);
          }
        }
        const claimsByReceipt = new Map(allClaims.map((c) => [c.receiptHash.toLowerCase(), c]));
        const sorted = Array.from(byHash.values()).sort((a, b) => b.blockNumber - a.blockNumber);
        return sorted.map((r) => toView(r, claimsByReceipt.get(r.receiptHash.toLowerCase())));
      })
    : { ok: false as const, error: "not a valid address", queriedAt: new Date().toISOString() };

  const lpReceipts = res.ok ? res.data : [];
  const totalSuffered = sumUSDC(lpReceipts);
  const totalRebated = sumUSDC(lpReceipts.filter((r) => r.status === "REBATED"));

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

      {/* LP Header */}
      <div className="border border-border bg-surface shadow-card p-5 sm:p-7 rounded-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <AddressAvatar address={params.address} size={56} className="mt-0.5" />
            <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text">
              LP Forensics & Restitution
            </h1>
            <p className="mt-1.5 text-sm text-muted flex items-center gap-1.5">
              <Wallet aria-hidden="true" className="w-4 h-4 text-good" />
              Liquidity Provider Restitution Account
            </p>
              <div className="mt-3 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-surface-2 border border-border pl-3 pr-2 py-1.5">
                <span className="text-xs text-muted">LP Address:</span>
                <HashDisplay hash={params.address} truncate={false} className="text-xs" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/demo"
              className="px-5 py-2.5 bg-ink text-on-ink text-sm font-medium rounded-full hover:bg-ink/85 transition-colors whitespace-nowrap"
            >
              Open Claim Portal
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-6 border-t border-border text-sm">
          <div className="p-4 rounded-2xl bg-surface-2">
            <div className="text-muted text-sm">Extractions Suffered</div>
            <div className="text-text font-semibold mt-1.5 text-xl tabular-nums">
              {lpReceipts.length}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-surface-2">
            <div className="text-muted text-sm">Total Value Extracted</div>
            <div className="text-danger font-semibold mt-1.5 text-xl tabular-nums">
              ${totalSuffered}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-surface-2">
            <div className="text-muted text-sm">Total Rebates Claimed</div>
            <div className="text-good font-semibold mt-1.5 text-xl tabular-nums">
              ${totalRebated} USDC
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-surface-2">
            <div className="text-muted text-sm">Settlement Network</div>
            <div className="text-accent font-semibold mt-1.5 text-base">Arc Testnet (Circle)</div>
          </div>
        </div>
      </div>

      {/* Extractions Suffered Table */}
      <div className="space-y-2.5">
        <h2 className="px-1 text-base font-semibold tracking-tight text-text">
          Observed Extractions on this Account ({lpReceipts.length})
        </h2>

        <ArkivSource
          ok={res.ok}
          queriedAt={res.queriedAt}
          error={res.ok ? undefined : res.error}
          query={`receipts where victim|lp = ${params.address.slice(0, 10)}… · lp_claims where lp = …`}
          count={res.ok ? lpReceipts.length : undefined}
          writer={writerAddress()}
        />
        <ReceiptsTable
          receipts={lpReceipts}
          columns={["pool", "searcher"]}
          emptyText="No extraction receipts for this account on Arkiv."
        />
      </div>
    </div>
  );
}

