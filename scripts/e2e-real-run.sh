#!/usr/bin/env bash
# DarkTrace real end-to-end run (testnets only):
#   Base Sepolia: real sandwich through DarkTraceHook -> ExtractionDetected
#   Indexer:      rebuild from Swap events -> CPMM counterfactual -> Arkiv receipt -> Arc attestation
#   Arc Testnet:  claim the USDC rebate from RebateVault
#
# Usage:  PRIVATE_KEY=0x… ./scripts/e2e-real-run.sh
# Needs:  foundry (forge, cast), pnpm install done, the writer wallet 0xb491…aDA5
#         (~0.005 Base Sepolia ETH, a little Arc USDC for gas).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${PRIVATE_KEY:-}" ]; then
  if [ -n "${ARKIV_PRIVATE_KEY:-}" ]; then
    PRIVATE_KEY="$ARKIV_PRIVATE_KEY"
  elif [ -f .env ]; then
    PRIVATE_KEY=$(grep -E '^ARKIV_PRIVATE_KEY=' .env | head -n 1 | cut -d= -f2- | tr -d '"'\'' ' | tr -d '\r')
  fi
fi

: "${PRIVATE_KEY:?set PRIVATE_KEY to the DarkTrace writer wallet key}"
BASE_RPC="${BASE_SEPOLIA_RPC:-https://sepolia.base.org}"
export ARKIV_PRIVATE_KEY="$PRIVATE_KEY"
OUT=contracts/deployments/e2e-base-sepolia.json

git submodule update --init --recursive contracts/lib/v4-core >/dev/null
mkdir -p contracts/deployments

if [ ! -f "$OUT" ]; then
  echo "==> [1/4] Base Sepolia: deploy test tokens, routers, bundle; create pool on DarkTraceHook"
  (cd contracts && forge script script/E2ESandwich.s.sol:E2ESandwichScript --sig "setup()" \
    --rpc-url "$BASE_RPC" --private-key "$PRIVATE_KEY" --broadcast --slow)
else
  echo "==> [1/4] reusing pool from $OUT"
fi

echo "==> [2/4] Base Sepolia: frontrun -> victim -> backrun (one bundle)"
(cd contracts && forge script script/E2ESandwich.s.sol:E2ESandwichScript --sig "sandwich()" \
  --rpc-url "$BASE_RPC" --private-key "$PRIVATE_KEY" --broadcast --slow)
TX=$(node -e 'const f=require("fs"),p=require("path");const d="contracts/broadcast/E2ESandwich.s.sol/84532";const name=f.existsSync(p.join(d,"sandwich-latest.json"))?"sandwich-latest.json":"run-latest.json";console.log(JSON.parse(f.readFileSync(p.join(d,name))).receipts[0].transactionHash)')
BLOCK=$(cast receipt "$TX" blockNumber --rpc-url "$BASE_RPC")
POOL=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).poolId)' "$OUT")
echo "    sandwich tx $TX (block $BLOCK)"

echo "==> [3/4] Indexer: seal receipt on Arkiv + attest on Arc"
BASE_SEPOLIA_RPC="$BASE_RPC" pnpm --silent --filter @darktrace/indexer process-tx "$TX" || \
  echo "    (process-tx skipped/failed — the deployed watcher may have sealed it; continuing)"

echo "==> [4/4] Arc: claim the USDC rebate"
pnpm --silent --filter @darktrace/indexer claim "$POOL" "$BLOCK"

echo
echo "Base Sepolia tx: https://sepolia.basescan.org/tx/$TX"
echo "Dashboard:       https://darktrace-lovat.vercel.app/pool/$POOL"
