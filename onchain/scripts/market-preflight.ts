/** Read-only Base Sepolia market-infrastructure preview. No signer is required. */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { checkMarketPreflight } from "./market-chain";
import { MARKET_REHEARSAL, marketRecordPaths } from "./market-config";

async function main(): Promise<void> {
  const result = await checkMarketPreflight();
  const paths = marketRecordPaths(path.join(__dirname, "..", "deployments"));
  console.log("Base Sepolia market-infrastructure preflight PASSED (read-only).");
  console.log(`Chain:             ${MARKET_REHEARSAL.network} (${MARKET_REHEARSAL.chainId})`);
  console.log(`MOON:              ${MARKET_REHEARSAL.moon}`);
  console.log(`USDC:              ${MARKET_REHEARSAL.usdc}`);
  console.log(`Uniswap v3 factory:${MARKET_REHEARSAL.uniswapV3Factory}`);
  console.log(`Safe / POL:        ${MARKET_REHEARSAL.safe} (${result.safeShape})`);
  console.log(`Treasury (12%):    ${MARKET_REHEARSAL.treasuryRecipient}`);
  console.log(`POL retained (88%):${MARKET_REHEARSAL.polRecipient}`);
  console.log(`Launch fee tier:   ${MARKET_REHEARSAL.feeTier} (1%)`);
  console.log(`Existing 1% pool:  ${result.launchPool}`);
  console.log(`Market record:     ${fs.existsSync(paths.record) ? "exists; no duplicate deployment" : "not created"}`);
  console.log(`Partial marker:    ${fs.existsSync(paths.partial) ? "exists; manual chain review required" : "none"}`);
  const treasuryCode = await ethers.provider.getCode(MARKET_REHEARSAL.treasuryRecipient);
  console.log(`Treasury code:     ${treasuryCode === "0x" ? "none (EOA or undeployed contract); custody unverified" : "deployed contract; custody unverified"}`);
  if (result.safeShape === "1-of-3") {
    console.warn("Warning: any one Safe owner can act alone; 1-of-3 is testnet-only.");
  }
  console.log("No key requested, signature produced, or transaction sent by this script.");
}

main().catch((error) => {
  const failure = error as { message?: unknown; name?: unknown; code?: unknown };
  const detail =
    typeof failure?.message === "string" && failure.message.length > 0
      ? failure.message
      : typeof failure?.name === "string" && failure.name.length > 0
        ? failure.name
        : "unknown error";
  const code =
    typeof failure?.code === "string" && /^[A-Z0-9_]+$/.test(failure.code)
      ? ` [${failure.code}]`
      : "";
  console.error(`Market preflight failed: ${detail}${code}`);
  process.exitCode = 1;
});
