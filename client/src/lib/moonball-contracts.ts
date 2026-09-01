/**
 * On-chain wiring for the Moonball Protocol page.
 *
 * Contract addresses come from build-time env vars so the same bundle works
 * across local / Base Sepolia / Base. When VITE_MOON_ADDRESS is unset the
 * Protocol page renders a "not deployed yet" state instead of erroring.
 *
 * After running scripts/deploy.ts, paste the printed VITE_* lines into the
 * dashboard environment and rebuild.
 */

export interface ChainConfig {
  id: number;
  hexId: string;
  name: string;
  rpcUrl: string;
  explorer: string;
  usdc: string;
  nativeSymbol: string;
}

export const CHAINS: Record<number, ChainConfig> = {
  8453: {
    id: 8453,
    hexId: "0x2105",
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    explorer: "https://basescan.org",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    nativeSymbol: "ETH",
  },
  84532: {
    id: 84532,
    hexId: "0x14a34",
    name: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    explorer: "https://sepolia.basescan.org",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    nativeSymbol: "ETH",
  },
  31337: {
    id: 31337,
    hexId: "0x7a69",
    name: "Hardhat",
    rpcUrl: "http://127.0.0.1:8545",
    explorer: "",
    usdc: "",
    nativeSymbol: "ETH",
  },
};

export const ACTIVE_CHAIN_ID =
  Number(import.meta.env.VITE_CHAIN_ID) || 84532;

export const ACTIVE_CHAIN: ChainConfig =
  CHAINS[ACTIVE_CHAIN_ID] || CHAINS[84532];

const env = import.meta.env as Record<string, string | undefined>;

export const ADDRESSES = {
  moon: env.VITE_MOON_ADDRESS || "",
  oracle: env.VITE_ORACLE_ADDRESS || "",
  // USDC defaults to the canonical token on the active chain if not overridden.
  usdc: env.VITE_USDC_ADDRESS || ACTIVE_CHAIN.usdc || "",
};

/** Public RPC used for read-only contract calls when no wallet is connected. */
export const READ_RPC_URL = env.VITE_PUBLIC_RPC_URL || ACTIVE_CHAIN.rpcUrl;

/** True only when both core contract addresses are configured. */
export const IS_DEPLOYED = Boolean(ADDRESSES.moon && ADDRESSES.oracle);

// ─── ABIs (human-readable; ethers parses these directly) ────────────────
// MOON is a fixed-supply ERC-20 (V2 DEX event market): no protocol mint, redeem,
// peg, treasury, or health surface. Price is discovered on a DEX.
export const MOON_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

// The oracle is read-only: it publishes the live jackpot and an informational
// reference value (NOT a peg or tradable price).
export const ORACLE_ABI = [
  "function getJackpotMillions() view returns (uint256)",
  "function oracleReferenceValueWad() view returns (uint256)",
  "function isFresh() view returns (bool)",
];

export function explorerTx(hash: string): string {
  return ACTIVE_CHAIN.explorer ? `${ACTIVE_CHAIN.explorer}/tx/${hash}` : "";
}

export function explorerAddress(addr: string): string {
  return ACTIVE_CHAIN.explorer ? `${ACTIVE_CHAIN.explorer}/address/${addr}` : "";
}
