// Executes a real separate-identity sandwich on Base Sepolia and prepares Arc Testnet v2:
//   1. Ensures RebateVault v2 on Arc Testnet holds >= 5.00 USDC reserve and Victim EOA has Arc gas.
//   2. Ensures Victim EOA (distinct from Operator EOA) has Base Sepolia ETH + tUSDC and router approvals.
//   3. Broadcasts frontrun (Operator EOA) -> victim (Victim EOA) -> backrun (Operator EOA) in one Base Sepolia block.
//   4. Verifies DarkTraceHook emitted ExtractionDetected and writes deployments/e2e-v2-latest.json.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  defineChain,
  encodeFunctionData,
  http,
  keccak256,
  concatHex,
  toHex,
  parseAbi,
  type Hex,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { normalizePrivateKey } from "@darktrace/arkiv";

export function deriveVictimPrivateKey(operatorKey: Hex): Hex {
  const envVictim = normalizePrivateKey(process.env.VICTIM_PRIVATE_KEY);
  if (envVictim) return envVictim;
  return keccak256(concatHex([operatorKey, toHex("darktrace:victim-eoa:v2")]));
}

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: [process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"] } },
});

const ARC_VAULT = (process.env.REBATE_VAULT_ADDRESS || "0x238dE56E52A3F6C6708952052e6a20E5102b4d5b") as Hex;
const ARC_USDC = "0x3600000000000000000000000000000000000000" as const;
const HOOK = (process.env.HOOK_ADDRESS || "0xBCC9e1C474Ed195b3791f2c41EdAC2a25c5b80c0") as Hex;

const MIN_SQRT_PRICE = 4295128739n;
const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342n;

const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
]);

const VAULT_ABI = parseAbi([
  "function depositFunds(uint256 amount)",
]);

const ROUTER_ABI = parseAbi([
  "function swap((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, (bool takeClaims, bool settleUsingBurn) testSettings, bytes hookData) payable returns (int256 delta)",
]);

const HOOK_EVENT_ABI = parseAbi([
  "event ExtractionDetected(bytes32 indexed poolId, address indexed searcher, address indexed victim, uint256 extractedValue, bytes32 proofHash)",
]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sendBatchRawTransactions(rpcUrl: string, rawTxs: [Hex, Hex, Hex]): Promise<[Hex, Hex, Hex]> {
  const payload = rawTxs.map((raw, i) => ({
    jsonrpc: "2.0",
    id: i + 1,
    method: "eth_sendRawTransaction",
    params: [raw],
  }));
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as Array<{ id: number; result?: Hex; error?: { message: string } }>;
  const sorted = [...json].sort((a, b) => a.id - b.id);
  for (const item of sorted) {
    if (item.error || !item.result) {
      throw new Error(`eth_sendRawTransaction[${item.id}] failed: ${item.error?.message ?? "no result"}`);
    }
  }
  return [sorted[0].result!, sorted[1].result!, sorted[2].result!];
}

async function waitForFreshBlock(client: PublicClient, maxWaitMs = 3_000): Promise<bigint> {
  const start = await client.getBlockNumber();
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await sleep(120);
    const cur = await client.getBlockNumber();
    if (cur > start) return cur;
  }
  return start;
}

