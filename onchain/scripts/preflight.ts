/**
 * Read-only public-network deployment preflight. This sends no transactions and
 * prints no private keys. DEPLOYER_ADDRESS enables address-only checks without
 * loading a signer; this does not prove key control or readiness to sign.
 *
 * Run: npx hardhat run scripts/preflight.ts --network baseSepolia
 */
import { ethers, network } from "hardhat";
import {
  assertSafeShapeForNetwork,
  resolveDeploymentConfig,
} from "./deploy-config";
import { resolvePreflightDeployer } from "./preflight-deployer";

const SAFE_ABI = [
  "function getThreshold() view returns (uint256)",
  "function getOwners() view returns (address[])",
];
const USDC_ABI = ["function decimals() view returns (uint8)"];
const EXPECTED_CHAIN_IDS: Readonly<Record<string, bigint>> = {
  baseSepolia: 84532n,
  base: 8453n,
};

async function main() {
  const expectedChainId = EXPECTED_CHAIN_IDS[network.name];
  if (!expectedChainId) {
    throw new Error("Preflight supports only baseSepolia and base public networks.");
  }

  const networkInfo = await ethers.provider.getNetwork();
  if (networkInfo.chainId !== expectedChainId) {
    throw new Error(
      `RPC chain mismatch: expected ${expectedChainId}, received ${networkInfo.chainId}.`
    );
  }

  const [deployer] = await ethers.getSigners();
  const deployerAddress = resolvePreflightDeployer(
    process.env.DEPLOYER_ADDRESS,
    deployer?.address
  );
  const config = resolveDeploymentConfig(network.name, deployerAddress, {
    UPDATER_ADDRESS: process.env.UPDATER_ADDRESS,
    ORACLE_STALENESS: process.env.ORACLE_STALENESS,
    SUPPLY_RECIPIENT: process.env.SUPPLY_RECIPIENT,
    SAFE_ADDRESS: process.env.SAFE_ADDRESS,
    USDC_ADDRESS: process.env.USDC_ADDRESS,
    SEED_JACKPOT_M: process.env.SEED_JACKPOT_M,
  });

  const balance = await ethers.provider.getBalance(deployerAddress);
  if (balance === 0n) throw new Error("Deployer has no native ETH for gas.");

  const usdcCode = await ethers.provider.getCode(config.usdc!);
  if (usdcCode === "0x") throw new Error("Configured USDC address has no contract code.");
  const usdc = new ethers.Contract(config.usdc!, USDC_ABI, ethers.provider);
  if ((await usdc.decimals()) !== 6n) {
    throw new Error("Configured USDC contract does not report 6 decimals.");
  }

  let safeShape: "1-of-3" | "2-of-3" | undefined;
  if (config.safe) {
    const safeCode = await ethers.provider.getCode(config.safe);
    if (safeCode === "0x") throw new Error("SAFE_ADDRESS has no contract code.");
    const safe = new ethers.Contract(config.safe, SAFE_ABI, ethers.provider);
    const [threshold, owners]: [bigint, string[]] = await Promise.all([
      safe.getThreshold(),
      safe.getOwners(),
    ]);
    safeShape = assertSafeShapeForNetwork(network.name, threshold, owners);
  }

  console.log("Moonball deployment preflight PASSED (read-only; no transactions sent).");
  console.log(`Network:          ${network.name} (${networkInfo.chainId})`);
  console.log(`Deployer:         ${deployerAddress}`);
  console.log(`Signer:           ${deployer ? "configured; no signature requested" : "address-only; key control not checked"}`);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} ETH`);
  console.log(`Oracle owner:     ${config.safe ?? deployerAddress}`);
  console.log(`Oracle updater:   ${config.updater}`);
  console.log(`Supply recipient: ${config.recipient}`);
  console.log(`USDC:             ${config.usdc}`);
  console.log(`Staleness:        ${config.staleness}s`);
  if (!config.safe) {
    console.warn("Warning: no Safe configured; acceptable for testnet rehearsal only.");
  } else {
    console.log(`Safe:             ${config.safe} (${safeShape})`);
    if (safeShape === "1-of-3") {
      console.warn("Warning: 1-of-3 is accepted for Base Sepolia rehearsal only; any single owner can act alone. Base mainnet requires 2-of-3.");
    }
  }
}

main().catch((error) => {
  console.error(`Preflight failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
