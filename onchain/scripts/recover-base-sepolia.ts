/**
 * Resumes the documented 2026-09-10 Base Sepolia partial deployment.
 *
 * The oracle transaction mined successfully, but the original deploy script
 * stopped when an immediate RPC read returned empty data. This recovery path
 * adopts that oracle only after re-validating its receipt, bytecode, and
 * configuration. It then deploys (or discovers) exactly one current MOON token,
 * writes the candidate record, and leaves full verification to the guarded
 * wrapper's final read-only step.
 */
import { artifacts, ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { resolveDeploymentConfig } from "./deploy-config";
import { writeDeploymentRecord } from "./deployment-record";
import { parsePartialDeploymentRecord } from "./recovery-config";

const EXPECTED_NETWORK = "baseSepolia";
const EXPECTED_CHAIN_ID = 84532n;
const TOTAL_SUPPLY = 100_000_000n * 10n ** 18n;
const READ_ATTEMPTS = 30;
const READ_DELAY_MS = 1_000;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function retryRead<T>(label: string, read: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt++) {
    try {
      return await read();
    } catch (error) {
      lastError = error;
      if (attempt < READ_ATTEMPTS) await delay(READ_DELAY_MS);
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${label} failed after ${READ_ATTEMPTS} attempts: ${message}`);
}

async function waitForCode(address: string, label: string): Promise<string> {
  for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt++) {
    const code = await ethers.provider.getCode(address);
    if (code !== "0x") return code;
    if (attempt < READ_ATTEMPTS) await delay(READ_DELAY_MS);
  }
  throw new Error(`${label} bytecode was still unavailable after ${READ_ATTEMPTS} attempts.`);
}

async function validateMoonState(address: string, recipient: string): Promise<void> {
  await retryRead(`MOON state validation at ${address}`, async () => {
    const moon = await ethers.getContractAt("MoonballToken", address);
    const [totalSupply, declaredSupply, recipientBalance, name, symbol, decimals] =
      await Promise.all([
        moon.totalSupply(),
        moon.TOTAL_SUPPLY(),
        moon.balanceOf(recipient),
        moon.name(),
        moon.symbol(),
        moon.decimals(),
      ]);
    if (
      totalSupply !== TOTAL_SUPPLY ||
      declaredSupply !== TOTAL_SUPPLY ||
      recipientBalance !== TOTAL_SUPPLY ||
      name !== "Moonball" ||
      symbol !== "MOON" ||
      decimals !== 18n
    ) {
      throw new Error("matching token bytecode has unexpected supply, recipient, or metadata state");
    }
  });
}

async function validateMoon(
  address: string,
  expectedCodeHash: string,
  recipient: string
): Promise<boolean> {
  const code = await ethers.provider.getCode(address);
  if (code === "0x" || ethers.keccak256(code) !== expectedCodeHash) return false;
  await validateMoonState(address, recipient);
  return true;
}

async function transactionHashForNonce(
  deployer: string,
  nonce: number
): Promise<string> {
  let high = await ethers.provider.getBlockNumber();
  if ((await ethers.provider.getTransactionCount(deployer, high)) <= nonce) {
    throw new Error(`Deployer nonce ${nonce} is not yet confirmed.`);
  }
  let low = Math.max(0, high - 10_000);
  while ((await ethers.provider.getTransactionCount(deployer, low)) > nonce) {
    high = low;
    low = Math.max(0, low - 10_000);
  }
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if ((await ethers.provider.getTransactionCount(deployer, middle)) > nonce) high = middle;
    else low = middle;
  }

  const block = await ethers.provider.getBlock(high);
  if (!block) throw new Error(`Could not load block ${high} for nonce recovery.`);
  for (const hash of block.transactions) {
    const transaction = await ethers.provider.getTransaction(hash);
    if (
      transaction &&
      transaction.from.toLowerCase() === deployer.toLowerCase() &&
      transaction.nonce === nonce
    ) {
      return transaction.hash;
    }
  }
  throw new Error(`Could not locate deployer nonce ${nonce} in block ${high}.`);
}

async function main(): Promise<void> {
  if (network.name !== EXPECTED_NETWORK) {
    throw new Error(`Recovery is hard-coded to ${EXPECTED_NETWORK}; found ${network.name}.`);
  }
  const chain = await ethers.provider.getNetwork();
  if (chain.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Recovery requires chain ID ${EXPECTED_CHAIN_ID}; found ${chain.chainId}.`);
  }

  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("Recovery requires the locally prompted deployer signer.");

  const deploymentDirectory = path.join(__dirname, "..", "deployments");
  const partialFile = path.join(deploymentDirectory, `${EXPECTED_NETWORK}.partial.json`);
  if (!fs.existsSync(partialFile)) {
    throw new Error(`Required partial deployment record not found: ${partialFile}`);
  }
  const partialJson = JSON.parse(fs.readFileSync(partialFile, "utf8"));
  const partial = parsePartialDeploymentRecord(partialJson, EXPECTED_NETWORK);

  const config = resolveDeploymentConfig(network.name, signer.address, {
    UPDATER_ADDRESS: process.env.UPDATER_ADDRESS,
    ORACLE_STALENESS: process.env.ORACLE_STALENESS,
    SUPPLY_RECIPIENT: process.env.SUPPLY_RECIPIENT,
    SAFE_ADDRESS: process.env.SAFE_ADDRESS,
    USDC_ADDRESS: process.env.USDC_ADDRESS,
    SEED_JACKPOT_M: process.env.SEED_JACKPOT_M,
  });
  const expectedOwner = config.safe ?? signer.address;
  if (ethers.getAddress(signer.address) !== partial.deployer) {
    throw new Error("Prompted signer does not match the partial deployment deployer.");
  }
  if (
    partial.owner !== ethers.getAddress(expectedOwner) ||
    partial.updater !== ethers.getAddress(config.updater) ||
    partial.recipient !== ethers.getAddress(config.recipient) ||
    partial.usdc !== ethers.getAddress(config.usdc!) ||
    partial.staleness !== config.staleness ||
    partial.safe !== (config.safe ?? null)
  ) {
    throw new Error("Current deployment configuration does not match the partial deployment record.");
  }

  const oracleTransaction = await ethers.provider.getTransaction(
    partial.oracleTransactionHash
  );
  const oracleReceipt = await ethers.provider.getTransactionReceipt(
    partial.oracleTransactionHash
  );
  if (
    !oracleTransaction ||
    !oracleReceipt ||
    oracleTransaction.from.toLowerCase() !== partial.deployer.toLowerCase() ||
    oracleTransaction.to !== null ||
    oracleTransaction.nonce !== partial.oracleDeploymentNonce ||
    oracleReceipt.status !== 1 ||
    oracleReceipt.blockNumber !== partial.oracleDeploymentBlock ||
    !oracleReceipt.contractAddress ||
    ethers.getAddress(oracleReceipt.contractAddress) !== partial.oracle
  ) {
    throw new Error("Partial oracle transaction or receipt does not match the recovery record.");
  }

  const oracleArtifact = await artifacts.readArtifact("JackpotOracle");
  const oracleCode = await waitForCode(partial.oracle, "Recovered oracle");
  if (ethers.keccak256(oracleCode) !== ethers.keccak256(oracleArtifact.deployedBytecode)) {
    throw new Error("Recovered oracle runtime bytecode does not match the current artifact.");
  }
  await retryRead("Recovered oracle state validation", async () => {
    const oracle = await ethers.getContractAt("JackpotOracle", partial.oracle);
    const [schema, owner, updater, staleness] = await Promise.all([
      oracle.ORACLE_SCHEMA_VERSION(),
      oracle.owner(),
      oracle.authorizedUpdater(),
      oracle.stalenessThreshold(),
    ]);
    if (
      schema !== 2n ||
      ethers.getAddress(owner) !== partial.owner ||
      ethers.getAddress(updater) !== partial.updater ||
      staleness !== BigInt(partial.staleness)
    ) {
      throw new Error("recovered oracle state differs from the partial record");
    }
  });
  console.log(`Recovered oracle validated: ${partial.oracle}`);
  console.log(`Oracle transaction: ${partial.oracleTransactionHash}`);

  const moonArtifact = await artifacts.readArtifact("MoonballToken");
  const expectedMoonCodeHash = ethers.keccak256(moonArtifact.deployedBytecode);
  const latestNonce = await ethers.provider.getTransactionCount(signer.address, "latest");
  const matches: Array<{ address: string; nonce: number }> = [];
  for (let nonce = partial.oracleDeploymentNonce + 1; nonce < latestNonce; nonce++) {
    const address = ethers.getCreateAddress({ from: signer.address, nonce });
    if (await validateMoon(address, expectedMoonCodeHash, config.recipient)) {
      matches.push({ address, nonce });
    }
  }
  if (matches.length > 1) {
    throw new Error("Multiple current MOON deployments were found after the recovered oracle; manual review is required.");
  }

  let moonAddress: string;
  let moonTransactionHash: string;
  let moonDeploymentNonce: number;
  if (matches.length === 1) {
    moonAddress = matches[0].address;
    moonDeploymentNonce = matches[0].nonce;
    moonTransactionHash = await transactionHashForNonce(signer.address, moonDeploymentNonce);
    console.log(`Existing MOON recovery candidate validated: ${moonAddress}`);
  } else {
    const pendingNonce = await ethers.provider.getTransactionCount(signer.address, "pending");
    if (pendingNonce !== latestNonce) {
      throw new Error("The deployer has a pending transaction; recovery will not send another transaction.");
    }
    moonDeploymentNonce = pendingNonce;
    const predictedAddress = ethers.getCreateAddress({
      from: signer.address,
      nonce: moonDeploymentNonce,
    });
    if ((await ethers.provider.getCode(predictedAddress)) !== "0x") {
      throw new Error("The predicted MOON deployment address already contains code.");
    }

    const Moon = await ethers.getContractFactory("MoonballToken");
    const moon = await Moon.deploy(config.recipient);
    const transaction = moon.deploymentTransaction();
    if (!transaction) throw new Error("MOON deployment did not expose a transaction.");
    moonTransactionHash = transaction.hash;
    moonAddress = ethers.getAddress(predictedAddress);
    console.log(`MOON transaction submitted: ${moonTransactionHash}`);
    console.log(`Predicted MOON address: ${moonAddress}`);

    const receipt = await transaction.wait(3);
    if (
      !receipt ||
      receipt.status !== 1 ||
      !receipt.contractAddress ||
      ethers.getAddress(receipt.contractAddress) !== moonAddress
    ) {
      throw new Error("MOON deployment receipt was missing, failed, or returned the wrong address.");
    }
    const moonCode = await waitForCode(moonAddress, "MOON");
    if (ethers.keccak256(moonCode) !== expectedMoonCodeHash) {
      throw new Error("Deployed MOON runtime bytecode does not match the current artifact.");
    }
    await validateMoonState(moonAddress, config.recipient);
    console.log(`MOON deployment validated: ${moonAddress}`);
  }

  const recoveredAt = new Date().toISOString();
  const out = {
    status: "candidate",
    architecture: "moonball-v1",
    network: network.name,
    usdc: config.usdc!,
    oracle: partial.oracle,
    moon: moonAddress,
    owner: partial.owner,
    updater: partial.updater,
    staleness: partial.staleness,
    supply: "100000000",
    supplyUnits: TOTAL_SUPPLY.toString(),
    recipient: partial.recipient,
    safe: partial.safe,
    deployedAt: recoveredAt,
    recovery: {
      oracleTransactionHash: partial.oracleTransactionHash,
      oracleDeploymentNonce: partial.oracleDeploymentNonce,
      moonTransactionHash,
      moonDeploymentNonce,
      recoveredAt,
    },
  };
  const written = writeDeploymentRecord(deploymentDirectory, network.name, out);
  if (written.archivedFile) {
    console.log(
      `Archived previous record: ${path.relative(deploymentDirectory, written.archivedFile)}`
    );
  }

  fs.writeFileSync(
    partialFile,
    `${JSON.stringify(
      {
        ...partialJson,
        status: "recovered",
        moon: moonAddress,
        moonTransactionHash,
        moonDeploymentNonce,
        recoveredAt,
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log(`Saved deployments/${network.name}.json`);
  console.log("Marked the partial deployment record recovered.");
  console.log("Next: run read-only deployment verification; do not seed the oracle or create a pool.");
}

main().catch((error) => {
  console.error(`Base Sepolia recovery failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
