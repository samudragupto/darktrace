import { ArkivClient, ExtractionReceipt, normalizePrivateKey } from "@darktrace/arkiv";
import { runCounterfactualSimulation, SimulationInput } from "@darktrace/simulator";
import { createWalletClient, createPublicClient, http, parseAbi, defineChain, type PublicClient } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { reconstructSandwich } from "./onchain";

/** Foundry SimulationRegistry that the funded RebateVault verifies against. */
const DEFAULT_SIMULATION_REGISTRY = "0xb8416cb4d82BA72b70C3EC55d7AC66b5DB415CF8" as const;

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});

export interface ExtractionEventPayload {
  poolId: `0x${string}`;
  searcher: `0x${string}`;
  victim: `0x${string}`;
  extractedValue: bigint;
  proofHash: `0x${string}`;
  blockNumber: number;
  txHash?: `0x${string}`;
  /** Log index of ExtractionDetected inside the block (bounds the swap search). */
  logIndex?: number;
}

export interface PipelineConfig {
  arkivClient?: ArkivClient;
  demoFast?: boolean;
  arcRpcUrl?: string;
  arcPrivateKey?: `0x${string}`;
  simulationRegistryAddress?: `0x${string}`;
  /** Base Sepolia client used to rebuild the sandwich from PoolManager Swap events. */
  baseClient?: PublicClient;
  baseRpcUrl?: string;
}

export interface ProcessedPipelineResult {
  receipt: ExtractionReceipt;
  receiptHash: string;
  /** Arkiv $key of the sealed receipt (undefined in memory mode). */
  arkivEntityKey?: string;
  arkivTxHash?: string;
  simulationHash: string;
  attestedOnArc: boolean;
  arcTxHash?: string;
}

const SIMULATION_REGISTRY_V2_ABI = parseAbi([
  "function recordSimulation(bytes32 simulationHash, bytes32 receiptHash, uint256 extractedUSDC, address beneficiary) external",
]);

const SIMULATION_REGISTRY_ABI = parseAbi([
  "function recordSimulation(bytes32 simulationHash, bytes32 receiptHash, uint256 extractedUSDC) external",
  "function beneficiaryOf(bytes32 receiptHash) external view returns (address)",
  "function getAttestation(bytes32 receiptHash) external view returns (bool verified, uint256 amountUSDC, bytes32 simHash)"
]);

export class ForensicPipeline {
  private arkiv: ArkivClient;
  private demoFast: boolean;
  private arcRpcUrl: string;
  private arcPrivateKey?: `0x${string}`;
  private simulationRegistryAddress?: `0x${string}`;
  private baseClient: PublicClient;

  // Deduplication cache to prevent re-processing identical proof hashes
  private processedHashes: Set<string> = new Set();

