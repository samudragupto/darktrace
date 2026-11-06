// Off-chain complement to DarkTraceHook: scans hooked pools block by block for sandwiches whose
// frontrun and backrun use DIFFERENT contracts but are signed by the SAME EOA (the split-contract
// evasion documented in specs/08-hook-threat-model.md §3). Matches go through the same
// ForensicPipeline (rebuild -> counterfactual -> Arkiv -> Arc) with detection = "linked-origin".
import { keccak256, concat, parseAbiItem, type Hex, type PublicClient } from "viem";
import { POOL_MANAGER, decodeSwapLogs, findLinkedSandwiches, type OriginSwap } from "./onchain";
import type { ForensicPipeline } from "./pipeline";

const SWAP_EVENT = parseAbiItem(
  "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)"
);
const MAX_RANGE = 150n; // public Base Sepolia RPC caps eth_getLogs at 200 blocks

export interface LinkedScannerStatus {
  enabled: boolean;
  pools: Hex[];
  lastScannedBlock: string | null;
  candidates: number;
  lastError: string | null;
}

export interface LinkedScannerConfig {
  client: PublicClient;
  pools: Hex[];
  pipeline: ForensicPipeline;
  intervalMs?: number;
  minTickDelta?: number;
}

const log = (level: string, stage: string, message: string, meta: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, stage, message, ...meta }));

/** One scan step over [from, to]; exported for tests and the process-tx CLI. */
export async function scanRange(
  client: PublicClient,
  pools: Hex[],
  from: bigint,
  to: bigint,
  originCache: Map<string, Hex> = new Map(),
  minTickDelta = 15
) {
  const logs = await client.getLogs({ address: POOL_MANAGER, event: SWAP_EVENT, args: { id: pools }, fromBlock: from, toBlock: to });
  const groups = new Map<string, typeof logs>();
  for (const l of logs) {
    const k = `${l.blockNumber}:${l.args.id}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(l);
  }

  const results: { poolId: Hex; blockNumber: bigint; sandwich: ReturnType<typeof findLinkedSandwiches>[number] }[] = [];
  for (const [k, group] of groups) {
    if (group.length < 3) continue;
    const swaps = decodeSwapLogs(group as never);
    const enriched: OriginSwap[] = [];
    for (const s of swaps) {
      let origin = originCache.get(s.txHash);
      if (!origin) {
        origin = (await client.getTransaction({ hash: s.txHash })).from;
        originCache.set(s.txHash, origin);
      }
      enriched.push({ ...s, origin });
    }
    const [block, poolId] = k.split(":");
    for (const sandwich of findLinkedSandwiches(enriched, minTickDelta)) {
      results.push({ poolId: poolId as Hex, blockNumber: BigInt(block), sandwich });
    }
  }
  return results;
}

export function startLinkedScanner(config: LinkedScannerConfig): { stop: () => void; status: LinkedScannerStatus } {
  const status: LinkedScannerStatus = {
    enabled: true,
    pools: config.pools,
    lastScannedBlock: null,
    candidates: 0,
    lastError: null,
  };
  const originCache = new Map<string, Hex>();
  let last: bigint | null = null;
  let running = false;

  const step = async () => {
    if (running) return;
    running = true;
    try {
      const head = await config.client.getBlockNumber();
      if (last === null) last = head - 1n;
      const from = last + 1n;
      if (from > head) return;
      const to = head - from > MAX_RANGE ? from + MAX_RANGE : head;

      for (const { poolId, blockNumber, sandwich } of await scanRange(config.client, config.pools, from, to, originCache, config.minTickDelta)) {
        status.candidates += 1;
        log("INFO", "LINKED_DETECTED", "Split-contract sandwich linked by signing EOA", {
          poolId,
          blockNumber: blockNumber.toString(),
          searcherOrigin: sandwich.searcherOrigin,
          frontrunContract: sandwich.frontrun.sender,
          backrunContract: sandwich.backrun.sender,
        });
        try {
          await config.pipeline.processExtraction({
            poolId,
            searcher: sandwich.searcherOrigin,
            victim: sandwich.victim.sender,
            extractedValue: 0n,
            proofHash: keccak256(concat([sandwich.frontrun.txHash, sandwich.victim.txHash, sandwich.backrun.txHash])),
            blockNumber: Number(blockNumber),
            txHash: sandwich.backrun.txHash,
            logIndex: sandwich.backrun.logIndex,
            detection: "linked-origin",
          });
        } catch (err) {
          log("ERROR", "PIPELINE_FAILED", err instanceof Error ? err.message : String(err), { txHash: sandwich.backrun.txHash });
        }
      }
      last = to;
      status.lastScannedBlock = to.toString();
      status.lastError = null;
    } catch (err) {
      status.lastError = err instanceof Error ? err.message : String(err);
      log("WARN", "LINKED_SCAN", "scan step failed; will retry", { error: status.lastError });
    } finally {
      running = false;
    }
  };

  const timer = setInterval(step, config.intervalMs ?? 6_000);
  void step();
  log("INFO", "INIT", "Linked-origin scanner started", { pools: config.pools });
  return {
    stop: () => {
      clearInterval(timer);
      status.enabled = false;
    },
    status,
  };
}
