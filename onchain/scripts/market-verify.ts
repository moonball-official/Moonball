/** Read-only verification of the recorded Base Sepolia market infrastructure. */
import * as fs from "fs";
import * as path from "path";
import { checkMarketDeployment } from "./market-chain";
import { marketRecordPaths } from "./market-config";

async function main(): Promise<void> {
  const paths = marketRecordPaths(path.join(__dirname, "..", "deployments"));
  if (!fs.existsSync(paths.record)) {
    throw new Error("No market deployment record exists; the contracts have not been deployed by this workflow.");
  }
  const record = JSON.parse(fs.readFileSync(paths.record, "utf8"));
  const verified = await checkMarketDeployment(record);
  console.log("Base Sepolia market-infrastructure verification PASSED (read-only).");
  console.log(`Fee splitter:            ${verified.splitter}`);
  console.log(`Official-market registry:${verified.registry}`);
  console.log(`Safe owner / POL:        ${verified.safe}`);
  console.log(`Treasury recipient:      ${verified.treasuryRecipient}`);
  console.log("Creation transactions match compiled artifacts and approved constructor values.");
  console.log("Verification does not imply an audit, pool registration, liquidity, or production approval.");
}

main().catch((error) => {
  console.error(`Market verification failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
