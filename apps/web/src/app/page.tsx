import Link from "next/link";
import { fromArkiv, sumUSDC, toView } from "@/lib/arkiv";
import { LatestSandwich } from "@/components/home/LatestSandwich";
import { getVaultReserveUSDC } from "@/lib/arc";
import { WalletLookup } from "@/components/ui/WalletLookup";
import { DemoData } from "@/components/ui/DemoData";
import { Landmark, LayoutDashboard, Layers, Radar, Search, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams?: { lookup?: string } }) {
  const [res, vaultReserve] = await Promise.all([
    fromArkiv((sdk) => sdk.listRecentReceipts(25)),
    getVaultReserveUSDC(),
  ]);
  const receipts = res.ok ? res.data : [];
  const totalExtracted = sumUSDC(receipts);
  // Newest real (non-fixture) receipt for the hero visual; presentation only.
  const latest =
    receipts
      .slice()
      .sort((a, b) => b.blockNumber - a.blockNumber)
      .map((r) => toView(r))
      .find((v) => !v.isSynthetic) ?? null;

  return (
    <div className="flex-1 flex flex-col w-full max-w-7xl mx-auto gap-3 lg:gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3 lg:gap-4">
        {/* Wallet-style overview: title, headline balance, actions, lookup */}
        <section className="bg-surface border border-border rounded-card shadow-card p-5 sm:p-8 flex flex-col">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text text-balance">
            DARKTRACE MEV FORENSICS
          </h1>
          <p className="mt-3 text-muted text-sm sm:text-base max-w-[62ch] leading-relaxed">
            LPs and traders lose over $1B a year to MEV (a conservative estimate). DarkTrace measures each sandwich, proves it on-chain, and pays the victim back.
            Transient-storage hooks detect extraction footprints on Base Sepolia,
            Arkiv seals immutable forensic receipts, and affected LPs claim USDC rebates on Arc.
          </p>

          <div className="mt-8 text-center sm:text-left">
            <p className="text-sm text-muted">Extracted Volume (Arkiv)</p>
            <p className="mt-1 text-5xl sm:text-6xl font-semibold tracking-tight tabular-nums text-text">
              {res.ok ? `$${totalExtracted}` : <span className="text-muted text-3xl font-medium">unavailable</span>}
            </p>
            <p className="mt-2 text-sm text-muted">Cumulative attested USDC loss</p>
          </div>

          <nav aria-label="Quick actions" className="mt-7">
            <ul className="grid grid-cols-4 gap-2 max-w-md mx-auto sm:mx-0">
              {[
                { href: "#lookup-q", label: "Check wallet", icon: Search, external: false },
                { href: "/demo", label: "Terminal demo", icon: Radar, external: false },
                { href: "/dashboard", label: "Forensic explorer", icon: LayoutDashboard, external: false },
                {
                  href: "https://explorer.testnet.arc.io/address/0x238dE56E52A3F6C6708952052e6a20E5102b4d5b",
                  label: "RebateVault",
                  icon: Landmark,
                  external: true,
                },
              ].map(({ href, label, icon: Icon, external }) => {
                const inner = (
                  <>
                    <span className="grid place-items-center w-12 h-12 rounded-full bg-ink text-on-ink transition-transform group-hover:-translate-y-0.5">
                      <Icon aria-hidden="true" className="w-5 h-5" strokeWidth={1.75} />
                    </span>
                    <span className="text-xs font-medium text-text text-center leading-tight">{label}</span>
                    {external && <span className="sr-only">(Arc explorer, opens in a new tab)</span>}
                  </>
                );
                const cls = "group flex flex-col items-center gap-2 rounded-2xl p-1.5";
                return (
                  <li key={label}>
                    {external ? (
                      <a href={href} target="_blank" rel="noreferrer" className={cls}>
                        {inner}
                      </a>
                    ) : (
                      <Link href={href} className={cls}>
                        {inner}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-8 pt-6 border-t border-border">
            <WalletLookup invalid={searchParams?.lookup === "invalid"} />
          </div>
        </section>

        <div className="flex flex-col gap-3 lg:gap-4 min-w-0">
          <LatestSandwich receipt={latest} ok={res.ok} />

          {/* Remaining live counters as wallet-style asset rows */}
          <section aria-labelledby="readout-title" className="bg-surface border border-border rounded-card shadow-card p-2">
            <h2 id="readout-title" className="px-3 pt-3 pb-1 text-sm font-semibold text-text">
              Network readout
            </h2>
            <ul className="divide-y divide-border">
              <li className="flex items-center gap-3 px-3 py-3">
                <span aria-hidden="true" className="grid place-items-center w-10 h-10 rounded-full bg-accent/10 text-accent shrink-0">
                  <Layers className="w-[18px] h-[18px]" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1 flex flex-col">
                  <span className="text-sm font-medium text-text">Detected Extractions (Arkiv)</span>
                  <span className="text-xs text-muted">Live entities on Arkiv Rabdi</span>
                </span>
                <span className="text-lg font-semibold tabular-nums text-accent">
                  {res.ok ? receipts.length : <span className="text-muted text-sm font-medium">unavailable</span>}
                </span>
              </li>
              <li className="flex items-center gap-3 px-3 py-3">
                <span aria-hidden="true" className="grid place-items-center w-10 h-10 rounded-full bg-good/10 text-good shrink-0">
                  <Landmark className="w-[18px] h-[18px]" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1 flex flex-col">
                  <span className="text-sm font-medium text-text">RebateVault v2 Reserve (Arc)</span>
                  <span className="text-xs text-muted">Live on-chain balance (0x238d…4d5b)</span>
                </span>
                <span className="text-lg font-semibold tabular-nums text-good whitespace-nowrap">
                  {vaultReserve !== null ? `$${vaultReserve} USDC` : <span className="text-muted text-sm font-medium">unavailable</span>}
                </span>
              </li>
              <li className="flex items-center gap-3 px-3 py-3">
                <span aria-hidden="true" className="grid place-items-center w-10 h-10 rounded-full bg-arkiv/10 text-arkiv shrink-0">
                  <ShieldCheck className="w-[18px] h-[18px]" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1 flex flex-col">
                  <span className="text-sm font-medium text-text">Arkiv Sealed Proofs</span>
                  <span className="text-xs text-muted">Cryptographically immutable</span>
                </span>
                <span className="text-lg font-semibold tabular-nums text-text">
                  <DemoData label="STATIC">{res.ok ? "100.0%" : "—"}</DemoData>
                </span>
              </li>
            </ul>
            <p className="px-3 pt-2 pb-3 text-xs text-muted leading-relaxed">
              Extracted Volume, Detected Extractions and the vault reserve are read live from Arkiv Rabdi (chain 7794095) and Arc Testnet (chain 5042002); Sealed Proofs is a fixed value, not a measurement.
            </p>
          </section>
        </div>
      </div>

      {/* System Architecture Matrix */}
      <section className="bg-surface border border-border rounded-card shadow-card p-5 sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight text-text mb-5">System Core Verification</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0 md:divide-x md:divide-border">
          <div className="space-y-2 md:pr-6">
            <h3 className="text-sm font-semibold text-text">1. Uniswap v4 Hook</h3>
            <p className="text-muted text-sm leading-relaxed">
              Base Sepolia contract measuring tick inversion and volume deltas using Cancun transient storage (<code className="prose-code">tstore</code>). Emits <code className="prose-code">ExtractionDetected</code>.
            </p>
          </div>
          <div className="space-y-2 md:px-6">
            <h3 className="text-sm font-semibold text-text">2. Arc Settlement</h3>
            <p className="text-muted text-sm leading-relaxed">
              Circle USDC L1 hosting <code className="prose-code">RebateVault.sol</code> and <code className="prose-code">SimulationRegistry.sol</code>. Computes counterfactual execution against pre-attack reserves and issues USDC restitution.
            </p>
          </div>
          <div className="space-y-2 md:pl-6">
            <h3 className="text-sm font-semibold text-text">3. Arkiv Proof Ledger</h3>
            <p className="text-muted text-sm leading-relaxed">
              Permanent queryable audit trail for <code className="prose-code">ExtractionReceipt</code>, searcher reputation scores, and verified LP claim history.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
