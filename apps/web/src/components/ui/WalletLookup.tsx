import { Search } from "lucide-react";

interface WalletLookupProps {
  invalid?: boolean;
  compact?: boolean;
}

/** Plain GET form (no JS): /lookup routes an address to its LP page and a receipt hash to its receipt. */
export function WalletLookup({ invalid = false, compact = false }: WalletLookupProps) {
  return (
    <form action="/lookup" method="get" className={`w-full ${compact ? "" : "space-y-1.5"}`} role="search">
      {!compact && (
        <label htmlFor="lookup-q" className="block text-[11px] font-mono text-muted uppercase tracking-wider">
          Was I sandwiched? Check a wallet or receipt
        </label>
      )}
      <div className="flex w-full gap-2">
        <input
          id="lookup-q"
          name="q"
          required
          spellCheck={false}
          autoComplete="off"
          placeholder="0x… wallet address or receipt hash"
          aria-invalid={invalid}
          className={`min-w-0 flex-1 px-3 py-2 rounded bg-bg border font-mono text-xs text-text placeholder:text-muted focus:outline-none focus:border-accent ${
            invalid ? "border-danger" : "border-border"
          }`}
        />
        <button
          type="submit"
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded bg-accent text-bg font-mono text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <Search className="w-3.5 h-3.5" aria-hidden="true" />
          Check
        </button>
      </div>
      {invalid && (
        <p className="text-[11px] font-mono text-danger">
          Enter a 0x wallet address (40 hex characters) or a receipt hash (64 hex characters).
        </p>
      )}
    </form>
  );
}
