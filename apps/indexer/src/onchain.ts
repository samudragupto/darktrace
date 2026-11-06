// Rebuilds a detected sandwich from on-chain data only: the three Uniswap v4 PoolManager `Swap`
// events around the hook's ExtractionDetected log. Anyone can recompute the result from the
// transaction(s) alone; no archive state is needed.
import { decodeEventLog, parseAbi, type Hex, type PublicClient } from "viem";
import type { SimulationInput } from "@darktrace/simulator";

export const POOL_MANAGER = "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408" as const;

const SWAP_ABI = parseAbi([
  "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)",
]);

const Q96 = 1n << 96n;
const PIPS = 1_000_000n;

export interface OnchainSwap {
  sender: Hex;
  zeroForOne: boolean;
  /** Gross input paid by the swapper (includes the LP fee), in raw token units. */
  amountInGross: bigint;
  /** Input that actually moved the curve: gross minus the LP fee. */
  amountInNet: bigint;
  sqrtPriceX96After: bigint;
  liquidity: bigint;
  tick: number;
  fee: number;
  txHash: Hex;
  logIndex: number;
  /** Raw signed v4 Swap deltas (swapper perspective: negative = paid into the pool). */
  amount0: bigint;
  amount1: bigint;
}

/** A Swap enriched with the EOA that signed its transaction. */
export type OriginSwap = OnchainSwap & { origin: Hex };

export interface ReconstructedSandwich {
  frontrun: OnchainSwap;
  victim: OnchainSwap;
  backrun: OnchainSwap;
  /** Pool price immediately before the frontrun, derived from the frontrun's own Swap event. */
  preAttackSqrtPriceX96: bigint;
  simulationInput: SimulationInput;
  txHashes: [Hex, Hex, Hex];
  /** Wallet that signed the victim's swap transaction: the restitution beneficiary. */
  victimOrigin: Hex;
}

const abs = (x: bigint) => (x < 0n ? -x : x);

function toSwap(log: { data: Hex; topics: readonly Hex[]; transactionHash: Hex | null; logIndex: number | null }): OnchainSwap {
  const { args } = decodeEventLog({ abi: SWAP_ABI, data: log.data, topics: log.topics as [Hex, ...Hex[]] });
  // v4 Swap amounts are from the swapper's perspective: negative = paid into the pool.
  const zeroForOne = args.amount0 < 0n;
  const amountInGross = abs(zeroForOne ? args.amount0 : args.amount1);
  const fee = BigInt(args.fee);
  return {
    sender: args.sender,
    zeroForOne,
    amountInGross,
    amountInNet: (amountInGross * (PIPS - fee)) / PIPS,
    sqrtPriceX96After: args.sqrtPriceX96,
    liquidity: args.liquidity,
    tick: args.tick,
    fee: Number(fee),
    txHash: log.transactionHash as Hex,
    logIndex: log.logIndex ?? 0,
    amount0: args.amount0,
    amount1: args.amount1,
  };
}

/** Decodes PoolManager Swap logs into ordered swaps. */
export function decodeSwapLogs(
  logs: readonly { data: Hex; topics: readonly Hex[]; transactionHash: Hex | null; logIndex: number | null }[]
): OnchainSwap[] {
  return logs.map((l) => toSwap(l)).sort((a, b) => a.logIndex - b.logIndex);
}

/** Uniswap tick of a sqrtPriceX96 (float; precise enough for threshold comparisons). */
export function tickOfSqrtPrice(sqrtPriceX96: bigint): number {
  const p = Number(sqrtPriceX96) / 2 ** 96;
  return Math.floor(Math.log(p * p) / Math.log(1.0001));
}

export interface LinkedSandwich {
  frontrun: OriginSwap;
  victim: OriginSwap;
  backrun: OriginSwap;
  /** EOA that signed both the frontrun and the backrun. */
  searcherOrigin: Hex;
}

/**
 * Off-chain detector for the split-contract evasion that an on-chain hook cannot see: frontrun and
 * backrun go through DIFFERENT router contracts but are signed by the SAME EOA, around a victim swap
 * signed by a different EOA. Uses the same thresholds as DarkTraceHook (push >= minTickDelta ticks,
 * reversal >= 30% of the push) plus a profit check in the frontrun's input token.
 * `swaps` must be one pool, one block, ordered by logIndex.
 */
