/**
 * Transfers oracle ownership to a Safe (or any multisig/timelock) once the
 * deployment is verified and operating correctly.
 *
 * In V2 the MoonballToken is an immutable, ownerless, fixed-supply ERC-20 — it
 * has no admin to transfer. The only privileged surface is the JackpotOracle:
 *
 *   - JackpotOracle.owner → SAFE_ADDRESS (controls updater + staleness config)
 *
 * The oracle's authorizedUpdater (the bridge keeper) is intentionally left alone
 * so the live bridge keeps working. Change it separately with setAuthorizedUpdater
 * from the Safe if you rotate keeper keys.
 *
 * Run:  SAFE_ADDRESS=0xSafe... npx hardhat run scripts/transfer-ownership.ts --network baseSepolia
 *
 * Config (env / .env):
 *   SAFE_ADDRESS    — new owner (required)
 *   ORACLE_ADDRESS  — oracle address; falls back to deployments/<network>.json
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

function oracleFromDeployments(): string | undefined {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) return undefined;
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  return d.oracle;
}

async function main() {
  const safe = process.env.SAFE_ADDRESS;
  if (!safe || !ethers.isAddress(safe)) {
    throw new Error("SAFE_ADDRESS must be a valid address.");
  }

  const oracleAddress = process.env.ORACLE_ADDRESS || oracleFromDeployments();
  if (!oracleAddress) {
    throw new Error(
      "ORACLE_ADDRESS unset and not found in deployments. Set it or deploy first."
    );
  }

  const [signer] = await ethers.getSigners();
  console.log(`Network: ${network.name}`);
  console.log(`Signer:  ${signer.address}`);
  console.log(`New owner (Safe): ${safe}`);

  const oracle = await ethers.getContractAt("JackpotOracle", oracleAddress);

  const me = signer.address.toLowerCase();
  const target = safe.toLowerCase();
  const eq = (a: string, b: string) => a.toLowerCase() === b;

  // Idempotent: a partially-completed run can be safely re-run.
  const oracleOwner = (await oracle.owner()).toLowerCase();
  if (eq(oracleOwner, target)) {
    console.log("• Oracle already owned by Safe, skipping.");
  } else if (eq(oracleOwner, me)) {
    console.log("→ Transferring oracle ownership to Safe…");
    await (await oracle.transferOwnership(safe)).wait();
  } else {
    console.log(`⚠ Oracle owner is ${oracleOwner}, not the signer — cannot transfer.`);
  }

  console.log("\n✓ Done. Verify on-chain:");
  console.log(`  oracle.owner   = ${await oracle.owner()}`);
  console.log(`  oracle.updater = ${await oracle.authorizedUpdater()} (bridge keeper, unchanged)`);
  console.log("  token          = immutable, ownerless (nothing to transfer)");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
