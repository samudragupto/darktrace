import { NextResponse } from "next/server";
import { createPublicClient, http, isHex, type Hex } from "viem";
import { proveRebateClaim } from "@/lib/claims";
import { arkiv } from "@darktrace/arkiv";
import { arcTestnet } from "@/config/chains";

const REBATE_VAULT_V2 = (process.env.NEXT_PUBLIC_REBATE_VAULT || "0x238dE56E52A3F6C6708952052e6a20E5102b4d5b").toLowerCase();

const CLAIMED_ABI = [
  {
    type: "function",
    name: "claimedReceipts",
    stateMutability: "view",
    inputs: [{ name: "receiptHash", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/**
 * Records an Arc rebate claim as an Arkiv LPClaim. Public endpoint, so nothing in the body is trusted:
 * the claim tx must be a successful tx on Arc whose logs contain RebateClaimed(receiptHash) emitted by
 * RebateVault v2, and the LP recorded on Arkiv is the event's `recipient`, never the request's `lp`.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      receiptHash?: string;
      lp?: string;
      claimTx?: string;
    };

    const receiptHash = (body.receiptHash ?? "").trim().toLowerCase();
    const lp = (body.lp ?? "").trim();
    const claimTx = (body.claimTx ?? "").trim().toLowerCase();

    if (!isHex(receiptHash) || receiptHash.length !== 66) {
      return NextResponse.json({ ok: false, error: "Invalid receiptHash (expected 32-byte hex)" }, { status: 400 });
    }
    if (!isHex(lp) || lp.length !== 42) {
      return NextResponse.json({ ok: false, error: "Invalid lp address" }, { status: 400 });
    }
    if (!isHex(claimTx) || claimTx.length !== 66) {
      return NextResponse.json({ ok: false, error: "Invalid claimTx hash" }, { status: 400 });
    }

    // Verify on Arc Testnet that the transaction succeeded and the receipt is marked claimed on RebateVault v2.
    const arcClient = createPublicClient({
      chain: arcTestnet,
      transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network"),
    });

    const [txReceipt, isClaimed] = await Promise.all([
      arcClient.getTransactionReceipt({ hash: claimTx as Hex }),
      arcClient.readContract({
        address: REBATE_VAULT_V2 as Hex,
        abi: CLAIMED_ABI,
        functionName: "claimedReceipts",
        args: [receiptHash as Hex],
      }),
    ]);

    if (txReceipt.status !== "success") {
      return NextResponse.json({ ok: false, error: "Arc claim transaction did not succeed on-chain" }, { status: 400 });
    }

    // The tx must actually be the vault's claim of THIS receipt; the recipient comes from the event.
    const proof = proveRebateClaim(txReceipt.logs, REBATE_VAULT_V2, receiptHash, lp);
    if (!proof.ok) {
      return NextResponse.json({ ok: false, error: proof.error }, { status: 400 });
    }
    const recipient = proof.recipient;

    const sdk = arkiv();
    const existing = await sdk.claimForReceipt(receiptHash);
    if (existing) {
      return NextResponse.json({
        ok: true,
        alreadyRecorded: true,
        entityKey: existing.arkivEntityKey,
        claimTx: existing.claimTx,
      });
    }

    if (!sdk.canWrite) {
      return NextResponse.json({
        ok: true,
        arkivWritten: false,
        note: "Arc claim verified on-chain; server ARKIV_PRIVATE_KEY not configured so run `pnpm --filter @darktrace/indexer claim` to seal LPClaim.",
      });
    }

    const written = await sdk.writeLPClaim({
      v: "1.0.0",
      lp: recipient,
      receiptHash,
      claimTx,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      ok: true,
      arkivWritten: true,
      entityKey: written.entityKey,
      arkivTxHash: written.txHash,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

