// Server-side reads from Base Sepolia. Never substitutes a made-up figure: failures return null.
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
export const SEARCHER_REGISTRY = (
  process.env.NEXT_PUBLIC_SEARCHER_REGISTRY || "0x24A2669C706CCE71BAea24a4De18D9D215713551"
).toLowerCase();

const BONDS = "0xfe10d774"; // bonds(address)
const TOTAL_SLASHED = "0x30f92439"; // totalSlashed(address)

async function call(data: string, timeoutMs: number): Promise<bigint | null> {
  try {
    const res = await fetch(BASE_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: SEARCHER_REGISTRY, data }, "latest"] }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string };
    return json.result && json.result !== "0x" ? BigInt(json.result) : null;
  } catch {
    return null;
  }
}

const eth = (wei: bigint) => (Number(wei) / 1e18).toFixed(4);

/** Live SearcherRegistry bond and cumulative slashing (native ETH on Base Sepolia), or null. */
export async function getSearcherBond(address: string, timeoutMs = 4_000): Promise<{ bondEth: string; slashedEth: string } | null> {
  const arg = address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const [bond, slashed] = await Promise.all([call(BONDS + arg, timeoutMs), call(TOTAL_SLASHED + arg, timeoutMs)]);
  if (bond === null || slashed === null) return null;
  return { bondEth: eth(bond), slashedEth: eth(slashed) };
}
