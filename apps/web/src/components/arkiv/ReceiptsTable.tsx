import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { HashDisplay } from "@/components/ui/HashDisplay";
import { StatusPill } from "@/components/ui/StatusPill";
import type { ReceiptView } from "@/lib/arkiv";

type Column = "pool" | "searcher" | "victim";

interface ReceiptsTableProps {
  receipts: ReceiptView[];
  columns: Column[];
  emptyText: string;
}

/** Receipts read from Arkiv. Each row links to the receipt page and to its Arkiv entity. */
export function ReceiptsTable({ receipts, columns, emptyText }: ReceiptsTableProps) {
  if (receipts.length === 0) {
    return (
      <div className="border border-border rounded bg-surface p-8 text-center text-xs font-mono text-muted">
        {emptyText}
      </div>
    );
  }
  return (
    <div className="border border-border rounded bg-surface overflow-x-auto">
      <table className="w-full text-xs font-mono text-left border-collapse">
        <thead>
          <tr className="border-b border-border text-muted bg-[#15181E] select-none">
            <th className="py-2.5 px-3 font-semibold">Receipt Hash</th>
            {columns.includes("pool") && <th className="py-2.5 px-3 font-semibold">Pool</th>}
            {columns.includes("searcher") && <th className="py-2.5 px-3 font-semibold">Searcher</th>}
            {columns.includes("victim") && <th className="py-2.5 px-3 font-semibold">Victim</th>}
            <th className="py-2.5 px-3 font-semibold text-right">Block</th>
            <th className="py-2.5 px-3 font-semibold text-right">Extracted USDC</th>
            <th className="py-2.5 px-3 font-semibold text-right">Injected Slippage</th>
            <th className="py-2.5 px-3 font-semibold">Arkiv $key</th>
            <th className="py-2.5 px-3 font-semibold text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {receipts.map((r) => (
            <tr key={r.arkivEntityKey} className="hover:bg-[#181B20] transition-colors group">
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-1.5">
                  <Link href={`/receipt/${r.receiptHash}`}>
                    <HashDisplay hash={r.receiptHash} className="group-hover:text-accent" />
                  </Link>
                  {r.isSynthetic && (
                    <span
                      title="Synthetic SDK smoke-test fixture (scripts/arkiv-write-test.ts)"
                      className="px-1.5 py-0.5 text-[10px] border border-accent/40 bg-accent/10 text-accent rounded font-semibold uppercase"
                    >
                      FIXTURE
                    </span>
                  )}
                </div>
              </td>
              {columns.includes("pool") && (
                <td className="py-2.5 px-3 text-text">
                  <Link href={`/pool/${r.poolId}`} className="hover:underline">
                    {r.poolName}
                  </Link>
                </td>
              )}
              {columns.includes("searcher") && (
                <td className="py-2.5 px-3">
                  <Link href={`/searcher/${r.searcher}`}>
                    <HashDisplay hash={r.searcher} className="text-muted hover:text-text" />
                  </Link>
                </td>
              )}
              {columns.includes("victim") && (
                <td className="py-2.5 px-3">
                  <Link href={`/lp/${r.victim}`}>
                    <HashDisplay hash={r.victim} className="text-muted hover:text-text" />
                  </Link>
                </td>
              )}
              <td className="py-2.5 px-3 text-right text-muted tabular-nums">#{r.blockNumber}</td>
              <td className="py-2.5 px-3 text-right font-bold text-danger tabular-nums">${r.extractedUSDC}</td>
              <td className="py-2.5 px-3 text-right text-accent tabular-nums">
                {r.injectedSlippageBps === null ? <span className="text-muted">—</span> : `+${r.injectedSlippageBps} bps`}
              </td>
              <td className="py-2.5 px-3">
                <a
                  href={r.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[#BC8CFF] hover:underline"
                >
                  {r.arkivEntityKey.slice(0, 8)}…{r.arkivEntityKey.slice(-4)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </td>
              <td className="py-2.5 px-3 text-center">
                <div className="inline-flex items-center gap-1.5">
                  <StatusPill status={r.status} />
                  {r.hasExtendedExpiry && r.status === "ARCHIVED" && (
                    <span
                      title="Open-claim receipt expiry extended to 90 days via extendEntity"
                      className="px-1.5 py-0.5 text-[10px] border border-[#BC8CFF]/40 bg-[#BC8CFF]/10 text-[#BC8CFF] rounded font-semibold"
                    >
                      90d TTL
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
