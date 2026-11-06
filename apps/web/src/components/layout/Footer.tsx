export function Footer() {
  const contracts = [
    {
      name: "v4 PoolManager",
      network: "Base Sepolia",
      address: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
      explorerUrl: "https://sepolia.basescan.org/address/0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
    },
    {
      name: "DarkTraceHook",
      network: "Base Sepolia",
      address: "0xBCC9e1C474Ed195b3791f2c41EdAC2a25c5b80c0",
      explorerUrl: "https://sepolia.basescan.org/address/0xBCC9e1C474Ed195b3791f2c41EdAC2a25c5b80c0",
    },
    {
      name: "RebateVault v2 (Foundry)",
      network: "Arc Testnet",
      address: "0x238dE56E52A3F6C6708952052e6a20E5102b4d5b",
      explorerUrl: "https://explorer.testnet.arc.io/address/0x238dE56E52A3F6C6708952052e6a20E5102b4d5b",
    },
    {
      name: "Studio RebateVault",
      network: "Arc Testnet",
      address: "0x676065eb7c72ddf2048f21e6cb2ca6721827c1de",
      explorerUrl: "https://explorer.testnet.arc.io/address/0x676065eb7c72ddf2048f21e6cb2ca6721827c1de",
    },
  ];

  return (
    <footer className="w-full border-t border-border bg-surface px-4 py-2 text-[11px] font-mono text-muted flex flex-col sm:flex-row items-center justify-between gap-2">
      <div className="flex items-center gap-4">
        <span className="text-text font-semibold">DARKTRACE FORENSICS</span>
        <span>•</span>
        <span>ETHGlobal Mumbai 2026</span>
        <span>•</span>
        <span>Uniswap v4 + Arc + Arkiv</span>
      </div>

      <div className="flex items-center gap-4 overflow-x-auto">
        {contracts.map((c) => (
          <a
            key={c.name}
            href={c.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="hover:text-text transition-colors flex items-center gap-1"
          >
            <span className="text-muted">{c.name}:</span>
            <span className="text-text underline decoration-border hover:decoration-accent">
              {c.address.slice(0, 6)}...{c.address.slice(-4)}
            </span>
          </a>
        ))}
      </div>
    </footer>
  );
}