  constructor(config: PipelineConfig = {}) {
    this.arkiv = config.arkivClient || new ArkivClient();
    this.demoFast = config.demoFast ?? (process.env.DEMO_FAST === "1");
    this.arcRpcUrl = config.arcRpcUrl || process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
    // The same writer wallet (0xb491…aDA5) owns SimulationRegistry, so ARKIV_PRIVATE_KEY is the fallback.
    this.arcPrivateKey =
      config.arcPrivateKey ||
      normalizePrivateKey(process.env.ARC_PRIVATE_KEY) ||
      normalizePrivateKey(process.env.ARKIV_PRIVATE_KEY) ||
      undefined;
    this.simulationRegistryAddress =
      config.simulationRegistryAddress ||
      (process.env.SIMULATION_REGISTRY_ADDRESS as `0x${string}` | undefined) ||
      DEFAULT_SIMULATION_REGISTRY;
    this.baseClient =
      config.baseClient ||
      (createPublicClient({
        chain: baseSepolia,
        transport: http(config.baseRpcUrl || process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org"),
      }) as PublicClient);
  }

  /**
   * Main pipeline entry: Event -> Simulator -> Arkiv -> Arc SimulationRegistry
   */
  async processExtraction(event: ExtractionEventPayload): Promise<ProcessedPipelineResult | null> {
    const proofKey = event.proofHash.toLowerCase();

    // 1. Deduplication
    if (this.processedHashes.has(proofKey)) {
      this.log("WARN", "DEDUPE", "Skipping duplicate extraction event", { proofHash: event.proofHash });
      return null;
    }
    this.processedHashes.add(proofKey);

    this.log("INFO", "DETECTED", "Hook extraction fingerprint observed", {
      poolId: event.poolId,
      searcher: event.searcher,
      victim: event.victim,
      blockNumber: event.blockNumber,
      proofHash: event.proofHash,
    });

    // Cross-process dedupe: the in-memory set above only covers this process. If another indexer
    // (e.g. the deployed watcher vs. the process-tx CLI) already sealed this sandwich, skip it.
    const sealed = (await this.arkiv.getByPool(event.poolId)).find(
      (r) => r.blockNumber === event.blockNumber && r.searcher.toLowerCase() === event.searcher.toLowerCase()
    );
    if (sealed) {
      this.log("WARN", "DEDUPE", "Sandwich already sealed on Arkiv; skipping", {
        poolId: event.poolId,
        blockNumber: event.blockNumber,
      });
      return null;
    }

    // 2. Counterfactual Simulation
    let simulationHash: `0x${string}`;
    let extractedUSDC: string;
    let extractedUSDCRaw: bigint;
    let injectedSlippageBps: number;
    let legitSlippageBps: number;
    let onchainTxHashes: string[] | undefined;
    let beneficiary: `0x${string}` = event.victim;

    if (this.demoFast) {
      // Deterministic fast simulation calculation
      const simInput: SimulationInput = {
        poolId: event.poolId,
        blockNumber: event.blockNumber,
        searcherTxs: {
          frontrun: {
            sender: event.searcher,
            zeroForOne: true,
            amountSpecified: 50_000_000_000n,
          },
          backrun: {
            sender: event.searcher,
            zeroForOne: false,
            amountSpecified: 15_000_000_000_000_000_000n,
          },
        },
        victimSwap: {
          sender: event.victim,
          zeroForOne: true,
          amountSpecified: 100_000_000_000n,
        },
      };

      const simResult = runCounterfactualSimulation(simInput);
      simulationHash = simResult.simulationHash;
      extractedUSDC = simResult.extractedUSDC;
      extractedUSDCRaw = simResult.extractedUSDCRaw;
      injectedSlippageBps = simResult.injectedSlippageBps;
      legitSlippageBps = simResult.legitSlippageBps;

      this.log("INFO", "SIMULATED", "Deterministic simulation computed (DEMO_FAST=1)", {
        extractedUSDC,
        injectedSlippageBps,
        legitSlippageBps,
        simulationHash,
      });
    } else {
      // Rebuild the real frontrun / victim / backrun from the PoolManager's Swap events.
      const sandwich = await reconstructSandwich(this.baseClient, {
        poolId: event.poolId,
        blockNumber: BigInt(event.blockNumber),
        searcher: event.searcher,
        victim: event.victim,
        detectedLogIndex: event.logIndex,
      });
      onchainTxHashes = sandwich.txHashes;
      beneficiary = sandwich.victimOrigin;
      const simInput: SimulationInput = sandwich.simulationInput;

      this.log("INFO", "RECONSTRUCTED", "Sandwich rebuilt from PoolManager Swap events", {
        frontrunIn: sandwich.frontrun.amountInGross.toString(),
        victimIn: sandwich.victim.amountInGross.toString(),
        backrunIn: sandwich.backrun.amountInGross.toString(),
        ticks: [sandwich.frontrun.tick, sandwich.victim.tick, sandwich.backrun.tick],
        preAttackSqrtPriceX96: sandwich.preAttackSqrtPriceX96.toString(),
      });

      const simResult = runCounterfactualSimulation(simInput);
      simulationHash = simResult.simulationHash;
      extractedUSDC = simResult.extractedUSDC;
      extractedUSDCRaw = simResult.extractedUSDCRaw;
      injectedSlippageBps = simResult.injectedSlippageBps;
      legitSlippageBps = simResult.legitSlippageBps;

      this.log("INFO", "SIMULATED", "Counterfactual computed against pre-attack reserves using constant-product pricing", {
        extractedUSDC,
        injectedSlippageBps,
        simulationHash,
      });
    }

    // 3. Write Immutable Forensic Receipt to Arkiv
    const receipt: ExtractionReceipt = {
      v: "1.0.0",
      poolId: event.poolId,
      searcher: event.searcher,
      victim: event.victim,
      // Restitution beneficiary: the wallet that signed the victim swap (the hook only sees its router).
      lp: beneficiary,
      blockNumber: event.blockNumber,
      extractedUSDC,
      injectedSlippageBps,
      legitSlippageBps,
      simulationHash,
      // Real frontrun / victim / backrun tx hashes (identical when the sandwich landed as one bundle).
      txHashes: onchainTxHashes ?? (event.txHash ? [event.txHash, event.txHash, event.txHash] : []),
      createdAt: Date.now(),
    };

    const {
      receiptHash,
      entityId,
      entityKey: arkivEntityKey,
      arkivTxHash,
    } = await this.arkiv.writeExtractionReceipt(receipt);

    this.log("INFO", "ARCHIVED", arkivEntityKey
      ? "Forensic receipt sealed to Arkiv Rabdi"
      : "Forensic receipt stored in memory (ARKIV_DEV_MODE=memory, not on Arkiv)", {
      receiptHash,
      entityId,
      arkivEntityKey,
      arkivTxHash,
      explorer: arkivEntityKey ? `https://rabdi.explorer.arkiv.network/entity/${arkivEntityKey}` : undefined,
      searcher: receipt.searcher,
    });

    // 4. Attest to SimulationRegistry on Arc
    let attestedOnArc = false;
    let arcTxHash: string | undefined;

    if (this.arcPrivateKey && this.simulationRegistryAddress) {
      try {
        const account = privateKeyToAccount(this.arcPrivateKey);
        const walletClient = createWalletClient({
          account,
          chain: arcTestnet,
          transport: http(this.arcRpcUrl),
        });

        const arcClient = createPublicClient({ chain: arcTestnet, transport: http(this.arcRpcUrl) });
        // v2 registries bind the attestation to a beneficiary (the only address RebateVault lets claim).
        const isV2 = await arcClient
          .readContract({ address: this.simulationRegistryAddress, abi: SIMULATION_REGISTRY_ABI, functionName: "beneficiaryOf", args: [receiptHash as `0x${string}`] })
          .then(() => true, () => false);
        const tx = isV2
          ? await walletClient.writeContract({
              address: this.simulationRegistryAddress,
              abi: SIMULATION_REGISTRY_V2_ABI,
              functionName: "recordSimulation",
              args: [simulationHash, receiptHash as `0x${string}`, extractedUSDCRaw, beneficiary],
            })
          : await walletClient.writeContract({
              address: this.simulationRegistryAddress,
              abi: SIMULATION_REGISTRY_ABI,
              functionName: "recordSimulation",
              args: [simulationHash, receiptHash as `0x${string}`, extractedUSDCRaw],
            });
        if (!isV2) this.log("WARN", "LEGACY_REGISTRY", "v1 SimulationRegistry: claims are not restricted to the victim", {});
        const mined = await arcClient.waitForTransactionReceipt({ hash: tx });
        if (mined.status !== "success") throw new Error(`recordSimulation reverted (tx ${tx})`);

        attestedOnArc = true;
        arcTxHash = tx;

        this.log("INFO", "ATTESTED", "Simulation record committed to Arc SimulationRegistry", {
          txHash: tx,
          registry: this.simulationRegistryAddress,
          beneficiary: isV2 ? beneficiary : undefined,
        });
      } catch (err: unknown) {
        this.log("ERROR", "ATTEST_FAILED", "Failed to submit attestation to Arc", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      this.log("WARN", "NOT_ATTESTED", "No Arc signer key configured: simulation NOT attested on Arc", {
        simulationHash,
        receiptHash,
        amountUSDC: extractedUSDC,
      });
    }

    return {
      receipt,
      receiptHash,
      arkivEntityKey,
      arkivTxHash,
      simulationHash,
      attestedOnArc,
      arcTxHash,
    };
  }

  private log(
    level: "INFO" | "WARN" | "ERROR",
    stage: string,
    message: string,
    meta: Record<string, unknown> = {}
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      stage,
      message,
      ...meta,
    };
    // Monospace structured JSON log
    console.log(JSON.stringify(logEntry));
  }
}
