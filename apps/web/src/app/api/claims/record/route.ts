import { NextResponse } from "next/server";
import { createPublicClient, http, isHex, type Hex } from "viem";
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
    if (!isClaimed) {
      return NextResponse.json({ ok: false, error: "Receipt is not marked claimed on Arc RebateVault v2" }, { status: 400 });
    }

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
      lp,
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

