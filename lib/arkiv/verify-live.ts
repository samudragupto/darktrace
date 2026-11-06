// Read-only check that DarkTrace receipts are queryable from Arkiv Rabdi.
// Usage: pnpm arkiv:verify [receiptHash]
// Needs no private key; ARKIV_ACCESS_KEY is optional (public endpoint is rate limited).
import { ArkivSdk, isSyntheticReceipt } from "./sdk";

const SAMPLE_RECEIPT_HASH = "0xe9e56b6adbf0cae90f08b28a0ae3dccd9fc4ece42eb7b0126e4f208646eae6ce";
const REAL_SEARCHER = "0xc31545299093C46d87752cD6378A811BFDD9940D";

async function main() {
  const sdk = new ArkivSdk();
  const hash = process.argv[2] ?? SAMPLE_RECEIPT_HASH;
  console.log(`Writer (trusted owner): ${sdk.writerAddress}`);

  const r = await sdk.getReceiptByHash(hash);
  if (!r) {
    console.error(`FAILED no receipt with receiptHash ${hash} owned by the writer`);
    process.exit(1);
  }
  console.log(`READ_OK receiptHash=${r.receiptHash}`);
  console.log(`  $key       ${r.arkivEntityKey}`);
  console.log(`  pool       ${r.poolId}`);
  console.log(`  searcher   ${r.searcher}  victim ${r.victim}`);
  console.log(`  extracted  ${r.extractedUSDC} USDC   block ${r.blockNumber}`);
  console.log(`  txHashes   ${r.txHashes.length}`);
  console.log(`  explorer   ${r.explorerUrl}`);

  const [recent, byPool, bySearcher, claims, profile] = await Promise.all([
    sdk.listRecentReceipts(10),
    sdk.listReceiptsByPool(r.poolId),
    sdk.listReceiptsBySearcher(r.searcher),
    sdk.listLPClaims(),
    sdk.getSearcherProfile(REAL_SEARCHER),
  ]);
  const realCount = recent.filter((x) => !isSyntheticReceipt(x)).length;
  const syntheticCount = recent.filter((x) => isSyntheticReceipt(x)).length;
  console.log(`RECENT_OK ${recent.length} receipt(s) (${realCount} real on-chain, ${syntheticCount} fixture)`);
  console.log(`POOL_OK ${byPool.length} receipt(s) for pool`);
  console.log(`SEARCHER_OK ${bySearcher.length} receipt(s) for searcher`);
  console.log(`CLAIMS_OK ${claims.length} claim(s)`);
  if (!profile) {
    console.error(`FAILED no SearcherProfile for ${REAL_SEARCHER}`);
    process.exit(1);
  }
  console.log(
    `PROFILE_OK $key=${profile.arkivEntityKey} searcher=${profile.searcher} extractions=${profile.extractions} lastSeenBlock=${profile.lastSeenBlock}`
  );
}

main().catch((err) => {
  console.error("FAILED", err);
  process.exit(1);
});
