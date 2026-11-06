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
  ArrowUpRight,
  Play,
} from "lucide-react";

interface LiveFeedItem {
  id: string;
  mode: "verified" | "simulated";
  label: string;
  timestamp: string;
  blockNumber: number;
  poolId: string;
  poolName: string;
  searcher: string;
  victim: string;
  beneficiary: string;
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
  txHashes?: string[];
  arcAttestTx?: string;
  arcNotBeneficiaryRevertTx?: string;
  arcClaimTx?: string;
  arkivClaimKey?: string;
}

const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;
const REBATE_VAULT_ADDRESS = "0x238dE56E52A3F6C6708952052e6a20E5102b4d5b" as const;

const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const VERIFIED_RUNS: LiveFeedItem[] = [
  {
    id: "verified-run-2",
    mode: "verified",
    label: "Verified Run #2 (Separate EOA · Arc v2)",
    timestamp: "Block #55,152,258",
    blockNumber: 55152258,
    poolId: "0x2183dce5625ecbb1cf175be52a75b31eeed7bf7774181e3136ba49f6fc3c676c",
    poolName: "tUSDC / tWETH (Hook v1)",
    searcher: "0xc31545299093C46d87752cD6378A811BFDD9940D",
    victim: "0x524e061C89036b12a4f377bD8999038Da3A551Db",
    beneficiary: "0x524e061C89036b12a4f377bD8999038Da3A551Db",
    extractedUSDC: "3.54",
    injectedSlippageBps: 35,
    legitSlippageBps: 90,
    lpLvrDelta: "-$3.54",
    status: "REBATED",
    receiptHash: "0xe191f885168d1d06b6c7d27ef00504d58f7661c7da5adc8c3a79aaf8bb72959a",
    arkivEntityKey: "0x2286e8a00e389f51ea21e3d5280f2078b54b4b2456842783962416c1a9dd5d27",
    arkivWriteTxHash: "0xef493d0d271e00410a48bc8f5a64fb6ccf37d7a9a884f4ed81c0445f2ef349f3",
    simulationHash: "0x63c908352fead0fcb49acbed9f9b2b1abaa7af480f0ef57c11908667a70697d7",
    arkivURI: "arkiv://darktrace.v1/receipt/0xe191f885168d1d06b6c7d27ef00504d58f7661c7da5adc8c3a79aaf8bb72959a",
    txHashes: [
      "0xa9a12ef232d1df4a38a56cf10ef5566f71a36798b4b4109eebf89a05658ba48c",
      "0x23984ec70d7fc514697be40d8bb7500941ecbed350181a75b7fcb79e7ea772c4",
      "0x6dd63c93a3945d7f737b64350f480cbafc3a5032b0442b3dbef4c6d72f84f5d9",
    ],
    arcAttestTx: "0xf4e1fa19d88a7151ba7c2d43a525daafecffca1e29d290a7eb4059d521744ca4",
    arcNotBeneficiaryRevertTx: "0xef11bca9a7f4b64983a2404834cdf1c817c1aeda334a73f0958cfa3aeddca8eb",
    arcClaimTx: "0xb72bd280acafa1f1cec3f6738066070e1bc0940408348ed530fb54b39df1fd00",
    arkivClaimKey: "0x45dcfc2de3a9b1e6738ef67dcfa323c202f28683da820c35cf0f27d3b6d89a35",
  },
  {
    id: "verified-hook-v2",
    mode: "verified",
    label: "Hook v2 Detection (Open Claim · 90d TTL)",
    timestamp: "Block #55,162,450",
    blockNumber: 55162450,
    poolId: "0x5d78af67b033875696613c57b5a68f4a62eba0d98095844b0e9c8c691afc63df",
    poolName: "tUSDC / tWETH (Hook v2)",
    searcher: "0xc31545299093C46d87752cD6378A811BFDD9940D",
    victim: "0x942823FD44c68d77Ad631f0aa4DEA35143E52488",
    beneficiary: "0xb491fe5846DE735B6Cb03a677A3C6296FAB0aDA5",
    extractedUSDC: "3.57",
    injectedSlippageBps: 36,
    legitSlippageBps: 91,
    lpLvrDelta: "-$3.57",
    status: "ARCHIVED",
    receiptHash: "0x2d992c83c11668835db493c4637772c03166a7f89ef82e2e3cec057493ffef1c",
    arkivEntityKey: "0x259dc2884aab483503458ce1ebb716c4e90bf156eadfaaa2e9761d2ec60b0fd2",
    arkivWriteTxHash: "0x03512e4f36a5d7b9e88be1f496d1353f59972f56cf1df54c030de4f1d3548744",
    simulationHash: "0x69f5c002087777e9ba7cc1c7e73d7fc66389c9f31d41522b7d1a8d5fb5a523e7",
    arkivURI: "arkiv://darktrace.v1/receipt/0x2d992c83c11668835db493c4637772c03166a7f89ef82e2e3cec057493ffef1c",
    txHashes: [
      "0xef694630199a91f86c1b8cdae55b0f3192373d7e776d7d3032fd2aa120a051c8",
      "0xef694630199a91f86c1b8cdae55b0f3192373d7e776d7d3032fd2aa120a051c8",
      "0xef694630199a91f86c1b8cdae55b0f3192373d7e776d7d3032fd2aa120a051c8",
    ],
    arcAttestTx: "0x2a29b07019220ccc727e82b26b59595f5be703a5c443367eea3b706dcdc22431",
  },
  {
    id: "verified-run-1",
    mode: "verified",
    label: "Verified Run #1 (Hook v1 · Arc v1)",
    timestamp: "Block #55,113,190",
    blockNumber: 55113190,
    poolId: "0x2183dce5625ecbb1cf175be52a75b31eeed7bf7774181e3136ba49f6fc3c676c",
    poolName: "tUSDC / tWETH (Hook v1)",
    searcher: "0xc31545299093C46d87752cD6378A811BFDD9940D",
    victim: "0x942823FD44c68d77Ad631f0aa4DEA35143E52488",
    beneficiary: "0xb491fe5846DE735B6Cb03a677A3C6296FAB0aDA5",
    extractedUSDC: "3.57",
    injectedSlippageBps: 36,
    legitSlippageBps: 91,
    lpLvrDelta: "-$3.57",
    status: "REBATED",
    receiptHash: "0xdf3305cb8962998d3f887ad00ee3d206948d4b36703f6be39c9e65c9dee4e681",
    arkivEntityKey: "0x837ad00cd5fba8b67ba3976cbbca64de32d4ddac8483bb6b56b6866f67b432a8",
    simulationHash: "0x69f5c002087777e9ba7cc1c7e73d7fc66389c9f31d41522b7d1a8d5fb5a523e7",
    arkivURI: "arkiv://darktrace.v1/receipt/0xdf3305cb8962998d3f887ad00ee3d206948d4b36703f6be39c9e65c9dee4e681",
    txHashes: [
      "0x1adc35cf1d5c726c853dea8de8401cc52d07689e7c52770b5b543c1ea3a410b4",
      "0x1adc35cf1d5c726c853dea8de8401cc52d07689e7c52770b5b543c1ea3a410b4",
      "0x1adc35cf1d5c726c853dea8de8401cc52d07689e7c52770b5b543c1ea3a410b4",
    ],
    arcAttestTx: "0x50ab85caa05a7e52e9b9e5b498faf8c67981c1ba013060a068f7ef43cfd9eec9",
    arcClaimTx: "0x4202622d97af28edd3439a8f3f5ab773524755362357aa22d4c6bfb100a4963f",
    arkivClaimKey: "0x20d3a7149d2912642cc7dedf994454a48dc6c1f480bb81bf007de5c788985fd5",
  },
];

