import Link from "next/link";
import { HashDisplay } from "@/components/ui/HashDisplay";
import { StatusPill } from "@/components/ui/StatusPill";
import { ArkivSource } from "@/components/arkiv/ArkivSource";
import { ClaimRebatePanel } from "@/components/receipt/ClaimRebatePanel";
import { ReceiptProgress } from "@/components/receipt/ReceiptProgress";
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
        className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted shadow-card hover:text-text transition-colors"
      >
        <ArrowLeft aria-hidden="true" className="w-4 h-4" />
        Back to Surveillance Matrix
      </Link>
    </div>
  );

  if (!res.ok || !res.data) {
    return (
      <div className="flex-1 w-full max-w-5xl mx-auto flex flex-col gap-3 lg:gap-4">
        {backLink}
        {source}
        <div className="border border-border bg-surface shadow-card p-10 rounded-card text-center space-y-2">
          <SearchX aria-hidden="true" className="w-7 h-7 mx-auto text-muted" />
          <h1 className="text-lg text-text font-semibold">
            {res.ok ? "No receipt with this hash on Arkiv" : "Could not reach Arkiv"}
          </h1>
          <div className="text-xs font-mono text-muted break-all">{params.hash}</div>
          <p className="text-sm text-muted">
            Only entities written by the DarkTrace writer ({writer.slice(0, 6)}…{writer.slice(-4)}) are trusted.
          </p>
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
  // Share of realized slippage for the decomposition bar (presentation only).
  const legitShare = hasSlippage && totalSlippage ? (receipt.legitSlippageBps! / totalSlippage) * 100 : 0;
  const injectedShare = hasSlippage && totalSlippage ? (receipt.injectedSlippageBps! / totalSlippage) * 100 : 0;

  const entityRow = "py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-6";

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto flex flex-col gap-3 lg:gap-4">
      {backLink}
      {source}

      {/* Main Forensic Header */}
      <section className="border border-border bg-surface shadow-card p-5 sm:p-7 rounded-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text">Extraction Receipt</h1>
            <p className="mt-1.5 text-sm text-muted flex items-center gap-1.5">
              <ShieldCheck aria-hidden="true" className="w-4 h-4 text-good" />
              Arkiv Rabdi Attested Record
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm text-muted">Receipt Hash:</span>
              <HashDisplay hash={receipt.receiptHash} truncate={false} className="text-xs" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {receipt.isSynthetic && (
              <span className="px-2.5 py-1 text-[11px] border border-accent/30 bg-accent/10 text-accent rounded-full font-semibold uppercase">
                FIXTURE (SDK SMOKE TEST)
              </span>
            )}
            <StatusPill status={receipt.status} />
          </div>
        </div>

        <ReceiptProgress
          receiptHash={receipt.receiptHash}
          extractedUSDC={receipt.extractedUSDC}
          blockNumber={receipt.blockNumber}
          status={receipt.status}
          isSynthetic={receipt.isSynthetic}
        />

        {receipt.isSynthetic && (
          <div className="p-4 border border-accent/30 bg-accent/5 rounded-2xl text-sm text-accent leading-relaxed">
            <strong>Data Quality Notice:</strong> This entity was written by{" "}
            <code className="prose-code">scripts/arkiv-write-test.ts</code> as an Arkiv SDK round-trip fixture using
            synthetic placeholder addresses (<code className="prose-code">0x1111…</code> /{" "}
            <code className="prose-code">0x2222…</code>) and tx hashes (<code className="prose-code">0xaaaa1111…</code>).
            Real Base Sepolia sandwich receipts have no <code className="prose-code">FIXTURE</code> badge.
          </div>
        )}

        {/* Core Metrics */}
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-y-5 gap-x-4 border-t border-border pt-5">
          <div>
            <dt className="text-sm text-muted">Extracted USDC</dt>
            <dd className="text-danger font-semibold mt-1 text-2xl tabular-nums">${receipt.extractedUSDC}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Injected Slippage</dt>
            <dd className="text-accent font-semibold mt-1 text-2xl tabular-nums">{bps(receipt.injectedSlippageBps, "+")}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Legit Slippage</dt>
            <dd className="text-good font-semibold mt-1 text-2xl tabular-nums">{bps(receipt.legitSlippageBps)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Base Sepolia Block</dt>
            <dd className="text-text font-semibold mt-1 text-2xl font-mono tabular-nums">#{receipt.blockNumber}</dd>
          </div>
        </dl>
      </section>

      {/* Slippage Decomposition: dark chart panel */}
      <section className="ink rounded-card shadow-float p-5 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-base font-semibold tracking-tight text-text">Counterfactual Slippage Decomposition</h2>
          <span className="text-danger font-semibold tabular-nums">${receipt.extractedUSDC} USDC Lost</span>
        </div>
        {hasSlippage ? (
          <>
            {totalSlippage! > 0 && (
              <figure className="space-y-3">
                <div className="flex h-3 w-full gap-0.5" aria-hidden="true">
                  {legitShare > 0 && (
                    <div
                      className="h-full rounded-l-[4px] bg-good last:rounded-r-[4px]"
                      style={{ width: `${legitShare}%` }}
                      title={`Legit slippage: ${receipt.legitSlippageBps} bps`}
                    />
                  )}
                  {injectedShare > 0 && (
                    <div
                      className="h-full rounded-r-[4px] bg-accent first:rounded-l-[4px]"
                      style={{ width: `${injectedShare}%` }}
                      title={`Injected slippage: +${receipt.injectedSlippageBps} bps`}
                    />
                  )}
                </div>
                <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm bg-good" />
                    Legit (counterfactual) <span className="text-text font-mono tabular-nums">{receipt.legitSlippageBps} bps</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm bg-accent" />
                    Injected by frontrun <span className="text-text font-mono tabular-nums">+{receipt.injectedSlippageBps} bps</span>
                  </span>
                  <span>
                    Total realized <span className="text-text font-mono tabular-nums">{totalSlippage} bps</span>
                  </span>
                </figcaption>
              </figure>
            )}
            <p className="text-sm text-muted leading-relaxed max-w-[70ch]">
              Victim realized <span className="text-danger font-semibold font-mono tabular-nums">{totalSlippage} bps</span> of slippage. The
              CPMM counterfactual shows <span className="text-good font-semibold font-mono tabular-nums">{receipt.legitSlippageBps} bps</span>{" "}
              would have occurred without the attack; the extra{" "}
              <span className="text-accent font-semibold font-mono tabular-nums">+{receipt.injectedSlippageBps} bps</span> was injected by the
              searcher&apos;s frontrun.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted leading-relaxed max-w-[70ch]">
            This entity predates the slippage columns; only the extracted amount was recorded on Arkiv.
          </p>
        )}
      </section>

      {/* Transaction Sequence: dark activity panel */}
      <section className="ink rounded-card shadow-float p-5 sm:p-7 space-y-4">
        <h2 className="text-base font-semibold tracking-tight text-text">Same-Block Transaction Sandwich</h2>
        {receipt.txHashes.length === 0 ? (
          <p className="text-sm text-muted">No transaction hashes recorded on this entity.</p>
        ) : (
          <ol className="space-y-2">
            {receipt.txHashes.map((tx, idx) => {
              const role =
                idx === 0 ? "1. Frontrun Swap (Searcher)" : idx === 1 ? "2. Victim Swap (User)" : "3. Backrun Swap (Searcher)";
              const isVictim = idx === 1;
              return (
                <li
                  key={`${tx}-${idx}`}
                  className={`px-4 py-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    isVictim ? "bg-accent/10 ring-1 ring-inset ring-accent/40" : "bg-surface"
                  }`}
                >
                  <span className={`text-sm font-medium ${isVictim ? "text-accent" : "text-text"}`}>{role}</span>
                  <div className="flex items-center gap-2">
                    <HashDisplay hash={tx} className="text-muted" />
                    <a
                      href={`https://sepolia.basescan.org/tx/${tx}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted hover:text-text p-1 -m-1 rounded-md"
                    >
                      <ExternalLink aria-hidden="true" className="w-3.5 h-3.5" />
                      <span className="sr-only">View transaction on BaseScan (opens in a new tab)</span>
                    </a>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Arkiv entity + attestation details */}
      <section className="border border-border bg-surface shadow-card p-5 sm:p-7 rounded-card text-sm">
        <h2 className="text-base font-semibold tracking-tight text-text mb-2">Arkiv Entity &amp; Attestation</h2>

        <div className="divide-y divide-border">
          <div className={entityRow}>
            <span className="text-muted">Arkiv Rabdi Entity Key ($key):</span>
            <a
              href={receipt.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-arkiv hover:underline flex items-center gap-1 min-w-0"
            >
              <HashDisplay hash={receipt.arkivEntityKey} truncate={false} />
              <ExternalLink aria-hidden="true" className="w-3 h-3 shrink-0" />
              <span className="sr-only">(Arkiv explorer, opens in a new tab)</span>
            </a>
          </div>

          <div className={entityRow}>
            <span className="text-muted">Entity Owner (writer wallet):</span>
            <HashDisplay hash={receipt.owner} truncate={false} />
          </div>

          <div className={entityRow}>
            <span className="text-muted">Created / Expires (Arkiv block):</span>
            <span className="text-text font-mono text-xs tabular-nums flex flex-wrap items-center gap-1.5">
              <Database aria-hidden="true" className="w-3.5 h-3.5 text-muted" />#{receipt.createdAtBlock} → #{receipt.expiresAtBlock}
              {receipt.hasExtendedExpiry && (
                <span className="px-2 py-0.5 text-[11px] font-sans border border-arkiv/30 bg-arkiv/10 text-arkiv rounded-full font-semibold">
                  EXTENDED TO 90d (OPEN CLAIM)
                </span>
              )}
            </span>
          </div>

          <div className={entityRow}>
            <span className="text-muted">Target Pool:</span>
            <Link href={`/pool/${receipt.poolId}`} className="text-text hover:underline flex items-center gap-1">
              <span className="font-medium">{receipt.poolName}</span>
              <span className="text-muted font-mono text-xs">({receipt.poolId.slice(0, 10)}…)</span>
            </Link>
          </div>

          <div className={entityRow}>
            <span className="text-muted">Searcher Address:</span>
            <Link href={`/searcher/${receipt.searcher}`} className="hover:underline min-w-0">
              <HashDisplay hash={receipt.searcher} truncate={false} />
            </Link>
          </div>

          <div className={entityRow}>
            <span className="text-muted">Victim Address:</span>
            <Link href={`/lp/${receipt.victim}`} className="hover:underline min-w-0">
              <HashDisplay hash={receipt.victim} truncate={false} />
            </Link>
          </div>

          <div className={entityRow}>
            <span className="text-muted">Detected by:</span>
            <span className="text-text sm:text-right">
              {receipt.detection === "linked-origin"
                ? "Off-chain linked-origin scan (frontrun & backrun via different contracts, same signing EOA)"
                : "On-chain DarkTraceHook (ExtractionDetected)"}
            </span>
          </div>

          <div className={entityRow}>
            <span className="text-muted">Simulation Hash (CPMM counterfactual):</span>
            <HashDisplay hash={receipt.simulationHash} truncate={false} />
          </div>
        </div>
      </section>

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
