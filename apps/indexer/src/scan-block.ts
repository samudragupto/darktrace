// Runs the linked-origin scanner over one block (or a range) and, unless --seal, prints what the
// pipeline would seal without writing anything.
//   pnpm --filter @darktrace/indexer exec tsx src/scan-block.ts <fromBlock> [toBlock] [--seal]
import "dotenv/config";
import { createPublicClient, http, type PublicClient } from "viem";
import { baseSepolia } from "viem/chains";
import { ArkivClient } from "@darktrace/arkiv";
import { scanRange } from "./linked-scanner";
import { ForensicPipeline } from "./pipeline";

const POOLS = (
  process.env.WATCH_POOLS ||
  "0x2183dce5625ecbb1cf175be52a75b31eeed7bf7774181e3136ba49f6fc3c676c,0x5d78af67b033875696613c57b5a68f4a62eba0d98095844b0e9c8c691afc63df"
)
  .split(",")
  .map((p) => p.trim()) as `0x${string}`[];

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const seal = process.argv.includes("--seal");
  if (!args[0]) throw new Error("usage: scan-block <fromBlock> [toBlock] [--seal]");
  const from = BigInt(args[0]);
  const to = BigInt(args[1] ?? args[0]);
  if (!seal) process.env.ARC_PRIVATE_KEY = process.env.ARKIV_PRIVATE_KEY = "";

  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org"),
  }) as PublicClient;
  const found = await scanRange(client, POOLS, from, to);
  console.log(`LINKED_CANDIDATES ${found.length} in blocks ${from}..${to}`);

  const pipeline = new ForensicPipeline({
    baseClient: client,
    demoFast: false,
    ...(seal ? {} : { arkivClient: new ArkivClient({ devMode: "memory" }) }),
  });
  for (const { poolId, blockNumber, sandwich } of found) {
    console.log(
      `  pool ${poolId.slice(0, 10)}… block ${blockNumber} searcherEOA ${sandwich.searcherOrigin} ` +
        `frontrun via ${sandwich.frontrun.sender.slice(0, 10)}… backrun via ${sandwich.backrun.sender.slice(0, 10)}… victimEOA ${sandwich.victim.origin}`
    );
    const r = await pipeline.processExtraction({
      poolId,
      searcher: sandwich.searcherOrigin,
      victim: sandwich.victim.sender,
      extractedValue: 0n,
      proofHash: sandwich.backrun.txHash,
      blockNumber: Number(blockNumber),
      txHash: sandwich.backrun.txHash,
      logIndex: sandwich.backrun.logIndex,
      detection: "linked-origin",
    });
    if (r) {
      console.log(
        `  RECEIPT ${seal ? "sealed" : "(dry run)"} loss=${r.receipt.extractedUSDC} USDC injected=${r.receipt.injectedSlippageBps}bps ` +
          `legit=${r.receipt.legitSlippageBps}bps beneficiary=${r.receipt.lp} detection=${r.receipt.detection}`
      );
    }
  }
}

main().catch((e) => {
  console.error("FAILED", e instanceof Error ? e.message : e);
  process.exit(1);
});
