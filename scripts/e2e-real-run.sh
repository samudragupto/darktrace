#!/usr/bin/env bash
# DarkTrace real end-to-end run (testnets only, separate searcher & victim EOAs):
#   1. Pool & Arc v2 Vault setup (tops up RebateVault v2 reserve to 5.00 USDC; funds Victim EOA)
#   2. Base Sepolia: 3-tx sandwich in one block (Operator frontrun -> Victim swap -> Operator backrun)
#   3. Indexer:      rebuild from Swap events -> CPMM counterfactual -> Arkiv receipt -> Arc v2 attestation
#   4. Arc Testnet:  prove Operator claim reverts NotBeneficiary, then Victim EOA claims USDC rebate
#
# Usage:  PRIVATE_KEY=0x… ./scripts/e2e-real-run.sh
# Needs:  foundry (forge, cast), pnpm install done, the writer wallet 0xb491…aDA5
#         (~0.005 Base Sepolia ETH, ~4 Arc USDC for vault top-up + gas).
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
V2_OUT=contracts/deployments/e2e-v2-latest.json

git submodule update --init --recursive contracts/lib/v4-core >/dev/null
mkdir -p contracts/deployments

if [ ! -f "$OUT" ]; then
  echo "==> [1/4] Base Sepolia: deploy test tokens, routers, bundle; create pool on DarkTraceHook"
  (cd contracts && forge script script/E2ESandwich.s.sol:E2ESandwichScript --sig "setup()" \
    --rpc-url "$BASE_RPC" --private-key "$PRIVATE_KEY" --broadcast --slow)
else
  echo "==> [1/4] reusing pool from $OUT"
fi

echo "==> [2/4] Arc v2 vault top-up + Base Sepolia separate-identity 3-tx sandwich (frontrun -> victim -> backrun)"
BASE_SEPOLIA_RPC="$BASE_RPC" pnpm --silent --filter @darktrace/indexer e2e-sandwich
TX=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).backrunTx)' "$V2_OUT")
BLOCK=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).blockNumber)' "$V2_OUT")
POOL=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).poolId)' "$V2_OUT")
echo "    backrun tx $TX (block $BLOCK)"

echo "==> [3/4] Indexer: seal receipt on Arkiv + attest beneficiary on Arc v2"
BASE_SEPOLIA_RPC="$BASE_RPC" pnpm --silent --filter @darktrace/indexer process-tx "$TX" || \
  echo "    (process-tx skipped/failed — the deployed watcher may have sealed it; continuing)"

echo "==> [4/4] Arc v2: prove Operator reverts NotBeneficiary, then claim USDC rebate as Victim EOA"
pnpm --silent --filter @darktrace/indexer claim "$POOL" "$BLOCK" --as-victim --prove-revert-tx

echo
echo "Base Sepolia backrun tx: https://sepolia.basescan.org/tx/$TX"
echo "Dashboard:               https://darktrace-lovat.vercel.app/pool/$POOL"
