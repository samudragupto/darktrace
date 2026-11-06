import { ReactNode } from "react";

interface DemoDataProps {
  children?: ReactNode;
  label?: string;
  className?: string;
}

/**
 * Inline wrapper and visible badge for seeded / illustrative testnet figures.
 * Ensures judges can immediately distinguish live on-chain reads from seeded demo records.
 */
export function DemoData({
  children,
  label = "DEMO",
  className = "",
}: DemoDataProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {children}
      <span className="px-2 py-1 text-[11px] leading-none font-semibold tracking-wide uppercase text-muted bg-surface-2 border border-border rounded-full select-none">
        [{label}]
      </span>
    </span>
  );
}

export function DemoDataBadge({
  children,
  label = "DEMO",
  className = "",
}: DemoDataProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {children}
      <span className="px-2 py-1 text-[11px] leading-none font-semibold tracking-wide uppercase text-muted bg-surface-2 border border-border rounded-full select-none">
        [{label}]
      </span>
    </span>
  );
}

