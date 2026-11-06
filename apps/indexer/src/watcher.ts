import { createPublicClient, http, parseAbiItem } from "viem";
import { baseSepolia } from "viem/chains";
import { ForensicPipeline } from "./pipeline";

const EXTRACTION_DETECTED_EVENT = parseAbiItem(
  "event ExtractionDetected(bytes32 indexed poolId, address indexed searcher, address indexed victim, uint256 extractedValue, bytes32 proofHash)"
);

export interface WatcherConfig {
  /** One or more DarkTraceHook deployments (v1 and v2 are both live on Base Sepolia). */
  hookAddress: `0x${string}` | `0x${string}`[];
  rpcUrl?: string;
  pipeline: ForensicPipeline;
}

export function startHookWatcher(config: WatcherConfig) {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(config.rpcUrl || process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org"),
  });

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "INFO",
      stage: "INIT",
      message: "DarkTrace Base Sepolia Hook Watcher started",
      hookAddresses: ([] as string[]).concat(config.hookAddress),
    })
  );

  const unwatch = publicClient.watchEvent({
    address: config.hookAddress,
    event: EXTRACTION_DETECTED_EVENT,
    onLogs: async (logs) => {
      for (const log of logs) {
        if (!log.args.poolId || !log.args.searcher || !log.args.victim) continue;

        try {
          await config.pipeline.processExtraction({
            poolId: log.args.poolId,
            searcher: log.args.searcher,
            victim: log.args.victim,
            extractedValue: log.args.extractedValue ?? 0n,
            proofHash: log.args.proofHash ?? "0x00",
            blockNumber: Number(log.blockNumber),
            txHash: log.transactionHash,
            logIndex: log.logIndex ?? undefined,
          });
        } catch (err) {
          // One failed event (e.g. Arkiv unreachable or writer key missing) must not kill the watcher.
          console.error(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              level: "ERROR",
              stage: "PIPELINE_FAILED",
              message: err instanceof Error ? err.message : String(err),
              txHash: log.transactionHash,
            })
          );
        }
      }
    },
    onError: (error) => {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "ERROR",
          stage: "WATCHER_ERROR",
          message: error.message,
        })
      );
    },
  });

  return unwatch;
}