const INITIAL_SIMULATED_FEED: LiveFeedItem[] = [
  {
    id: "sim-feed-1",
    mode: "simulated",
    label: "SDK Smoke-Test Fixture [DEMO]",
    timestamp: "22:50:18.420",
    blockNumber: 12489201,
    poolId: "0x835c24ae58a98118715d7541b2c5f0df8f11ca328b8e9c9c3850441c632e8d21",
    poolName: "WETH / USDC",
    searcher: "0x1111111111111111111111111111111111111111",
    victim: "0x2222222222222222222222222222222222222222",
    beneficiary: "0x3333333333333333333333333333333333333333",
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
];

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<"verified" | "simulated">("verified");
  const [simFeed, setSimFeed] = useState<LiveFeedItem[]>(INITIAL_SIMULATED_FEED);
  const [selectedVerified, setSelectedVerified] = useState<LiveFeedItem>(VERIFIED_RUNS[0]);
  const [selectedSimulated, setSelectedSimulated] = useState<LiveFeedItem>(INITIAL_SIMULATED_FEED[0]);
  const [replayStage, setReplayStage] = useState<number>(4); // 1=DETECTED, 2=SIMULATED, 3=ARCHIVED, 4=REBATED
  const [isReplaying, setIsReplaying] = useState(false);

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
    liveVaultRaw !== undefined ? (Number(liveVaultRaw) / 1e6).toFixed(2) : "1.46";

  const selectedItem = activeTab === "verified" ? selectedVerified : selectedSimulated;

  // Replay verified run step-by-step using real on-chain data
  const handleReplayVerifiedRun = () => {
    setIsReplaying(true);
    setReplayStage(1);
    setTimeout(() => setReplayStage(2), 900);
    setTimeout(() => setReplayStage(3), 1800);
    setTimeout(() => {
      setReplayStage(4);
      setIsReplaying(false);
    }, 2700);
  };

  // Trigger simulated sandwich attack sequence
  const handleTriggerSandwich = () => {
    setActiveTab("simulated");
    setIsSimulating(true);
    setClaimedSuccess(false);

    const newItemId = `feed-${Date.now()}`;
    const newProofHash =
      "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const newSimHash =
      "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.${String(now.getMilliseconds()).padStart(3, "0")}`;

    const targetLoss = 1.25;
    setAnimatedLoss(0);

    let currentTicker = 0;
    const tickerInterval = setInterval(() => {
      currentTicker += 0.14;
      if (currentTicker >= targetLoss) {
        currentTicker = targetLoss;
        clearInterval(tickerInterval);
      }
      setAnimatedLoss(parseFloat(currentTicker.toFixed(2)));
    }, 60);

    const initialItem: LiveFeedItem = {
      id: newItemId,
      mode: "simulated",
      label: "Simulated Browser Run [DEMO]",
      timestamp: timeStr,
      blockNumber: 12489201,
      poolId: "0x835c24ae58a98118715d7541b2c5f0df8f11ca328b8e9c9c3850441c632e8d21",
      poolName: "WETH / USDC",
      searcher: "0x1111111111111111111111111111111111111111",
      victim: "0x2222222222222222222222222222222222222222",
      beneficiary: "0x3333333333333333333333333333333333333333",
      extractedUSDC: targetLoss.toFixed(2),
      injectedSlippageBps: 187,
      legitSlippageBps: 12,
      lpLvrDelta: "-$1.21",
      status: "DETECTED",
      receiptHash: newProofHash,
      simulationHash: newSimHash,
      arkivURI: `arkiv://darktrace.v1/receipt/${newProofHash}`,
    };

    setSimFeed((prev) => [initialItem, ...prev]);
    setSelectedSimulated(initialItem);

    setTimeout(() => {
      setSimFeed((prev) =>
        prev.map((item) => (item.id === newItemId ? { ...item, status: "SIMULATED" } : item))
      );
      setSelectedSimulated((curr) => (curr.id === newItemId ? { ...curr, status: "SIMULATED" } : curr));
    }, 1100);

    setTimeout(() => {
      setSimFeed((prev) =>
        prev.map((item) => (item.id === newItemId ? { ...item, status: "ARCHIVED" } : item))
      );
      setSelectedSimulated((curr) => (curr.id === newItemId ? { ...curr, status: "ARCHIVED" } : curr));
      setIsSimulating(false);
      setAnimatedLoss(null);
    }, 2100);
  };

  const handleClaimRebate = () => {
    setIsClaiming(true);
    const claimAmount = parseFloat(selectedSimulated.extractedUSDC);

    setTimeout(() => {
      setIsClaiming(false);
      setClaimedSuccess(true);
      setLpBalance((prev) => parseFloat((prev + claimAmount).toFixed(2)));

      setSimFeed((prev) =>
        prev.map((item) => (item.id === selectedSimulated.id ? { ...item, status: "REBATED" } : item))
      );
      setSelectedSimulated((curr) => ({
        ...curr,
        status: "REBATED",
      }));
    }, 1200);
  };

  const totalSlippage = selectedItem.injectedSlippageBps + selectedItem.legitSlippageBps;
  const displayedStatus =
    activeTab === "verified" && isReplaying
      ? replayStage === 1
        ? "DETECTED"
        : replayStage === 2
        ? "SIMULATED"
        : replayStage === 3
        ? "ARCHIVED"
        : selectedItem.status
      : selectedItem.status;

  const listItems = activeTab === "verified" ? VERIFIED_RUNS : simFeed;

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col gap-3 lg:gap-4">
      {/* Mode Switcher Banner */}
      <div className="border border-border bg-surface shadow-card p-3 sm:p-4 rounded-card flex flex-col gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-3xl sm:rounded-full bg-surface-2 border border-border self-start">
          <button
            type="button"
            onClick={() => setActiveTab("verified")}
            aria-pressed={activeTab === "verified"}
            className={`px-4 py-2 rounded-full font-medium text-left transition-colors ${
              activeTab === "verified"
                ? "bg-ink text-on-ink"
                : "text-muted hover:text-text hover:bg-surface"
            }`}
          >
            1. Replay Verified On-Chain Runs (Real Data)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("simulated")}
            aria-pressed={activeTab === "simulated"}
            className={`px-4 py-2 rounded-full font-medium text-left transition-colors ${
              activeTab === "simulated"
                ? "bg-ink text-on-ink"
                : "text-muted hover:text-text hover:bg-surface"
            }`}
          >
            2. Browser Simulation Sandbox [DEMO]
          </button>
        </div>
        <div className="text-xs text-muted">
          {activeTab === "verified" ? (
            <span className="text-good">
              Every tx hash, Arkiv $key, and Arc settlement below is live on Base Sepolia, Arkiv Rabdi, and Arc Testnet.
            </span>
          ) : (
            <span className="text-accent">
              [SIMULATED IN BROWSER] Replays the 4-stage pipeline locally without broadcasting a live transaction.
            </span>
          )}
        </div>
      </div>

      {/* Top Protocol Status Bar */}
      <div className="border border-border bg-surface shadow-card px-4 py-3 sm:px-5 rounded-card flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-good font-semibold">
            <span aria-hidden="true" className="w-2 h-2 rounded-full bg-good animate-pulse"></span>
            RADAR ACTIVE
          </div>
          <span aria-hidden="true" className="hidden sm:inline text-border">|</span>
          <span className="text-muted">
            TARGET: <span className="text-text font-bold">Base Sepolia (Hook v1 & v2)</span>
          </span>
          <span aria-hidden="true" className="hidden sm:inline text-border">|</span>
          <span className="text-muted">
            SETTLEMENT: <span className="text-text font-bold">Arc Testnet (RebateVault v2)</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-full bg-surface-2">
            <span className="text-muted">VAULT RESERVE (ARC V2):</span>
            <span className="text-text font-bold tabular-nums">${liveVaultUSDC} USDC</span>
          </div>

          {activeTab === "verified" ? (
            <button
              onClick={handleReplayVerifiedRun}
              disabled={isReplaying}
              type="button"
              className="px-4 py-2 bg-ink hover:bg-ink/85 disabled:opacity-50 text-on-ink font-medium rounded-full flex items-center gap-1.5 transition-colors"
            >
              {isReplaying ? (
                <>
                  <RefreshCw aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />
                  <span>Replaying Stage {replayStage}/4…</span>
                </>
              ) : (
                <>
                  <Play aria-hidden="true" className="w-3.5 h-3.5" />
                  <span>Replay Verified Run</span>
                </>
              )}
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-full bg-surface-2">
                <span className="text-muted">LP USDC BALANCE (ARC):</span>
                <DemoData>
                  <span className="text-good font-bold tabular-nums">${lpBalance.toFixed(2)} USDC</span>
                </DemoData>
              </div>
              <button
                onClick={handleTriggerSandwich}
                disabled={isSimulating}
                type="button"
                className="px-4 py-2 border border-text text-text hover:bg-surface-2 disabled:opacity-50 font-medium rounded-full flex items-center gap-1.5 transition-colors"
              >
                {isSimulating ? (
                  <>
                    <RefreshCw aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />
                    <span>Simulating Attack...</span>
                  </>
                ) : (
                  <>
                    <Zap aria-hidden="true" className="w-3.5 h-3.5" />
                    <span>Trigger Simulated Sandwich [DEMO]</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Two-Column Bloomberg Terminal Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 flex-1 min-h-[620px]">
        {/* LEFT COLUMN: Event Feed (7 Cols) */}
        <div className="lg:col-span-7 ink rounded-card shadow-float flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 text-sm select-none">
            <div className="flex items-center gap-2 font-semibold text-text">
              <Layers aria-hidden="true" className="w-3.5 h-3.5 text-accent" />
              <span>
                {activeTab === "verified"
                  ? "Verified On-Chain Runs (Base Sepolia → Arkiv → Arc)"
                  : "Simulated Surveillance Stream [DEMO]"}
              </span>
            </div>
            <span className="text-xs text-muted tabular-nums">{listItems.length} RUNS</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border font-mono text-xs">
            {listItems.map((item) => {
              const isSelected = selectedItem.id === item.id;
              // Same selection as before; extracted so mouse and keyboard trigger identical behavior.
              const select = () => {
                if (activeTab === "verified") {
                  setSelectedVerified(item);
                  setReplayStage(4);
                } else {
                  setSelectedSimulated(item);
                  setClaimedSuccess(item.status === "REBATED");
                }
              };
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={select}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      select();
                    }
                  }}
                  className={`px-5 py-4 transition-colors cursor-pointer select-none space-y-2 focus-visible:outline-offset-[-2px] ${
                    isSelected ? "bg-surface-2 ring-1 ring-inset ring-accent/60" : "hover:bg-surface-2"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-text font-bold">{item.label}</span>
                      <span className="text-muted text-xs tabular-nums">({item.timestamp})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.mode === "simulated" ? (
                        <DemoData>
                          <span className="text-danger font-bold tabular-nums">${item.extractedUSDC}</span>
                        </DemoData>
                      ) : (
                        <span className="text-danger font-bold tabular-nums">${item.extractedUSDC} USDC</span>
                      )}
                      <StatusPill status={isSelected ? displayedStatus : item.status} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                    <span>
                      Pool: <span className="text-text">{item.poolName}</span> · Beneficiary:{" "}
                      <span className="text-text">
                        {item.beneficiary.slice(0, 8)}…{item.beneficiary.slice(-4)}
                      </span>
                    </span>
                    <span className="tabular-nums">
                      +{item.injectedSlippageBps} bps injected / {item.legitSlippageBps} bps legit
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Step-by-step On-Chain Evidence Breakdown when in Verified Mode */}
            {activeTab === "verified" && selectedVerified.txHashes && (
              <div className="px-5 py-4 bg-surface space-y-3">
                <div className="text-xs font-semibold text-accent uppercase tracking-wider">
                  On-Chain Transaction Sequence ({selectedVerified.label})
                </div>

                <div className="space-y-2 text-xs">
                  {selectedVerified.txHashes.map((tx, idx) => (
                    <div
                      key={`${tx}-${idx}`}
                      className="px-3 py-2.5 rounded-xl bg-surface-2 flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className={idx === 1 ? "text-accent font-semibold" : "text-muted"}>
                        {idx === 0
                          ? "Tx 1 · Frontrun Swap (Searcher)"
                          : idx === 1
                          ? `Tx 2 · Victim Swap (${selectedVerified.victim.slice(0, 8)}…)`
                          : "Tx 3 · Backrun Swap + ExtractionDetected Event"}
                      </span>
                      <a
                        href={`https://base-sepolia.blockscout.com/tx/${tx}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-text hover:text-accent inline-flex items-center gap-1"
                      >
                        {tx.slice(0, 12)}…{tx.slice(-6)}
                        <ExternalLink aria-hidden="true" className="w-3 h-3" />
                      </a>
                    </div>
                  ))}

                  {selectedVerified.arcAttestTx && (
                    <div className="px-3 py-2.5 rounded-xl bg-surface-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted">
                        Arc SimulationRegistry.recordSimulation (beneficiary = {selectedVerified.beneficiary.slice(0, 8)}…)
                      </span>
                      <a
                        href={`https://explorer.testnet.arc.io/tx/${selectedVerified.arcAttestTx}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-text hover:text-accent inline-flex items-center gap-1"
                      >
                        {selectedVerified.arcAttestTx.slice(0, 12)}…{selectedVerified.arcAttestTx.slice(-6)}
                        <ExternalLink aria-hidden="true" className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {selectedVerified.arcNotBeneficiaryRevertTx && (
                    <div className="px-3 py-2.5 rounded-xl border border-danger/30 bg-danger/5 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-danger font-semibold">
                        Arc RebateVault v2 NotBeneficiary Revert Proof (Operator Rejected)
                      </span>
                      <a
                        href={`https://explorer.testnet.arc.io/tx/${selectedVerified.arcNotBeneficiaryRevertTx}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-danger hover:underline inline-flex items-center gap-1"
                      >
                        {selectedVerified.arcNotBeneficiaryRevertTx.slice(0, 12)}…
                        {selectedVerified.arcNotBeneficiaryRevertTx.slice(-6)}
                        <ExternalLink aria-hidden="true" className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Receipt Inspector (5 Cols) */}
        <div className="lg:col-span-5 border border-border rounded-card bg-surface shadow-card flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 text-sm select-none">
            <div className="flex items-center gap-2 font-semibold text-text">
              <ShieldCheck aria-hidden="true" className="w-3.5 h-3.5 text-good" />
              <span>Cryptographic Receipt Detail</span>
            </div>
            <StatusPill status={displayedStatus} />
          </div>

          <div className="p-5 flex-1 overflow-y-auto space-y-4 font-mono text-xs">
            {/* Extracted Value Banner */}
            <div className="p-4 rounded-2xl bg-surface-2 space-y-1">
              <div className="text-xs text-muted uppercase flex items-center justify-between">
                <span>Detected Extracted Loss</span>
                {selectedItem.mode === "simulated" ? (
                  <DemoData />
                ) : (
                  <span className="text-good text-xs font-semibold">VERIFIED ON-CHAIN</span>
                )}
              </div>
              <div className="text-3xl font-bold text-danger tabular-nums">
                ${animatedLoss !== null ? animatedLoss.toFixed(2) : selectedItem.extractedUSDC} USDC
              </div>
              <div className="text-xs text-muted">
                LP LVR Impact: <span className="text-danger font-semibold">{selectedItem.lpLvrDelta}</span>
              </div>
            </div>

            {/* Counterfactual Slippage Breakdown */}
            <div className="p-4 rounded-2xl bg-surface-2 space-y-2.5">
              <div className="text-xs font-semibold text-text uppercase tracking-wider">
                Counterfactual Decomposition
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-surface">
                  <div className="text-muted text-xs">INJECTED MEV</div>
                  <div className="text-accent font-bold mt-0.5 tabular-nums">
                    +{selectedItem.injectedSlippageBps} bps
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-surface">
                  <div className="text-muted text-xs">NATURAL SLIPPAGE</div>
                  <div className="text-good font-bold mt-0.5 tabular-nums">
                    {selectedItem.legitSlippageBps} bps
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted leading-relaxed">
                <span className="text-accent font-bold">{selectedItem.injectedSlippageBps} bps</span> of the{" "}
                {totalSlippage} bps realized slippage was frontrun price distortion.
              </div>
            </div>

            {/* Cryptographic Identifiers */}
            <div className="space-y-2.5 pt-1 border-t border-border">
              <div>
                <div className="text-xs text-muted uppercase">Canonical Receipt Hash</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <HashDisplay hash={selectedItem.receiptHash} truncate={true} prefixLength={10} suffixLength={8} />
                  <Link
                    href={`/receipt/${selectedItem.receiptHash}`}
                    className="text-accent hover:underline inline-flex items-center gap-1 text-xs"
                  >
                    <span>Open Live Receipt Page</span>
                    <ExternalLink aria-hidden="true" className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              <div>
                <div className="text-xs text-muted uppercase">Arkiv Rabdi Entity Key ($key)</div>
                {selectedItem.arkivEntityKey ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <HashDisplay
                      hash={selectedItem.arkivEntityKey}
                      truncate={true}
                      prefixLength={10}
                      suffixLength={8}
                    />
                    <a
                      href={`https://rabdi.explorer.arkiv.network/entity/${selectedItem.arkivEntityKey}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:underline flex items-center gap-1 text-xs"
                    >
                      <ExternalLink aria-hidden="true" className="w-3 h-3" />
                      <span>Explorer</span>
                    </a>
                  </div>
                ) : (
                  <span className="text-muted text-xs">Unpublished in browser sandbox</span>
                )}
              </div>

              <div>
                <div className="text-xs text-muted uppercase">Attested Beneficiary (Wallet)</div>
                <HashDisplay hash={selectedItem.beneficiary} truncate={true} prefixLength={10} suffixLength={8} />
              </div>

              {selectedItem.arcClaimTx && (
                <div>
                  <div className="text-xs text-muted uppercase">Arc USDC Claim Transaction</div>
                  <div className="flex items-center gap-1.5 text-good mt-0.5">
                    <a
                      href={`https://explorer.testnet.arc.io/tx/${selectedItem.arcClaimTx}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline inline-flex items-center gap-1"
                    >
                      <HashDisplay hash={selectedItem.arcClaimTx} truncate={true} />
                      <ArrowUpRight aria-hidden="true" className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs text-muted uppercase">Internal App URI Reference</div>
                <div className="text-muted text-xs flex items-center gap-1 mt-0.5">
                  <Database aria-hidden="true" className="w-3 h-3" />
                  <span className="truncate">{selectedItem.arkivURI}</span>
                </div>
              </div>
            </div>

            {/* Restitution Claim Action */}
            <div className="pt-2 border-t border-border">
              {activeTab === "verified" ? (
                selectedItem.status === "REBATED" ? (
                  <div className="p-3.5 border border-good/30 bg-good/10 rounded-2xl space-y-2 text-good">
                    <div className="font-bold flex items-center gap-2">
                      <Check aria-hidden="true" className="w-4 h-4" />
                      <span>Verified On-Chain Rebate Claimed (${selectedItem.extractedUSDC} USDC)</span>
                    </div>
                    <div className="text-xs text-muted">
                      Paid by Arc RebateVault to beneficiary{" "}
                      <span className="text-text">{selectedItem.beneficiary.slice(0, 10)}…</span> and sealed on Arkiv (
                      <a
                        href={`https://rabdi.explorer.arkiv.network/entity/${selectedItem.arkivClaimKey}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-arkiv hover:underline"
                      >
                        LPClaim $key {selectedItem.arkivClaimKey?.slice(0, 8)}…
                      </a>
                      ).
                    </div>
                  </div>
                ) : (
                  <Link
                    href={`/receipt/${selectedItem.receiptHash}`}
                    className="w-full py-3 bg-ink hover:bg-ink/85 text-on-ink font-sans text-sm font-medium rounded-full flex items-center justify-center gap-2 transition-colors"
                  >
                    <ShieldCheck aria-hidden="true" className="w-4 h-4" />
                    <span>Open Live Receipt & Claim ${selectedItem.extractedUSDC} USDC on Arc v2</span>
                  </Link>
                )
              ) : selectedItem.status === "REBATED" || claimedSuccess ? (
                <div className="p-3.5 border border-good/30 bg-good/10 rounded-2xl flex items-center gap-2.5 text-good">
                  <Check aria-hidden="true" className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      <span>Simulated Rebate Claim Settled</span>
                      <DemoData />
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      Simulated payout: ${selectedItem.extractedUSDC} USDC credited to LP demo balance. (No live claim
                      transaction broadcast).
                    </div>
                  </div>
                </div>
              ) : selectedItem.status === "ARCHIVED" ? (
                <button
                  onClick={handleClaimRebate}
                  disabled={isClaiming}
                  type="button"
                  className="w-full py-3 bg-ink hover:bg-ink/85 disabled:opacity-50 text-on-ink font-sans text-sm font-medium rounded-full flex items-center justify-center gap-2 transition-colors"
                >
                  {isClaiming ? (
                    <>
                      <RefreshCw aria-hidden="true" className="w-4 h-4 animate-spin" />
                      <span>Simulating Rebate Payout on Arc...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck aria-hidden="true" className="w-4 h-4" />
                      <span>Simulate ${selectedItem.extractedUSDC} USDC Rebate Claim [DEMO]</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="p-3 rounded-2xl bg-surface-2 text-center text-muted text-xs flex items-center justify-center gap-2">
                  <RefreshCw aria-hidden="true" className="w-3 h-3 animate-spin text-accent" />
                  <span>Pipeline in progress: {selectedItem.status}...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
