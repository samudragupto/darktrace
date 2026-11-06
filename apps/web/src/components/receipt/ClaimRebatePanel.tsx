"use client";

import { useState } from "react";
import { useAccount, useChainId, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { type Hex } from "viem";
import { arcTestnet } from "@/config/chains";
import { HashDisplay } from "@/components/ui/HashDisplay";
import { AlertTriangle, Check, ExternalLink, RefreshCw, ShieldCheck, Wallet } from "lucide-react";

const REGISTRY_V2 = (process.env.NEXT_PUBLIC_SIMULATION_REGISTRY ||
  "0xd501D47b246438A18C8a0BFFCF10338CfBB661a2") as Hex;
const VAULT_V2 = (process.env.NEXT_PUBLIC_REBATE_VAULT ||
  "0x238dE56E52A3F6C6708952052e6a20E5102b4d5b") as Hex;

const REGISTRY_ABI = [
  {
    type: "function",
    name: "getAttestation",
    stateMutability: "view",
    inputs: [{ name: "receiptHash", type: "bytes32" }],
    outputs: [
      { name: "verified", type: "bool" },
      { name: "extractedValueUSDC", type: "uint256" },
      { name: "attestedAt", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "beneficiaryOf",
    stateMutability: "view",
    inputs: [{ name: "receiptHash", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const VAULT_ABI = [
  {
    type: "function",
    name: "claimedReceipts",
    stateMutability: "view",
    inputs: [{ name: "receiptHash", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "claimRebate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "receiptHash", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "amountUSDC", type: "uint256" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

interface ClaimRebatePanelProps {
  receiptHash: string;
  extractedUSDC: string;
  fallbackBeneficiary: string;
  status: "ARCHIVED" | "REBATED";
  initialClaimTx?: string;
  isSynthetic?: boolean;
}

export function ClaimRebatePanel({
  receiptHash,
  extractedUSDC,
  fallbackBeneficiary,
  status,
  initialClaimTx,
  isSynthetic,
}: ClaimRebatePanelProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const { writeContractAsync } = useWriteContract();

  const [txHash, setTxHash] = useState<string | undefined>(initialClaimTx);
  const [arkivEntityKey, setArkivEntityKey] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [claimedLocal, setClaimedLocal] = useState(status === "REBATED");

  const validBytes32 = /^0x[0-9a-fA-F]{64}$/.test(receiptHash);
  const hashHex = (validBytes32 ? receiptHash : "0x" + "0".repeat(64)) as Hex;

  const { data: attestation, isError: attestationError } = useReadContract({
    address: REGISTRY_V2,
    abi: REGISTRY_ABI,
    functionName: "getAttestation",
    args: [hashHex],
    chainId: arcTestnet.id,
    query: { enabled: validBytes32 },
  });

  const { data: onchainBeneficiary } = useReadContract({
    address: REGISTRY_V2,
    abi: REGISTRY_ABI,
    functionName: "beneficiaryOf",
    args: [hashHex],
    chainId: arcTestnet.id,
    query: { enabled: validBytes32 },
  });

  const { data: isClaimedOnArc, refetch: refetchClaimed } = useReadContract({
    address: VAULT_V2,
    abi: VAULT_ABI,
    functionName: "claimedReceipts",
    args: [hashHex],
    chainId: arcTestnet.id,
    query: { enabled: validBytes32 },
  });

  const isAttested = Boolean(attestation?.[0]);
  const zero = BigInt(0);
  const attestedRaw = attestation?.[1] ?? zero;
  const attestedFormatted =
    attestedRaw > zero ? (Number(attestedRaw) / 1e6).toFixed(6).replace(/\.?0+$/, "") : extractedUSDC;

  const zeroAddr = "0x0000000000000000000000000000000000000000";
  const effectiveBeneficiary =
    onchainBeneficiary && onchainBeneficiary.toLowerCase() !== zeroAddr
      ? onchainBeneficiary
      : fallbackBeneficiary;

  const isBeneficiary =
    Boolean(address) &&
    Boolean(effectiveBeneficiary) &&
    address!.toLowerCase() === effectiveBeneficiary.toLowerCase();

  const isClaimed = claimedLocal || status === "REBATED" || Boolean(isClaimedOnArc);

  const handleClaim = async () => {
    setErrorMsg(null);
    if (!isConnected || !address) {
      openConnectModal?.();
      return;
    }
    if (!isBeneficiary) {
      setErrorMsg(
        `NotBeneficiary: Connected wallet (${address.slice(0, 8)}…) is not the attested beneficiary (${effectiveBeneficiary.slice(0, 8)}…). RebateVault v2 rejects unauthorized claims.`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      if (chainId !== arcTestnet.id) {
        await switchChainAsync({ chainId: arcTestnet.id });
      }

      const amountToClaim =
        attestedRaw > zero ? attestedRaw : BigInt(Math.round((parseFloat(extractedUSDC) || 0) * 1e6));

      const hash = await writeContractAsync({
        address: VAULT_V2,
        abi: VAULT_ABI,
        functionName: "claimRebate",
        args: [hashHex, address, amountToClaim, "0x"],
        chainId: arcTestnet.id,
      });

      setTxHash(hash);
      setClaimedLocal(true);
      await refetchClaimed();

      // Record LPClaim on Arkiv Rabdi via server API
      const res = await fetch("/api/claims/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptHash,
          lp: address,
          claimTx: hash,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; entityKey?: string; error?: string };
      if (json.ok && json.entityKey) {
        setArkivEntityKey(json.entityKey);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("NotBeneficiary")) {
        setErrorMsg("Transaction reverted with NotBeneficiary on Arc RebateVault v2.");
      } else if (msg.includes("AlreadyClaimed")) {
        setErrorMsg("Transaction reverted with AlreadyClaimed: this receipt was already settled.");
      } else {
        setErrorMsg(msg.slice(0, 220));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border border-border bg-[#15191E] p-5 rounded space-y-4 text-xs font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-good font-bold uppercase flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-good" />
            Settlement · Arc Testnet RebateVault v2
          </div>
          <div className="text-muted text-[11px] mt-1 leading-relaxed">
            {isClaimed
              ? `Rebate of $${extractedUSDC} USDC settled on Arc Testnet and sealed on Arkiv (darktrace.lp_claims).`
              : isSynthetic
              ? "Synthetic SDK smoke-test fixture (not attested on Arc v2)."
              : isAttested
              ? `Attested on Arc SimulationRegistry v2 (${REGISTRY_V2.slice(0, 8)}…) for $${attestedFormatted} USDC. Only the attested beneficiary can claim.`
              : `Awaiting v2 attestation or settled on retired v1 vault.`}
          </div>
        </div>

        {isClaimed ? (
          <div className="px-3 py-1.5 border border-good/40 bg-good/10 text-good rounded font-semibold text-[11px] inline-flex items-center gap-1.5 self-start sm:self-center">
            <Check className="w-3.5 h-3.5" />
            CLAIMED (REBATED)
          </div>
        ) : null}
      </div>

      {/* Live Arc v2 On-Chain Verification Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-border text-[11px]">
        <div className="p-2.5 border border-border rounded bg-bg">
          <div className="text-muted">Arc v2 Attestation</div>
          <div className="mt-1 font-semibold text-text">
            {attestationError ? (
              <span className="text-danger">RPC unreachable</span>
            ) : isAttested ? (
              <span className="text-good">VERIFIED (${attestedFormatted} USDC)</span>
            ) : isClaimed ? (
              <span className="text-good">SETTLED (${extractedUSDC} USDC)</span>
            ) : (
              <span className="text-muted">UNATTESTED ON V2</span>
            )}
          </div>
        </div>

        <div className="p-2.5 border border-border rounded bg-bg">
          <div className="text-muted">Authorized Beneficiary (v2)</div>
          <div className="mt-1 text-text flex items-center gap-1">
            {effectiveBeneficiary ? (
              <HashDisplay hash={effectiveBeneficiary} />
            ) : (
              <span className="text-muted">—</span>
            )}
          </div>
        </div>

        <div className="p-2.5 border border-border rounded bg-bg">
          <div className="text-muted">Vault Nullifier Status</div>
          <div className="mt-1 font-semibold">
            {isClaimed ? (
              <span className="text-good">CLAIMED</span>
            ) : (
              <span className="text-accent">OPEN (UNCLAIMED)</span>
            )}
          </div>
        </div>
      </div>

      {/* Claim Tx / LPClaim Link if Claimed */}
      {txHash && (
        <div className="p-3 border border-good/30 bg-good/5 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2 text-good">
            <Check className="w-3.5 h-3.5" />
            <span>Arc Claim Transaction:</span>
            <a
              href={`https://explorer.testnet.arc.io/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="underline inline-flex items-center gap-1 font-semibold"
            >
              {txHash.slice(0, 12)}…{txHash.slice(-8)}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          {arkivEntityKey && (
            <a
              href={`https://rabdi.explorer.arkiv.network/entity/${arkivEntityKey}`}
              target="_blank"
              rel="noreferrer"
              className="text-[#BC8CFF] hover:underline inline-flex items-center gap-1"
            >
              Arkiv LPClaim $key: {arkivEntityKey.slice(0, 10)}…
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Interactive Wallet Action for Open Claims */}
      {!isClaimed && !isSynthetic && (
        <div className="space-y-3 pt-1">
          {isConnected && address && !isBeneficiary && (
            <div className="p-3 border border-danger/40 bg-danger/10 rounded text-danger flex items-start gap-2 text-[11px]">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold uppercase">NotBeneficiary Guard Active</div>
                <div className="text-muted mt-0.5">
                  Connected wallet <span className="text-text">{address}</span> is not the attested beneficiary (
                  <span className="text-text">{effectiveBeneficiary}</span>).{" "}
                  <code className="text-danger">RebateVault.claimRebate</code> will revert with{" "}
                  <code className="text-danger">NotBeneficiary</code> on-chain. Connect the beneficiary wallet to
                  claim.
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 border border-danger/40 bg-danger/10 rounded text-danger text-[11px] break-words">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {!isConnected ? (
              <button
                type="button"
                onClick={() => openConnectModal?.()}
                className="px-4 py-2 bg-good text-bg rounded font-bold text-xs hover:opacity-90 transition-opacity inline-flex items-center gap-2"
              >
                <Wallet className="w-3.5 h-3.5" />
                Connect Beneficiary Wallet to Claim
              </button>
            ) : chainId !== arcTestnet.id ? (
              <button
                type="button"
                disabled={isSwitching}
                onClick={() => switchChainAsync({ chainId: arcTestnet.id })}
                className="px-4 py-2 bg-accent text-bg rounded font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity inline-flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSwitching ? "animate-spin" : ""}`} />
                Switch Wallet to Arc Testnet (5042002)
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting || !isAttested || !isBeneficiary}
                onClick={handleClaim}
                className="px-4 py-2 bg-good text-bg rounded font-bold text-xs hover:opacity-90 disabled:opacity-40 transition-opacity inline-flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Claiming Rebate on Arc v2 & Sealing LPClaim…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Claim ${attestedFormatted} USDC Rebate on Arc v2
                  </>
                )}
              </button>
            )}

            <span className="text-[11px] text-muted">
              Vault v2: <code className="text-text">{VAULT_V2.slice(0, 10)}…</code>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
