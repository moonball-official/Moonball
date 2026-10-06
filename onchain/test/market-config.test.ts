import { expect } from "chai";
import * as path from "path";
import {
  MARKET_DEPLOY_APPROVAL,
  MARKET_REHEARSAL,
  MARKET_RECORD_ARCHITECTURE,
  marketRecordPaths,
  requirePinnedAddress,
  validateCoreCandidate,
  validateMarketRecord,
} from "../scripts/market-config";

const CORE = {
  status: "candidate",
  architecture: "moonball-v1",
  network: "baseSepolia",
  moon: MARKET_REHEARSAL.moon,
  usdc: MARKET_REHEARSAL.usdc,
};

const MARKET = {
  status: "candidate",
  architecture: MARKET_RECORD_ARCHITECTURE,
  network: "baseSepolia",
  chainId: 84532,
  moon: MARKET_REHEARSAL.moon,
  usdc: MARKET_REHEARSAL.usdc,
  safe: MARKET_REHEARSAL.safe,
  treasuryRecipient: MARKET_REHEARSAL.treasuryRecipient,
  polRecipient: MARKET_REHEARSAL.polRecipient,
  uniswapV3Factory: MARKET_REHEARSAL.uniswapV3Factory,
  deployer: "0xa51690f5C451f428CcBDa048b4c720EA4962Ee5E",
  splitter: "0x0000000000000000000000000000000000000001",
  splitterTransactionHash: `0x${"a".repeat(64)}`,
  registry: "0x0000000000000000000000000000000000000002",
  registryTransactionHash: `0x${"b".repeat(64)}`,
  deployedAt: "2026-09-21T00:00:00.000Z",
};

describe("Base Sepolia market deployment guards", () => {
  it("pins the user-approved recipients and canonical Uniswap v3 factory", () => {
    expect(MARKET_REHEARSAL.safe).to.equal(MARKET_REHEARSAL.polRecipient);
    expect(MARKET_REHEARSAL.treasuryRecipient).not.to.equal(MARKET_REHEARSAL.polRecipient);
    expect(MARKET_REHEARSAL.uniswapV3Factory.toLowerCase()).to.equal(
      "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24"
    );
    expect(MARKET_DEPLOY_APPROVAL).to.equal("BASE_SEPOLIA_SPLITTER_AND_REGISTRY_ONLY");
  });

  it("rejects a changed or deprecated core deployment", () => {
    expect(validateCoreCandidate(CORE).moon).to.equal(MARKET_REHEARSAL.moon);
    for (const changed of [
      { ...CORE, status: "deprecated" },
      { ...CORE, network: "base" },
      { ...CORE, moon: MARKET_REHEARSAL.safe },
      { ...CORE, usdc: MARKET_REHEARSAL.safe },
    ]) {
      expect(() => validateCoreCandidate(changed)).to.throw();
    }
    expect(() => requirePinnedAddress("Treasury", MARKET_REHEARSAL.safe, MARKET_REHEARSAL.treasuryRecipient)).to.throw(
      "differs from the approved Base Sepolia value"
    );
  });

  it("rejects record tampering before any on-chain verification", () => {
    expect(validateMarketRecord(MARKET).registry).to.equal(MARKET.registry);
    for (const changed of [
      { ...MARKET, status: "current" },
      { ...MARKET, chainId: 8453 },
      { ...MARKET, treasuryRecipient: MARKET_REHEARSAL.polRecipient },
      { ...MARKET, splitterTransactionHash: "0x1234" },
      { ...MARKET, registry: "0x0000000000000000000000000000000000000000" },
    ]) {
      expect(() => validateMarketRecord(changed)).to.throw();
    }
  });

  it("keeps the market record separate from the core deployment", () => {
    const paths = marketRecordPaths(path.join("workspace", "deployments"));
    expect(paths.record).to.equal(path.join("workspace", "deployments", "baseSepolia.market.json"));
    expect(paths.partial).to.equal(path.join("workspace", "deployments", "baseSepolia.market.partial.json"));
  });
});
