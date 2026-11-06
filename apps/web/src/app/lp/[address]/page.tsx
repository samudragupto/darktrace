import Link from "next/link";
import { HashDisplay } from "@/components/ui/HashDisplay";
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

      {/* LP Header */}
      <div className="border border-border bg-surface p-6 rounded space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-accent uppercase tracking-wider flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-good" />
              Liquidity Provider Restitution Account
            </div>
            <h1 className="text-xl font-bold font-mono text-text mt-1">
              LP Forensics & Restitution
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-mono text-muted">LP Address:</span>
              <HashDisplay hash={params.address} truncate={false} className="text-xs" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/demo"
              className="px-3 py-1.5 bg-accent text-bg font-mono text-xs font-semibold rounded hover:opacity-90 transition-opacity"
            >
              Open Claim Portal
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border text-xs font-mono">
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">Extractions Suffered</div>
            <div className="text-text font-bold mt-1 tabular-nums">
              {lpReceipts.length}
            </div>
          </div>
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">Total Value Extracted</div>
            <div className="text-danger font-bold mt-1 tabular-nums">
              ${totalSuffered}
            </div>
          </div>
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">Total Rebates Claimed</div>
            <div className="text-good font-bold mt-1 tabular-nums">
              ${totalRebated} USDC
            </div>
          </div>
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">Settlement Network</div>
            <div className="text-accent font-bold mt-1">Arc Testnet (Circle)</div>
          </div>
        </div>
      </div>

      {/* Extractions Suffered Table */}
      <div className="space-y-3">
        <div className="text-xs font-mono font-semibold text-text uppercase tracking-wider">
          Observed Extractions on this Account ({lpReceipts.length})
        </div>

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

