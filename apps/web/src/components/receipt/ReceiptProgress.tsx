"use client";

import { useReadContract } from "wagmi";
import { type Hex } from "viem";
import { Check, Loader2 } from "lucide-react";
import { arcTestnet } from "@/config/chains";
import { REGISTRY_ABI, REGISTRY_V2, VAULT_ABI, VAULT_V2 } from "@/components/receipt/ClaimRebatePanel";

interface ReceiptProgressProps {
  receiptHash: string;
  extractedUSDC: string;
  blockNumber: number;
  status: "ARCHIVED" | "REBATED";
  isSynthetic?: boolean;
}

type StepState = "done" | "current" | "upcoming" | "checking" | "skipped";

/**
 * Where a receipt is in the pipeline: Detected → Sealed on Arkiv → Attested on Arc → Rebated.
 * Reads the same Arc views as ClaimRebatePanel (identical wagmi query keys, so the
 * results are shared from cache rather than fetched twice).
 */
export function ReceiptProgress({ receiptHash, extractedUSDC, blockNumber, status, isSynthetic }: ReceiptProgressProps) {
  const validBytes32 = /^0x[0-9a-fA-F]{64}$/.test(receiptHash);
  const hashHex = (validBytes32 ? receiptHash : "0x" + "0".repeat(64)) as Hex;
  const enabled = validBytes32 && !isSynthetic;

  const attestation = useReadContract({
    address: REGISTRY_V2,
    abi: REGISTRY_ABI,
    functionName: "getAttestation",
    args: [hashHex],
    chainId: arcTestnet.id,
    query: { enabled: validBytes32 },
  });

  const claimed = useReadContract({
    address: VAULT_V2,
    abi: VAULT_ABI,
    functionName: "claimedReceipts",
    args: [hashHex],
    chainId: arcTestnet.id,
    query: { enabled: validBytes32 },
  });

  const isRebated = status === "REBATED" || Boolean(claimed.data);
  const isAttested = Boolean(attestation.data?.[0]) || isRebated;
  const arcLoading = enabled && !isRebated && (attestation.isLoading || claimed.isLoading);
  const arcError = enabled && !isRebated && attestation.isError;

  const attestState: StepState = isSynthetic
    ? "skipped"
    : isAttested
    ? "done"
    : arcLoading
    ? "checking"
    : "current";
  const rebateState: StepState = isSynthetic
    ? "skipped"
    : isRebated
    ? "done"
    : isAttested
    ? "current"
    : "upcoming";

  const steps: { label: string; detail: string; state: StepState }[] = [
    { label: "Detected", detail: `Base Sepolia block #${blockNumber}`, state: "done" },
    { label: "Sealed on Arkiv", detail: "Receipt entity on Rabdi", state: "done" },
    {
      label: "Attested on Arc",
      detail: isSynthetic ? "Not applicable (SDK fixture)" : arcError ? "Arc RPC unreachable" : "SimulationRegistry v2",
      state: attestState,
    },
    {
      label: "Rebated",
      detail: isSynthetic ? "Not applicable (SDK fixture)" : `$${extractedUSDC} USDC`,
      state: rebateState,
    },
  ];

  let next: string;
  if (isSynthetic) next = "This is an SDK smoke-test fixture, so it never reaches Arc settlement.";
  else if (isRebated) next = `Rebate of $${extractedUSDC} USDC paid on Arc Testnet.`;
  else if (arcLoading) next = "Checking the Arc attestation…";
  else if (arcError) next = "Could not reach Arc Testnet to check the attestation. Reload to try again.";
  else if (isAttested) next = `Attested. The beneficiary wallet can claim $${extractedUSDC} USDC.`;
  else next = "Not attested on Arc v2 yet, or settled on the retired v1 vault.";

  const showClaimLink = !isSynthetic && isAttested && !isRebated;

  return (
    <div className="border-t border-border pt-5">
      <h2 className="sr-only">Receipt progress</h2>
      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-y-5">
        {steps.map((s, i) => {
          const isLast = i === steps.length - 1;
          const filled = s.state === "done";
          const active = s.state === "current" || s.state === "checking";
          return (
            <li
              key={s.label}
              aria-current={active ? "step" : undefined}
              className="relative flex flex-col items-center text-center px-2"
            >
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`hidden sm:block absolute top-[15px] left-[calc(50%+20px)] right-[calc(-50%+20px)] h-0.5 rounded-full ${
                    filled ? "bg-ink" : "bg-border"
                  }`}
                />
              )}
              <span
                aria-hidden="true"
                className={`grid place-items-center w-8 h-8 rounded-full text-xs font-semibold ${
                  filled
                    ? "bg-ink text-on-ink"
                    : active
                    ? "border-2 border-text text-text bg-surface"
                    : "border border-border text-muted bg-surface"
                }`}
              >
                {filled ? (
                  <Check className="w-4 h-4" strokeWidth={2.5} />
                ) : s.state === "checking" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`mt-2 text-sm ${
                  filled || active ? "text-text font-medium" : "text-muted"
                } ${s.state === "skipped" ? "line-through decoration-muted/60" : ""}`}
              >
                {s.label}
              </span>
              <span className="mt-0.5 text-xs text-muted">{s.detail}</span>
              <span className="sr-only">
                {s.state === "done"
                  ? "(complete)"
                  : s.state === "checking"
                  ? "(checking)"
                  : s.state === "current"
                  ? "(current step)"
                  : s.state === "skipped"
                  ? "(not applicable)"
                  : "(not started)"}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
        <p className="text-sm text-muted" aria-live="polite">
          {next}
        </p>
        {showClaimLink && (
          <a
            href="#settlement"
            className="px-4 py-2 rounded-full bg-ink text-on-ink text-sm font-medium hover:bg-ink/85 transition-colors whitespace-nowrap"
          >
            Go to claim
          </a>
        )}
      </div>
    </div>
  );
}
