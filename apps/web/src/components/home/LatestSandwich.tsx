import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import type { ReceiptView } from "@/lib/arkiv";

interface LatestSandwichProps {
  /** Most recent non-fixture receipt read from Arkiv, or null when none is available. */
  receipt: ReceiptView | null;
  /** Whether the Arkiv read succeeded. */
  ok: boolean;
}

const short = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;

/**
 * Hero visual: the latest real sandwich as its three same-block transactions.
 * Every value comes from the Arkiv receipt; nothing here is illustrative.
 */
export function LatestSandwich({ receipt, ok }: LatestSandwichProps) {
  if (!receipt) {
    return (
      <div className="ink rounded-2xl p-6 min-h-[240px] flex flex-col items-center justify-center text-center gap-2">
        <Layers aria-hidden="true" className="w-6 h-6 text-muted" />
        <p className="text-sm text-text font-medium">
          {ok ? "No sandwiches recorded on Arkiv yet" : "Latest sandwich unavailable"}
        </p>
        <p className="text-xs text-muted max-w-[32ch]">
          {ok
            ? "The newest detected extraction will appear here."
            : "The Arkiv Rabdi read did not return in time. Reload to try again."}
        </p>
      </div>
    );
  }

  const [front, victim, back] = receipt.txHashes;
  const steps = [
    { role: "Frontrun swap", who: "Searcher", tx: front, isVictim: false },
    {
      role: "Victim swap",
      who:
        receipt.injectedSlippageBps !== null ? `+${receipt.injectedSlippageBps} bps injected` : "Sandwiched trade",
      tx: victim,
      isVictim: true,
    },
    { role: "Backrun swap", who: "Searcher", tx: back, isVictim: false },
  ];

  return (
    <div className="ink relative rounded-2xl p-5 sm:p-6 group">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-4">
        <h2 className="text-sm font-semibold text-text">Latest sandwich</h2>
        <span className="text-xs text-muted font-mono tabular-nums">
          Block #{receipt.blockNumber} · {receipt.poolName}
        </span>
      </div>

      <ol className="space-y-2">
        {steps.map((s) => (
          <li
            key={s.role}
            className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm ${
              s.isVictim ? "bg-accent/10 ring-1 ring-inset ring-accent/40 text-accent" : "bg-surface-2 text-text"
            }`}
          >
            <span className="font-medium">{s.role}</span>
            <span className="flex items-center gap-2 min-w-0 text-xs">
              <span className={s.isVictim ? "text-accent" : "text-muted"}>{s.who}</span>
              {s.tx && <span className="hidden sm:inline font-mono text-muted">{short(s.tx)}</span>}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-danger tabular-nums">${receipt.extractedUSDC} USDC</div>
          <div className="text-xs text-muted mt-0.5">Extracted from the victim</div>
        </div>
        <Link
          href={`/receipt/${receipt.receiptHash}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text after:absolute after:inset-0 after:rounded-2xl after:content-['']"
        >
          Open receipt
          <ArrowRight aria-hidden="true" className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
