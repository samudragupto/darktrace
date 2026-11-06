/**
 * Global network indicator displayed in the application header.
 * Always shows "BASE SEPOLIA · ARC TESTNET" in small monospace type.
 */
export function NetworkBadge() {
  return (
    <div
      className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 border border-border rounded-full bg-surface-2 text-xs select-none whitespace-nowrap"
      data-testid="network-badge"
      title="Base Sepolia and Arc Testnet (testnets only)"
    >
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-good"></span>
      {/* Spec: always visible. Full label from sm up, compact label on phones. */}
      <span className="text-text font-medium tracking-wide uppercase hidden sm:inline">
        BASE SEPOLIA · ARC TESTNET
      </span>
      <span className="text-text font-medium tracking-wide uppercase sm:hidden">TESTNET</span>
    </div>
  );
}

