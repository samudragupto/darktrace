#!/usr/bin/env node
// Cross-platform runner for `pnpm e2e:real` (works in Windows PowerShell, Git Bash, macOS, Linux).
// Mirrors scripts/e2e-real-run.sh step-for-step.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

function readEnvKey(name) {
  if (process.env[name]) return process.env[name].trim();
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return "";
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith(`${name}=`)) {
      return line.slice(name.length + 1).replace(/^['"]|['"]$/g, "").trim();
    }
  }
  return "";
}

const privateKey = readEnvKey("PRIVATE_KEY") || readEnvKey("ARKIV_PRIVATE_KEY");
if (!privateKey) {
  console.error("ERROR: set PRIVATE_KEY (or ARKIV_PRIVATE_KEY in .env) to the DarkTrace writer wallet key");
  process.exit(1);
}

const baseRpc = process.env.BASE_SEPOLIA_RPC || readEnvKey("BASE_SEPOLIA_RPC") || "https://sepolia.base.org";
const env = {
  ...process.env,
  PRIVATE_KEY: privateKey,
  ARKIV_PRIVATE_KEY: privateKey,
  BASE_SEPOLIA_RPC: baseRpc,
};

function runPnpm(args) {
  const r = spawnSync("pnpm", args, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return r.status ?? 1;
}

const outPath = path.join(root, "contracts/deployments/e2e-base-sepolia.json");
const v2OutPath = path.join(root, "contracts/deployments/e2e-v2-latest.json");

if (!fs.existsSync(outPath)) {
  console.log("==> [1/4] Base Sepolia: deploy test tokens, routers, bundle; create pool on DarkTraceHook");
  execFileSync(
    "forge",
    [
      "script",
      "script/E2ESandwich.s.sol:E2ESandwichScript",
      "--sig",
      "setup()",
      "--rpc-url",
      baseRpc,
      "--private-key",
      privateKey,
      "--broadcast",
      "--slow",
    ],
    { cwd: path.join(root, "contracts"), env, stdio: "inherit" }
  );
} else {
  console.log(`==> [1/4] reusing pool from contracts/deployments/e2e-base-sepolia.json`);
}

console.log("==> [2/4] Arc v2 vault top-up + Base Sepolia separate-identity 3-tx sandwich (frontrun -> victim -> backrun)");
if (runPnpm(["--silent", "--filter", "@darktrace/indexer", "e2e-sandwich"]) !== 0) {
  process.exit(1);
}

const v2 = JSON.parse(fs.readFileSync(v2OutPath, "utf8"));
console.log(`    frontrun tx (Operator): ${v2.frontrunTx}`);
console.log(`    victim tx   (Victim):   ${v2.victimTx}`);
console.log(`    backrun tx  (Operator): ${v2.backrunTx} (block ${v2.blockNumber})`);

console.log("==> [3/4] Indexer: seal receipt on Arkiv + attest beneficiary on Arc v2");
if (runPnpm(["--silent", "--filter", "@darktrace/indexer", "process-tx", v2.backrunTx]) !== 0) {
  console.log("    (process-tx skipped/failed — the deployed watcher may have sealed it; continuing)");
}

console.log("==> [4/4] Arc v2: prove Operator reverts NotBeneficiary, then claim USDC rebate as Victim EOA");
if (
  runPnpm([
    "--silent",
    "--filter",
    "@darktrace/indexer",
    "claim",
    v2.poolId,
    String(v2.blockNumber),
    "--as-victim",
    "--prove-revert-tx",
  ]) !== 0
) {
  process.exit(1);
}

console.log("");
console.log(`Base Sepolia frontrun tx: https://sepolia.basescan.org/tx/${v2.frontrunTx}`);
console.log(`Base Sepolia victim tx:   https://sepolia.basescan.org/tx/${v2.victimTx}`);
console.log(`Base Sepolia backrun tx:  https://sepolia.basescan.org/tx/${v2.backrunTx}`);
console.log(`Dashboard:                https://darktrace-lovat.vercel.app/pool/${v2.poolId}`);

