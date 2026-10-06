import { artifacts, ethers, network } from "hardhat";
import * as path from "path";
import { assertSafeShapeForNetwork } from "./deploy-config";
import {
  MARKET_REHEARSAL,
  MarketDeploymentRecord,
  readCoreCandidate,
  validateMarketRecord,
} from "./market-config";

const SAFE_ABI = [
  "function getThreshold() view returns (uint256)",
  "function getOwners() view returns (address[])",
];
const FACTORY_ABI = [
  "function feeAmountTickSpacing(uint24) view returns (int24)",
  "function getPool(address,address,uint24) view returns (address)",
];
const POOL_ABI = [
  "function factory() view returns (address)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
];

export interface MarketPreflightResult {
  safeShape: "1-of-3" | "2-of-3";
  launchPool: string;
}

function sameAddress(left: string, right: string): boolean {
  return ethers.getAddress(left) === ethers.getAddress(right);
}

async function requireCode(address: string, label: string): Promise<void> {
  if ((await ethers.provider.getCode(address)) === "0x") {
    throw new Error(`${label} has no deployed contract code at ${address}.`);
  }
}

async function requireCanonicalPool(poolAddress: string, feeTier: number): Promise<void> {
  await requireCode(poolAddress, "Canonical Uniswap v3 pool");
  const pool = new ethers.Contract(poolAddress, POOL_ABI, ethers.provider);
  const [factory, token0, token1, fee] = await Promise.all([
    pool.factory(),
    pool.token0(),
    pool.token1(),
    pool.fee(),
  ]);
  if (!sameAddress(factory, MARKET_REHEARSAL.uniswapV3Factory)) {
    throw new Error("Pool factory is not the pinned Uniswap v3 factory.");
  }
  const tokens = [ethers.getAddress(token0), ethers.getAddress(token1)].sort();
  const expectedTokens = [MARKET_REHEARSAL.moon, MARKET_REHEARSAL.usdc].sort();
  if (tokens[0] !== expectedTokens[0] || tokens[1] !== expectedTokens[1]) {
    throw new Error("Pool tokens are not the pinned MOON/USDC pair.");
  }
  if (fee !== BigInt(feeTier)) throw new Error("Pool fee tier differs from factory lookup.");
}

/** Read-only guard shared by preview, deployment, and verification. */
export async function checkMarketPreflight(): Promise<MarketPreflightResult> {
  if (network.name !== MARKET_REHEARSAL.network) {
    throw new Error("Market infrastructure rehearsal is Base Sepolia only.");
  }
  const actualNetwork = await ethers.provider.getNetwork();
  if (actualNetwork.chainId !== MARKET_REHEARSAL.chainId) {
    throw new Error("RPC is not connected to Base Sepolia chain 84532.");
  }

  const directory = path.join(__dirname, "..", "deployments");
  readCoreCandidate(directory);
  await Promise.all([
    requireCode(MARKET_REHEARSAL.moon, "MOON"),
    requireCode(MARKET_REHEARSAL.usdc, "USDC"),
    requireCode(MARKET_REHEARSAL.safe, "Safe"),
    requireCode(MARKET_REHEARSAL.uniswapV3Factory, "Uniswap v3 factory"),
  ]);

  const moon = await ethers.getContractAt("MoonballToken", MARKET_REHEARSAL.moon);
  const usdc = new ethers.Contract(
    MARKET_REHEARSAL.usdc,
    ["function decimals() view returns (uint8)"],
    ethers.provider
  );
  const safe = new ethers.Contract(MARKET_REHEARSAL.safe, SAFE_ABI, ethers.provider);
  const factory = new ethers.Contract(
    MARKET_REHEARSAL.uniswapV3Factory,
    FACTORY_ABI,
    ethers.provider
  );
  const [supply, declaredSupply, usdcDecimals, threshold, owners, tickSpacing, launchPool] =
    await Promise.all([
      moon.totalSupply(),
      moon.TOTAL_SUPPLY(),
      usdc.decimals(),
      safe.getThreshold(),
      safe.getOwners(),
      factory.feeAmountTickSpacing(MARKET_REHEARSAL.feeTier),
      factory.getPool(
        MARKET_REHEARSAL.moon,
        MARKET_REHEARSAL.usdc,
        MARKET_REHEARSAL.feeTier
      ),
    ]);

  const expectedSupply = 100_000_000n * 10n ** 18n;
  if (supply !== expectedSupply || declaredSupply !== expectedSupply) {
    throw new Error("MOON does not have the approved fixed 100,000,000 supply.");
  }
  if (usdcDecimals !== 6n) throw new Error("Official USDC does not have 6 decimals.");
  const safeShape = assertSafeShapeForNetwork(network.name, threshold, owners);
  if (tickSpacing <= 0n) throw new Error("Canonical factory does not enable the 1% fee tier.");
  if (launchPool !== ethers.ZeroAddress) {
    await requireCanonicalPool(launchPool, MARKET_REHEARSAL.feeTier);
  }
  return { safeShape, launchPool: ethers.getAddress(launchPool) };
}

