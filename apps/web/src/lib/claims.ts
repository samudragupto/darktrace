// Pure validation for recording an Arc rebate claim on Arkiv. Kept free of network calls so it can
// be unit-tested: the API route fetches the tx receipt, this decides whether it proves the claim.
import { decodeEventLog, parseAbiItem, type Hex } from "viem";

export const REBATE_CLAIMED = parseAbiItem(
  "event RebateClaimed(bytes32 indexed receiptHash, address indexed recipient, uint256 amountUSDC)"
);

export interface ReceiptLog {
  address: string;
  data: Hex;
  topics: readonly Hex[];
}

export type ClaimProof =
  | { ok: true; recipient: Hex; amountUSDC: bigint }
  | { ok: false; error: string };

/**
 * Accepts only a RebateClaimed(receiptHash, …) event emitted by `vault` inside the claim tx's logs.
 * `claimedLp`, if given, must equal the on-chain recipient.
 */
export function proveRebateClaim(
  logs: readonly ReceiptLog[],
  vault: string,
  receiptHash: string,
  claimedLp?: string
): ClaimProof {
  const want = receiptHash.toLowerCase();
  for (const l of logs) {
    if (l.address.toLowerCase() !== vault.toLowerCase() || l.topics.length === 0) continue;
    let ev;
    try {
      ev = decodeEventLog({ abi: [REBATE_CLAIMED], data: l.data, topics: l.topics as [Hex, ...Hex[]] });
    } catch {
      continue;
    }
    if (ev.args.receiptHash.toLowerCase() !== want) continue;
    if (claimedLp && claimedLp.toLowerCase() !== ev.args.recipient.toLowerCase()) {
      return { ok: false, error: `lp does not match the on-chain claim recipient ${ev.args.recipient}` };
    }
    return { ok: true, recipient: ev.args.recipient, amountUSDC: ev.args.amountUSDC };
  }
  return { ok: false, error: "claimTx did not emit RebateClaimed for this receiptHash from RebateVault v2" };
}
