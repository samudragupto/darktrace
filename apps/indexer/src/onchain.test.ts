import test from "node:test";
import assert from "node:assert/strict";
import { encodeAbiParameters, encodeEventTopics, parseAbi, parseAbiParameters, type Hex, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { runCounterfactualSimulation } from "@darktrace/simulator";
import { reconstructSandwich, sqrtPriceBefore, type OnchainSwap } from "./onchain";
import { deriveVictimPrivateKey } from "./e2e-sandwich";

// Swap events captured from a real E2ESandwich bundle executed against the deployed
// DarkTraceHook + PoolManager on a Base Sepolia fork (pool started at tick 196260).
const L = 2_000_000_000_000_000n;
const swap = (o: Partial<OnchainSwap> & Pick<OnchainSwap, "zeroForOne" | "amountInGross" | "sqrtPriceX96After">): OnchainSwap => ({
  sender: "0x0000000000000000000000000000000000000000",
  liquidity: L,
  tick: 0,
  fee: 3000,
  txHash: "0x00",
  logIndex: 0,
  amount0: 0n,
  amount1: 0n,
  amountInNet: (o.amountInGross * 997_000n) / 1_000_000n,
  ...o,
});

const frontrun = swap({ zeroForOne: true, amountInGross: 200_000_000n, sqrtPriceX96After: 1444136703318398671528530784802494n, tick: 196223 });
const victim = swap({ zeroForOne: true, amountInGross: 1_000_000_000n, sqrtPriceX96After: 1431132797381226925493802983826653n, tick: 196042 });

const tickOf = (sqrtX96: bigint) => {
  const p = Number(sqrtX96) / 2 ** 96;
  return Math.floor(Math.log(p * p) / Math.log(1.0001));
};

test("pre-attack price is recovered exactly from the frontrun's own Swap event", () => {
  assert.equal(tickOf(sqrtPriceBefore(frontrun)), 196260);
});

test("victim's pre-swap price equals the frontrun's post-swap price", () => {
  const derived = sqrtPriceBefore(victim);
  const diff = derived > frontrun.sqrtPriceX96After ? derived - frontrun.sqrtPriceX96After : frontrun.sqrtPriceX96After - derived;
  // rounding only: < 1e-12 relative
  assert.ok(diff * 1_000_000_000_000n < frontrun.sqrtPriceX96After, `diff ${diff}`);
});

test("counterfactual on the real bundle yields a positive loss below the victim's notional", () => {
  const Q96 = 1n << 96n;
  const pre = sqrtPriceBefore(frontrun);
  const sim = runCounterfactualSimulation({
    poolId: "0xb78726fa11c35fdb1f60f78b58dbb55116a87b53abd0d7babd15102e77e07298",
    blockNumber: 1,
    searcherTxs: {
      frontrun: { sender: "0x1", zeroForOne: true, amountSpecified: -frontrun.amountInNet },
      backrun: { sender: "0x1", zeroForOne: false, amountSpecified: -1n },
    },
    victimSwap: { sender: "0x2", zeroForOne: true, amountSpecified: -victim.amountInNet },
    preAttackReserve0: (L * Q96) / pre,
    preAttackReserve1: (L * pre) / Q96,
  });
  assert.ok(sim.extractedUSDCRaw > 0n);
  assert.ok(sim.extractedUSDCRaw < 1_000_000_000n); // < the 1,000 tUSDC the victim swapped
  assert.equal(sim.extractedUSDC, "3.57");
});

test("reconstructSandwich attributes beneficiary to Victim EOA across 3 separate transactions", async () => {
  const operatorKey = "0x1111111111111111111111111111111111111111111111111111111111111111" as const;
  const victimKey = deriveVictimPrivateKey(operatorKey);
  const operatorEOA = privateKeyToAccount(operatorKey).address;
  const victimEOA = privateKeyToAccount(victimKey).address;
  assert.notEqual(operatorEOA.toLowerCase(), victimEOA.toLowerCase());

  const poolId = "0x2183dce5625ecbb1cf175be52a75b31eeed7bf7774181e3136ba49f6fc3c676c" as const;
  const searcherRouter = "0xc31545299093C46d87752cD6378A811BFDD9940D" as const;
  const victimRouter = "0x942823FD44c68d77Ad631f0aa4DEA35143E52488" as const;
  const tx1 = "0xaaa1111111111111111111111111111111111111111111111111111111111111" as const;
  const tx2 = "0xbbb2222222222222222222222222222222222222222222222222222222222222" as const;
  const tx3 = "0xccc3333333333333333333333333333333333333333333333333333333333333" as const;

  const swapAbi = parseAbi([
    "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)",
  ]);
  const makeLog = (
    sender: Hex,
    amount0: bigint,
    amount1: bigint,
    sqrtPriceX96: bigint,
    tick: number,
    txHash: Hex,
    logIndex: number
  ) => ({
    topics: encodeEventTopics({ abi: swapAbi, eventName: "Swap", args: { id: poolId, sender } }),
    data: encodeAbiParameters(
      parseAbiParameters("int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee"),
      [amount0, amount1, sqrtPriceX96, L, tick, 3000]
    ),
    transactionHash: txHash,
    logIndex,
  });

  const mockClient = {
    getLogs: async () => [
      makeLog(searcherRouter, -200_000_000n, 66_000_000_000_000_000n, frontrun.sqrtPriceX96After, 196223, tx1, 1),
      makeLog(victimRouter, -1_000_000_000n, 328_000_000_000_000_000n, victim.sqrtPriceX96After, 196042, tx2, 2),
      makeLog(searcherRouter, 202_428_787n, -66_000_000_000_000_000n, 1433700000000000000000000000000000n, 196079, tx3, 3),
    ],
    getTransaction: async ({ hash }: { hash: Hex }) => ({
      from: hash === tx2 ? victimEOA : operatorEOA,
    }),
  } as unknown as PublicClient;

  const reconstructed = await reconstructSandwich(mockClient, {
    poolId,
    blockNumber: 55150000n,
    searcher: searcherRouter,
    victim: victimRouter,
    detectedLogIndex: 4,
  });

  assert.equal(reconstructed.victimOrigin.toLowerCase(), victimEOA.toLowerCase());
  assert.notEqual(reconstructed.victimOrigin.toLowerCase(), operatorEOA.toLowerCase());
  assert.deepEqual(reconstructed.txHashes, [tx1, tx2, tx3]);
});
