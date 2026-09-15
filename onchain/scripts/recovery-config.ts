import { getAddress, isAddress } from "ethers";

export interface PartialDeploymentRecord {
  status: "partial";
  architecture: "moonball-v1";
  network: string;
  deployer: string;
  usdc: string;
  oracle: string;
  owner: string;
  updater: string;
  staleness: number;
  recipient: string;
  safe: string | null;
  oracleTransactionHash: string;
  oracleDeploymentNonce: number;
  oracleDeploymentBlock: number;
  oracleReceiptStatus: 1;
  recordedAt: string;
  failure: string;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Partial deployment record must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function addressField(record: Record<string, unknown>, name: string): string {
  const value = record[name];
  if (typeof value !== "string" || !isAddress(value)) {
    throw new Error(`Partial deployment field ${name} must be a valid address.`);
  }
  return getAddress(value);
}

function integerField(
  record: Record<string, unknown>,
  name: string,
  minimum: number
): number {
  const value = record[name];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`Partial deployment field ${name} must be an integer >= ${minimum}.`);
  }
  return value;
}

export function parsePartialDeploymentRecord(
  value: unknown,
  expectedNetwork: string
): PartialDeploymentRecord {
  const record = objectRecord(value);
  if (record.status !== "partial") {
    throw new Error("Recovery requires a deployment record with status partial.");
  }
  if (record.architecture !== "moonball-v1") {
    throw new Error("Partial deployment architecture must be moonball-v1.");
  }
  if (record.network !== expectedNetwork) {
    throw new Error(`Partial deployment network must be ${expectedNetwork}.`);
  }

  const transactionHash = record.oracleTransactionHash;
  if (typeof transactionHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) {
    throw new Error("Partial deployment oracleTransactionHash must be a transaction hash.");
  }
  if (record.oracleReceiptStatus !== 1) {
    throw new Error("Partial deployment oracle receipt must have successful status 1.");
  }
  if (typeof record.recordedAt !== "string" || Number.isNaN(Date.parse(record.recordedAt))) {
    throw new Error("Partial deployment recordedAt must be an ISO timestamp.");
  }
  if (typeof record.failure !== "string" || record.failure.length === 0) {
    throw new Error("Partial deployment failure must describe the interrupted stage.");
  }

  const staleness = integerField(record, "staleness", 300);
  if (staleness > 86_400) {
    throw new Error("Partial deployment staleness must not exceed 86400 seconds.");
  }

  let safe: string | null = null;
  if (record.safe !== null && record.safe !== undefined) {
    if (typeof record.safe !== "string" || !isAddress(record.safe)) {
      throw new Error("Partial deployment field safe must be a valid address or null.");
    }
    safe = getAddress(record.safe);
  }

  return {
    status: "partial",
    architecture: "moonball-v1",
    network: expectedNetwork,
    deployer: addressField(record, "deployer"),
    usdc: addressField(record, "usdc"),
    oracle: addressField(record, "oracle"),
    owner: addressField(record, "owner"),
    updater: addressField(record, "updater"),
    staleness,
    recipient: addressField(record, "recipient"),
    safe,
    oracleTransactionHash: transactionHash,
    oracleDeploymentNonce: integerField(record, "oracleDeploymentNonce", 0),
    oracleDeploymentBlock: integerField(record, "oracleDeploymentBlock", 1),
    oracleReceiptStatus: 1,
    recordedAt: record.recordedAt,
    failure: record.failure,
  };
}
