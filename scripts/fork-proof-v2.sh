#!/usr/bin/env bash
# Fork proof for DarkTraceHook v2 (no broadcast, no keys): runs two 3-transaction sandwiches in a single
# block on a local anvil fork of Base Sepolia against the REAL deployed hook v2 (0xCeF7…c0c0) and pool.
#   A) frontrun + backrun through the same router  -> hook v2 must emit ExtractionDetected (cross-tx state)
#   B) backrun through a second router (evasion)   -> hook v2 stays silent; the off-chain linked-origin
#      scanner (apps/indexer/src/linked-scanner.ts) must catch it.
# Usage: ./scripts/fork-proof-v2.sh            (needs foundry + `pnpm install`; uses anvil on :8549)
set -euo pipefail
cd "$(dirname "$0")/.."
F=http://127.0.0.1:8549
PM=0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408
HOOK2=0xCeF7a999885D93f23Beeb7D319A83F2949B2c0c0
T0=0x80EdDDa74D7127Db41A3Ce86a8E8d5621EC7F4Df   # tUSDC
T1=0xd501D47b246438A18C8a0BFFCF10338CfBB661a2   # tWETH
OP=0xb491fe5846DE735B6Cb03a677A3C6296FAB0aDA5   # searcher EOA (impersonated)
VIC=0x524e061C89036b12a4f377bD8999038Da3A551Db  # victim EOA (impersonated)
RA=0xc31545299093C46d87752cD6378A811BFDD9940D   # searcher router A (deployed PoolSwapTest)
RV=0x942823FD44c68d77Ad631f0aa4DEA35143E52488   # victim router (deployed PoolSwapTest)
KEY="($T0,$T1,3000,60,$HOOK2)"
SIG="swap((address,address,uint24,int24,address),(bool,int256,uint160),(bool,bool),bytes)"
MIN=4295128740; MAX=1461446703485210103287273052203988822378723970341
X=66000000000000000            # tWETH the searcher buys (exact output) and sells back
ED=$(cast keccak 'ExtractionDetected(bytes32,address,address,uint256,bytes32)')

anvil --fork-url "${BASE_SEPOLIA_RPC:-https://sepolia.base.org}" --port 8549 --auto-impersonate --silent   --retries 20 --fork-retry-backoff 2000 &
ANVIL=$!; trap 'kill $ANVIL 2>/dev/null' EXIT
for _ in $(seq 1 120); do cast block-number --rpc-url $F >/dev/null 2>&1 && break; sleep 1; done
cast block-number --rpc-url $F >/dev/null || { echo "anvil fork did not start"; exit 1; }
s() { cast send "$@" --unlocked --rpc-url $F >/dev/null; }

echo "== setup (fork only): gas ETH, second searcher router, approvals, victim tUSDC"
for a in $OP $VIC; do cast rpc anvil_setBalance $a 0x8AC7230489E80000 --rpc-url $F >/dev/null; done # 10 ETH, fork only
# --constructor-args is variadic in forge, so it must come last.
RB=$(cd "${FORGE_DIR:-contracts}" && forge create lib/v4-core/src/test/PoolSwapTest.sol:PoolSwapTest \
      --rpc-url $F --unlocked --from $OP --broadcast --constructor-args $PM | awk '/Deployed to/{print $3}')
[ -n "$RB" ] || { echo "could not deploy router B"; exit 1; }
echo "   router B (fork-only): $RB"
for r in $RA $RB; do s $T0 'approve(address,uint256)' $r $(cast max-uint) --from $OP; s $T1 'approve(address,uint256)' $r $(cast max-uint) --from $OP; done
s $T0 'approve(address,uint256)' $RV $(cast max-uint) --from $VIC
s $T0 'transfer(address,uint256)' $VIC 2000000000 --from $OP

bundle() { # $1 = backrun router
  cast rpc evm_setAutomine false --rpc-url $F >/dev/null
  local f v b n
  n=$(cast nonce $OP --rpc-url $F) # explicit nonces: with automine off, cast would reuse the confirmed nonce
  f=$(cast send $RA "$SIG" "$KEY" "(true,$X,$MIN)" "(false,false)" 0x --from $OP --nonce $n --unlocked --async --rpc-url $F --priority-gas-price 3gwei --gas-price 20gwei --gas-limit 600000)
  v=$(cast send $RV "$SIG" "$KEY" "(true,-1000000000,$MIN)" "(false,false)" 0x --from $VIC --unlocked --async --rpc-url $F --priority-gas-price 2gwei --gas-price 20gwei --gas-limit 600000)
  b=$(cast send "$1" "$SIG" "$KEY" "(false,-$X,$MAX)" "(false,false)" 0x --from $OP --nonce $((n+1)) --unlocked --async --rpc-url $F --priority-gas-price 1gwei --gas-price 20gwei --gas-limit 600000)
  cast rpc evm_mine --rpc-url $F >/dev/null; cast rpc evm_setAutomine true --rpc-url $F >/dev/null
  for t in $f $v $b; do cast receipt $t --rpc-url $F --json | python -c "
import json,sys; r=json.load(sys.stdin)
ev=[l for l in r['logs'] if l['topics'][0]=='$ED']
print('   ', r['transactionHash'][:12], 'block', int(r['blockNumber'],16), 'idx', int(r['transactionIndex'],16), 'from', r['from'][:8], 'status', r['status'], 'ExtractionDetected' if ev else '')"; done
  BLOCK=$(cast receipt $b blockNumber --rpc-url $F)
}

echo "== A) 3 separate txs, same searcher router -> expect hook v2 ExtractionDetected"
bundle $RA
echo "== B) 3 separate txs, backrun via router B (split-contract evasion) -> expect NO hook event"
bundle $RB
echo "== B) off-chain linked-origin scanner over block $BLOCK"
(cd apps/indexer && BASE_SEPOLIA_RPC=$F npx tsx src/scan-block.ts "$BLOCK")
