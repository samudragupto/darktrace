// Live Arkiv (Rabdi testnet, chain 7794095) access through the official @arkiv-network/sdk.
// This is the ONLY code path that talks to Arkiv: the indexer writes through it and the
// web app reads through it. Verified against the live entity
// 0xc327d5db4aa3098b80dc8729d090317408f98d19e1e19c13d6cf83494a05f8ca.
import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { and, eq, desc } from "@arkiv-network/sdk/query";
import { addr, bytes, dec, defineSchema, str, u64 } from "@arkiv-network/sdk/schema";
import { http, hexToString, isHex, stringToBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ExtractionReceipt, LPClaim, SearcherProfile, computeReceiptHash } from "./schemas";

/** Wallet that writes DarkTrace entities. Reads only trust entities owned by it. */
export const DEFAULT_WRITER_ADDRESS = "0xb491fe5846DE735B6Cb03a677A3C6296FAB0aDA5" as const;
export const ARKIV_EXPLORER = "https://rabdi.explorer.arkiv.network";
export const RECEIPT_TTL_DAYS = 30;
/** Unclaimed receipts have their Arkiv expiry extended to 90 days so victims never lose forensic proof while a claim is open. */
export const OPEN_CLAIM_TTL_DAYS = 90;

/**
 * Returns true if the receipt is the initial SDK smoke-test fixture (written by scripts/arkiv-write-test.ts
 * with placeholder addresses 0x1111… / 0x2222… and synthetic txHashes 0xaaaa1111…) rather than a real Base Sepolia sandwich.
 */
export function isSyntheticReceipt(r: Pick<ArkivReceipt, "txHashes" | "searcher" | "victim">): boolean {
  const s = r.searcher.toLowerCase();
  const v = r.victim.toLowerCase();
  if (s === "0x1111111111111111111111111111111111111111" || v === "0x2222222222222222222222222222222222222222") {
    return true;
  }
  return r.txHashes.some((h) => /^0x(aaaa1111|bbbb2222|cccc3333)/i.test(h));
}

// ─── Schemas ────────────────────────────────────────────────────────────────
// Schema name "receipts" is kept so entities written before this change still match.
// Columns added later are optional for the same reason.
export const ReceiptsSchema = defineSchema("receipts", {
  poolId: str().indexed(),
  searcher: addr().indexed(),
  victim: addr().indexed(),
  lp: addr().indexed(),
  blockNumber: u64().indexed(),
  receiptHash: str().indexed(),
  extractedUSDC: dec(),
  simulationHash: str(),
  txHashes: bytes(),
  injectedSlippageBps: u64().optional(),
  legitSlippageBps: u64().optional(),
  createdAtMs: u64().optional(),
  detection: str().optional(), // "hook" | "linked-origin"; absent on entities written before it existed
});

export const SearcherProfilesSchema = defineSchema("darktrace.searcher_profiles", {
  searcher: addr().indexed(),
  extractions: u64(),
  bondedUSDC: dec(),
  slashedUSDC: dec(),
  lastSeenBlock: u64().indexed(),
});

export const LPClaimsSchema = defineSchema("darktrace.lp_claims", {
  lp: addr().indexed(),
  receiptHash: str().indexed(),
  claimTx: str(),
  createdAtMs: u64(),
});

// ─── Types returned to callers ──────────────────────────────────────────────
export interface ArkivEntityMeta {
  /** Arkiv entity key ($key) — NOT the receiptHash. */
  arkivEntityKey: Hex;
  owner: Hex;
  createdAtBlock: bigint;
  expiresAtBlock: bigint;
  explorerUrl: string;
}

export interface ArkivReceipt extends ArkivEntityMeta {
  receiptHash: string;
  poolId: string;
  searcher: string;
  victim: string;
  lp: string;
  blockNumber: number;
  extractedUSDC: string;
  simulationHash: string;
  txHashes: string[];
  injectedSlippageBps: number | null;
  legitSlippageBps: number | null;
  createdAtMs: number | null;
  /** "hook" | "linked-origin"; null for receipts written before detection was recorded (all hook-detected). */
  detection: string | null;
}

export interface ArkivSearcherProfile extends ArkivEntityMeta, Omit<SearcherProfile, "v"> {}
export interface ArkivLPClaim extends ArkivEntityMeta, Omit<LPClaim, "v"> {}

