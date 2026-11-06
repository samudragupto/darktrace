// Server-side read of the RebateVault's live USDC reserve on Arc Testnet.
// Never substitutes a hardcoded figure: if the read fails, callers get `null`.
const ARC_RPC_URL = process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network";
export const REBATE_VAULT = (process.env.NEXT_PUBLIC_REBATE_VAULT || "0x238dE56E52A3F6C6708952052e6a20E5102b4d5b").toLowerCase();
const USDC = "0x3600000000000000000000000000000000000000";
const BALANCE_OF = "0x70a08231";

/** Vault USDC balance formatted to 2 dp, or null when Arc could not be read. */
export async function getVaultReserveUSDC(timeoutMs = 4_000): Promise<string | null> {
  try {
    const res = await fetch(ARC_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: USDC, data: BALANCE_OF + REBATE_VAULT.slice(2).padStart(64, "0") }, "latest"],
      }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string };
    if (!json.result || json.result === "0x") return null;
    return (Number(BigInt(json.result)) / 1e6).toFixed(2);
  } catch {
    return null;
  }
}
