/** Validates and publishes the recovered Base Sepolia candidate source code. */
import hre, { artifacts, ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const EXPECTED_NETWORK = "baseSepolia";
const EXPECTED_CHAIN_ID = 84532n;
const SOURCIFY_API = "https://sourcify.dev/server";
const SOURCIFY_POLL_INTERVAL_MS = 2_000;
const SOURCIFY_MAX_POLLS = 60;

interface VerificationTarget {
  label: string;
  address: string;
  transactionHash: string;
  fullyQualifiedName: string;
  constructorArguments: readonly unknown[];
}

function requiredObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredAddress(record: Record<string, unknown>, name: string): string {
  const value = record[name];
  if (typeof value !== "string" || !ethers.isAddress(value)) {
    throw new Error(`Candidate field ${name} must be a valid address.`);
  }
  return ethers.getAddress(value);
}

function requiredHash(record: Record<string, unknown>, name: string): string {
  const value = record[name];
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`Candidate field ${name} must be a transaction hash.`);
  }
  return value;
}

async function validateTarget(target: VerificationTarget): Promise<void> {
  const artifact = await artifacts.readArtifact(target.fullyQualifiedName);
  const buildInfo = await artifacts.getBuildInfo(target.fullyQualifiedName);
  if (!buildInfo) throw new Error(`Build information missing for ${target.label}.`);
  const optimizer = buildInfo.input.settings.optimizer;
  if (
    buildInfo.solcVersion !== "0.8.24" ||
    optimizer?.enabled !== true ||
    optimizer.runs !== 200
  ) {
    throw new Error(`${target.label} compiler settings differ from Solidity 0.8.24 / optimizer 200.`);
  }

  const chainCode = await ethers.provider.getCode(target.address);
  if (
    chainCode === "0x" ||
    ethers.keccak256(chainCode) !== ethers.keccak256(artifact.deployedBytecode)
  ) {
    throw new Error(`${target.label} deployed bytecode does not exactly match the artifact.`);
  }

  const transaction = await ethers.provider.getTransaction(target.transactionHash);
  const receipt = await ethers.provider.getTransactionReceipt(target.transactionHash);
  if (
    !transaction ||
    !receipt ||
    receipt.status !== 1 ||
    !receipt.contractAddress ||
    ethers.getAddress(receipt.contractAddress) !== target.address
  ) {
    throw new Error(`${target.label} deployment transaction or receipt does not match the candidate.`);
  }

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode);
  const expectedDeployment = await factory.getDeployTransaction(
    ...target.constructorArguments
  );
  if (
    typeof expectedDeployment.data !== "string" ||
    transaction.data.toLowerCase() !== expectedDeployment.data.toLowerCase()
  ) {
    throw new Error(`${target.label} creation input does not match its constructor arguments.`);
  }
  console.log(
    `${target.label} local verification PASSED: ${target.address} (solc 0.8.24, optimizer 200)`
  );
}

function describeApiError(body: unknown): string {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
  }
  return JSON.stringify(body);
}

async function sourcifyRequest(
  url: string,
  init?: Parameters<typeof fetch>[1]
): Promise<{ response: Awaited<ReturnType<typeof fetch>>; body: unknown }> {
  const response = await fetch(url, init);
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    const preview = text.replace(/\s+/g, " ").slice(0, 160);
    throw new Error(
      `Sourcify returned HTTP ${response.status} with a non-JSON response: ${preview}`
    );
  }
  return { response, body };
}

/**
 * Sourcify retired its legacy v1 API in July 2026. Hardhat Verify 2.x still
 * targets that endpoint, so use Sourcify's current ticket-based v2 API.
 */
