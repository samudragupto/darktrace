import { Database, AlertTriangle } from "lucide-react";

interface ArkivSourceProps {
  ok: boolean;
  queriedAt: string;
  /** Human description of the query, e.g. `receipts where poolId = 0x83…`. */
  query: string;
  count?: number;
  writer: string;
  error?: string;
}

/** Visible provenance strip: tells judges exactly which Arkiv query produced the data below. */
export function ArkivSource({ ok, queriedAt, query, count, writer, error }: ArkivSourceProps) {
  if (!ok) {
    return (
      <div role="alert" className="flex items-start gap-2 px-4 py-2.5 border border-danger/30 bg-danger/5 rounded-2xl text-xs text-danger">
        <AlertTriangle aria-hidden="true" className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Arkiv Rabdi read failed ({error}). No fallback data is shown.
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 border border-arkiv/20 bg-arkiv/5 rounded-2xl text-xs text-arkiv">
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <Database aria-hidden="true" className="w-3.5 h-3.5" />
        Live from Arkiv Rabdi · chain 7794095
      </span>
      <span className="text-muted font-mono break-all">
        {query}
        {typeof count === "number" ? ` → ${count} entit${count === 1 ? "y" : "ies"}` : ""}
      </span>
      <span className="text-muted" title={writer}>
        ownedBy {writer.slice(0, 6)}…{writer.slice(-4)}
      </span>
      <span className="text-muted">queried {new Date(queriedAt).toISOString().replace("T", " ").slice(0, 19)} UTC</span>
    </div>
  );
}
