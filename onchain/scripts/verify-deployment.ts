/** Read-only verification of a recorded Moonball deployment and vesting set. */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const TOTAL_SUPPLY = 100_000_000n * 10n ** 18n;
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

function readJson(file: string): Record<string, any> {
  if (!fs.existsSync(file)) throw new Error(`Required deployment record not found: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function addressField(record: Record<string, any>, name: string): string {
  const value = record[name];
  if (typeof value !== "string" || !ethers.isAddress(value)) {
    throw new Error(`Deployment record field ${name} is not a valid address.`);
  }
  return ethers.getAddress(value);
}

async function requireCode(address: string, label: string): Promise<void> {
  await retryRpcRead(`${label} bytecode read`, async () => {
    if ((await ethers.provider.getCode(address)) === "0x") {
      throw new Error(`${label} has no contract code at ${address}.`);
    }
  });
}

async function main() {
  const directory = path.join(__dirname, "..", "deployments");
  const deploymentFile = path.join(directory, `${network.name}.json`);
  const deployment = readJson(deploymentFile);
  if (deployment.status === "deprecated") {
    throw new Error("Refusing to verify a deployment record marked deprecated.");
  }
  if (!["local", "candidate", "current"].includes(deployment.status)) {
    throw new Error("Deployment record has an unsupported status.");
  }
  if (deployment.architecture !== "moonball-v1" || deployment.network !== network.name) {
    throw new Error("Deployment record architecture or network does not match this run.");
  }

  const moonAddress = addressField(deployment, "moon");
  const oracleAddress = addressField(deployment, "oracle");
  const usdcAddress = addressField(deployment, "usdc");
  const owner = addressField(deployment, "owner");
  const updater = addressField(deployment, "updater");
  await Promise.all([
    requireCode(moonAddress, "MOON"),
    requireCode(oracleAddress, "Oracle"),
    requireCode(usdcAddress, "USDC"),
  ]);

  const moon = await ethers.getContractAt("MoonballToken", moonAddress);
  const oracle = await ethers.getContractAt("JackpotOracle", oracleAddress);
  const usdc = new ethers.Contract(
    usdcAddress,
    ["function decimals() view returns (uint8)"],
    ethers.provider
  );
  const [totalSupply, declaredSupply, schemaVersion, chainOwner, chainUpdater, staleness, decimals] =
    await retryRpcRead("Core deployment state read", () =>
      Promise.all([
        moon.totalSupply(),
        moon.TOTAL_SUPPLY(),
        oracle.ORACLE_SCHEMA_VERSION(),
        oracle.owner(),
        oracle.authorizedUpdater(),
        oracle.stalenessThreshold(),
        usdc.decimals(),
      ])
    );
  if (totalSupply !== TOTAL_SUPPLY || declaredSupply !== TOTAL_SUPPLY) {
    throw new Error("MOON supply is not exactly 100,000,000 tokens.");
  }
  if (
    String(deployment.supply) !== "100000000" ||
    String(deployment.supplyUnits) !== TOTAL_SUPPLY.toString()
  ) {
    throw new Error("Recorded MOON supply does not match the fixed on-chain supply.");
  }
  if (schemaVersion !== 2n) throw new Error("Oracle schema version is not 2.");
  if (ethers.getAddress(chainOwner) !== owner) throw new Error("Oracle owner differs from record.");
  if (ethers.getAddress(chainUpdater) !== updater) throw new Error("Oracle updater differs from record.");
  if (staleness !== BigInt(deployment.staleness)) {
    throw new Error("Oracle staleness threshold differs from record.");
  }
  if (decimals !== 6n) throw new Error("USDC does not report 6 decimals.");

  console.log("Core deployment verification PASSED.");
  console.log(`MOON:   ${moonAddress} (100,000,000 fixed supply)`);
  console.log(`Oracle: ${oracleAddress} (schema v2, owner/updater verified)`);
  console.log(`USDC:   ${usdcAddress} (6 decimals)`);

  const vestingFile = path.join(directory, `${network.name}.vesting.json`);
  if (!fs.existsSync(vestingFile)) {
    console.log("No vesting record found; core-only verification complete.");
    return;
  }
  const vesting = readJson(vestingFile);
  if (vesting.network !== network.name || ethers.getAddress(vesting.moon) !== moonAddress) {
    throw new Error("Vesting record does not match the core deployment.");
  }
  if (!Array.isArray(vesting.wallets) || vesting.wallets.length === 0) {
    throw new Error("Vesting record contains no wallets.");
  }

  for (const item of vesting.wallets) {
    const walletAddress = ethers.getAddress(item.wallet);
    const beneficiary = ethers.getAddress(item.beneficiary);
    await requireCode(walletAddress, `${item.label} vesting wallet`);
    const wallet = await ethers.getContractAt("MoonVestingWallet", walletAddress);
    const [chainBeneficiary, locked, released, releasable, cliff] = await Promise.all([
      wallet.owner(),
      moon.balanceOf(walletAddress),
      wallet["released(address)"](moonAddress),
      wallet["releasable(address)"](moonAddress),
      wallet.cliff(),
    ]);
    if (ethers.getAddress(chainBeneficiary) !== beneficiary) {
      throw new Error(`${item.label} vesting beneficiary differs from record.`);
    }
    if (locked + released !== ethers.parseEther(String(item.amount))) {
      throw new Error(`${item.label} vesting allocation differs from record.`);
    }
    const latestBlock = await ethers.provider.getBlock("latest");
    if (latestBlock && BigInt(latestBlock.timestamp) < cliff && releasable !== 0n) {
      throw new Error(`${item.label} has tokens releasable before its cliff.`);
    }
    console.log(
      `${item.label}: ${walletAddress} (${item.amount} MOON locked for ${beneficiary})`
    );
  }
  console.log("Vesting deployment verification PASSED.");
}

main().catch((error) => {
  console.error(`Verification failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
