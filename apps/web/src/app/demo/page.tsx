"use client";

import { useState } from "react";
import Link from "next/link";
import { useReadContract } from "wagmi";
import { HashDisplay } from "@/components/ui/HashDisplay";
import { StatusPill } from "@/components/ui/StatusPill";
import { DemoData } from "@/components/ui/DemoData";
import { arcTestnet } from "@/config/chains";
import { 
  ShieldCheck, 
  Database, 
  Zap, 
  RefreshCw, 
  Check, 
  ExternalLink, 
  Layers,
  ArrowUpRight
} from "lucide-react";

interface LiveFeedItem {
  id: string;
  timestamp: string;
  poolId: string;
  poolName: string;
  searcher: string;
  victim: string;
  extractedUSDC: string;
  injectedSlippageBps: number;
  legitSlippageBps: number;
  lpLvrDelta: string;
  status: "DETECTED" | "SIMULATED" | "ARCHIVED" | "REBATED";
  receiptHash: string;
  arkivEntityKey?: string;
  arkivWriteTxHash?: string;
  simulationHash: string;
  arkivURI: string;
  arcClaimTx?: string;
}

const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;
const REBATE_VAULT_ADDRESS = "0x2ab745F51002Ce236A9A2dA81cDaA553B87f28CD" as const;

const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const INITIAL_FEED: LiveFeedItem[] = [
  {
    id: "feed-1",
    timestamp: "22:50:18.420",
    poolId: "0x835c24ae58a98118715d7541b2c5f0df8f11ca328b8e9c9c3850441c632e8d21",
    poolName: "WETH / USDC",
    searcher: "0x1111111111111111111111111111111111111111",
    victim: "0x2222222222222222222222222222222222222222",
    extractedUSDC: "1.25",
    injectedSlippageBps: 187,
    legitSlippageBps: 12,
    lpLvrDelta: "-$1.21",
    status: "ARCHIVED",
    receiptHash: "0xe9e56b6adbf0cae90f08b28a0ae3dccd9fc4ece42eb7b0126e4f208646eae6ce",
    arkivEntityKey: "0xc327d5db4aa3098b80dc8729d090317408f98d19e1e19c13d6cf83494a05f8ca",
    arkivWriteTxHash: "0x544ee730bb736cdbafcd837bad62f857c8ed0e0eaedf7afce807ffb060c6e0f6",
    simulationHash: "0xc9ddedeba69e600924875d3ce6c3e2cd554170c510cec4bfd5016182dc156309",
    arkivURI: "arkiv://darktrace.v1/receipt/0xe9e56b6adbf0cae90f08b28a0ae3dccd9fc4ece42eb7b0126e4f208646eae6ce",
  },
  {
    id: "feed-2",
    timestamp: "22:45:04.821",
    poolId: "0x835c24ae58a98118715d7541b2c5f0df8f11ca328b8e9c9c3850441c632e8d21",
    poolName: "WETH / USDC",
    searcher: "0x1111111111111111111111111111111111111111",
    victim: "0x7777777777777777777777777777777777777777",
    extractedUSDC: "0.85",
    injectedSlippageBps: 240,
    legitSlippageBps: 18,
    lpLvrDelta: "-$0.82",
    status: "ARCHIVED",
    receiptHash: "0x4a5b6c7d8e9f01234567890abcdef1234567890abcd9c8d1f2b3e4a506172839",
    simulationHash: "0xa1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
    arkivURI: "arkiv://darktrace.v1/receipt/0x4a5b6c7d8e9f01234567890abcdef1234567890abcd9c8d1f2b3e4a506172839",
  },
];

