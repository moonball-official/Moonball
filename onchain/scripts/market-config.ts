import * as fs from "fs";
import * as path from "path";
import { getAddress, isAddress, ZeroAddress } from "ethers";

/** Base Sepolia rehearsal values; this module must not be reused for mainnet. */
export const MARKET_REHEARSAL = Object.freeze({
  network: "baseSepolia",
  chainId: 84532n,
  moon: getAddress("0x70171D11Dfe7791431F06c8E1e7837517394D58D"),
  usdc: getAddress("0x036CbD53842c5426634e7929541eC2318f3dCF7e"),
  safe: getAddress("0xB2cb3851d8055bA6aA8Cf7E548c1211D475e0d29"),
  treasuryRecipient: getAddress("0xd46ac2c972c7f49ead826a40f0f0eeba0e12847c"),
  polRecipient: getAddress("0xB2cb3851d8055bA6aA8Cf7E548c1211D475e0d29"),
  uniswapV3Factory: getAddress("0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"),
  feeTier: 10_000,
});

export const MARKET_DEPLOY_APPROVAL =
  "BASE_SEPOLIA_SPLITTER_AND_REGISTRY_ONLY";
export const MARKET_RECORD_NAME = "baseSepolia.market";
export const MARKET_RECORD_ARCHITECTURE = "moonball-v1-market-infrastructure";

export interface CoreCandidateRecord {
  status: string;
  architecture: string;
  network: string;
  moon: string;
  usdc: string;
}

export interface MarketDeploymentRecord {
  status: "candidate";
  architecture: typeof MARKET_RECORD_ARCHITECTURE;
  network: "baseSepolia";
  chainId: 84532;
  moon: string;
  usdc: string;
  safe: string;
  treasuryRecipient: string;
  polRecipient: string;
  uniswapV3Factory: string;
  deployer: string;
  splitter: string;
  splitterTransactionHash: string;
  registry: string;
  registryTransactionHash: string;
  deployedAt: string;
}

export function requirePinnedAddress(
  label: string,
  value: unknown,
  expected: string
): string {
  if (typeof value !== "string" || !isAddress(value)) {
    throw new Error(`${label} must be a valid address.`);
  }
  const address = getAddress(value);
  if (address !== expected) {
    throw new Error(`${label} differs from the approved Base Sepolia value.`);
  }
  return address;
}

export function requireAddress(label: string, value: unknown): string {
  if (typeof value !== "string" || !isAddress(value)) {
    throw new Error(`${label} must be a valid address.`);
  }
  const address = getAddress(value);
  if (address === ZeroAddress) throw new Error(`${label} must not be zero.`);
  return address;
}

export function validateCoreCandidate(record: unknown): CoreCandidateRecord {
  if (!record || typeof record !== "object") {
    throw new Error("Core deployment record is missing or malformed.");
  }
  const core = record as Record<string, unknown>;
  if (
    core.status !== "candidate" ||
    core.architecture !== "moonball-v1" ||
    core.network !== MARKET_REHEARSAL.network
  ) {
    throw new Error("Core deployment is not the approved Base Sepolia candidate.");
  }
  requirePinnedAddress("Core MOON", core.moon, MARKET_REHEARSAL.moon);
  requirePinnedAddress("Core USDC", core.usdc, MARKET_REHEARSAL.usdc);
  if (MARKET_REHEARSAL.treasuryRecipient === MARKET_REHEARSAL.polRecipient) {
    throw new Error("Treasury and POL recipients must be distinct.");
  }
  return core as unknown as CoreCandidateRecord;
}

export function readCoreCandidate(directory: string): CoreCandidateRecord {
  const file = path.join(directory, "baseSepolia.json");
  if (!fs.existsSync(file)) throw new Error(`Core deployment record not found: ${file}`);
  return validateCoreCandidate(JSON.parse(fs.readFileSync(file, "utf8")));
}

export function marketRecordPaths(directory: string): {
  record: string;
  partial: string;
} {
  return {
    record: path.join(directory, `${MARKET_RECORD_NAME}.json`),
    partial: path.join(directory, `${MARKET_RECORD_NAME}.partial.json`),
  };
}

export function validateMarketRecord(value: unknown): MarketDeploymentRecord {
  if (!value || typeof value !== "object") {
    throw new Error("Market deployment record is missing or malformed.");
  }
  const record = value as Record<string, unknown>;
  if (
    record.status !== "candidate" ||
    record.architecture !== MARKET_RECORD_ARCHITECTURE ||
    record.network !== MARKET_REHEARSAL.network ||
    record.chainId !== Number(MARKET_REHEARSAL.chainId)
  ) {
    throw new Error("Market deployment record has an unsupported status or network.");
  }
  for (const key of [
    "moon",
    "usdc",
    "safe",
    "treasuryRecipient",
    "polRecipient",
    "uniswapV3Factory",
  ] as const) {
    requirePinnedAddress(`Market ${key}`, record[key], MARKET_REHEARSAL[key]);
  }
  for (const key of ["deployer", "splitter", "registry"] as const) {
    requireAddress(`Market ${key}`, record[key]);
  }
  for (const key of ["splitterTransactionHash", "registryTransactionHash"] as const) {
    if (typeof record[key] !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(record[key])) {
      throw new Error(`Market ${key} must be a transaction hash.`);
    }
  }
  if (typeof record.deployedAt !== "string" || !Number.isFinite(Date.parse(record.deployedAt))) {
    throw new Error("Market deployedAt must be an ISO timestamp.");
  }
  return record as unknown as MarketDeploymentRecord;
}
