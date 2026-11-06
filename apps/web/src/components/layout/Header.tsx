"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { NetworkBadge } from "@/components/ui/NetworkBadge";

export function Header() {
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Forensic Live", href: "/demo" },
  ];

  return (
    <header className="min-h-10 w-full bg-surface border-b border-border px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs select-none">
      <div className="flex items-center gap-3 sm:gap-6">
        <Link href="/" className="font-mono font-bold tracking-wider text-text flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent inline-block"></span>
          DARKTRACE
        </Link>
        <span className="text-border">|</span>
        <nav className="flex items-center space-x-3 sm:space-x-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`transition-colors py-1 ${
                  isActive
                    ? "text-text font-medium border-b border-accent"
                    : "text-muted hover:text-text"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden md:block">
          <NetworkBadge />
        </div>

        <ConnectButton.Custom>
          {({ account, chain: activeChain, openConnectModal, openAccountModal, mounted }) => {
            const ready = mounted;
            const connected = ready && account && activeChain;

            if (!ready) {
              return (
                <div
                  aria-hidden="true"
                  className="opacity-0 pointer-events-none select-none text-[11px] font-mono"
                >
                  Loading...
                </div>
              );
            }

            if (!connected) {
              return (
                <button
                  onClick={openConnectModal}
                  type="button"
                  className="px-2.5 py-1 text-[11px] font-mono font-medium border border-border rounded bg-surface hover:border-accent text-text transition-colors"
                >
                  Connect Wallet
                </button>
              );
            }

            return (
              <button
                onClick={openAccountModal}
                type="button"
                className="px-2.5 py-1 text-[11px] font-mono border border-border rounded bg-surface hover:border-muted text-text flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-good"></span>
                {account.displayName}
              </button>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </header>
  );
}

