import test from "node:test";
import assert from "node:assert/strict";
import type { Hex } from "viem";
import { findLinkedSandwiches, type OriginSwap } from "./onchain";

// Swap values from the verified sandwich on pool 0x2183…676c (block 55,113,190): frontrun 200 tUSDC,
// victim 1,000 tUSDC, backrun returns 202.43 tUSDC. Liquidity 2e15, fee 0.30%.
const L = 2_000_000_000_000_000n;
const SEARCHER_EOA = "0xb491fe5846DE735B6Cb03a677A3C6296FAB0aDA5" as Hex;
const VICTIM_EOA = "0x524e061C89036b12a4f377bD8999038Da3A551Db" as Hex;
const ROUTER_A = "0xc31545299093C46d87752cD6378A811BFDD9940D" as Hex; // searcher's frontrun contract
const ROUTER_B = "0x00000000000000000000000000000000000000B2" as Hex; // searcher's second (backrun) contract
const VICTIM_ROUTER = "0x942823FD44c68d77Ad631f0aa4DEA35143E52488" as Hex;

const mk = (o: Partial<OriginSwap> & Pick<OriginSwap, "sender" | "origin" | "zeroForOne" | "amount0" | "amount1" | "tick" | "sqrtPriceX96After">, i: number): OriginSwap => {
  const amountInGross = o.zeroForOne ? -o.amount0 : -o.amount1;
  return {
    liquidity: L,
    fee: 3000,
    txHash: `0x${String(i).repeat(64)}` as Hex,
    logIndex: i,
    amountInGross,
    amountInNet: (amountInGross * 997_000n) / 1_000_000n,
    ...o,
  };
};

const frontrun = (sender: Hex, origin: Hex) =>
  mk({ sender, origin, zeroForOne: true, amount0: -200_000_000n, amount1: 66_370_112_633_809_093n, tick: 196223, sqrtPriceX96After: 1444136703318398671528530784802494n }, 1);
const victim = (origin: Hex) =>
  mk({ sender: VICTIM_ROUTER, origin, zeroForOne: true, amount0: -1_000_000_000n, amount1: 328_264_736_288_198_190n, tick: 196042, sqrtPriceX96After: 1431132797381226925493802983826653n }, 2);
const backrun = (sender: Hex, origin: Hex, amount0 = 202_428_787n) =>
  mk({ sender, origin, zeroForOne: false, amount0, amount1: -66_370_112_633_809_093n, tick: 196079, sqrtPriceX96After: 1433754100843042891035436764454077n }, 3);

test("catches the split-contract evasion: different contracts, same signing EOA", () => {
  const found = findLinkedSandwiches([frontrun(ROUTER_A, SEARCHER_EOA), victim(VICTIM_EOA), backrun(ROUTER_B, SEARCHER_EOA)]);
  assert.equal(found.length, 1);
  assert.equal(found[0].searcherOrigin, SEARCHER_EOA);
  assert.equal(found[0].victim.origin, VICTIM_EOA);
});

test("leaves same-contract sandwiches to the on-chain hook (no duplicate)", () => {
  assert.equal(findLinkedSandwiches([frontrun(ROUTER_A, SEARCHER_EOA), victim(VICTIM_EOA), backrun(ROUTER_A, SEARCHER_EOA)]).length, 0);
});

test("does not flag two independent traders (different signers on the outer legs)", () => {
  const other = "0x000000000000000000000000000000000000C0DE" as Hex;
  assert.equal(findLinkedSandwiches([frontrun(ROUTER_A, SEARCHER_EOA), victim(VICTIM_EOA), backrun(ROUTER_B, other)]).length, 0);
});

test("does not flag when the 'victim' is the searcher itself", () => {
  assert.equal(findLinkedSandwiches([frontrun(ROUTER_A, SEARCHER_EOA), victim(SEARCHER_EOA), backrun(ROUTER_B, SEARCHER_EOA)]).length, 0);
});

test("does not flag an unprofitable round trip (e.g. a rebalance that lost money)", () => {
  assert.equal(
    findLinkedSandwiches([frontrun(ROUTER_A, SEARCHER_EOA), victim(VICTIM_EOA), backrun(ROUTER_B, SEARCHER_EOA, 199_000_000n)]).length,
    0
  );
});

test("does not flag when the swaps are not adjacent around the victim", () => {
  const noise = mk({ sender: VICTIM_ROUTER, origin: VICTIM_EOA, zeroForOne: false, amount0: 1n, amount1: -1n, tick: 196100, sqrtPriceX96After: 1434000000000000000000000000000000n }, 4);
  const swaps = [frontrun(ROUTER_A, SEARCHER_EOA), noise, victim(VICTIM_EOA), backrun(ROUTER_B, SEARCHER_EOA)].map((s, i) => ({ ...s, logIndex: i }));
  assert.equal(findLinkedSandwiches(swaps).length, 0);
});