export interface ArkivSdkConfig {
  accessKey?: string;
  /** Private key of the writer wallet. Required only for writes. */
  privateKey?: string;
  /** Address whose entities are trusted on read. */
  writerAddress?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const lower = (a: string) => a.toLowerCase() as Hex;
const explorerUrl = (key: string) => `${ARKIV_EXPLORER}/entity/${key}`;

type Val<T> = { value: T } | undefined;
const v = <T>(x: Val<T>): T | undefined => x?.value;
const num = (x: Val<bigint>): number | null => (x?.value === undefined ? null : Number(x.value));

function decodeTxHashes(raw: Hex | Uint8Array | undefined): string[] {
  if (!raw) return [];
  try {
    const text = typeof raw === "string" ? hexToString(raw) : new TextDecoder().decode(raw);
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function meta(row: { $key: Hex; $owner: Hex; $createdAt: bigint; $expiresAt: bigint }): ArkivEntityMeta {
  return {
    arkivEntityKey: row.$key,
    owner: row.$owner,
    createdAtBlock: row.$createdAt,
    expiresAtBlock: row.$expiresAt,
    explorerUrl: explorerUrl(row.$key),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toReceipt(row: any): ArkivReceipt {
  return {
    ...meta(row),
    receiptHash: v<string>(row.receiptHash) ?? "",
    poolId: v<string>(row.poolId) ?? "",
    searcher: v<string>(row.searcher) ?? "",
    victim: v<string>(row.victim) ?? "",
    lp: v<string>(row.lp) ?? "",
    blockNumber: num(row.blockNumber) ?? 0,
    extractedUSDC: v<string>(row.extractedUSDC) ?? "0",
    simulationHash: v<string>(row.simulationHash) ?? "",
    txHashes: decodeTxHashes(v(row.txHashes)),
    injectedSlippageBps: num(row.injectedSlippageBps),
    legitSlippageBps: num(row.legitSlippageBps),
    createdAtMs: num(row.createdAtMs),
    detection: v<string>(row.detection) ?? null,
  };
}

// ─── Client ─────────────────────────────────────────────────────────────────
/** Trims whitespace and one pair of surrounding quotes (a common copy-paste artefact in env UIs). */
const cleanEnv = (v: string | undefined) => (v ?? "").trim().replace(/^(['"])(.*)\1$/, "$2").trim();

export type WriterKeyStatus = "ok" | "missing" | "invalid";

/** Normalises a private key; returns null when it is not 32 bytes of hex. Never throws. */
export function normalizePrivateKey(raw: string | undefined): Hex | null {
  let pk = cleanEnv(raw);
  if (!pk) return null;
  if (!pk.startsWith("0x")) pk = `0x${pk}`;
  return isHex(pk) && pk.length === 66 ? (pk as Hex) : null;
}

export class ArkivSdk {
  readonly writerAddress: Hex;
  /** Write-key state. Reads never depend on it, so a bad key cannot take the UI down. */
  readonly writerKeyStatus: WriterKeyStatus;
  private readonly accessKey: string;
  private readonly privateKey?: Hex;

  constructor(config: ArkivSdkConfig = {}) {
    this.accessKey = cleanEnv(config.accessKey ?? process.env.ARKIV_ACCESS_KEY);
    const writer = cleanEnv(config.writerAddress ?? process.env.ARKIV_WRITER_ADDRESS) || DEFAULT_WRITER_ADDRESS;
    if (!isHex(writer) || writer.length !== 42) {
      throw new Error(`[arkiv] ARKIV_WRITER_ADDRESS must be a 0x address (40 hex chars), got ${writer.length} chars`);
    }
    this.writerAddress = writer as Hex;

    const raw = config.privateKey ?? process.env.ARKIV_PRIVATE_KEY;
    const pk = normalizePrivateKey(raw);
    if (pk) this.privateKey = pk;
    this.writerKeyStatus = pk ? "ok" : cleanEnv(raw) ? "invalid" : "missing";
  }

  get canWrite(): boolean {
    return this.writerKeyStatus === "ok";
  }

  private chain() {
    return rabdi({ accessKey: this.accessKey });
  }

  reader() {
    return createPublicClient({ chain: this.chain(), transport: http() });
  }

  private writer() {
    if (this.writerKeyStatus === "invalid") {
      throw new Error("[arkiv] ARKIV_PRIVATE_KEY is set but is not 32 bytes hex (check for quotes or extra characters)");
    }
    if (!this.privateKey) throw new Error("[arkiv] ARKIV_PRIVATE_KEY is required to write to Arkiv");
    return createWalletClient({
      chain: this.chain(),
      transport: http(),
      account: privateKeyToAccount(this.privateKey),
    });
  }

  // ── Receipts ──
  async writeReceipt(receipt: ExtractionReceipt) {
    const receiptHash = computeReceiptHash(receipt).toLowerCase();
    const { entityKey, txHash } = await this.writer().createEntity(
      ReceiptsSchema,
      {
        poolId: receipt.poolId.toLowerCase(),
        searcher: addr(lower(receipt.searcher)),
        victim: addr(lower(receipt.victim)),
        lp: addr(lower(receipt.lp)),
        blockNumber: u64(BigInt(receipt.blockNumber)),
        receiptHash,
        extractedUSDC: dec(receipt.extractedUSDC),
        simulationHash: receipt.simulationHash.toLowerCase(),
        txHashes: stringToBytes(JSON.stringify(receipt.txHashes.map((h) => h.toLowerCase()))),
        injectedSlippageBps: u64(BigInt(receipt.injectedSlippageBps)),
        legitSlippageBps: u64(BigInt(receipt.legitSlippageBps)),
        createdAtMs: u64(BigInt(receipt.createdAt)),
        ...(receipt.detection ? { detection: receipt.detection } : {}),
      },
      { expiration: ExpirationTime.fromDays(RECEIPT_TTL_DAYS) }
    );
    return { receiptHash, entityKey, txHash, explorerUrl: explorerUrl(entityKey) };
  }

  async getReceiptByHash(receiptHash: string): Promise<ArkivReceipt | null> {
    const res = await this.reader()
      .select()
      .from(ReceiptsSchema)
      .where(eq("receiptHash", receiptHash.toLowerCase()))
      .ownedBy(this.writerAddress)
      .limit(1)
      .fetch();
    return res.entities[0] ? toReceipt(res.entities[0]) : null;
  }

  async getReceiptByEntityKey(entityKey: Hex): Promise<ArkivReceipt | null> {
    try {
      const row = await this.reader().getEntity(entityKey, ReceiptsSchema);
      if (row.$owner.toLowerCase() !== this.writerAddress.toLowerCase()) return null;
      return toReceipt(row);
    } catch {
      return null;
    }
  }

  async listRecentReceipts(limit = 25): Promise<ArkivReceipt[]> {
    const res = await this.reader()
      .select()
      .from(ReceiptsSchema)
      .ownedBy(this.writerAddress)
      .orderBy(desc("blockNumber"))
      .limit(limit)
      .fetch();
    return res.entities.map(toReceipt);
  }

  async listReceiptsByPool(poolId: string, limit = 50): Promise<ArkivReceipt[]> {
    const res = await this.reader()
      .select()
      .from(ReceiptsSchema)
      .where(eq("poolId", poolId.toLowerCase()))
      .ownedBy(this.writerAddress)
      .orderBy(desc("blockNumber"))
      .limit(limit)
      .fetch();
    return res.entities.map(toReceipt);
  }

  async listReceiptsBySearcher(searcher: string, limit = 50): Promise<ArkivReceipt[]> {
    const res = await this.reader()
      .select()
      .from(ReceiptsSchema)
      .where(eq("searcher", addr(lower(searcher))))
      .ownedBy(this.writerAddress)
      .orderBy(desc("blockNumber"))
      .limit(limit)
      .fetch();
    return res.entities.map(toReceipt);
  }

  async listReceiptsByParty(address: string, limit = 50): Promise<ArkivReceipt[]> {
    const a = addr(lower(address));
    const [asVictim, asLp] = await Promise.all([
      this.reader().select().from(ReceiptsSchema).where(eq("victim", a)).ownedBy(this.writerAddress).limit(limit).fetch(),
      this.reader().select().from(ReceiptsSchema).where(eq("lp", a)).ownedBy(this.writerAddress).limit(limit).fetch(),
    ]);
    const seen = new Map<string, ArkivReceipt>();
    for (const row of [...asVictim.entities, ...asLp.entities]) seen.set(row.$key, toReceipt(row));
    return Array.from(seen.values()).sort((x, y) => y.blockNumber - x.blockNumber);
  }

  // ── Searcher profiles ──
  async getSearcherProfile(searcher: string): Promise<ArkivSearcherProfile | null> {
    const res = await this.reader()
      .select()
      .from(SearcherProfilesSchema)
      .where(eq("searcher", addr(lower(searcher))))
      .ownedBy(this.writerAddress)
      .limit(1)
      .fetch();
    const row = res.entities[0];
    if (!row) return null;
    return {
      ...meta(row),
      searcher: row.searcher.value,
      extractions: Number(row.extractions.value),
      bondedUSDC: row.bondedUSDC.value,
      slashedUSDC: row.slashedUSDC.value,
      lastSeenBlock: Number(row.lastSeenBlock.value),
    };
  }

  async listSearcherProfiles(limit = 50): Promise<ArkivSearcherProfile[]> {
    const res = await this.reader()
      .select()
      .from(SearcherProfilesSchema)
      .ownedBy(this.writerAddress)
      .orderBy(desc("lastSeenBlock"))
      .limit(limit)
      .fetch();
    return res.entities.map((row) => ({
      ...meta(row),
      searcher: row.searcher.value,
      extractions: Number(row.extractions.value),
      bondedUSDC: row.bondedUSDC.value,
      slashedUSDC: row.slashedUSDC.value,
      lastSeenBlock: Number(row.lastSeenBlock.value),
    }));
  }

  async upsertSearcherProfile(p: SearcherProfile) {
    const values = {
      searcher: addr(lower(p.searcher)),
      extractions: u64(BigInt(p.extractions)),
      bondedUSDC: dec(p.bondedUSDC),
      slashedUSDC: dec(p.slashedUSDC),
      lastSeenBlock: u64(BigInt(p.lastSeenBlock)),
    };
    const existing = await this.getSearcherProfile(p.searcher);
    if (existing) {
      const { txHash } = await this.writer().patchEntity(SearcherProfilesSchema, existing.arkivEntityKey, { set: values });
      return { entityKey: existing.arkivEntityKey, txHash };
    }
    return this.writer().createEntity(SearcherProfilesSchema, values, {
      expiration: ExpirationTime.fromDays(RECEIPT_TTL_DAYS),
    });
  }

  /**
   * Deliberate entity expiry policy: if a receipt has an open (unclaimed) rebate,
   * extends its Arkiv entity lifetime to `days` (default: OPEN_CLAIM_TTL_DAYS = 90 days)
   * using `@arkiv-network/sdk` `extendEntity` so the victim's forensic proof never expires
   * while an attestation is still claimable on Arc.
   */
  async extendOpenReceiptExpiry(receiptHash: string, days = OPEN_CLAIM_TTL_DAYS) {
    const receipt = await this.getReceiptByHash(receiptHash);
    if (!receipt) {
      throw new Error(`[arkiv] receipt ${receiptHash} not found`);
    }
    const claim = await this.claimForReceipt(receiptHash);
    if (claim) {
      return {
        extended: false as const,
        reason: "already_claimed" as const,
        entityKey: receipt.arkivEntityKey,
        previousExpiresAtBlock: receipt.expiresAtBlock,
        expiresAtBlock: receipt.expiresAtBlock,
      };
    }
    const { txHash, expiresAt } = await this.writer().extendEntity({
      entityKey: receipt.arkivEntityKey,
      expiration: ExpirationTime.fromDays(days),
    });
    return {
      extended: true as const,
      entityKey: receipt.arkivEntityKey,
      txHash,
      previousExpiresAtBlock: receipt.expiresAtBlock,
      expiresAtBlock: expiresAt,
    };
  }

  // ── LP claims ──
  async writeLPClaim(c: LPClaim) {
    return this.writer().createEntity(
      LPClaimsSchema,
      {
        lp: addr(lower(c.lp)),
        receiptHash: c.receiptHash.toLowerCase(),
        claimTx: c.claimTx.toLowerCase(),
        createdAtMs: u64(BigInt(c.createdAt)),
      },
      { expiration: ExpirationTime.fromDays(RECEIPT_TTL_DAYS) }
    );
  }

  async listLPClaims(lp?: string, limit = 50): Promise<ArkivLPClaim[]> {
    let q = this.reader().select().from(LPClaimsSchema);
    if (lp) q = q.where(eq("lp", addr(lower(lp))));
    const res = await q.ownedBy(this.writerAddress).limit(limit).fetch();
    return res.entities.map((row) => ({
      ...meta(row),
      lp: row.lp.value,
      receiptHash: row.receiptHash.value,
      claimTx: row.claimTx.value,
      createdAt: Number(row.createdAtMs.value),
    }));
  }

  async claimForReceipt(receiptHash: string): Promise<ArkivLPClaim | null> {
    const res = await this.reader()
      .select()
      .from(LPClaimsSchema)
      .where(and(eq("receiptHash", receiptHash.toLowerCase())))
      .ownedBy(this.writerAddress)
      .limit(1)
      .fetch();
    const row = res.entities[0];
    if (!row) return null;
    return {
      ...meta(row),
      lp: row.lp.value,
      receiptHash: row.receiptHash.value,
      claimTx: row.claimTx.value,
      createdAt: Number(row.createdAtMs.value),
    };
  }
}

/** Default shared instance (reads need no private key). */
let _shared: ArkivSdk | undefined;
export function arkiv(): ArkivSdk {
  return (_shared ??= new ArkivSdk());
}
