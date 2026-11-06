import Link from "next/link";
import { ArrowRight, ExternalLink, Inbox, Layers } from "lucide-react";
import { HashDisplay } from "@/components/ui/HashDisplay";
import { StatusPill } from "@/components/ui/StatusPill";
import type { ReceiptView } from "@/lib/arkiv";

type Column = "pool" | "searcher" | "victim";

interface ReceiptsTableProps {
  receipts: ReceiptView[];
  columns: Column[];
  emptyText: string;
}

/**
 * Receipts read from Arkiv, as a wallet-style activity list. Each row links to the
 * receipt page, and carries the same fields the table did: hash, pool, searcher,
 * victim, block, extracted USDC, injected slippage, Arkiv $key and status.
 */
export function ReceiptsTable({ receipts, columns, emptyText }: ReceiptsTableProps) {
  if (receipts.length === 0) {
    return (
      <div className="border border-border rounded-card bg-surface shadow-card p-10 text-center text-sm text-muted flex flex-col items-center gap-2">
        <Inbox aria-hidden="true" className="w-6 h-6" />
        {emptyText}
      </div>
    );
  }
  return (
    <ul className="border border-border rounded-card bg-surface shadow-card divide-y divide-border overflow-hidden">
      {receipts.map((r) => (
        <li key={r.arkivEntityKey} className="group flex flex-wrap sm:flex-nowrap items-start gap-3 sm:gap-4 px-4 sm:px-5 py-4 hover:bg-surface-2/60 transition-colors">
          <span
            aria-hidden="true"
            className={`mt-0.5 grid place-items-center w-10 h-10 shrink-0 rounded-full ${
              r.status === "REBATED" ? "bg-good/10 text-good" : "bg-danger/10 text-danger"
            }`}
          >
            <Layers className="w-[18px] h-[18px]" strokeWidth={1.75} />
          </span>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link
                href={`/receipt/${r.receiptHash}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-text hover:underline"
              >
                Sandwich on {r.poolName}
                <ArrowRight aria-hidden="true" className="w-3.5 h-3.5 text-muted transition-transform group-hover:translate-x-0.5" />
              </Link>
              {r.isSynthetic && (
                <span
                  title="Synthetic SDK smoke-test fixture (scripts/arkiv-write-test.ts)"
                  className="px-2 py-0.5 text-[11px] border border-accent/30 bg-accent/10 text-accent rounded-full font-semibold uppercase whitespace-nowrap"
                >
                  FIXTURE
                </span>
              )}
            </div>

            <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <div className="flex items-center gap-1.5">
                <dt>Receipt</dt>
                <dd>
                  <HashDisplay hash={r.receiptHash} className="text-muted" />
                </dd>
              </div>
              {columns.includes("pool") && (
                <div className="flex items-center gap-1.5">
                  <dt>Pool</dt>
                  <dd>
                    <Link href={`/pool/${r.poolId}`} className="text-text hover:underline whitespace-nowrap">
                      {r.poolName}
                    </Link>
                  </dd>
                </div>
              )}
              {columns.includes("searcher") && (
                <div className="flex items-center gap-1.5">
                  <dt>Searcher</dt>
                  <dd>
                    <Link href={`/searcher/${r.searcher}`} className="font-mono text-text hover:underline whitespace-nowrap">
                      {r.searcher.slice(0, 6)}…{r.searcher.slice(-4)}
                    </Link>
                  </dd>
                </div>
              )}
              {columns.includes("victim") && (
                <div className="flex items-center gap-1.5">
                  <dt>Victim</dt>
                  <dd>
                    <Link href={`/lp/${r.victim}`} className="font-mono text-text hover:underline whitespace-nowrap">
                      {r.victim.slice(0, 6)}…{r.victim.slice(-4)}
                    </Link>
                  </dd>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <dt>Block</dt>
                <dd className="font-mono tabular-nums text-text whitespace-nowrap">#{r.blockNumber}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt>Arkiv $key</dt>
                <dd>
                  <a
                    href={r.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-arkiv hover:underline whitespace-nowrap"
                  >
                    {r.arkivEntityKey.slice(0, 8)}…{r.arkivEntityKey.slice(-4)}
                    <ExternalLink aria-hidden="true" className="w-3 h-3" />
                    <span className="sr-only">(Arkiv explorer, opens in a new tab)</span>
                  </a>
                </dd>
              </div>
            </dl>
          </div>

          <div className="w-full sm:w-auto pl-[52px] sm:pl-0 shrink-0 flex flex-row sm:flex-col flex-wrap items-center sm:items-end justify-between sm:justify-start gap-1.5 sm:text-right">
            <span className="text-sm font-semibold text-danger tabular-nums whitespace-nowrap">
              ${r.extractedUSDC} USDC<span className="font-normal text-xs text-muted"> extracted</span>
            </span>
            <span className="text-xs text-muted tabular-nums whitespace-nowrap">
              {r.injectedSlippageBps === null ? "—" : `+${r.injectedSlippageBps} bps injected`}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <StatusPill status={r.status} />
              {r.hasExtendedExpiry && r.status === "ARCHIVED" && (
                <span
                  title="Open-claim receipt expiry extended to 90 days via extendEntity"
                  className="px-2 py-0.5 text-[11px] border border-arkiv/30 bg-arkiv/10 text-arkiv rounded-full font-semibold whitespace-nowrap"
                >
                  90d TTL
                </span>
              )}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
