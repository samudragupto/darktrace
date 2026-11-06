import test from "node:test";
import assert from "node:assert/strict";
import { proveRebateClaim, type ReceiptLog } from "./claims";

// Real logs from Arc Testnet, verified run #2 (block 55,152,258 on Base Sepolia).
const VAULT_V2 = "0x238de56e52a3f6c6708952052e6a20e5102b4d5b";
const RUN2_RECEIPT = "0xe191f885168d1d06b6c7d27ef00504d58f7661c7da5adc8c3a79aaf8bb72959a";
const VICTIM = "0x524e061c89036b12a4f377bd8999038da3a551db";

// claimRebate tx 0xb72bd280…fd00: native + ERC-20 USDC Transfer, then RebateClaimed from the vault.
const CLAIM_TX_LOGS: ReceiptLog[] = [
  {
    address: "0xfffffffffffffffffffffffffffffffffffffffe",
    data: "0x000000000000000000000000000000000000000000000000312086536e0d9000",
    topics: [
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      "0x000000000000000000000000238de56e52a3f6c6708952052e6a20e5102b4d5b",
      "0x000000000000000000000000524e061c89036b12a4f377bd8999038da3a551db",
    ],
  },
  {
    address: "0x3600000000000000000000000000000000000000",
    data: "0x0000000000000000000000000000000000000000000000000000000000360409",
    topics: [
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      "0x000000000000000000000000238de56e52a3f6c6708952052e6a20e5102b4d5b",
      "0x000000000000000000000000524e061c89036b12a4f377bd8999038da3a551db",
    ],
  },
  {
    address: "0x238de56e52a3f6c6708952052e6a20e5102b4d5b",
    data: "0x0000000000000000000000000000000000000000000000000000000000360409",
    topics: [
      "0x1fdcfe64e270970425b2907eedd33c5b0dac360a629f3db94eb02b8804e3c5b5",
      "0xe191f885168d1d06b6c7d27ef00504d58f7661c7da5adc8c3a79aaf8bb72959a",
      "0x000000000000000000000000524e061c89036b12a4f377bd8999038da3a551db",
    ],
  },
];

// recordSimulation tx 0xf4e1fa19…4ca4: a successful Arc tx about the SAME receipt, but not a claim.
const ATTEST_TX_LOGS: ReceiptLog[] = [
  {
    address: "0xd501d47b246438a18c8a0bffcf10338cfbb661a2",
    data: "0x000000000000000000000000000000000000000000000000000000000036040900000000000000000000000000000000000000000000000000000000043b5762",
    topics: [
      "0xa6291a41cc415bfc2ec37c1727118a3bf8afcd6b2d34b6956fd5bb2152fc30f9",
      "0x4f3ff115bb8b9e3b8be8608769eb3ad77cba4f8c03de95115f2ef357dd0297cd",
      "0xe191f885168d1d06b6c7d27ef00504d58f7661c7da5adc8c3a79aaf8bb72959a",
      "0x000000000000000000000000524e061c89036b12a4f377bd8999038da3a551db",
    ],
  },
];

test("accepts the real run #2 claim and takes the recipient from the event", () => {
  const proof = proveRebateClaim(CLAIM_TX_LOGS, VAULT_V2, RUN2_RECEIPT, VICTIM);
  assert.equal(proof.ok, true);
  if (proof.ok) {
    assert.equal(proof.recipient.toLowerCase(), VICTIM);
    assert.equal(proof.amountUSDC, BigInt(3539977));
  }
});

test("accepts without an lp hint (recipient comes from chain)", () => {
  const proof = proveRebateClaim(CLAIM_TX_LOGS, VAULT_V2, RUN2_RECEIPT.toUpperCase().replace("0X", "0x"));
  assert.equal(proof.ok, true);
});

test("rejects a successful tx that is not a claim (e.g. the attestation for the same receipt)", () => {
  const proof = proveRebateClaim(ATTEST_TX_LOGS, VAULT_V2, RUN2_RECEIPT, VICTIM);
  assert.equal(proof.ok, false);
});

test("rejects a real claim tx presented for a different receipt", () => {
  const other = "0xdf3305cb8962998d3f887ad00ee3d206948d4b36703f6be39c9e65c9dee4e681";
  assert.equal(proveRebateClaim(CLAIM_TX_LOGS, VAULT_V2, other).ok, false);
});

test("rejects an attacker-supplied lp that differs from the on-chain recipient", () => {
  const proof = proveRebateClaim(CLAIM_TX_LOGS, VAULT_V2, RUN2_RECEIPT, "0x000000000000000000000000000000000000bad0");
  assert.equal(proof.ok, false);
});

test("rejects RebateClaimed emitted by any contract other than the vault", () => {
  const spoofed = CLAIM_TX_LOGS.map((l) => ({ ...l, address: "0x0000000000000000000000000000000000000bad" }));
  assert.equal(proveRebateClaim(spoofed, VAULT_V2, RUN2_RECEIPT).ok, false);
});
