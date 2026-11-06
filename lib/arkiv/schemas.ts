// Canonical field order matches SimulationRegistry.attest(receiptHash, ...). Verified at Stage 9.
import { keccak256, toHex, stringToBytes } from "viem";

export interface ExtractionReceipt {
  v: "1.0.0";
  poolId: string;
  searcher: string;
  victim: string;
  lp: string;
  blockNumber: number;
  extractedUSDC: string;
  injectedSlippageBps: number;
  legitSlippageBps: number;
  simulationHash: string;
  txHashes: string[];
  createdAt: number;
  /**
   * How the sandwich was found: "hook" (DarkTraceHook ExtractionDetected) or "linked-origin"
   * (off-chain: frontrun and backrun from different contracts signed by the same EOA).
   * Optional and NOT part of computeReceiptHash, so existing receipt hashes are unchanged.
   */
  detection?: "hook" | "linked-origin";
}

export interface SearcherProfile {
  v: "1.0.0";
  searcher: string;
  extractions: number;
  bondedUSDC: string;
  slashedUSDC: string;
  lastSeenBlock: number;
}

export interface LPClaim {
  v: "1.0.0";
  receiptHash: string;
  lp: string;
  claimTx: string;
  createdAt: number;
}

/**
 * Computes deterministic canonical hash for an ExtractionReceipt.
 */
export function computeReceiptHash(receipt: ExtractionReceipt): `0x${string}` {
  // Deterministic JSON ordering
  const canonical = JSON.stringify({
    v: receipt.v,
    poolId: receipt.poolId.toLowerCase(),
    searcher: receipt.searcher.toLowerCase(),
    victim: receipt.victim.toLowerCase(),
    lp: receipt.lp.toLowerCase(),
    blockNumber: receipt.blockNumber,
    extractedUSDC: receipt.extractedUSDC,
    injectedSlippageBps: receipt.injectedSlippageBps,
    legitSlippageBps: receipt.legitSlippageBps,
    simulationHash: receipt.simulationHash.toLowerCase(),
    txHashes: receipt.txHashes.map((h) => h.toLowerCase()),
    createdAt: receipt.createdAt,
  });

  return keccak256(stringToBytes(canonical));
}
