export function Footer() {
  const contracts = [
    {
      name: "v4 PoolManager",
      network: "Base Sepolia",
      address: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
      explorerUrl: "https://sepolia.basescan.org/address/0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
    },
    {
      name: "DarkTraceHook v2",
      network: "Base Sepolia",
      address: "0xCeF7a999885D93f23Beeb7D319A83F2949B2c0c0",
      explorerUrl: "https://sepolia.basescan.org/address/0xCeF7a999885D93f23Beeb7D319A83F2949B2c0c0",
    },
    {
      name: "DarkTraceHook v1",
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
    <footer className="w-full bg-surface border border-border rounded-card shadow-card px-4 py-4 sm:px-5 text-xs text-muted flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-text font-semibold">DARKTRACE FORENSICS</span>
        <span aria-hidden="true">•</span>
        <span>Uniswap v4 + Arc + Arkiv</span>
      </div>

      <nav aria-label="Deployed contracts">
        <ul className="flex flex-wrap gap-2">
          {contracts.map((c) => (
            <li key={c.name}>
              <a
                href={c.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 hover:border-muted/50 hover:text-text transition-colors"
              >
                <span>{c.name}</span>
                <span className="font-mono text-text">
                  {c.address.slice(0, 6)}...{c.address.slice(-4)}
                </span>
                <span className="sr-only">
                  ({c.network}, full address {c.address}, opens in a new tab)
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  );
}
