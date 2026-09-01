import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
const accounts = DEPLOYER_KEY ? [DEPLOYER_KEY] : [];

// Per-network RPC endpoints, each falling back to a shared RPC_URL so a single
// env var still works for one-network setups.
const BASE_RPC = process.env.BASE_RPC_URL || process.env.RPC_URL || "";
const BASE_SEPOLIA_RPC =
  process.env.BASE_SEPOLIA_RPC_URL || process.env.RPC_URL || "https://sepolia.base.org";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    // Local node started with `npx hardhat node`
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Base mainnet / Sepolia — only usable when RPC_URL + key are set in .env
    base: {
      url: BASE_RPC,
      chainId: 8453,
      accounts,
    },
    baseSepolia: {
      url: BASE_SEPOLIA_RPC,
      chainId: 84532,
      accounts,
    },
  },
};

export default config;
