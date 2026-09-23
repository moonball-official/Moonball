/**
 * Deploys the Moonball V2 protocol (DEX event market) and records the addresses
 * in onchain/deployments/<network>.json for the bridge and dashboard to consume.
 *
 *   - JackpotOracle: read-only on-chain reference (jackpot millions + reference
 *     value), fed by the off-chain consensus bridge.
 *   - MoonballToken: exactly 100M fixed-supply MOON minted to the treasury/Safe.
 *     MOON has NO protocol mint/redeem and NO collateral treasury; price is
 *     discovered on the official MOON/USDC Uniswap v3 pool.
 *
 * Local:  npx hardhat node          (terminal 1)
 *         npx hardhat run scripts/deploy.ts --network localhost   (terminal 2)
 *
 * Config (env / .env):
 *   UPDATER_ADDRESS    — oracle updater / bridge keeper (public: required)
 *   ORACLE_STALENESS   — seconds before oracle data is stale (default: 14400 = 4h)
 *   SUPPLY_RECIPIENT   — receives all 100M MOON (public: required; Base: the Safe)
 *   SAFE_ADDRESS       — 2-of-3 Safe on Base; 1-of-3 or 2-of-3 on Base Sepolia
 *   SEED_JACKPOT_M     — optional localhost/Hardhat-only seed; deployer must be the updater
 *   USDC_ADDRESS       — DEX quote token (public: required and verified for Base)
 *
 * Only hardhat/localhost may fall back to the deployer or deploy MockUSDC.
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import {
  assertSafeShapeForNetwork,
  resolveDeploymentConfig,
} from "./deploy-config";
import { writeDeploymentRecord } from "./deployment-record";

const SAFE_ABI = [
  "function getThreshold() view returns (uint256)",
  "function getOwners() view returns (address[])",
];

const RPC_READ_ATTEMPTS = 30;
const RPC_READ_DELAY_MS = 1_000;

async function retryRpcRead<T>(label: string, read: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RPC_READ_ATTEMPTS; attempt++) {
    try {
      return await read();
    } catch (error) {
      lastError = error;
      if (attempt < RPC_READ_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, RPC_READ_DELAY_MS));
      }
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${label} failed after ${RPC_READ_ATTEMPTS} attempts: ${message}`);
}

async function verifySafe(safeAddress: string): Promise<"1-of-3" | "2-of-3"> {
  const code = await ethers.provider.getCode(safeAddress);
  if (code === "0x") {
    throw new Error("SAFE_ADDRESS must contain deployed contract code.");
  }

  const safe = new ethers.Contract(safeAddress, SAFE_ABI, ethers.provider);
  try {
    const [threshold, owners]: [bigint, string[]] = await Promise.all([
      safe.getThreshold(),
      safe.getOwners(),
    ]);
    return assertSafeShapeForNetwork(network.name, threshold, owners);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`SAFE_ADDRESS validation failed: ${message}`);
  }
}

async function main() {
  const deploymentDirectory = path.join(__dirname, "..", "deployments");
  const partialFile = path.join(deploymentDirectory, `${network.name}.partial.json`);
  if (fs.existsSync(partialFile)) {
    let partialStatus: unknown;
    try {
      partialStatus = JSON.parse(fs.readFileSync(partialFile, "utf8")).status;
    } catch {
      throw new Error(
        `Malformed partial deployment marker at ${partialFile}; refusing a new deployment.`
      );
    }
    if (partialStatus === "partial") {
      throw new Error(
        `An unresolved partial deployment exists at ${partialFile}; use the guarded recovery workflow instead of deploying duplicates.`
      );
    }
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Network:  ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const config = resolveDeploymentConfig(network.name, deployer.address, {
    UPDATER_ADDRESS: process.env.UPDATER_ADDRESS,
    ORACLE_STALENESS: process.env.ORACLE_STALENESS,
    SUPPLY_RECIPIENT: process.env.SUPPLY_RECIPIENT,
    SAFE_ADDRESS: process.env.SAFE_ADDRESS,
    USDC_ADDRESS: process.env.USDC_ADDRESS,
    SEED_JACKPOT_M: process.env.SEED_JACKPOT_M,
  });
  const { updater, staleness, recipient, safe, seedJackpotM } = config;

  if (!config.isLocal && safe) {
    const safeShape = await verifySafe(safe);
    console.log(`Safe:      ${safe}  (verified ${safeShape})`);
    if (safeShape === "1-of-3") {
      console.warn("Warning: 1-of-3 is accepted for Base Sepolia rehearsal only; any single owner can act alone. Base mainnet requires 2-of-3.");
    }
  }

  // DEX pair quote token (for the eventual MOON/USDC pool). Not wired into the
  // token — MOON has no collateral. We only record it for the dashboard.
  let usdcAddress = config.usdc;
  if (!usdcAddress) {
    console.log("Local network without USDC_ADDRESS — deploying test-only MockUSDC.");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mock = await MockUSDC.deploy();
    await mock.waitForDeployment();
    usdcAddress = await mock.getAddress();
  }
  console.log(`USDC:     ${usdcAddress}  (DEX pair quote token)`);

  // Oracle (read-only on-chain reference). The configured owner is installed at
  // genesis so a public deployment never relies on a one-step handoff.
  const oracleOwner = safe ?? deployer.address;
  const Oracle = await ethers.getContractFactory("JackpotOracle");
  const oracle = await Oracle.deploy(oracleOwner, updater, staleness);
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  if ((await retryRpcRead("Oracle schema read", () => oracle.ORACLE_SCHEMA_VERSION())) !== 2n) {
    throw new Error("Deployed oracle reported an unexpected schema version.");
  }
  console.log(
    `Oracle:   ${oracleAddress}  (owner ${oracleOwner}, updater ${updater}, staleness ${staleness}s)`
  );

  // Optional: push an initial jackpot so the reference value is live immediately.
  if (seedJackpotM !== undefined) {
    const jackpotM = seedJackpotM;
    const now = Math.floor(Date.now() / 1000);
    const lastDrawTimestamp = now - 60;
    const nextDrawTimestamp = now + 3 * 24 * 60 * 60;
    const cycleId = ethers.id("moonball-local-seed-cycle");
    const drawId = ethers.solidityPackedKeccak256(
      ["string", "uint64"],
      ["moonball-local-seed-draw", lastDrawTimestamp]
    );
    const jackpotAmountUsd = BigInt(jackpotM) * 1_000_000n;
    const cashValueUsd = jackpotAmountUsd / 2n;
    const snapshotId = ethers.solidityPackedKeccak256(
      [
        "bytes32",
        "bytes32",
        "uint256",
        "uint256",
        "uint64",
        "uint64",
        "uint64",
        "bool",
        "uint32",
      ],
      [
        cycleId,
        drawId,
        jackpotAmountUsd,
        cashValueUsd,
        lastDrawTimestamp,
        nextDrawTimestamp,
        now,
        false,
        1,
      ]
    );
    await (
      await oracle.fulfillJackpotData({
        sequence: 1,
        snapshotId,
        cycleId,
        drawId,
        jackpotAmountUsd,
        cashValueUsd,
        lastDrawTimestamp,
        nextDrawTimestamp,
        sourceTimestamp: now,
        hadWinner: false,
        drawsSinceReset: 1,
      })
    ).wait();
    console.log(
      `Pushed $${jackpotM}M → reference $${ethers.formatEther(await oracle.oracleReferenceValueWad())}/MOON`
    );
  }

  // Token (exactly 100M fixed supply, entirely minted to the recipient)
  const Moon = await ethers.getContractFactory("MoonballToken");
  const moonToken = await Moon.deploy(recipient);
  await moonToken.waitForDeployment();
  const moonAddress = await moonToken.getAddress();
  const supplyUnits = await retryRpcRead("MOON total supply read", () => moonToken.totalSupply());
  const supplyWhole = supplyUnits / 10n ** 18n;
  console.log(
    `MOON:     ${moonAddress}  (${supplyWhole.toString()} MOON minted to ${recipient})`
  );

  // Persist addresses for the bridge + dashboard
  const dir = deploymentDirectory;
  const out = {
    status: config.isLocal ? "local" : "candidate",
    architecture: "moonball-v1",
    network: network.name,
    usdc: usdcAddress,
    oracle: oracleAddress,
    moon: moonAddress,
    owner: oracleOwner,
    updater,
    staleness,
    supply: supplyWhole.toString(),
    supplyUnits: supplyUnits.toString(),
    recipient,
    safe: safe ?? null,
    deployedAt: new Date().toISOString(),
  };
  const written = writeDeploymentRecord(dir, network.name, out);
  if (written.archivedFile) {
    console.log(`Archived previous record: ${path.relative(dir, written.archivedFile)}`);
  }
  console.log(`\nSaved deployments/${network.name}.json`);

  // Frontend wiring: paste these into the dashboard's environment so the
  // Protocol page can read the live oracle reference + token supply.
  const chainId =
    network.name === "base" ? 8453 : network.name === "baseSepolia" ? 84532 : 31337;
  console.log("\n── Dashboard env (Protocol page) ──");
  console.log(`VITE_CHAIN_ID=${chainId}`);
  console.log(`VITE_MOON_ADDRESS=${moonAddress}`);
  console.log(`VITE_ORACLE_ADDRESS=${oracleAddress}`);
  console.log(`VITE_USDC_ADDRESS=${usdcAddress}`);
  console.log("\nNext: use the Safe-approved workflow to seed and register the official MOON/USDC pool.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
