// Final leg of the real end-to-end run: find the sealed receipt on Arkiv, wait for its Arc
// attestation, then claim the USDC restitution from RebateVault.
//
// Usage: pnpm --filter @darktrace/indexer claim <poolId> <baseBlockNumber> [recipient] [existingClaimTx]
//   existingClaimTx: backfill the Arkiv LPClaim for a rebate that was already claimed on Arc.
// Env:   ARKIV_PRIVATE_KEY (or ARC_PRIVATE_KEY) — the wallet that sends the claim on Arc.
import "dotenv/config";
import { createPublicClient, createWalletClient, defineChain, http, parseAbi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arkiv, normalizePrivateKey } from "@darktrace/arkiv";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: [process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"] } },
});
const REGISTRY = (process.env.SIMULATION_REGISTRY_ADDRESS || "0xb8416cb4d82BA72b70C3EC55d7AC66b5DB415CF8") as Hex;
const VAULT = (process.env.REBATE_VAULT_ADDRESS || "0x2ab745F51002Ce236A9A2dA81cDaA553B87f28CD") as Hex;
const USDC = "0x3600000000000000000000000000000000000000" as const;

const ABI = parseAbi([
  "function getAttestation(bytes32 receiptHash) view returns (bool verified, uint256 amountUSDC, bytes32 simHash)",
  "function claimedReceipts(bytes32) view returns (bool)",
  "function beneficiaryOf(bytes32) view returns (address)",
  "function claimRebate(bytes32 receiptHash, address recipient, uint256 amountUSDC, bytes proofBundle)",
  "function balanceOf(address) view returns (uint256)",
]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [poolId, blockArg, recipientArg, existingClaimTx] = process.argv.slice(2);
  if (!poolId || !blockArg) {
    console.error("usage: claim <poolId> <baseBlockNumber> [recipient]");
    process.exit(1);
  }
  const key = normalizePrivateKey(process.env.ARC_PRIVATE_KEY) || normalizePrivateKey(process.env.ARKIV_PRIVATE_KEY);
  if (!key) throw new Error("set ARKIV_PRIVATE_KEY (or ARC_PRIVATE_KEY) to the claiming wallet's key");
  const account = privateKeyToAccount(key);
  const recipient = (recipientArg || account.address) as Hex;

  // 1. The receipt as sealed on Arkiv (whichever indexer wrote it).
  const block = Number(blockArg);
  let receipt;
  for (let i = 0; i < 24 && !receipt; i++) {
    receipt = (await arkiv().listReceiptsByPool(poolId)).find((r) => r.blockNumber === block);
    if (!receipt) await sleep(5_000);
  }
  if (!receipt) throw new Error(`no Arkiv receipt for pool ${poolId} at block ${block}`);
  console.log(`Arkiv receipt ${receipt.receiptHash} ($key ${receipt.arkivEntityKey}) — ${receipt.extractedUSDC} USDC`);

  // 2. Wait for the SimulationRegistry attestation on Arc.
  const arc = createPublicClient({ chain: arcTestnet, transport: http() });
  const rh = receipt.receiptHash as Hex;
  let att: readonly [boolean, bigint, Hex] = [false, 0n, "0x"];
  for (let i = 0; i < 24 && !att[0]; i++) {
    att = await arc.readContract({ address: REGISTRY, abi: ABI, functionName: "getAttestation", args: [rh] });
    if (!att[0]) await sleep(5_000);
  }
  if (!att[0]) throw new Error(`receipt ${rh} is not attested in SimulationRegistry ${REGISTRY}`);
  console.log(`Attested on Arc: ${att[1]} raw USDC (simulationHash ${att[2]})`);

  // v2 registries name the only wallet allowed to claim; fail early with a clear message.
  const beneficiary = await arc
    .readContract({ address: REGISTRY, abi: ABI, functionName: "beneficiaryOf", args: [rh] })
    .catch(() => null); // v1 registry: no beneficiary binding
  if (beneficiary && beneficiary.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`only the beneficiary ${beneficiary} can claim this rebate (signer is ${account.address})`);
  }
  if (beneficiary) console.log(`Beneficiary: ${beneficiary} (signer matches)`);

  if (await arc.readContract({ address: VAULT, abi: ABI, functionName: "claimedReceipts", args: [rh] })) {
    console.log("Already claimed on Arc.");
    if (existingClaimTx) await recordClaimOnArkiv(rh, recipient, existingClaimTx as Hex);
    else console.log("Pass the claim tx as the 4th argument to record the LPClaim on Arkiv.");
    return;
  }

  // 3. Claim the full attested amount.
  const before = await arc.readContract({ address: USDC, abi: ABI, functionName: "balanceOf", args: [VAULT] });
  const wallet = createWalletClient({ chain: arcTestnet, transport: http(), account });
  const tx = await wallet.writeContract({ address: VAULT, abi: ABI, functionName: "claimRebate", args: [rh, recipient, att[1], "0x"] });
  const mined = await arc.waitForTransactionReceipt({ hash: tx });
  if (mined.status !== "success") throw new Error(`claimRebate reverted (tx ${tx})`);
  const after = await arc.readContract({ address: USDC, abi: ABI, functionName: "balanceOf", args: [VAULT] });

  console.log(`\nRebate claimed: ${Number(att[1]) / 1e6} USDC -> ${recipient}`);
  console.log(`Vault reserve: ${Number(before) / 1e6} -> ${Number(after) / 1e6} USDC`);
  console.log(`Arc tx: ${tx}`);
  await recordClaimOnArkiv(rh, recipient, tx);
}

/** Seals the restitution as an LPClaim entity on Arkiv (once per receipt). */
async function recordClaimOnArkiv(receiptHash: Hex, lp: Hex, claimTx: Hex) {
  const sdk = arkiv();
  if (await sdk.claimForReceipt(receiptHash)) {
    console.log("LPClaim already on Arkiv.");
    return;
  }
  const { entityKey } = await sdk.writeLPClaim({ v: "1.0.0", lp, receiptHash, claimTx, createdAt: Date.now() });
  console.log(`LPClaim sealed on Arkiv: https://rabdi.explorer.arkiv.network/entity/${entityKey}`);
}

main().catch((err) => {
  console.error("FAILED", err instanceof Error ? err.message : err);
  process.exit(1);
});
