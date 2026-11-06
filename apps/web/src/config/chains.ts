import { defineChain } from "viem";
import { baseSepolia } from "viem/chains";

/**
 * Arc Testnet - Circle's USDC-native L1
 * Gas token: USDC (6 decimals)
 */
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://explorer.testnet.arc.io",
    },
  },
  testnet: true,
});

export const supportedChains = [baseSepolia, arcTestnet] as const;

