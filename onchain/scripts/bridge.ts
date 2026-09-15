/**
 * Moonball oracle bridge.
 *
 * Reads a consensus-verified dashboard snapshot, validates its source provenance,
 * and publishes the reference-only update to JackpotOracle. One-shot failures
 * exit non-zero so a scheduler can alert; daemon mode retries a bounded number of
 * times per polling cycle and then waits for the next cycle.
 */
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import {
  buildOracleUpdate,
  validateDashboardUrl,
  validateDeploymentRecord,
  withRetries,
} from "./bridge-lib";

const ORACLE_ABI = [
  "function fulfillJackpotData((uint64 sequence, bytes32 snapshotId, bytes32 cycleId, bytes32 drawId, uint256 jackpotAmountUsd, uint256 cashValueUsd, uint64 lastDrawTimestamp, uint64 nextDrawTimestamp, uint64 sourceTimestamp, bool hadWinner, uint32 drawsSinceReset) update) external",
  "function getLatestJackpot() view returns ((uint64 sequence, bytes32 snapshotId, bytes32 cycleId, bytes32 drawId, uint256 jackpotAmountUsd, uint256 cashValueUsd, uint64 lastDrawTimestamp, uint64 nextDrawTimestamp, uint64 sourceTimestamp, bool hadWinner, uint32 drawsSinceReset, uint64 lastUpdated))",
  "function getJackpotMillions() view returns (uint256)",
  "function isFresh() view returns (bool)",
  "function MIN_JACKPOT() view returns (uint256)",
  "function MAX_JACKPOT() view returns (uint256)",
  "function stalenessThreshold() view returns (uint64)",
  "function authorizedUpdater() view returns (address)",
  "function updatesPaused() view returns (bool)",
  "function usedSnapshotIds(bytes32 snapshotId) view returns (bool)",
  "function ORACLE_SCHEMA_VERSION() view returns (uint256)",
];

function env(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function resolveRpcUrl(networkName: string): string {
  const networkSpecific =
    networkName === "baseSepolia"
      ? process.env.BASE_SEPOLIA_RPC_URL
      : networkName === "base"
        ? process.env.BASE_RPC_URL
        : undefined;
  return networkSpecific || env("RPC_URL", networkName === "localhost" ? "http://127.0.0.1:8545" : undefined);
}

function expectedChainId(networkName: string): bigint | undefined {
  if (networkName === "baseSepolia") return 84532n;
  if (networkName === "base") return 8453n;
  if (networkName === "localhost" || networkName === "hardhat") return 31337n;
  return undefined;
}

function boundedInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be a whole number from ${minimum} through ${maximum}.`);
  }
  return value;
}

function resolveOracleAddress(networkName: string): string {
  if (process.env.ORACLE_ADDRESS) {
    if (!ethers.isAddress(process.env.ORACLE_ADDRESS)) {
      throw new Error("ORACLE_ADDRESS must be a valid address.");
    }
    return ethers.getAddress(process.env.ORACLE_ADDRESS);
  }

  const file = path.join(__dirname, "..", "deployments", `${networkName}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(
      `ORACLE_ADDRESS is unset and ${file} was not found. Deploy first or set ORACLE_ADDRESS.`
    );
  }
  return validateDeploymentRecord(JSON.parse(fs.readFileSync(file, "utf8")));
}

