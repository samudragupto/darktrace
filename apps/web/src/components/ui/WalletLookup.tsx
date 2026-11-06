import { Search } from "lucide-react";

interface WalletLookupProps {
  invalid?: boolean;
  compact?: boolean;
}

/** Plain GET form (no JS): /lookup routes an address to its LP page and a receipt hash to its receipt. */
export function WalletLookup({ invalid = false, compact = false }: WalletLookupProps) {
  return (
    <form action="/lookup" method="get" className={`w-full ${compact ? "" : "space-y-2"}`} role="search">
      {!compact && (
        <label htmlFor="lookup-q" className="block text-sm font-medium text-text">
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
          aria-label={compact ? "Wallet address or receipt hash" : undefined}
          aria-invalid={invalid}
          aria-describedby={invalid ? "lookup-q-error" : undefined}
          className={`min-w-0 flex-1 px-4 py-2.5 rounded-full bg-surface-2 border font-mono text-sm text-text placeholder:text-muted focus:border-text focus:bg-surface ${
            invalid ? "border-danger" : "border-border"
          }`}
        />
        <button
          type="submit"
          className="shrink-0 inline-flex items-center gap-2 pl-4 pr-1.5 py-1.5 rounded-full bg-ink text-on-ink text-sm font-medium hover:bg-ink/85 transition-colors"
        >
          Check
          <span aria-hidden="true" className="grid place-items-center w-7 h-7 rounded-full bg-on-ink text-ink">
            <Search className="w-3.5 h-3.5" />
          </span>
        </button>
      </div>
      {invalid && (
        <p id="lookup-q-error" className="text-xs text-danger">
          Enter a 0x wallet address (40 hex characters) or a receipt hash (64 hex characters).
        </p>
      )}
    </form>
  );
}