export default function DemoPage() {
  const [feed, setFeed] = useState<LiveFeedItem[]>(INITIAL_FEED);
  const [selectedItem, setSelectedItem] = useState<LiveFeedItem>(INITIAL_FEED[0]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimedSuccess, setClaimedSuccess] = useState(false);
  const [lpBalance, setLpBalance] = useState(15.0);
  const [animatedLoss, setAnimatedLoss] = useState<number | null>(null);

  const { data: liveVaultRaw } = useReadContract({
    address: ARC_USDC_ADDRESS,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [REBATE_VAULT_ADDRESS],
    chainId: arcTestnet.id,
  });

  const liveVaultUSDC =
    liveVaultRaw !== undefined ? (Number(liveVaultRaw) / 1e6).toFixed(2) : "5.00";

  // Trigger simulated sandwich attack sequence
  const handleTriggerSandwich = () => {
    setIsSimulating(true);
    setClaimedSuccess(false);

    const newItemId = `feed-${Date.now()}`;
    const newProofHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const newSimHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.${String(now.getMilliseconds()).padStart(3, "0")}`;

    // Target value calibrated to 5.00 USDC Arc RebateVault
    const targetLoss = 1.25;
    setAnimatedLoss(0);

    // Number ticker animation
    let currentTicker = 0;
    const tickerInterval = setInterval(() => {
      currentTicker += 0.14;
      if (currentTicker >= targetLoss) {
        currentTicker = targetLoss;
        clearInterval(tickerInterval);
      }
      setAnimatedLoss(parseFloat(currentTicker.toFixed(2)));
    }, 60);

    // Step 1: DETECTED (Immediate)
    const initialItem: LiveFeedItem = {
      id: newItemId,
      timestamp: timeStr,
      poolId: "0x835c24ae58a98118715d7541b2c5f0df8f11ca328b8e9c9c3850441c632e8d21",
      poolName: "WETH / USDC",
      searcher: "0x1111111111111111111111111111111111111111",
      victim: "0x2222222222222222222222222222222222222222",
      extractedUSDC: targetLoss.toFixed(2),
      injectedSlippageBps: 187,
      legitSlippageBps: 12,
      lpLvrDelta: "-$1.21",
      status: "DETECTED",
      receiptHash: newProofHash,
      simulationHash: newSimHash,
      arkivURI: `arkiv://darktrace.v1/receipt/${newProofHash}`,
    };

    setFeed((prev) => [initialItem, ...prev]);
    setSelectedItem(initialItem);

    // Step 2: SIMULATED (t = 1.0s)
    setTimeout(() => {
      setFeed((prev) =>
        prev.map((item) => (item.id === newItemId ? { ...item, status: "SIMULATED" } : item))
      );
      setSelectedItem((curr) => (curr.id === newItemId ? { ...curr, status: "SIMULATED" } : curr));
    }, 1100);

    // Step 3: ARCHIVED (t = 2.0s)
    setTimeout(() => {
      setFeed((prev) =>
        prev.map((item) => (item.id === newItemId ? { ...item, status: "ARCHIVED" } : item))
      );
      setSelectedItem((curr) => (curr.id === newItemId ? { ...curr, status: "ARCHIVED" } : curr));
      setIsSimulating(false);
      setAnimatedLoss(null);
    }, 2100);
  };

  // Claim Rebate on Arc
  const handleClaimRebate = () => {
    setIsClaiming(true);
    const claimAmount = parseFloat(selectedItem.extractedUSDC);

    setTimeout(() => {
      setIsClaiming(false);
      setClaimedSuccess(true);

      // Balance ticks up on Arc!
      setLpBalance((prev) => parseFloat((prev + claimAmount).toFixed(2)));

      setFeed((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id
            ? { ...item, status: "REBATED" }
            : item
        )
      );
      setSelectedItem((curr) => ({
        ...curr,
        status: "REBATED",
      }));
    }, 1200);
  };

  // injected = extra slippage caused by the frontrun; legit = slippage the victim would have had anyway.
  const totalSlippage = selectedItem.injectedSlippageBps + selectedItem.legitSlippageBps;

  return (
    <div className="flex-1 p-4 max-w-7xl mx-auto w-full flex flex-col space-y-3">
      {/* Top Protocol Status Bar */}
      <div className="border border-border bg-surface px-4 py-2.5 rounded flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-good font-semibold">
            <span className="w-2 h-2 rounded-full bg-good animate-pulse"></span>
            RADAR ACTIVE
          </div>
          <span className="text-border">|</span>
          <span className="text-muted">
            TARGET: <span className="text-text font-bold">Base Sepolia (Hook)</span>
          </span>
          <span className="text-border">|</span>
          <span className="text-muted">
            SETTLEMENT: <span className="text-text font-bold">Arc Testnet (RebateVault)</span>
          </span>
        </div>

        {/* User Restitution Vault Balance Counter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 border border-border rounded bg-bg">
            <span className="text-muted">VAULT RESERVE (ARC):</span>
            <span className="text-text font-bold tabular-nums">
              ${liveVaultUSDC} USDC
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 border border-border rounded bg-bg">
            <span className="text-muted">LP USDC BALANCE (ARC):</span>
            <DemoData>
              <span className="text-good font-bold tabular-nums">
                ${lpBalance.toFixed(2)} USDC
              </span>
            </DemoData>
          </div>

          <button
            onClick={handleTriggerSandwich}
            disabled={isSimulating}
            type="button"
            className="px-3.5 py-1.5 bg-accent hover:opacity-90 disabled:opacity-50 text-bg font-bold rounded flex items-center gap-1.5 transition-opacity"
          >
            {isSimulating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Simulating Attack...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>Trigger Sandwich</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Two-Column Bloomberg Terminal Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-[620px]">
        {/* LEFT COLUMN: Live Event Feed (7 Cols) */}
        <div className="lg:col-span-7 border border-border rounded bg-surface flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-[#15181E] flex items-center justify-between text-xs font-mono select-none">
            <div className="flex items-center gap-2 font-semibold text-text uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-accent" />
              <span>Real-Time Surveillance Stream</span>
            </div>
            <span className="text-[11px] text-muted tabular-nums">
              {feed.length} OBSERVATIONS
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border font-mono text-xs">
            {feed.map((item) => {
              const isSelected = selectedItem.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedItem(item);
                    setClaimedSuccess(item.status === "REBATED");
                  }}
                  className={`p-3.5 transition-colors cursor-pointer select-none flex items-center justify-between gap-3 ${
                    isSelected ? "bg-[#181C22] border-l-2 border-accent" : "hover:bg-[#14161B]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted text-[11px] tabular-nums">{item.timestamp}</span>
                    <span className="text-text font-bold">{item.poolName}</span>
                    <span className="text-muted text-[11px]">
                      Victim: {item.victim.slice(0, 6)}…
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <DemoData>
                      <span className="text-danger font-bold tabular-nums">
                        ${item.extractedUSDC}
                      </span>
                    </DemoData>
                    <StatusPill status={item.status} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Receipt Inspector (5 Cols) */}
        <div className="lg:col-span-5 border border-border rounded bg-surface flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-[#15181E] flex items-center justify-between text-xs font-mono select-none">
            <div className="flex items-center gap-2 font-semibold text-text uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-good" />
              <span>Cryptographic Receipt Detail</span>
            </div>
            <StatusPill status={selectedItem.status} />
          </div>

          <div className="p-4 flex-1 overflow-y-auto space-y-4 font-mono text-xs">
            {/* Extracted Value Banner with Counter Animation */}
            <div className="p-3.5 border border-border rounded bg-bg space-y-1">
              <div className="text-[11px] text-muted uppercase flex items-center justify-between">
                <span>Detected Extracted Loss</span>
                <DemoData />
              </div>
              <div className="text-3xl font-bold text-danger tabular-nums">
                ${animatedLoss !== null ? animatedLoss.toFixed(2) : selectedItem.extractedUSDC}
              </div>
              <div className="text-[11px] text-muted">
                LP LVR Impact: <span className="text-danger font-semibold">{selectedItem.lpLvrDelta}</span>
              </div>
            </div>

            {/* Counterfactual Slippage Breakdown */}
            <div className="p-3.5 border border-border rounded bg-bg space-y-2.5">
              <div className="text-xs font-semibold text-text uppercase tracking-wider">
                Counterfactual Decomposition
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 border border-border rounded bg-surface">
                  <div className="text-muted text-[10px]">INJECTED MEV</div>
                  <div className="text-accent font-bold mt-0.5 tabular-nums">
                    +{selectedItem.injectedSlippageBps} bps
                  </div>
                </div>
                <div className="p-2 border border-border rounded bg-surface">
                  <div className="text-muted text-[10px]">NATURAL SLIPPAGE</div>
                  <div className="text-good font-bold mt-0.5 tabular-nums">
                    {selectedItem.legitSlippageBps} bps
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-muted leading-relaxed">
                <span className="text-accent font-bold">{selectedItem.injectedSlippageBps} bps</span> of the {totalSlippage} bps realized slippage was toxic frontrun injection, not legitimate market price discovery.
              </div>
            </div>

            {/* Cryptographic Identifiers */}
            <div className="space-y-2.5 pt-1 border-t border-border">
              <div>
                <div className="text-[10px] text-muted uppercase">Canonical Receipt Hash</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <HashDisplay hash={selectedItem.receiptHash} truncate={true} prefixLength={10} suffixLength={8} />
                  <Link
                    href={`/receipt/${selectedItem.receiptHash}`}
                    className="text-muted hover:text-text"
                    title="View Receipt Dossier"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-muted uppercase">Arkiv Rabdi Entity Key</div>
                {selectedItem.arkivEntityKey ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <HashDisplay hash={selectedItem.arkivEntityKey} truncate={true} prefixLength={10} suffixLength={8} />
                    <a
                      href={`https://rabdi.explorer.arkiv.network/entity/${selectedItem.arkivEntityKey}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Explorer</span>
                    </a>
                  </div>
                ) : (
                  <span className="text-muted text-[11px]">Unpublished in test session</span>
                )}
              </div>

              <div>
                <div className="text-[10px] text-muted uppercase">Simulation Hash (Arc Attestation)</div>
                <HashDisplay hash={selectedItem.simulationHash} truncate={true} prefixLength={10} suffixLength={8} />
              </div>

              <div>
                <div className="text-[10px] text-muted uppercase">Internal App URI Reference</div>
                <div className="text-muted text-[11px] flex items-center gap-1 mt-0.5">
                  <Database className="w-3 h-3" />
                  <span className="truncate">{selectedItem.arkivURI}</span>
                </div>
              </div>

              {selectedItem.arcClaimTx && (
                <div>
                  <div className="text-[10px] text-muted uppercase">Arc Settlement Tx</div>
                  <div className="flex items-center gap-1.5 text-good">
                    <HashDisplay hash={selectedItem.arcClaimTx} truncate={true} />
                    <ArrowUpRight className="w-3 h-3" />
                  </div>
                </div>
              )}
            </div>

            {/* Restitution Claim Action */}
            <div className="pt-2 border-t border-border">
              {selectedItem.status === "REBATED" || claimedSuccess ? (
                <div className="p-3.5 border border-good/40 bg-good/10 rounded flex items-center gap-2.5 text-good">
                  <Check className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      <span>Simulated Rebate Claim Settled</span>
                      <DemoData />
                    </div>
                    <div className="text-[10px] text-muted mt-0.5">
                      Simulated payout: ${selectedItem.extractedUSDC} USDC credited to LP demo balance. (No live claim transaction broadcast).
                    </div>
                  </div>
                </div>
              ) : selectedItem.status === "ARCHIVED" ? (
                <button
                  onClick={handleClaimRebate}
                  disabled={isClaiming}
                  type="button"
                  className="w-full py-2.5 bg-good hover:opacity-90 disabled:opacity-50 text-bg font-bold rounded flex items-center justify-center gap-2 transition-opacity"
                >
                  {isClaiming ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Simulating Rebate Payout on Arc...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Simulate ${selectedItem.extractedUSDC} USDC Rebate Claim</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="p-3 border border-border rounded bg-bg text-center text-muted text-[11px] flex items-center justify-center gap-2">
                  <RefreshCw className="w-3 h-3 animate-spin text-accent" />
                  <span>Pipeline in progress: {selectedItem.status}...</span>
                </div>
              )}
            </div>

            {/* Slashed Bond Reprimand Box */}
            {selectedItem.status === "REBATED" && (
              <div className="p-2.5 border border-border rounded bg-surface text-[11px] text-muted space-y-1">
                <div>
                  <span className="text-accent font-semibold">Flow 1 · Base Sepolia: </span>
                  Searcher <span className="font-mono text-text">0x1111…1111</span>{" "}
                  <span className="text-danger font-semibold">bond reduced (Base Sepolia, forensic only)</span> by{" "}
                  <span className="text-danger font-semibold">${selectedItem.extractedUSDC}</span>.
                </div>
                <div className="text-[10px] text-muted">
                  Independent of Flow 2 (Arc Testnet pre-funded RebateVault payout; no cross-chain bridge).
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
