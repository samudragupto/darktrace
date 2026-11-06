import "dotenv/config";
import http from "node:http";
import { ArkivSdk } from "@darktrace/arkiv";
import { ForensicPipeline } from "./pipeline";
import { startHookWatcher } from "./watcher";
import { startLinkedScanner } from "./linked-scanner";
import { createPublicClient, http as viemHttp, type PublicClient } from "viem";
import { baseSepolia } from "viem/chains";

// Verified deployments (Base Sepolia). Both hooks are live; both pools are hooked.
const DEFAULT_HOOKS = [
  "0xBCC9e1C474Ed195b3791f2c41EdAC2a25c5b80c0", // DarkTraceHook v1
  "0xCeF7a999885D93f23Beeb7D319A83F2949B2c0c0", // DarkTraceHook v2
] as const;
const DEFAULT_POOLS = [
  "0x2183dce5625ecbb1cf175be52a75b31eeed7bf7774181e3136ba49f6fc3c676c", // tUSDC/tWETH on hook v1
  "0x5d78af67b033875696613c57b5a68f4a62eba0d98095844b0e9c8c691afc63df", // tUSDC/tWETH on hook v2
] as const;
const list = (v: string | undefined, fallback: readonly string[]) =>
  (v ? v.split(",").map((x) => x.trim()).filter(Boolean) : [...fallback]) as `0x${string}`[];

async function main() {
  // HOOK_ADDRESS may be one address or a comma-separated list; default = both verified hooks.
  const hookAddresses = list(process.env.HOOK_ADDRESS, DEFAULT_HOOKS);
  const hookAddress = hookAddresses[0];
  const watchPools = list(process.env.WATCH_POOLS, DEFAULT_POOLS);
  const linkedScan = process.env.LINKED_SCAN !== "0";
  const demoFast = process.env.DEMO_FAST === "1";
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
  const arkivMemory = process.env.ARKIV_DEV_MODE === "memory";

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "INFO",
      stage: "BOOTSTRAP",
      message: "DarkTrace Forensic Indexer Service initialized",
      hookAddress,
      hookAddresses,
      watchPools,
      linkedScan,
      demoFast,
      port,
      arkiv: arkivMemory ? "memory (offline)" : "live (Rabdi 7794095)",
      arcRpcUrl: process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network",
    })
  );

  // Never crash the service over a missing writer key: stay up, report it on /health,
  // and fail loudly per event (see watcher.ts) instead of faking writes.
  const keyStatus = new ArkivSdk().writerKeyStatus;
  const arkivWriter = arkivMemory
    ? "memory"
    : keyStatus === "ok"
      ? "live"
      : keyStatus === "invalid"
        ? "invalid-key"
        : "unconfigured";
  if (arkivWriter !== "live" && arkivWriter !== "memory") {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "WARN",
        stage: "ARKIV_WRITER",
        message:
          arkivWriter === "invalid-key"
            ? "ARKIV_PRIVATE_KEY is set but is not 32 bytes hex (quotes/extra characters?): extractions will NOT be sealed on Arkiv"
            : "ARKIV_PRIVATE_KEY not set: detected extractions will NOT be sealed on Arkiv (set the key, or ARKIV_DEV_MODE=memory for offline runs)",
      })
    );
  }

  const pipeline = new ForensicPipeline({
    demoFast,
  });

  const unwatch = startHookWatcher({
    hookAddress: hookAddresses,
    pipeline,
  });

  const baseClient = createPublicClient({
    chain: baseSepolia,
    transport: viemHttp(process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org"),
  }) as PublicClient;
  const scanner = linkedScan ? startLinkedScanner({ client: baseClient, pools: watchPools, pipeline }) : null;

  // Health check HTTP server for container runtime
  const server = http.createServer((req, res) => {
    const url = req.url || "/";
    if (
      url === "/health" ||
      url === "/" ||
      url.startsWith("/api/indexer/health") ||
      url === "/api/indexer"
    ) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "healthy",
          service: "indexer",
          hookAddress, // kept for existing dashboards: the first watched hook
          hookAddresses,
          arkivWriter,
          linkedScanner: scanner ? scanner.status : { enabled: false },
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.listen(port, () => {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "INFO",
        stage: "HTTP_READY",
        message: `Indexer health server listening on port ${port}`,
      })
    );
  });

  process.on("SIGINT", () => {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "INFO",
        stage: "SHUTDOWN",
        message: "Shutting down indexer gracefully",
      })
    );
    unwatch();
    scanner?.stop();
    server.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "FATAL",
      stage: "CRASH",
      message: err.message,
    })
  );
  process.exit(1);
});
