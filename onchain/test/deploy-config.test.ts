import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  assertTwoOfThreeSafeShape,
  OFFICIAL_USDC,
  resolveDeploymentConfig,
} from "../scripts/deploy-config";
import { writeDeploymentRecord } from "../scripts/deployment-record";

const DEPLOYER = "0x0000000000000000000000000000000000000001";
const UPDATER = "0x0000000000000000000000000000000000000002";
const RECIPIENT = "0x0000000000000000000000000000000000000003";
const SAFE = "0x0000000000000000000000000000000000000004";
const OTHER = "0x0000000000000000000000000000000000000005";

describe("deployment configuration guards", () => {
  it("allows deployer and MockUSDC defaults only on local networks", () => {
    for (const networkName of ["hardhat", "localhost"]) {
      const config = resolveDeploymentConfig(networkName, DEPLOYER, {});
      expect(config.isLocal).to.equal(true);
      expect(config.updater).to.equal(DEPLOYER);
      expect(config.recipient).to.equal(DEPLOYER);
      expect(config.usdc).to.equal(undefined);
    }
  });

  it("requires updater, recipient, and USDC addresses on public networks", () => {
    expect(() => resolveDeploymentConfig("baseSepolia", DEPLOYER, {})).to.throw(
      "UPDATER_ADDRESS is required"
    );
    expect(() =>
      resolveDeploymentConfig("baseSepolia", DEPLOYER, { UPDATER_ADDRESS: UPDATER })
    ).to.throw("SUPPLY_RECIPIENT is required");
    expect(() =>
      resolveDeploymentConfig("baseSepolia", DEPLOYER, {
        UPDATER_ADDRESS: UPDATER,
        SUPPLY_RECIPIENT: RECIPIENT,
      })
    ).to.throw("USDC_ADDRESS is required");
  });

  it("accepts explicit Base Sepolia configuration with official USDC", () => {
    const config = resolveDeploymentConfig("baseSepolia", DEPLOYER, {
      UPDATER_ADDRESS: UPDATER,
      SUPPLY_RECIPIENT: RECIPIENT,
      USDC_ADDRESS: OFFICIAL_USDC.baseSepolia,
    });
    expect(config.isLocal).to.equal(false);
    expect(config.updater).to.equal(UPDATER);
    expect(config.recipient).to.equal(RECIPIENT);
    expect(config.usdc).to.equal(OFFICIAL_USDC.baseSepolia);
  });

  it("rejects non-official USDC addresses on Base networks", () => {
    expect(() =>
      resolveDeploymentConfig("baseSepolia", DEPLOYER, {
        UPDATER_ADDRESS: UPDATER,
        SUPPLY_RECIPIENT: RECIPIENT,
        USDC_ADDRESS: OTHER,
      })
    ).to.throw("official USDC deployment for baseSepolia");
  });

  it("requires a Safe on Base mainnet", () => {
    expect(() =>
      resolveDeploymentConfig("base", DEPLOYER, {
        UPDATER_ADDRESS: UPDATER,
        SUPPLY_RECIPIENT: RECIPIENT,
        USDC_ADDRESS: OFFICIAL_USDC.base,
      })
    ).to.throw("SAFE_ADDRESS is required for Base mainnet");
  });

  it("requires the Base mainnet supply recipient to be the Safe", () => {
    expect(() =>
      resolveDeploymentConfig("base", DEPLOYER, {
        UPDATER_ADDRESS: UPDATER,
        SUPPLY_RECIPIENT: RECIPIENT,
        SAFE_ADDRESS: SAFE,
        USDC_ADDRESS: OFFICIAL_USDC.base,
      })
    ).to.throw("SUPPLY_RECIPIENT must equal SAFE_ADDRESS");
  });

  it("requires the public-network updater to be separate from the Safe", () => {
    expect(() =>
      resolveDeploymentConfig("base", DEPLOYER, {
        UPDATER_ADDRESS: SAFE,
        SUPPLY_RECIPIENT: SAFE,
        SAFE_ADDRESS: SAFE,
        USDC_ADDRESS: OFFICIAL_USDC.base,
      })
    ).to.throw("UPDATER_ADDRESS must be separate from SAFE_ADDRESS");
  });

  it("validates staleness and optional seed values", () => {
    expect(() =>
      resolveDeploymentConfig("localhost", DEPLOYER, { ORACLE_STALENESS: "0" })
    ).to.throw("ORACLE_STALENESS must be a whole number from 300 through 86400");
    expect(() =>
      resolveDeploymentConfig("localhost", DEPLOYER, { ORACLE_STALENESS: "86401" })
    ).to.throw("ORACLE_STALENESS must be a whole number from 300 through 86400");
    expect(() =>
      resolveDeploymentConfig("localhost", DEPLOYER, { SEED_JACKPOT_M: "19" })
    ).to.throw("SEED_JACKPOT_M must be a whole number from 20 through 5000");
    expect(() =>
      resolveDeploymentConfig("localhost", DEPLOYER, {
        UPDATER_ADDRESS: UPDATER,
        SEED_JACKPOT_M: "225",
      })
    ).to.throw("publish the initial value through the bridge");
    expect(() =>
      resolveDeploymentConfig("baseSepolia", DEPLOYER, {
        UPDATER_ADDRESS: UPDATER,
        SUPPLY_RECIPIENT: RECIPIENT,
        USDC_ADDRESS: OFFICIAL_USDC.baseSepolia,
        SEED_JACKPOT_M: "225",
      })
    ).to.throw("SEED_JACKPOT_M is local-only");
  });

  it("accepts only a 2-of-3 Safe shape", () => {
    expect(() => assertTwoOfThreeSafeShape(2n, [DEPLOYER, UPDATER, RECIPIENT])).not.to.throw();
    expect(() => assertTwoOfThreeSafeShape(1n, [DEPLOYER, UPDATER, RECIPIENT])).to.throw(
      "must be a 2-of-3 Safe"
    );
    expect(() => assertTwoOfThreeSafeShape(2n, [DEPLOYER, UPDATER])).to.throw(
      "must be a 2-of-3 Safe"
    );
    expect(() => assertTwoOfThreeSafeShape(2n, [DEPLOYER, UPDATER, UPDATER])).to.throw(
      "duplicate owners"
    );
    expect(() =>
      assertTwoOfThreeSafeShape(2n, [
        DEPLOYER,
        UPDATER,
        "0x0000000000000000000000000000000000000000",
      ])
    ).to.throw("zero owner");
  });

  it("archives an existing deployment record before replacing it", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "moonball-deploy-record-"));
    try {
      writeDeploymentRecord(directory, "baseSepolia", { status: "deprecated", oracle: OTHER });
      const written = writeDeploymentRecord(directory, "baseSepolia", {
        status: "candidate",
        oracle: UPDATER,
      });
      expect(written.archivedFile).to.be.a("string");
      const archived = JSON.parse(fs.readFileSync(written.archivedFile!, "utf8"));
      const current = JSON.parse(fs.readFileSync(written.file, "utf8"));
      expect(archived.status).to.equal("deprecated");
      expect(current.status).to.equal("candidate");
    } finally {
      const resolved = path.resolve(directory);
      if (!resolved.startsWith(path.resolve(os.tmpdir()))) {
        throw new Error("Refusing to remove a test directory outside the OS temp directory.");
      }
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  });

  it("rejects unsafe deployment record names", () => {
    expect(() => writeDeploymentRecord(os.tmpdir(), "../escape", {})).to.throw(
      "unsafe path characters"
    );
  });
});