export function findLinkedSandwiches(swaps: readonly OriginSwap[], minTickDelta = 15): LinkedSandwich[] {
  const found: LinkedSandwich[] = [];
  for (let i = 0; i + 2 < swaps.length; i++) {
    const [f, v, b] = [swaps[i], swaps[i + 1], swaps[i + 2]];
    const searcher = f.origin.toLowerCase();
    if (b.origin.toLowerCase() !== searcher) continue; // same signer on both legs
    if (v.origin.toLowerCase() === searcher) continue; // victim is someone else
    if (f.zeroForOne !== v.zeroForOne || b.zeroForOne === f.zeroForOne) continue; // push, follow, reverse
    if (f.sender.toLowerCase() === b.sender.toLowerCase()) continue; // same contract: the hook already sees it

    const push = f.tick - tickOfSqrtPrice(sqrtPriceBefore(f));
    const pull = b.tick - v.tick;
    if (Math.abs(push) < minTickDelta || Math.abs(pull) < minTickDelta) continue;
    if (Math.sign(push) === Math.sign(pull) || Math.abs(pull) * 100 < Math.abs(push) * 30) continue;

    // Searcher must end with more of the token it started with.
    const pnl = f.zeroForOne ? f.amount0 + b.amount0 : f.amount1 + b.amount1;
    if (pnl <= 0n) continue;

    found.push({ frontrun: f, victim: v, backrun: b, searcherOrigin: f.origin });
    i += 2;
  }
  return found;
}

/** Price before a swap, given its post-swap price, in-range liquidity and net input. */
export function sqrtPriceBefore(s: OnchainSwap): bigint {
  const L = s.liquidity;
  const pa = s.sqrtPriceX96After;
  if (s.zeroForOne) {
    // 1/sqrtP_after = 1/sqrtP_before + x/L  =>  sqrtP_before = Q96*L*pa / (Q96*L - x*pa)
    return (Q96 * L * pa) / (Q96 * L - s.amountInNet * pa);
  }
  // sqrtP_after = sqrtP_before + y*Q96/L
  return pa - (s.amountInNet * Q96) / L;
}

/**
 * Finds frontrun / victim / backrun for `poolId` in `blockNumber`, ending at the swap that
 * triggered ExtractionDetected (the last Swap at or before `detectedLogIndex`).
 */
export async function reconstructSandwich(
  client: PublicClient,
  params: {
    poolId: Hex;
    blockNumber: bigint;
    /** Router contract (hook detection) or, with matchBy "origin", the searcher's signing EOA. */
    searcher: Hex;
    victim: Hex;
    detectedLogIndex?: number;
    matchBy?: "sender" | "origin";
  }
): Promise<ReconstructedSandwich> {
  const logs = await client.getLogs({
    address: POOL_MANAGER,
    event: SWAP_ABI[0],
    args: { id: params.poolId },
    fromBlock: params.blockNumber,
    toBlock: params.blockNumber,
  });
  const swaps = logs
    .map((l) => toSwap(l as never))
    .filter((s) => params.detectedLogIndex === undefined || s.logIndex <= params.detectedLogIndex)
    .sort((a, b) => a.logIndex - b.logIndex);

  if (swaps.length < 3) {
    throw new Error(`expected >= 3 swaps for pool ${params.poolId} in block ${params.blockNumber}, found ${swaps.length}`);
  }
  const [frontrun, victim, backrun] = swaps.slice(-3);
  const searcher = params.searcher.toLowerCase();
  if (victim.sender.toLowerCase() !== params.victim.toLowerCase()) {
    throw new Error("Victim swap sender does not match the detected victim");
  }
  if (params.matchBy === "origin") {
    // Linked-origin detection: both searcher legs must be signed by the same EOA.
    const [fo, bo] = await Promise.all([
      client.getTransaction({ hash: frontrun.txHash }),
      client.getTransaction({ hash: backrun.txHash }),
    ]);
    if (fo.from.toLowerCase() !== searcher || bo.from.toLowerCase() !== searcher) {
      throw new Error("Frontrun/backrun signers do not match the linked searcher EOA");
    }
  } else if (frontrun.sender.toLowerCase() !== searcher || backrun.sender.toLowerCase() !== searcher) {
    throw new Error("Swap senders do not match the ExtractionDetected searcher/victim");
  }

  const pre = sqrtPriceBefore(frontrun);
  const L = frontrun.liquidity;
  // Virtual CPMM reserves equivalent to the in-range concentrated liquidity at the pre-attack price.
  const reserve0 = (L * Q96) / pre;
  const reserve1 = (L * pre) / Q96;

  const simulationInput: SimulationInput = {
    poolId: params.poolId as `0x${string}`,
    blockNumber: Number(params.blockNumber),
    searcherTxs: {
      frontrun: { sender: frontrun.sender, zeroForOne: frontrun.zeroForOne, amountSpecified: -frontrun.amountInNet },
      backrun: { sender: backrun.sender, zeroForOne: backrun.zeroForOne, amountSpecified: -backrun.amountInNet },
    },
    victimSwap: { sender: victim.sender, zeroForOne: victim.zeroForOne, amountSpecified: -victim.amountInNet },
    preAttackReserve0: reserve0,
    preAttackReserve1: reserve1,
  };

  // The hook only sees the victim's router; the person who lost money signed the victim tx.
  const victimOrigin = (await client.getTransaction({ hash: victim.txHash })).from;

  return {
    frontrun,
    victim,
    backrun,
    victimOrigin,
    preAttackSqrtPriceX96: pre,
    simulationInput,
    txHashes: [frontrun.txHash, victim.txHash, backrun.txHash],
  };
}