async function main() {
  const opKey = normalizePrivateKey(process.env.PRIVATE_KEY) || normalizePrivateKey(process.env.ARKIV_PRIVATE_KEY);
  if (!opKey) throw new Error("Set PRIVATE_KEY or ARKIV_PRIVATE_KEY");
  const victimKey = deriveVictimPrivateKey(opKey);

  const opAccount = privateKeyToAccount(opKey);
  const victimAccount = privateKeyToAccount(victimKey);
  if (opAccount.address.toLowerCase() === victimAccount.address.toLowerCase()) {
    throw new Error("Victim EOA must differ from Operator EOA");
  }

  const repoRoot = path.resolve(__dirname, "../../..");
  const deployPath = path.join(repoRoot, "contracts/deployments/e2e-base-sepolia.json");
  if (!fs.existsSync(deployPath)) {
    throw new Error(`Missing ${deployPath}; run E2ESandwich.s.sol setup() first`);
  }
  const deploy = JSON.parse(fs.readFileSync(deployPath, "utf8")) as {
    poolId: Hex;
    token0: Hex;
    token1: Hex;
    searcherRouter: Hex;
    victimRouter: Hex;
  };

  console.log(`Operator / Searcher EOA: ${opAccount.address}`);
  console.log(`Victim LP EOA:           ${victimAccount.address}`);

  // ── 1. Arc Testnet v2 Vault Top-Up & Victim Gas Funding ────────────────────
  const skipArcPrep = process.env.SKIP_ARC_PREP === "1";
  let vaultTopUpTx: Hex | undefined;
  let victimArcFundTx: Hex | undefined;

  if (!skipArcPrep) {
    const arcRpc = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
    const arc = createPublicClient({ chain: arcTestnet, transport: http(arcRpc) });
    const arcOpWallet = createWalletClient({ chain: arcTestnet, transport: http(arcRpc), account: opAccount });

    const vaultBal = await arc.readContract({
      address: ARC_USDC,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [ARC_VAULT],
    });
    const targetReserve = 5_000_000n; // 5.00 USDC
    if (vaultBal < targetReserve) {
      const topUp = targetReserve - vaultBal;
      console.log(`Topping up Arc RebateVault v2 (${ARC_VAULT}) by ${Number(topUp) / 1e6} USDC...`);
      const allow = await arc.readContract({
        address: ARC_USDC,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [opAccount.address, ARC_VAULT],
      });
      if (allow < topUp) {
        const appTx = await arcOpWallet.writeContract({
          address: ARC_USDC,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [ARC_VAULT, topUp],
        });
        await arc.waitForTransactionReceipt({ hash: appTx });
      }
      vaultTopUpTx = await arcOpWallet.writeContract({
        address: ARC_VAULT,
        abi: VAULT_ABI,
        functionName: "depositFunds",
        args: [topUp],
      });
      await arc.waitForTransactionReceipt({ hash: vaultTopUpTx });
      const newVaultBal = await arc.readContract({
        address: ARC_USDC,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [ARC_VAULT],
      });
      console.log(`  RebateVault v2 reserve: ${Number(newVaultBal) / 1e6} USDC (depositTx ${vaultTopUpTx})`);
    } else {
      console.log(`Arc RebateVault v2 reserve already >= 5.00 USDC (${Number(vaultBal) / 1e6} USDC)`);
    }

    const vicArcBal = await arc.readContract({
      address: ARC_USDC,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [victimAccount.address],
    });
    if (vicArcBal < 250_000n) {
      console.log(`Funding Victim EOA on Arc Testnet with 0.50 USDC for claim gas...`);
      victimArcFundTx = await arcOpWallet.writeContract({
        address: ARC_USDC,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [victimAccount.address, 500_000n],
      });
      await arc.waitForTransactionReceipt({ hash: victimArcFundTx });
      console.log(`  Victim Arc gas funded (tx ${victimArcFundTx})`);
    }
  }

  // ── 2. Base Sepolia Account Funding & Router Approvals ─────────────────────
  const baseRpc = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
  const base = createPublicClient({ chain: baseSepolia, transport: http(baseRpc) }) as PublicClient;
  const baseOpWallet = createWalletClient({ chain: baseSepolia, transport: http(baseRpc), account: opAccount });
  const baseVicWallet = createWalletClient({ chain: baseSepolia, transport: http(baseRpc), account: victimAccount });

  const [vicEth, vicUsdc, opAllow0, opAllow1, vicAllow0] = await Promise.all([
    base.getBalance({ address: victimAccount.address }),
    base.readContract({ address: deploy.token0, abi: ERC20_ABI, functionName: "balanceOf", args: [victimAccount.address] }),
    base.readContract({ address: deploy.token0, abi: ERC20_ABI, functionName: "allowance", args: [opAccount.address, deploy.searcherRouter] }),
    base.readContract({ address: deploy.token1, abi: ERC20_ABI, functionName: "allowance", args: [opAccount.address, deploy.searcherRouter] }),
    base.readContract({ address: deploy.token0, abi: ERC20_ABI, functionName: "allowance", args: [victimAccount.address, deploy.victimRouter] }),
  ]);

  if (vicEth < 400_000_000_000_000n) {
    console.log("Funding Victim EOA on Base Sepolia with 0.0008 ETH for swap gas...");
    const tx = await baseOpWallet.sendTransaction({ to: victimAccount.address, value: 800_000_000_000_000n });
    await base.waitForTransactionReceipt({ hash: tx });
  }
  if (vicUsdc < 1_000_000_000n) {
    console.log("Funding Victim EOA on Base Sepolia with 2,000 tUSDC...");
    const tx = await baseOpWallet.writeContract({
      address: deploy.token0,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [victimAccount.address, 2_000_000_000n],
    });
    await base.waitForTransactionReceipt({ hash: tx });
  }
  const maxUint = (1n << 256n) - 1n;
  if (opAllow0 < 10_000_000_000n) {
    const tx = await baseOpWallet.writeContract({
      address: deploy.token0,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [deploy.searcherRouter, maxUint],
    });
    await base.waitForTransactionReceipt({ hash: tx });
  }
  if (opAllow1 < 10_000_000_000_000_000_000n) {
    const tx = await baseOpWallet.writeContract({
      address: deploy.token1,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [deploy.searcherRouter, maxUint],
    });
    await base.waitForTransactionReceipt({ hash: tx });
  }
  if (vicAllow0 < 10_000_000_000n) {
    const tx = await baseVicWallet.writeContract({
      address: deploy.token0,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [deploy.victimRouter, maxUint],
    });
    await base.waitForTransactionReceipt({ hash: tx });
  }

  // ── 3. Execute 3-Tx Separate-Identity Sandwich in One Base Sepolia Block ──
  const poolKey = {
    currency0: deploy.token0,
    currency1: deploy.token1,
    fee: 3000,
    tickSpacing: 60,
    hooks: HOOK,
  } as const;
  const settings = { takeClaims: false, settleUsingBurn: false } as const;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { result: simDelta } = await base.simulateContract({
      address: deploy.searcherRouter,
      abi: ROUTER_ABI,
      functionName: "swap",
      args: [
        poolKey,
        { zeroForOne: true, amountSpecified: -200_000_000n, sqrtPriceLimitX96: MIN_SQRT_PRICE + 1n },
        settings,
        "0x",
      ],
      account: opAccount,
    });
    const rawLow128 = BigInt.asIntN(128, simDelta & ((1n << 128n) - 1n));
    const backrunIn = rawLow128 > 0n ? rawLow128 : -rawLow128;

    const [opNonce, vicNonce, block] = await Promise.all([
      base.getTransactionCount({ address: opAccount.address }),
      base.getTransactionCount({ address: victimAccount.address }),
      base.getBlock(),
    ]);
    const baseFee = (block.baseFeePerGas ?? 1_000_000n) * 2n + 100_000_000n;

    const rawTx1 = await baseOpWallet.signTransaction({
      to: deploy.searcherRouter,
      data: encodeFunctionData({
        abi: ROUTER_ABI,
        functionName: "swap",
        args: [
          poolKey,
          { zeroForOne: true, amountSpecified: -200_000_000n, sqrtPriceLimitX96: MIN_SQRT_PRICE + 1n },
          settings,
          "0x",
        ],
      }),
      nonce: opNonce,
      gas: 350_000n,
      maxFeePerGas: baseFee + 50_000_000n,
      maxPriorityFeePerGas: 50_000_000n, // 0.05 gwei (1st in block: searcher frontrun)
      chain: baseSepolia,
    });

    const rawTx2 = await baseVicWallet.signTransaction({
      to: deploy.victimRouter,
      data: encodeFunctionData({
        abi: ROUTER_ABI,
        functionName: "swap",
        args: [
          poolKey,
          { zeroForOne: true, amountSpecified: -1_000_000_000n, sqrtPriceLimitX96: MIN_SQRT_PRICE + 1n },
          settings,
          "0x",
        ],
      }),
      nonce: vicNonce,
      gas: 350_000n,
      maxFeePerGas: baseFee + 30_000_000n,
      maxPriorityFeePerGas: 30_000_000n, // 0.03 gwei (2nd in block: victim swap signed by Victim EOA)
      chain: baseSepolia,
    });

    const rawTx3 = await baseOpWallet.signTransaction({
      to: deploy.searcherRouter,
      data: encodeFunctionData({
        abi: ROUTER_ABI,
        functionName: "swap",
        args: [
          poolKey,
          { zeroForOne: false, amountSpecified: -backrunIn, sqrtPriceLimitX96: MAX_SQRT_PRICE - 1n },
          settings,
          "0x",
        ],
      }),
      nonce: opNonce + 1,
      gas: 400_000n,
      maxFeePerGas: baseFee + 10_000_000n,
      maxPriorityFeePerGas: 10_000_000n, // 0.01 gwei (3rd in block: searcher backrun)
      chain: baseSepolia,
    });

    await waitForFreshBlock(base);
    const [h1, h2, h3] = await sendBatchRawTransactions(baseRpc, [rawTx1, rawTx2, rawTx3]);
    const [r1, r2, r3] = await Promise.all([
      base.waitForTransactionReceipt({ hash: h1 }),
      base.waitForTransactionReceipt({ hash: h2 }),
      base.waitForTransactionReceipt({ hash: h3 }),
    ]);

    console.log(`Attempt ${attempt}:`);
    console.log(`  frontrun (Operator): ${h1} (block ${r1.blockNumber}, idx ${r1.transactionIndex})`);
    console.log(`  victim   (Victim):   ${h2} (block ${r2.blockNumber}, idx ${r2.transactionIndex})`);
    console.log(`  backrun  (Operator): ${h3} (block ${r3.blockNumber}, idx ${r3.transactionIndex})`);

    const hookLog = r3.logs.find((l) => l.address.toLowerCase() === HOOK.toLowerCase());
    if (hookLog) {
      const { args } = decodeEventLog({ abi: HOOK_EVENT_ABI, data: hookLog.data, topics: hookLog.topics });
      console.log(`  ExtractionDetected emitted in backrun tx ${h3} (proofHash ${args.proofHash})`);

      const outPath = path.join(repoRoot, "contracts/deployments/e2e-v2-latest.json");
      fs.writeFileSync(
        outPath,
        JSON.stringify(
          {
            poolId: deploy.poolId,
            blockNumber: Number(r3.blockNumber),
            operatorEOA: opAccount.address,
            victimEOA: victimAccount.address,
            frontrunTx: h1,
            victimTx: h2,
            backrunTx: h3,
            vaultTopUpTx,
            victimArcFundTx,
          },
          null,
          2
        ) + "\n"
      );
      return;
    }

    console.warn("  Transactions split across block boundary; retrying at next block boundary...");
  }

  throw new Error("Failed to land all 3 sandwich transactions in the same block after 2 attempts");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("FAILED", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