async function publishToSourcifyV2(target: VerificationTarget): Promise<void> {
  const buildInfo = await artifacts.getBuildInfo(target.fullyQualifiedName);
  if (!buildInfo) throw new Error(`Build information missing for ${target.label}.`);

  const [sourceName, contractName] = target.fullyQualifiedName.split(":");
  const compiledContract = buildInfo.output.contracts[sourceName]?.[contractName];
  if (!compiledContract) {
    throw new Error(`Compiled output missing for ${target.fullyQualifiedName}.`);
  }
  const metadataText = (compiledContract as unknown as { metadata?: unknown }).metadata;
  if (typeof metadataText !== "string") {
    throw new Error(`Compiler metadata output missing for ${target.label}.`);
  }
  const metadata = JSON.parse(metadataText) as {
    sources?: Record<string, unknown>;
  };
  const sourcePaths = Object.keys(metadata.sources ?? {});
  if (sourcePaths.length === 0) {
    throw new Error(`Compiler metadata has no sources for ${target.label}.`);
  }

  const sources: Record<string, { content: string }> = {};
  for (const sourcePath of sourcePaths) {
    const source = buildInfo.input.sources[sourcePath];
    if (!source || typeof source.content !== "string") {
      throw new Error(`Compiler input is missing ${sourcePath}.`);
    }
    sources[sourcePath] = { content: source.content };
  }

  const submitUrl = `${SOURCIFY_API}/v2/verify/${EXPECTED_CHAIN_ID}/${target.address}`;
  const { response, body } = await sourcifyRequest(submitUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stdJsonInput: {
        language: buildInfo.input.language,
        sources,
        settings: buildInfo.input.settings,
      },
      compilerVersion: buildInfo.solcLongVersion,
      contractIdentifier: target.fullyQualifiedName,
      creationTransactionHash: target.transactionHash,
    }),
  });

  const submission = requiredObject(body, "Sourcify submission response");
  if (response.status === 409 && submission.customCode === "already_verified") {
    console.log(
      `${target.label} is already verified on Sourcify: https://repo.sourcify.dev/${EXPECTED_CHAIN_ID}/${target.address}`
    );
    return;
  }
  if (!response.ok) {
    throw new Error(`Sourcify submission failed (HTTP ${response.status}): ${describeApiError(body)}`);
  }
  const verificationId = submission.verificationId;
  if (typeof verificationId !== "string" || verificationId.length === 0) {
    throw new Error("Sourcify submission did not return a verificationId.");
  }

  for (let attempt = 0; attempt < SOURCIFY_MAX_POLLS; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, SOURCIFY_POLL_INTERVAL_MS));
    }
    const statusResult = await sourcifyRequest(
      `${SOURCIFY_API}/v2/verify/${verificationId}`
    );
    if (!statusResult.response.ok) {
      throw new Error(
        `Sourcify status check failed (HTTP ${statusResult.response.status}): ${describeApiError(statusResult.body)}`
      );
    }
    const status = requiredObject(statusResult.body, "Sourcify status response");
    if (status.isJobCompleted !== true) continue;

    const contract = requiredObject(status.contract, "Completed Sourcify contract result");
    if (
      contract.chainId !== EXPECTED_CHAIN_ID.toString() ||
      typeof contract.address !== "string" ||
      ethers.getAddress(contract.address) !== target.address ||
      typeof contract.runtimeMatch !== "string" ||
      typeof contract.creationMatch !== "string"
    ) {
      throw new Error(`Sourcify completed with an unexpected result: ${JSON.stringify(status)}`);
    }
    console.log(
      `${target.label} verified on Sourcify (${contract.creationMatch} creation, ${contract.runtimeMatch} runtime).`
    );
    console.log(`https://repo.sourcify.dev/${EXPECTED_CHAIN_ID}/${target.address}`);
    return;
  }
  throw new Error(`Sourcify verification job ${verificationId} did not finish within two minutes.`);
}

async function publishTarget(target: VerificationTarget): Promise<string[]> {
  const failures: string[] = [];
  const common = {
    address: target.address,
    contract: target.fullyQualifiedName,
    libraries: {},
  };
  const services: Array<{ label: string; task: string; args: Record<string, unknown> }> = [
    {
      label: "Blockscout",
      task: "verify:blockscout",
      args: { ...common, force: false },
    },
  ];
  if (process.env.ETHERSCAN_API_KEY) {
    services.push({
      label: "BaseScan/Etherscan",
      task: "verify:etherscan",
      args: {
        ...common,
        constructorArgsParams: [...target.constructorArguments],
        force: false,
      },
    });
  }

  try {
    console.log(`\n${target.label}: publishing to Sourcify...`);
    await publishToSourcifyV2(target);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${target.label} / Sourcify: ${message}`);
  }

  for (const service of services) {
    try {
      console.log(`\n${target.label}: publishing to ${service.label}...`);
      await hre.run(service.task, service.args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${target.label} / ${service.label}: ${message}`);
    }
  }
  return failures;
}

async function main(): Promise<void> {
  if (network.name !== EXPECTED_NETWORK) {
    throw new Error(`Source verification is hard-coded to ${EXPECTED_NETWORK}.`);
  }
  const chain = await ethers.provider.getNetwork();
  if (chain.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Source verification requires chain ID ${EXPECTED_CHAIN_ID}.`);
  }

  const recordFile = path.join(__dirname, "..", "deployments", "baseSepolia.json");
  const candidate = requiredObject(
    JSON.parse(fs.readFileSync(recordFile, "utf8")),
    "Candidate deployment record"
  );
  if (
    candidate.status !== "candidate" ||
    candidate.architecture !== "moonball-v1" ||
    candidate.network !== EXPECTED_NETWORK
  ) {
    throw new Error("Source verification requires the current Base Sepolia candidate record.");
  }
  const recovery = requiredObject(candidate.recovery, "Candidate recovery metadata");
  const staleness = candidate.staleness;
  if (typeof staleness !== "number" || !Number.isSafeInteger(staleness)) {
    throw new Error("Candidate staleness must be an integer.");
  }

  const targets: VerificationTarget[] = [
    {
      label: "JackpotOracle",
      address: requiredAddress(candidate, "oracle"),
      transactionHash: requiredHash(recovery, "oracleTransactionHash"),
      fullyQualifiedName: "contracts/JackpotOracle.sol:JackpotOracle",
      constructorArguments: [
        requiredAddress(candidate, "owner"),
        requiredAddress(candidate, "updater"),
        staleness,
      ],
    },
    {
      label: "MoonballToken",
      address: requiredAddress(candidate, "moon"),
      transactionHash: requiredHash(recovery, "moonTransactionHash"),
      fullyQualifiedName: "contracts/MoonballToken.sol:MoonballToken",
      constructorArguments: [requiredAddress(candidate, "recipient")],
    },
  ];

  for (const target of targets) await validateTarget(target);
  if (process.env.PUBLISH_SOURCE_VERIFICATION !== "1") {
    console.log("Source-verification preflight PASSED (publication disabled)." );
    return;
  }

  const failures: string[] = [];
  for (const target of targets) failures.push(...(await publishTarget(target)));
  if (failures.length > 0) {
    throw new Error(`Source publication failed:\n- ${failures.join("\n- ")}`);
  }
  console.log("\nBase Sepolia candidate source publication PASSED.");
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
