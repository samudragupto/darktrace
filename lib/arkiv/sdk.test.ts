import test from "node:test";
import assert from "node:assert/strict";
import { ArkivSdk, normalizePrivateKey } from "./sdk";

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
