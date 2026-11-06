"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ChevronDown, Wallet } from "lucide-react";
import { NetworkBadge } from "@/components/ui/NetworkBadge";
import { AddressAvatar } from "@/components/ui/AddressAvatar";

/**
 * Wallet-style account bar above every page: the networks DarkTrace uses on the left,
 * the connected account (or Connect Wallet) on the right. Same RainbowKit modals as before.
 */
export function TopBar() {
  return (
    <div className="flex items-center justify-between gap-2 bg-surface border border-border rounded-full shadow-card pl-2 pr-2 py-2">
      <NetworkBadge />

      <ConnectButton.Custom>
        {({ account, chain: activeChain, openConnectModal, openAccountModal, openChainModal, mounted }) => {
          const ready = mounted;
          const connected = ready && account && activeChain;

          if (!ready) {
            return (
              <div aria-hidden="true" className="opacity-0 pointer-events-none select-none text-sm px-4 py-2">
                Loading...
              </div>
            );
          }

          if (!connected) {
            return (
              <button
                onClick={openConnectModal}
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full bg-ink text-on-ink hover:bg-ink/85 transition-colors whitespace-nowrap"
              >
                <Wallet aria-hidden="true" className="w-4 h-4" />
                Connect Wallet
              </button>
            );
          }

          return (
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                onClick={openChainModal}
                type="button"
                title="Switch wallet network"
                className={`hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${
                  activeChain.unsupported
                    ? "border-danger/40 bg-danger/5 text-danger"
                    : "border-border bg-surface-2 text-text hover:bg-surface"
                }`}
              >
                {activeChain.unsupported ? "Wrong network" : activeChain.name}
                <ChevronDown aria-hidden="true" className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={openAccountModal}
                type="button"
                className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border border-border bg-surface hover:bg-surface-2 text-text min-w-0 transition-colors"
              >
                <AddressAvatar address={account.address} size={26} />
                <span className="flex flex-col items-start leading-tight min-w-0">
                  <span className="text-sm font-medium font-mono truncate">{account.displayName}</span>
                  {account.displayBalance && (
                    <span className="hidden sm:inline text-[11px] text-muted tabular-nums">{account.displayBalance}</span>
                  )}
                </span>
                <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-muted shrink-0" />
              </button>
            </div>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
}
