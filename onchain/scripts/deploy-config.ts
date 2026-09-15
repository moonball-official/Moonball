import { getAddress, isAddress } from "ethers";

export const OFFICIAL_USDC: Readonly<Record<string, string>> = {
  baseSepolia: getAddress("0x036CbD53842c5426634e7929541eC2318f3dCF7e"),
  base: getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
};

export interface DeploymentEnvironment {
  UPDATER_ADDRESS?: string;
  ORACLE_STALENESS?: string;
  SUPPLY_RECIPIENT?: string;
  SAFE_ADDRESS?: string;
  USDC_ADDRESS?: string;
  SEED_JACKPOT_M?: string;
}

export interface DeploymentConfig {
  isLocal: boolean;
  updater: string;
  staleness: number;
  recipient: string;
  safe?: string;
  usdc?: string;
  seedJackpotM?: number;
}

function normalizeAddress(name: string, value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (!isAddress(value)) throw new Error(`${name} must be a valid address.`);
  return getAddress(value);
}

function requiredAddress(name: string, value: string | undefined): string {
  const address = normalizeAddress(name, value);
  if (!address) throw new Error(`${name} is required on public networks.`);
  return address;
}

export function assertTwoOfThreeSafeShape(
  threshold: bigint,
  owners: readonly string[]
): void {
  if (threshold !== 2n || owners.length !== 3) {
    throw new Error(
      `SAFE_ADDRESS must be a 2-of-3 Safe; found threshold ${threshold.toString()} with ${owners.length} owners.`
    );
  }
  const normalizedOwners = owners.map((owner) => {
    if (!isAddress(owner) || getAddress(owner) === getAddress("0x0000000000000000000000000000000000000000")) {
      throw new Error("SAFE_ADDRESS returned an invalid or zero owner.");
    }
    return getAddress(owner).toLowerCase();
  });
  if (new Set(normalizedOwners).size !== normalizedOwners.length) {
    throw new Error("SAFE_ADDRESS returned duplicate owners.");
  }
}

export function resolveDeploymentConfig(
  networkName: string,
  deployerAddress: string,
  env: DeploymentEnvironment
): DeploymentConfig {
  const deployer = requiredAddress("deployer", deployerAddress);
  const isLocal = networkName === "hardhat" || networkName === "localhost";

  const staleness = Number(env.ORACLE_STALENESS ?? "14400");
  if (!Number.isSafeInteger(staleness) || staleness < 300 || staleness > 86_400) {
    throw new Error(
      "ORACLE_STALENESS must be a whole number from 300 through 86400 seconds."
    );
  }

  const updater = isLocal
    ? normalizeAddress("UPDATER_ADDRESS", env.UPDATER_ADDRESS) ?? deployer
    : requiredAddress("UPDATER_ADDRESS", env.UPDATER_ADDRESS);
  const recipient = isLocal
    ? normalizeAddress("SUPPLY_RECIPIENT", env.SUPPLY_RECIPIENT) ?? deployer
    : requiredAddress("SUPPLY_RECIPIENT", env.SUPPLY_RECIPIENT);
  const safe = normalizeAddress("SAFE_ADDRESS", env.SAFE_ADDRESS);
  const usdc = isLocal
    ? normalizeAddress("USDC_ADDRESS", env.USDC_ADDRESS)
    : requiredAddress("USDC_ADDRESS", env.USDC_ADDRESS);

  const expectedUsdc = OFFICIAL_USDC[networkName];
  if (expectedUsdc && usdc !== expectedUsdc) {
    throw new Error(
      `USDC_ADDRESS must be the official USDC deployment for ${networkName}: ${expectedUsdc}.`
    );
  }

  if (!isLocal && safe && updater === safe) {
    throw new Error("UPDATER_ADDRESS must be separate from SAFE_ADDRESS on public networks.");
  }

  if (networkName === "base") {
    if (!safe) throw new Error("SAFE_ADDRESS is required for Base mainnet.");
    if (recipient !== safe) {
      throw new Error("SUPPLY_RECIPIENT must equal SAFE_ADDRESS on Base mainnet.");
    }
    if (updater === safe) {
      throw new Error("UPDATER_ADDRESS must be separate from SAFE_ADDRESS on Base mainnet.");
    }
  }

  let seedJackpotM: number | undefined;
  if (env.SEED_JACKPOT_M !== undefined && env.SEED_JACKPOT_M !== "") {
    if (!isLocal) {
      throw new Error(
        "SEED_JACKPOT_M is local-only; publish public-network data through the verified bridge."
      );
    }
    seedJackpotM = Number(env.SEED_JACKPOT_M);
    if (!Number.isSafeInteger(seedJackpotM) || seedJackpotM < 20 || seedJackpotM > 5_000) {
      throw new Error("SEED_JACKPOT_M must be a whole number from 20 through 5000.");
    }
    if (updater !== deployer) {
      throw new Error(
        "SEED_JACKPOT_M requires the deployer to be the updater; otherwise publish the initial value through the bridge."
      );
    }
  }

  return { isLocal, updater, staleness, recipient, safe, usdc, seedJackpotM };
}
