import test from "node:test";
import assert from "node:assert/strict";
import { ArkivSdk, normalizePrivateKey, isSyntheticReceipt, RECEIPT_TTL_DAYS, OPEN_CLAIM_TTL_DAYS } from "./sdk";

// Throwaway, well-known test key (never funded).
const KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

test("normalizePrivateKey tolerates copy-paste artefacts", () => {
  assert.equal(normalizePrivateKey(KEY), KEY);
  assert.equal(normalizePrivateKey(KEY.slice(2)), KEY); // missing 0x
  assert.equal(normalizePrivateKey(`"${KEY}"`), KEY); // wrapped in quotes
  assert.equal(normalizePrivateKey(`  '${KEY}'\n`), KEY); // single quotes + whitespace
  assert.equal(normalizePrivateKey(""), null);
  assert.equal(normalizePrivateKey("0xb491fe5846DE735B6Cb03a677A3C6296FAB0aDA5"), null); // an address, not a key
  assert.equal(normalizePrivateKey(`${KEY}ff`), null); // too long
});

test("a malformed write key never breaks read-only construction", () => {
  const bad = new ArkivSdk({ privateKey: "not-a-key" });
  assert.equal(bad.writerKeyStatus, "invalid");
  assert.equal(bad.canWrite, false);

  const missing = new ArkivSdk({ privateKey: "" });
  assert.equal(missing.writerKeyStatus, "missing");

  const quoted = new ArkivSdk({ privateKey: `"${KEY}"` });
  assert.equal(quoted.writerKeyStatus, "ok");
  assert.equal(quoted.canWrite, true);
});

test("writes with an invalid key fail with an actionable message", async () => {
  const bad = new ArkivSdk({ privateKey: "0x1234" });
  await assert.rejects(() => bad.writeLPClaim({ v: "1.0.0", lp: KEY.slice(0, 42), receiptHash: KEY, claimTx: KEY, createdAt: 0 }), /not 32 bytes hex/);
});

test("LPClaim lookup by receiptHash is case-insensitive and distinguishes claimed vs archived receipts", () => {
  const claims = [
    {
      receiptHash: "0xDF3305CB8962998D3F887AD00EE3D206948D4B36703F6BE39C9E65C9DEE4E681",
      lp: "0xb491fe5846de735b6cb03a677a3c6296fab0ada5",
      claimTx: "0x4202622d97af28edd3439a8f3f5ab773524755362357aa22d4c6bfb100a4963f",
    },
  ];
  const byReceipt = new Map(claims.map((c) => [c.receiptHash.toLowerCase(), c]));
  const claimedHash = "0xdf3305cb8962998d3f887ad00ee3d206948d4b36703f6be39c9e65c9dee4e681";
  const unclaimedHash = "0xe9e56b6adbf0cae90f08b28a0ae3dccd9fc4ece42eb7b0126e4f208646eae6ce";

  assert.equal(byReceipt.has(claimedHash.toLowerCase()), true);
  assert.equal(byReceipt.has(unclaimedHash.toLowerCase()), false);
});

test("isSyntheticReceipt distinguishes SDK smoke-test fixtures from real Base Sepolia sandwich receipts", () => {
  assert.equal(
    isSyntheticReceipt({
      searcher: "0x1111111111111111111111111111111111111111",
      victim: "0x2222222222222222222222222222222222222222",
      txHashes: ["0xaaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111"],
    }),
    true
  );
  assert.equal(
    isSyntheticReceipt({
      searcher: "0xc31545299093C46d87752cD6378A811BFDD9940D",
      victim: "0x942823FD44c68d77Ad631f0aa4DEA35143E52488",
      txHashes: [
        "0xa9a12ef232d1df4a38a56cf10ef5566f71a36798b4b4109eebf89a05658ba48c",
        "0x23984ec70d7fc514697be40d8bb7500941ecbed350181a75b7fcb79e7ea772c4",
        "0x6dd63c93a3945d7f737b64350f480cbafc3a5032b0442b3dbef4c6d72f84f5d9",
      ],
    }),
    false
  );
  assert.ok(OPEN_CLAIM_TTL_DAYS > RECEIPT_TTL_DAYS);
});
