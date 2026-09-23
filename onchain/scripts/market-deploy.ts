/** Explicitly approved, Base Sepolia-only splitter + registry deployment. */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { checkMarketDeployment, checkMarketPreflight } from "./market-chain";
import {
  MARKET_DEPLOY_APPROVAL,
  MARKET_REHEARSAL,
  MARKET_RECORD_ARCHITECTURE,
  MarketDeploymentRecord,
  marketRecordPaths,
  requireAddress,
} from "./market-config";

function savePartial(file: string, value: Record<string, unknown>, firstWrite: boolean): void {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: firstWrite ? "wx" : "w",
  });
}

async function main(): Promise<void> {
  if (process.env.MARKET_INFRASTRUCTURE_APPROVED !== MARKET_DEPLOY_APPROVAL) {
    throw new Error("Market deployment approval token missing; no transactions were sent.");
  }
  const directory = path.join(__dirname, "..", "deployments");
  const paths = marketRecordPaths(directory);
  if (fs.existsSync(paths.record) || fs.existsSync(paths.partial)) {
    throw new Error("Market record or partial marker already exists; inspect chain state before any retry.");
  }
  const expectedDeployer = requireAddress(
    "DEPLOYER_ADDRESS",
    process.env.DEPLOYER_ADDRESS
  );
  const preflight = await checkMarketPreflight();
  const [signer] = await ethers.getSigners();
  if (!signer || ethers.getAddress(signer.address) !== expectedDeployer) {
    throw new Error("Configured private key does not match DEPLOYER_ADDRESS; no transactions were sent.");
  }
  if ((await ethers.provider.getBalance(expectedDeployer)) === 0n) {
    throw new Error("Deployer has no Base Sepolia ETH for gas; no transactions were sent.");
  }
  if (preflight.safeShape === "1-of-3") {
    console.warn("1-of-3 Safe accepted for Base Sepolia rehearsal only. Any one owner can act alone.");
  }
  console.log("Approved scope: deploy ONLY the POL fee splitter and official-market registry on Base Sepolia.");
  console.log("Excluded: oracle updates, pool creation/registration, liquidity, vesting, mainnet.");
  console.log(`Deployer: ${expectedDeployer}`);
  console.log(`Safe owner / POL recipient: ${MARKET_REHEARSAL.safe}`);
  console.log(`Treasury recipient: ${MARKET_REHEARSAL.treasuryRecipient}`);

  const partial: Record<string, unknown> = {
    status: "partial",
    architecture: MARKET_RECORD_ARCHITECTURE,
    network: MARKET_REHEARSAL.network,
    chainId: Number(MARKET_REHEARSAL.chainId),
    deployer: expectedDeployer,
    safe: MARKET_REHEARSAL.safe,
    treasuryRecipient: MARKET_REHEARSAL.treasuryRecipient,
    polRecipient: MARKET_REHEARSAL.polRecipient,
    moon: MARKET_REHEARSAL.moon,
    usdc: MARKET_REHEARSAL.usdc,
    uniswapV3Factory: MARKET_REHEARSAL.uniswapV3Factory,
    startedAt: new Date().toISOString(),
  };
  fs.mkdirSync(directory, { recursive: true });
  // Create a durable marker before the first broadcast. An interrupted run must
  // be reconciled from chain state, never repeated blindly.
  savePartial(paths.partial, partial, true);

  const Splitter = await ethers.getContractFactory("MoonballPOLFeeSplitter", signer);
  const splitter = await Splitter.deploy(
    MARKET_REHEARSAL.safe,
    MARKET_REHEARSAL.treasuryRecipient,
    MARKET_REHEARSAL.polRecipient
  );
  const splitterTransaction = splitter.deploymentTransaction();
  if (!splitterTransaction) throw new Error("Splitter deployment transaction is unavailable.");
  partial.splitterTransactionHash = splitterTransaction.hash;
  partial.splitter = await splitter.getAddress();
  savePartial(paths.partial, partial, false);
  await splitter.waitForDeployment();
  console.log(`Fee splitter deployed: ${partial.splitter}`);

  const Registry = await ethers.getContractFactory("OfficialMarketRegistry", signer);
  const registry = await Registry.deploy(
    MARKET_REHEARSAL.safe,
    MARKET_REHEARSAL.uniswapV3Factory,
    MARKET_REHEARSAL.moon,
    MARKET_REHEARSAL.usdc
  );
  const registryTransaction = registry.deploymentTransaction();
  if (!registryTransaction) throw new Error("Registry deployment transaction is unavailable.");
  partial.registryTransactionHash = registryTransaction.hash;
  partial.registry = await registry.getAddress();
  savePartial(paths.partial, partial, false);
  await registry.waitForDeployment();
  console.log(`Official-market registry deployed: ${partial.registry}`);

  const record: MarketDeploymentRecord = {
    status: "candidate",
    architecture: MARKET_RECORD_ARCHITECTURE,
    network: "baseSepolia",
    chainId: 84532,
    moon: MARKET_REHEARSAL.moon,
    usdc: MARKET_REHEARSAL.usdc,
    safe: MARKET_REHEARSAL.safe,
    treasuryRecipient: MARKET_REHEARSAL.treasuryRecipient,
    polRecipient: MARKET_REHEARSAL.polRecipient,
    uniswapV3Factory: MARKET_REHEARSAL.uniswapV3Factory,
    deployer: expectedDeployer,
    splitter: String(partial.splitter),
    splitterTransactionHash: String(partial.splitterTransactionHash),
    registry: String(partial.registry),
    registryTransactionHash: String(partial.registryTransactionHash),
    deployedAt: new Date().toISOString(),
  };
  await checkMarketDeployment(record);
  fs.writeFileSync(paths.record, `${JSON.stringify(record, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  partial.status = "complete";
  partial.completedAt = new Date().toISOString();
  savePartial(paths.partial, partial, false);
  console.log(`Saved independently verified candidate record: ${paths.record}`);
  console.log("No pool was created or registered, and no liquidity was moved.");
}

main().catch((error) => {
  console.error(`Market deployment stopped: ${(error as Error).message}`);
  console.error("If a partial marker exists, inspect its transactions and chain state before retrying.");
  process.exitCode = 1;
});
