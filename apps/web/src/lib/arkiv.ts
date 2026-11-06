// Server-side data layer: every receipt the web app shows is read live from Arkiv Rabdi
// through @darktrace/arkiv (official @arkiv-network/sdk). Never import this from a client component.
import {
  arkiv,
  type ArkivReceipt,
  type ArkivLPClaim,
  type ArkivSearcherProfile,
  ARKIV_EXPLORER,
  isSyntheticReceipt,
  RECEIPT_TTL_DAYS,
  OPEN_CLAIM_TTL_DAYS,
} from "@darktrace/arkiv";
import { MOCK_POOLS } from "@/data/mockData";
import { unstable_noStore as noStore } from "next/cache";

export { ARKIV_EXPLORER, isSyntheticReceipt, RECEIPT_TTL_DAYS, OPEN_CLAIM_TTL_DAYS, type ArkivSearcherProfile };

const ARKIV_TIMEOUT_MS = 8_000;

export interface ReceiptView {
  receiptHash: string;
  arkivEntityKey: string;
  explorerUrl: string;
  owner: string;
  createdAtBlock: string;
  expiresAtBlock: string;
  hasExtendedExpiry: boolean;
  isSynthetic: boolean;
  poolId: string;
  poolName: string;
  searcher: string;
  victim: string;
  lp: string;
  blockNumber: number;
  extractedUSDC: string;
  injectedSlippageBps: number | null;
  legitSlippageBps: number | null;
  simulationHash: string;
  txHashes: string[];
  status: "ARCHIVED" | "REBATED";
  claimTx?: string;
}

export type ArkivResult<T> =
  | { ok: true; data: T; queriedAt: string }
  | { ok: false; error: string; queriedAt: string };

/** Pool metadata (name, fee) is static config; extraction data comes from Arkiv. */
export function poolName(poolId: string): string {
  return MOCK_POOLS.find((p) => p.id.toLowerCase() === poolId.toLowerCase())?.name ?? "Uniswap v4 Pool";
}

export function toView(r: ArkivReceipt, claim?: ArkivLPClaim | null): ReceiptView {
  const lifetimeBlocks = r.expiresAtBlock > r.createdAtBlock ? r.expiresAtBlock - r.createdAtBlock : 0n;
  return {
    receiptHash: r.receiptHash,
    arkivEntityKey: r.arkivEntityKey,
    explorerUrl: r.explorerUrl,
    owner: r.owner,
    createdAtBlock: r.createdAtBlock.toString(),
    expiresAtBlock: r.expiresAtBlock.toString(),
    hasExtendedExpiry: lifetimeBlocks > 2_000_000n,
    isSynthetic: isSyntheticReceipt(r),
    poolId: r.poolId,
    poolName: poolName(r.poolId),
    searcher: r.searcher,
    victim: r.victim,
    lp: r.lp,
    blockNumber: r.blockNumber,
    extractedUSDC: r.extractedUSDC,
    injectedSlippageBps: r.injectedSlippageBps,
    legitSlippageBps: r.legitSlippageBps,
    simulationHash: r.simulationHash,
    txHashes: r.txHashes,
    status: claim ? "REBATED" : "ARCHIVED",
    claimTx: claim?.claimTx,
  };
}

/** Joins receipts with their LPClaim (by receiptHash) so REBATED status matches across every page. */
export async function toViewsWithClaims(
  sdk: Pick<ReturnType<typeof arkiv>, "listLPClaims">,
  receipts: ArkivReceipt[]
): Promise<ReceiptView[]> {
  if (receipts.length === 0) return [];
  const claims = await sdk.listLPClaims();
  const byReceipt = new Map(claims.map((c) => [c.receiptHash.toLowerCase(), c]));
  return receipts.map((r) => toView(r, byReceipt.get(r.receiptHash.toLowerCase())));
}

/** Runs an Arkiv read with a timeout; failures are reported, never replaced with mock data. */
export async function fromArkiv<T>(fn: (sdk: ReturnType<typeof arkiv>) => Promise<T>): Promise<ArkivResult<T>> {
  // viem sends JSON-RPC as fetch POSTs, which Next.js would otherwise store in its Data Cache
  // (persisting across requests and deploys) and replay stale Arkiv answers. Always read live.
  noStore();
  const queriedAt = new Date().toISOString();
  try {
    const data = await Promise.race([
      fn(arkiv()),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Arkiv query timed out after ${ARKIV_TIMEOUT_MS}ms`)), ARKIV_TIMEOUT_MS)
      ),
    ]);
    return { ok: true, data, queriedAt };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), queriedAt };
  }
}

export const sumUSDC = (rows: { extractedUSDC: string }[]) =>
  rows.reduce((acc, r) => acc + (parseFloat(r.extractedUSDC) || 0), 0).toFixed(2);

export const writerAddress = () => arkiv().writerAddress;
