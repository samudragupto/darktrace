import Link from "next/link";
import { HashDisplay } from "@/components/ui/HashDisplay";
import { StatusPill } from "@/components/ui/StatusPill";
import { ArkivSource } from "@/components/arkiv/ArkivSource";
import { ClaimRebatePanel } from "@/components/receipt/ClaimRebatePanel";
import { fromArkiv, toView, writerAddress } from "@/lib/arkiv";
import { ArrowLeft, ExternalLink, ShieldCheck, Database, SearchX } from "lucide-react";

// Every receipt is read from Arkiv Rabdi at request time.
export const dynamic = "force-dynamic";

interface ReceiptPageProps {
  params: {
    hash: string;
  };
}

const isBytes32 = (h: string) => /^0x[0-9a-fA-F]{64}$/.test(h);

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const hash = params.hash.toLowerCase();

  const res = isBytes32(hash)
    ? await fromArkiv(async (sdk) => {
        // Canonical lookup is by receiptHash attribute; an Arkiv $key also resolves.
        const receipt = (await sdk.getReceiptByHash(hash)) ?? (await sdk.getReceiptByEntityKey(hash as `0x${string}`));
        const claim = receipt ? await sdk.claimForReceipt(receipt.receiptHash) : null;
        return receipt ? toView(receipt, claim) : null;
      })
    : { ok: false as const, error: "receipt hash must be 32 bytes hex", queriedAt: new Date().toISOString() };

  const writer = writerAddress();
  const source = (
    <ArkivSource
      ok={res.ok}
      queriedAt={res.queriedAt}
      error={res.ok ? undefined : res.error}
      query={`select * from receipts where receiptHash = ${hash.slice(0, 10)}… ownedBy(writer) · lp_claims`}
      count={res.ok ? (res.data ? 1 : 0) : undefined}
      writer={writer}
    />
  );

  const backLink = (
    <div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-mono text-muted hover:text-text transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Surveillance Matrix
      </Link>
    </div>
  );

  if (!res.ok || !res.data) {
    return (
      <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
        {backLink}
        {source}
        <div className="border border-border bg-surface p-8 rounded text-center space-y-2 font-mono">
          <SearchX className="w-6 h-6 mx-auto text-muted" />
          <div className="text-sm text-text font-semibold">
            {res.ok ? "No receipt with this hash on Arkiv" : "Could not reach Arkiv"}
          </div>
          <div className="text-xs text-muted break-all">{params.hash}</div>
          <div className="text-[11px] text-muted">
            Only entities written by the DarkTrace writer ({writer.slice(0, 6)}…{writer.slice(-4)}) are trusted.
          </div>
        </div>
      </div>
    );
  }

  const receipt = res.data;
  const hasSlippage = receipt.injectedSlippageBps !== null && receipt.legitSlippageBps !== null;
  // legit = slippage the victim would have had anyway (clean counterfactual);
  // injected = extra slippage caused by the frontrun. Total realized = legit + injected.
  const totalSlippage = hasSlippage ? receipt.injectedSlippageBps! + receipt.legitSlippageBps! : null;
  const bps = (v: number | null, sign = "") => (v === null ? "—" : `${sign}${v} bps`);

  return (
    <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
      {backLink}
      {source}

      {/* Main Forensic Header */}
      <div className="border border-border bg-surface p-6 rounded space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-accent uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-good" />
              Arkiv Rabdi Attested Record
            </div>
            <h1 className="text-xl font-bold font-mono text-text mt-1">Extraction Receipt</h1>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-mono text-muted">Receipt Hash:</span>
              <HashDisplay hash={receipt.receiptHash} truncate={false} className="text-xs" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {receipt.isSynthetic && (
              <span className="px-2 py-1 text-[11px] border border-accent/40 bg-accent/10 text-accent rounded font-semibold uppercase">
                FIXTURE (SDK SMOKE TEST)
              </span>
            )}
            <StatusPill status={receipt.status} />
          </div>
        </div>

        {receipt.isSynthetic && (
          <div className="p-3 border border-accent/40 bg-accent/10 rounded text-xs font-mono text-accent">
            <strong>Data Quality Notice:</strong> This entity was written by{" "}
            <code className="text-text">scripts/arkiv-write-test.ts</code> as an Arkiv SDK round-trip fixture using
            synthetic placeholder addresses (<code className="text-text">0x1111…</code> /{" "}
            <code className="text-text">0x2222…</code>) and tx hashes (<code className="text-text">0xaaaa1111…</code>).
            Real Base Sepolia sandwich receipts have no <code className="text-text">FIXTURE</code> badge.
          </div>
        )}

        {/* Slippage Decomposition */}
        <div className="p-4 border border-border rounded bg-bg space-y-2">
          <div className="text-xs font-mono text-text font-semibold flex items-center justify-between">
            <span>Counterfactual Slippage Decomposition</span>
            <span className="text-danger font-mono font-bold tabular-nums">${receipt.extractedUSDC} USDC Lost</span>
          </div>
          {hasSlippage ? (
            <p className="text-xs font-mono text-muted leading-relaxed">
              Victim realized <span className="text-danger font-semibold">{totalSlippage} bps</span> of slippage. The
              CPMM counterfactual shows <span className="text-good font-semibold">{receipt.legitSlippageBps} bps</span>{" "}
              would have occurred without the attack; the extra{" "}
              <span className="text-accent font-semibold">+{receipt.injectedSlippageBps} bps</span> was injected by the
              searcher&apos;s frontrun.
            </p>
          ) : (
            <p className="text-xs font-mono text-muted leading-relaxed">
              This entity predates the slippage columns; only the extracted amount was recorded on Arkiv.
            </p>
          )}
        </div>

        {/* Core Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-2">
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">Extracted USDC</div>
            <div className="text-danger font-bold mt-1 text-base tabular-nums">${receipt.extractedUSDC}</div>
          </div>
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">Injected Slippage</div>
            <div className="text-accent font-bold mt-1 text-base tabular-nums">{bps(receipt.injectedSlippageBps, "+")}</div>
          </div>
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">Legit Slippage</div>
            <div className="text-good font-bold mt-1 text-base tabular-nums">{bps(receipt.legitSlippageBps)}</div>
          </div>
          <div className="p-3 border border-border rounded bg-bg">
            <div className="text-muted text-[11px]">Base Sepolia Block</div>
            <div className="text-text font-bold mt-1 text-base tabular-nums">#{receipt.blockNumber}</div>
          </div>
        </div>
      </div>

      {/* Arkiv entity + attestation details */}
      <div className="border border-border bg-surface p-5 rounded space-y-4 text-xs font-mono">
        <div className="font-semibold text-text uppercase tracking-wider">Arkiv Entity & Attestation</div>

        <div className="space-y-3 divide-y divide-border">
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-muted">Arkiv Rabdi Entity Key ($key):</span>
            <a
              href={receipt.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline flex items-center gap-1"
            >
              <HashDisplay hash={receipt.arkivEntityKey} truncate={false} />
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-muted">Entity Owner (writer wallet):</span>
            <HashDisplay hash={receipt.owner} truncate={false} />
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-muted">Created / Expires (Arkiv block):</span>
            <span className="text-text tabular-nums flex flex-wrap items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-muted" />#{receipt.createdAtBlock} → #{receipt.expiresAtBlock}
              {receipt.hasExtendedExpiry && (
                <span className="px-1.5 py-0.5 text-[10px] border border-[#BC8CFF]/40 bg-[#BC8CFF]/10 text-[#BC8CFF] rounded font-semibold">
                  EXTENDED TO 90d (OPEN CLAIM)
                </span>
              )}
            </span>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-muted">Target Pool:</span>
            <Link href={`/pool/${receipt.poolId}`} className="text-text hover:underline flex items-center gap-1">
              <span>{receipt.poolName}</span>
              <span className="text-muted">({receipt.poolId.slice(0, 10)}…)</span>
            </Link>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-muted">Searcher Address:</span>
            <Link href={`/searcher/${receipt.searcher}`} className="hover:underline">
              <HashDisplay hash={receipt.searcher} truncate={false} />
            </Link>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-muted">Victim Address:</span>
            <Link href={`/lp/${receipt.victim}`} className="hover:underline">
              <HashDisplay hash={receipt.victim} truncate={false} />
            </Link>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-muted">Simulation Hash (CPMM counterfactual):</span>
            <HashDisplay hash={receipt.simulationHash} truncate={false} />
          </div>
        </div>
      </div>

      {/* Transaction Sequence */}
      <div className="border border-border bg-surface p-5 rounded space-y-3 text-xs font-mono">
        <div className="font-semibold text-text uppercase tracking-wider">Same-Block Transaction Sandwich</div>
        {receipt.txHashes.length === 0 ? (
          <div className="text-muted">No transaction hashes recorded on this entity.</div>
        ) : (
          <div className="space-y-2">
            {receipt.txHashes.map((tx, idx) => {
              const role =
                idx === 0 ? "1. Frontrun Swap (Searcher)" : idx === 1 ? "2. Victim Swap (User)" : "3. Backrun Swap (Searcher)";
              const roleColor = idx === 1 ? "text-accent" : "text-muted";
              return (
                <div key={`${tx}-${idx}`} className="p-3 border border-border rounded bg-bg flex items-center justify-between">
                  <span className={`font-semibold ${roleColor}`}>{role}</span>
                  <div className="flex items-center gap-2">
                    <HashDisplay hash={tx} />
                    <a
                      href={`https://sepolia.basescan.org/tx/${tx}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted hover:text-text"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Settlement (Live wagmi Arc v2 Claim + Arkiv LPClaim sealer) */}
      <ClaimRebatePanel
        receiptHash={receipt.receiptHash}
        extractedUSDC={receipt.extractedUSDC}
        fallbackBeneficiary={receipt.lp || receipt.victim}
        status={receipt.status}
        initialClaimTx={receipt.claimTx}
        isSynthetic={receipt.isSynthetic}
      />
    </div>
  );
}