async function requireDeploymentTransaction(
  hash: string,
  expectedAddress: string,
  expectedDeployer: string,
  expectedData: string,
  label: string
): Promise<void> {
  const [transaction, receipt] = await Promise.all([
    ethers.provider.getTransaction(hash),
    ethers.provider.getTransactionReceipt(hash),
  ]);
  if (!transaction || !receipt || receipt.status !== 1) {
    throw new Error(`${label} deployment transaction is missing or unsuccessful.`);
  }
  if (
    transaction.to !== null ||
    !sameAddress(transaction.from, expectedDeployer) ||
    transaction.data.toLowerCase() !== expectedData.toLowerCase() ||
    !receipt.contractAddress ||
    !sameAddress(receipt.contractAddress, expectedAddress)
  ) {
    throw new Error(`${label} deployment transaction does not match the approved artifact and constructor arguments.`);
  }
}

/** Read-only verification against both source creation data and on-chain state. */
export async function checkMarketDeployment(value: unknown): Promise<MarketDeploymentRecord> {
  const record = validateMarketRecord(value);
  await checkMarketPreflight();
  const splitterArtifact = await artifacts.readArtifact("MoonballPOLFeeSplitter");
  const registryArtifact = await artifacts.readArtifact("OfficialMarketRegistry");
  const splitterFactory = new ethers.ContractFactory(
    splitterArtifact.abi,
    splitterArtifact.bytecode
  );
  const registryFactory = new ethers.ContractFactory(
    registryArtifact.abi,
    registryArtifact.bytecode
  );
  const splitterCreation = await splitterFactory.getDeployTransaction(
    MARKET_REHEARSAL.safe,
    MARKET_REHEARSAL.treasuryRecipient,
    MARKET_REHEARSAL.polRecipient
  );
  const registryCreation = await registryFactory.getDeployTransaction(
    MARKET_REHEARSAL.safe,
    MARKET_REHEARSAL.uniswapV3Factory,
    MARKET_REHEARSAL.moon,
    MARKET_REHEARSAL.usdc
  );
  if (!splitterCreation.data || !registryCreation.data) {
    throw new Error("Compiled market creation bytecode is unavailable.");
  }
  await Promise.all([
    requireDeploymentTransaction(
      record.splitterTransactionHash,
      record.splitter,
      record.deployer,
      splitterCreation.data,
      "Fee splitter"
    ),
    requireDeploymentTransaction(
      record.registryTransactionHash,
      record.registry,
      record.deployer,
      registryCreation.data,
      "Official-market registry"
    ),
    requireCode(record.splitter, "Fee splitter"),
    requireCode(record.registry, "Official-market registry"),
  ]);

  const splitter = await ethers.getContractAt("MoonballPOLFeeSplitter", record.splitter);
  const registry = await ethers.getContractAt("OfficialMarketRegistry", record.registry);
  const [
    splitterOwner,
    treasuryRecipient,
    polRecipient,
    treasuryBps,
    registryOwner,
    factory,
    moon,
    quote,
    launchFee,
    officialPool,
    officialFeeTier,
    marketVersion,
  ] = await Promise.all([
    splitter.owner(),
    splitter.treasuryRecipient(),
    splitter.polRecipient(),
    splitter.TREASURY_SHARE_BPS(),
    registry.owner(),
    registry.uniswapV3Factory(),
    registry.moonToken(),
    registry.quoteToken(),
    registry.LAUNCH_FEE_TIER(),
    registry.officialPool(),
    registry.officialFeeTier(),
    registry.marketVersion(),
  ]);
  if (
    !sameAddress(splitterOwner, MARKET_REHEARSAL.safe) ||
    !sameAddress(treasuryRecipient, MARKET_REHEARSAL.treasuryRecipient) ||
    !sameAddress(polRecipient, MARKET_REHEARSAL.polRecipient) ||
    treasuryBps !== 1_200n ||
    !sameAddress(registryOwner, MARKET_REHEARSAL.safe) ||
    !sameAddress(factory, MARKET_REHEARSAL.uniswapV3Factory) ||
    !sameAddress(moon, MARKET_REHEARSAL.moon) ||
    !sameAddress(quote, MARKET_REHEARSAL.usdc) ||
    launchFee !== BigInt(MARKET_REHEARSAL.feeTier)
  ) {
    throw new Error("Market contract state differs from the approved Base Sepolia plan.");
  }

  if (officialPool === ethers.ZeroAddress) {
    if (officialFeeTier !== 0n || marketVersion !== 0n) {
      throw new Error("Unregistered official-market state is inconsistent.");
    }
  } else {
    const canonicalFactory = new ethers.Contract(
      MARKET_REHEARSAL.uniswapV3Factory,
      FACTORY_ABI,
      ethers.provider
    );
    const canonicalPool = await canonicalFactory.getPool(
      MARKET_REHEARSAL.moon,
      MARKET_REHEARSAL.usdc,
      officialFeeTier
    );
    if (!sameAddress(officialPool, canonicalPool) || marketVersion < 1n) {
      throw new Error("Registered official market is not canonical.");
    }
    await requireCanonicalPool(officialPool, Number(officialFeeTier));
  }
  return record;
}
