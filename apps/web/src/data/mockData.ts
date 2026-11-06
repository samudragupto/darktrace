/**
 * Static metadata for the pools the dashboard lists. Only pools that exist on-chain (or the SDK
 * smoke-test fixture, labeled as such) appear here; no TVL/volume is invented. Extraction figures
 * always come from Arkiv.
 */
export interface MockPool {
  id: string;
  name: string;
  feeTier: string;
  /** Which DarkTraceHook the pool is attached to, or "fixture" for the SDK smoke-test receipts. */
  hook: "v1" | "v2" | "fixture";
  /** Deployed hook address (Base Sepolia); absent for the fixture. */
  hookAddress?: string;
  /** Base Sepolia tx that initialized the pool; absent for the fixture. */
  initTx?: string;
  token0: string;
  token1: string;
}

export interface MockReceipt {
  receiptHash: string;
  arkivEntityKey?: string;
  arkivWriteTxHash?: string;
  poolId: string;
  poolName: string;
  searcher: string;
  victim: string;
  lp: string;
  blockNumber: number;
  extractedUSDC: string;
  injectedSlippageBps: number;
  legitSlippageBps: number;
  lpLvrDelta: string;
  simulationHash: string;
  arkivURI: string;
  status: "DETECTED" | "SIMULATED" | "ARCHIVED" | "REBATED";
  txHashes: string[];
  createdAt: number;
  claimTx?: string;
}

export const MOCK_POOLS: MockPool[] = [
  {
    // Real pool on DarkTraceHook v2 (Base Sepolia, block 55,162,442).
    id: "0x5d78af67b033875696613c57b5a68f4a62eba0d98095844b0e9c8c691afc63df",
    name: "tUSDC / tWETH (Hook v2)",
    feeTier: "0.30%",
    hook: "v2",
    hookAddress: "0xCeF7a999885D93f23Beeb7D319A83F2949B2c0c0",
    initTx: "0x495bf0757164e3dbb95cb667ae2d8aa5d890372b96fa9f82fd5375a2fe685f90",
    token0: "0x80eddda74d7127db41a3ce86a8e8d5621ec7f4df",
    token1: "0xd501d47b246438a18c8a0bffcf10338cfbb661a2",
  },
  {
    // Real pool on DarkTraceHook v1, created by `pnpm e2e:real` (Base Sepolia, block 55,113,082).
    id: "0x2183dce5625ecbb1cf175be52a75b31eeed7bf7774181e3136ba49f6fc3c676c",
    name: "tUSDC / tWETH (Hook v1)",
    feeTier: "0.30%",
    hook: "v1",
    hookAddress: "0xBCC9e1C474Ed195b3791f2c41EdAC2a25c5b80c0",
    token0: "0x80eddda74d7127db41a3ce86a8e8d5621ec7f4df",
    token1: "0xd501d47b246438a18c8a0bffcf10338cfbb661a2",
  },
  {
    // Pool id used by the two Arkiv SDK smoke-test receipts (0x1111…/0x2222… addresses).
    // It is NOT an on-chain pool; listed so those fixture receipts have a home, and labeled as such.
    id: "0x835c24ae58a98118715d7541b2c5f0df8f11ca328b8e9c9c3850441c632e8d21",
    name: "SDK fixture (not an on-chain pool)",
    feeTier: "—",
    hook: "fixture",
    token0: "0x4200000000000000000000000000000000000006",
    token1: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
];

export const MOCK_RECEIPTS: MockReceipt[] = [
  {
    receiptHash: "0xe9e56b6adbf0cae90f08b28a0ae3dccd9fc4ece42eb7b0126e4f208646eae6ce",
    arkivEntityKey: "0xc327d5db4aa3098b80dc8729d090317408f98d19e1e19c13d6cf83494a05f8ca",
    arkivWriteTxHash: "0x544ee730bb736cdbafcd837bad62f857c8ed0e0eaedf7afce807ffb060c6e0f6",
    poolId: "0x835c24ae58a98118715d7541b2c5f0df8f11ca328b8e9c9c3850441c632e8d21",
    poolName: "WETH / USDC",
    searcher: "0x1111111111111111111111111111111111111111",
    victim: "0x2222222222222222222222222222222222222222",
    lp: "0x3333333333333333333333333333333333333333",
    blockNumber: 12489201,
    extractedUSDC: "1.25",
    injectedSlippageBps: 187,
    legitSlippageBps: 12,
    lpLvrDelta: "-$1.21",
    simulationHash: "0xc9ddedeba69e600924875d3ce6c3e2cd554170c510cec4bfd5016182dc156309",
    arkivURI: "arkiv://darktrace.v1/receipt/0xe9e56b6adbf0cae90f08b28a0ae3dccd9fc4ece42eb7b0126e4f208646eae6ce",
    status: "ARCHIVED",
    txHashes: [
      "0xaaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111",
      "0xbbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222",
      "0xcccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333",
    ],
    createdAt: Date.now() - 3600000,
  },
  {
    receiptHash: "0x4a5b6c7d8e9f01234567890abcdef1234567890abcd9c8d1f2b3e4a506172839",
    poolId: "0x835c24ae58a98118715d7541b2c5f0df8f11ca328b8e9c9c3850441c632e8d21",
    poolName: "WETH / USDC",
    searcher: "0x1111111111111111111111111111111111111111",
    victim: "0x7777777777777777777777777777777777777777",
    lp: "0x3333333333333333333333333333333333333333",
    blockNumber: 12489240,
    extractedUSDC: "0.85",
    injectedSlippageBps: 240,
    legitSlippageBps: 18,
    lpLvrDelta: "-$0.82",
    simulationHash: "0xa1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
    arkivURI: "arkiv://darktrace.v1/receipt/0x4a5b6c7d8e9f01234567890abcdef1234567890abcd9c8d1f2b3e4a506172839",
    status: "ARCHIVED",
    txHashes: [
      "0x1122334455667788990011223344556677889900112233445566778899001122",
      "0x2233445566778899001122334455667788990011223344556677889900112233",
      "0x3344556677889900112233445566778899001122334455667788990011223344",
    ],
    createdAt: Date.now() - 1800000,
  },
  {
    receiptHash: "0x8f7e6d5c4b3a291807f6e5d4c3b2a1908f7e6d5c4b3a291807f6e5d4c3b2a190",
    poolId: "0x2a1b9487c02b8510fbc282901928014810294821092830192830192830192831",
    poolName: "cbBTC / USDC",
    searcher: "0x4444444444444444444444444444444444444444",
    victim: "0x8888888888888888888888888888888888888888",
    lp: "0x5555555555555555555555555555555555555555",
    blockNumber: 12489295,
    extractedUSDC: "1.65",
    injectedSlippageBps: 310,
    legitSlippageBps: 24,
    lpLvrDelta: "-$1.60",
    simulationHash: "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678",
    arkivURI: "arkiv://darktrace.v1/receipt/0x8f7e6d5c4b3a291807f6e5d4c3b2a1908f7e6d5c4b3a291807f6e5d4c3b2a190",
    status: "SIMULATED",
    txHashes: [
      "0x9988776655443322110099887766554433221100998877665544332211009988",
      "0x8877665544332211009988776655443322110099887766554433221100998877",
      "0x7766554433221100998877665544332211009988776655443322110099887766",
    ],
    createdAt: Date.now() - 600000,
  },
];