async function fetchLive(dashboardUrl: string): Promise<unknown> {
  const url = `${dashboardUrl.replace(/\/$/, "")}/api/powerball/live`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Dashboard returned ${response.status} for ${url}.`);
  return response.json();
}

interface PushOptions {
  dryRun: boolean;
  approvedSnapshotId?: string;
  approvedSequence?: string;
  authorizedUpdater: string;
}

function parseApprovedSequence(value: string | undefined): bigint | undefined {
  if (value === undefined || value === "") return undefined;
  if (!/^\d+$/.test(value)) throw new Error("EXPECTED_SEQUENCE must be a positive integer.");
  const sequence = BigInt(value);
  if (sequence < 1n || sequence >= (1n << 64n)) {
    throw new Error("EXPECTED_SEQUENCE must fit in uint64 and be at least 1.");
  }
  return sequence;
}

function printSnapshotPreview(update: ReturnType<typeof buildOracleUpdate>): void {
  console.log("Oracle snapshot preview:");
  console.log(`  Sequence:        ${update.sequence}`);
  console.log(`  Snapshot ID:     ${update.snapshotId}`);
  console.log(`  Cycle ID:        ${update.cycleId}`);
  console.log(`  Draw ID:         ${update.drawId}`);
  console.log(`  Jackpot:         $${update.jackpotAmountUsd / 1_000_000n}M`);
  console.log(`  Cash value:      $${update.cashValueUsd / 1_000_000n}M`);
  console.log(`  Last draw:       ${new Date(Number(update.lastDrawTimestamp) * 1_000).toISOString()}`);
  console.log(`  Next draw:       ${new Date(Number(update.nextDrawTimestamp) * 1_000).toISOString()}`);
  console.log(`  Source observed: ${new Date(Number(update.sourceTimestamp) * 1_000).toISOString()}`);
  console.log(`  Had winner:      ${update.hadWinner}`);
  console.log(`  Draws since reset: ${update.drawsSinceReset}`);
}

async function pushUpdate(
  oracle: ethers.Contract,
  live: unknown,
  options: PushOptions
): Promise<boolean> {
  const [latest, staleness, minimum, maximum, paused] = await Promise.all([
    oracle.getLatestJackpot(),
    oracle.stalenessThreshold(),
    oracle.MIN_JACKPOT(),
    oracle.MAX_JACKPOT(),
    oracle.updatesPaused(),
  ]);
  if (paused) throw new Error("Oracle updates are paused by the owner.");

  const update = buildOracleUpdate(
    live,
    BigInt(latest.sequence),
    Number(staleness)
  );
  if (update.jackpotAmountUsd < minimum || update.jackpotAmountUsd > maximum) {
    throw new Error("Snapshot is outside the deployed oracle's jackpot bounds.");
  }

  const expectedSequence = parseApprovedSequence(options.approvedSequence);
  if (
    options.approvedSnapshotId &&
    !/^0x[0-9a-fA-F]{64}$/.test(options.approvedSnapshotId)
  ) {
    throw new Error("EXPECTED_SNAPSHOT_ID must be a bytes32 hex value.");
  }
  if (
    options.approvedSnapshotId &&
    options.approvedSnapshotId.toLowerCase() !== update.snapshotId.toLowerCase()
  ) {
    throw new Error(
      `Snapshot changed after approval: expected ${options.approvedSnapshotId}, received ${update.snapshotId}.`
    );
  }
  if (expectedSequence !== undefined && expectedSequence !== update.sequence) {
    throw new Error(
      `Oracle sequence changed after approval: expected ${expectedSequence}, received ${update.sequence}.`
    );
  }

  printSnapshotPreview(update);

  if (String(latest.snapshotId).toLowerCase() === update.snapshotId.toLowerCase()) {
    console.log(`No update: snapshot ${update.snapshotId} is already current.`);
    return false;
  }
  if (await oracle.usedSnapshotIds(update.snapshotId)) {
    throw new Error(`Refusing replay of previously accepted snapshot ${update.snapshotId}.`);
  }

  if (options.dryRun) {
    await oracle.fulfillJackpotData.staticCall(update, {
      from: options.authorizedUpdater,
    });
    console.log("Read-only transaction simulation PASSED; no signature requested and no transaction sent.");
    return false;
  }

  console.log(
    `Publishing sequence ${update.sequence}: $${update.jackpotAmountUsd / 1_000_000n}M ` +
      `(cash $${update.cashValueUsd / 1_000_000n}M, source ${update.sourceTimestamp}).`
  );
  const transaction = await oracle.fulfillJackpotData(update);
  const receipt = await transaction.wait();
  console.log(
    `Confirmed in block ${receipt?.blockNumber}. On-chain jackpot: ` +
      `$${await oracle.getJackpotMillions()}M; fresh=${await oracle.isFresh()}.`
  );
  return true;
}

async function main() {
  const networkName = env("NETWORK", "localhost");
  const rpcUrl = resolveRpcUrl(networkName);
  const dryRun = process.env.DRY_RUN === "1";
  const dashboardUrl = validateDashboardUrl(
    env("DASHBOARD_URL", "http://localhost:5000")
  );
  const oracleAddress = resolveOracleAddress(networkName);
  const retryAttempts = boundedInteger("RETRY_ATTEMPTS", 3, 1, 10);
  const retryDelayMs = boundedInteger("RETRY_DELAY_MS", 2_000, 0, 60_000);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const chain = await provider.getNetwork();
  const requiredChainId = expectedChainId(networkName);
  if (requiredChainId !== undefined && chain.chainId !== requiredChainId) {
    throw new Error(
      `RPC chain mismatch: ${networkName} requires ${requiredChainId}, received ${chain.chainId}.`
    );
  }

  const readOnlyOracle = new ethers.Contract(oracleAddress, ORACLE_ABI, provider);
  const schemaVersion = await readOnlyOracle.ORACLE_SCHEMA_VERSION();
  if (schemaVersion !== 2n) {
    throw new Error(
      `Oracle ${oracleAddress} reports unsupported schema version ${schemaVersion}.`
    );
  }
  const configuredUpdater = ethers.getAddress(await readOnlyOracle.authorizedUpdater());
  if (process.env.UPDATER_ADDRESS) {
    if (!ethers.isAddress(process.env.UPDATER_ADDRESS)) {
      throw new Error("UPDATER_ADDRESS must be a valid address.");
    }
    if (ethers.getAddress(process.env.UPDATER_ADDRESS) !== configuredUpdater) {
      throw new Error(
        `UPDATER_ADDRESS does not match the oracle updater ${configuredUpdater}.`
      );
    }
  }

  let oracle = readOnlyOracle;
  let bridgeAddress = configuredUpdater;
  if (!dryRun) {
    if (
      (networkName === "baseSepolia" || networkName === "base") &&
      (!process.env.EXPECTED_SNAPSHOT_ID || !process.env.EXPECTED_SEQUENCE)
    ) {
      throw new Error(
        "Public-network publication requires EXPECTED_SNAPSHOT_ID and EXPECTED_SEQUENCE from an approved dry run."
      );
    }
    const privateKey = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
    if (!privateKey) throw new Error("Missing required env var: PRIVATE_KEY");
    const wallet = new ethers.Wallet(privateKey, provider);
    if (wallet.address !== configuredUpdater) {
      throw new Error(
        `Bridge wallet ${wallet.address} is not the authorized updater ${configuredUpdater}.`
      );
    }
    if ((await provider.getBalance(wallet.address)) === 0n) {
      throw new Error("Bridge updater has no native ETH for gas.");
    }
    oracle = new ethers.Contract(oracleAddress, ORACLE_ABI, wallet);
    bridgeAddress = wallet.address;
  }

  console.log(`${dryRun ? "Bridge preflight" : "Bridge"}: ${bridgeAddress} -> oracle ${oracleAddress}`);
  console.log(`Network: ${networkName} (${chain.chainId})`);
  console.log(`Source: ${dashboardUrl.replace(/\/$/, "")}/api/powerball/live`);

  const pollSeconds = boundedInteger("POLL_SECONDS", 0, 0, 86_400);
  const once = dryRun || process.env.ONCE === "1" || pollSeconds === 0;
  const runCycle = () =>
    withRetries(
      async () =>
        pushUpdate(oracle, await fetchLive(dashboardUrl), {
          dryRun,
          approvedSnapshotId: process.env.EXPECTED_SNAPSHOT_ID,
          approvedSequence: process.env.EXPECTED_SEQUENCE,
          authorizedUpdater: configuredUpdater,
        }),
      retryAttempts,
      retryDelayMs
    );

  if (once) {
    await runCycle();
    return;
  }

  console.log(`Polling every ${pollSeconds}s with up to ${retryAttempts} attempts per cycle.`);
  while (true) {
    try {
      await runCycle();
    } catch (error) {
      console.error(`Update cycle failed: ${(error as Error).message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollSeconds * 1_000));
  }
}

main().catch((error) => {
  console.error(`Bridge failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
