import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const WAD = 10n ** 18n; // 1 MOON / WAD dollar (18 decimals)
const moon = (n: string) => ethers.parseEther(n);

const STALENESS = 4 * 60 * 60; // 4 hours
const SUPPLY = 100_000_000n; // founder-approved whole MOON supply
const DAY = 24 * 60 * 60;

async function deployFixture() {
  const [deployer, recipient, user, other] = await ethers.getSigners();

  const Oracle = await ethers.getContractFactory("JackpotOracle");
  const oracle: any = await Oracle.deploy(
    deployer.address,
    deployer.address,
    STALENESS
  );

  const Moon = await ethers.getContractFactory("MoonballToken");
  const moonToken: any = await Moon.deploy(recipient.address);

  return { deployer, recipient, user, other, oracle, moonToken };
}

async function pushJackpot(
  oracle: any,
  jackpotMillions: number,
  hadWinner = false,
  draws = 1,
  overrides: Record<string, unknown> = {}
) {
  const now = await time.latest();
  const latest = await oracle.getLatestJackpot();
  const sequence = latest.sequence + 1n;
  const fields = {
    sequence,
    cycleId: ethers.id(hadWinner ? `cycle-${sequence}` : "cycle-1"),
    drawId: ethers.solidityPackedKeccak256(
      ["string", "uint64"],
      ["draw", now - 60]
    ),
    jackpotAmountUsd: BigInt(jackpotMillions) * 1_000_000n,
    cashValueUsd: (BigInt(jackpotMillions) * 1_000_000n) / 2n,
    lastDrawTimestamp: now - 60,
    nextDrawTimestamp: now + 3 * DAY,
    sourceTimestamp: now,
    hadWinner,
    drawsSinceReset: draws,
    ...overrides,
  };
  const snapshotId =
    typeof overrides.snapshotId === "string"
      ? overrides.snapshotId
      : ethers.solidityPackedKeccak256(
          [
            "bytes32",
            "bytes32",
            "uint256",
            "uint256",
            "uint64",
            "uint64",
            "uint64",
            "bool",
            "uint32",
          ],
          [
            fields.cycleId,
            fields.drawId,
            fields.jackpotAmountUsd,
            fields.cashValueUsd,
            fields.lastDrawTimestamp,
            fields.nextDrawTimestamp,
            fields.sourceTimestamp,
            fields.hadWinner,
            fields.drawsSinceReset,
          ]
        );
  const update = { ...fields, snapshotId };
  await oracle.fulfillJackpotData(update);
  return update;
}

describe("JackpotOracle", () => {
  it("starts not fresh and reports millions after a push", async () => {
    const { oracle } = await loadFixture(deployFixture);
    expect(await oracle.ORACLE_SCHEMA_VERSION()).to.equal(2n);
    expect(await oracle.isFresh()).to.equal(false);
    await pushJackpot(oracle, 169);
    expect(await oracle.isFresh()).to.equal(true);
    expect(await oracle.getJackpotMillions()).to.equal(169n);
  });

  it("only the authorized updater can push", async () => {
    const { oracle, user } = await loadFixture(deployFixture);
    const now = await time.latest();
    await expect(
      oracle.connect(user).fulfillJackpotData({
        sequence: 1,
        snapshotId: ethers.id("unauthorized-snapshot"),
        cycleId: ethers.id("cycle-1"),
        drawId: ethers.id("draw-1"),
        jackpotAmountUsd: 169_000_000n,
        cashValueUsd: 84_000_000n,
        lastDrawTimestamp: now - 60,
        nextDrawTimestamp: now + DAY,
        sourceTimestamp: now,
        hadWinner: false,
        drawsSinceReset: 1,
      })
    ).to.be.revertedWithCustomError(oracle, "Unauthorized");
  });

  it("rejects jackpots and cash values outside sanity bounds", async () => {
    const { oracle } = await loadFixture(deployFixture);
    await expect(
      pushJackpot(oracle, 1)
    ).to.be.revertedWithCustomError(oracle, "JackpotOutOfBounds");
    await expect(
      pushJackpot(oracle, 6_000)
    ).to.be.revertedWithCustomError(oracle, "JackpotOutOfBounds");
    await expect(
      pushJackpot(oracle, 100, false, 1, { cashValueUsd: 0 })
    ).to.be.revertedWithCustomError(oracle, "CashValueOutOfBounds");
    await expect(
      pushJackpot(oracle, 100, false, 1, { cashValueUsd: 101_000_000n })
    ).to.be.revertedWithCustomError(oracle, "CashValueOutOfBounds");
  });

  it("measures freshness from the source observation, not publication time", async () => {
    const { oracle } = await loadFixture(deployFixture);
    const now = await time.latest();
    await pushJackpot(oracle, 200, false, 1, {
      lastDrawTimestamp: now - STALENESS + 30,
      sourceTimestamp: now - STALENESS + 60,
    });
    expect(await oracle.isFresh()).to.equal(true);
    await time.increase(61);
    expect(await oracle.isFresh()).to.equal(false);
  });

  it("rejects stale source observations and invalid draw chronology", async () => {
    const { oracle } = await loadFixture(deployFixture);
    const now = await time.latest();
    await expect(
      pushJackpot(oracle, 200, false, 1, {
        lastDrawTimestamp: now - STALENESS - 2,
        sourceTimestamp: now - STALENESS - 1,
      })
    ).to.be.revertedWithCustomError(oracle, "InvalidSourceTimestamp");
    await expect(
      pushJackpot(oracle, 200, false, 1, {
        lastDrawTimestamp: now + 1,
        sourceTimestamp: now,
      })
    ).to.be.revertedWithCustomError(oracle, "InvalidDrawChronology");
  });

  it("requires monotonic sequences and permanently rejects replayed snapshots", async () => {
    const { oracle } = await loadFixture(deployFixture);
    const first = await pushJackpot(oracle, 200);
    await expect(
      pushJackpot(oracle, 210, false, 2, { sequence: 1 })
    ).to.be.revertedWithCustomError(oracle, "InvalidSequence");
    await expect(
      pushJackpot(oracle, 210, false, 2, { snapshotId: first.snapshotId })
    ).to.be.revertedWithCustomError(oracle, "SnapshotAlreadyUsed");
    expect(await oracle.usedSnapshotIds(first.snapshotId)).to.equal(true);
  });

  it("binds snapshot IDs to their contents and rejects observation regressions", async () => {
    const { oracle } = await loadFixture(deployFixture);
    const first = await pushJackpot(oracle, 200);
    await expect(
      pushJackpot(oracle, 210, false, 2, { snapshotId: ethers.id("made-up") })
    ).to.be.revertedWithCustomError(oracle, "InvalidSnapshotId");
    await expect(
      pushJackpot(oracle, 210, false, 2, {
        sourceTimestamp: Number(first.sourceTimestamp) - 1,
      })
    ).to.be.revertedWithCustomError(oracle, "SourceTimestampRegression");
    await expect(
      pushJackpot(oracle, 210, false, 2, {
        lastDrawTimestamp: Number(first.lastDrawTimestamp) - 1,
      })
    ).to.be.revertedWithCustomError(oracle, "DrawTimestampRegression");
  });

  it("records cycle changes without coupling them to token or pool state", async () => {
    const { oracle } = await loadFixture(deployFixture);
    await pushJackpot(oracle, 200);
    await pushJackpot(oracle, 20, true, 0);
    const cycleChanges = await oracle.queryFilter(
      oracle.filters.ReferenceCycleChanged()
    );
    expect(cycleChanges).to.have.length(1);
    const latest = await oracle.getLatestJackpot();
    expect(latest.hadWinner).to.equal(true);
    expect(latest.drawsSinceReset).to.equal(0n);
  });

  it("publishes a reference value of (jackpotMillions / 2) dollars in WAD", async () => {
    const { oracle } = await loadFixture(deployFixture);
    // $20M floor → $10 reference
    await pushJackpot(oracle, 20);
    expect(await oracle.oracleReferenceValueWad()).to.equal((20n * WAD) / 2n);
    // $225M → $112.50 reference
    await pushJackpot(oracle, 225);
    expect(await oracle.oracleReferenceValueWad()).to.equal((225n * WAD) / 2n);
  });

  it("reference value is informational, not a peg the token honors", async () => {
    // The oracle and the token are entirely decoupled: the token never reads the
    // oracle, mints against it, or redeems at the reference value.
    const { oracle, moonToken } = await loadFixture(deployFixture);
    await pushJackpot(oracle, 300);
    expect(await oracle.oracleReferenceValueWad()).to.be.gt(0);
    // No coupling functions exist on the token at all.
    expect((moonToken as any).currentPegPrice).to.equal(undefined);
    expect((moonToken as any).redeem).to.equal(undefined);
  });

  it("only the owner can rotate the updater", async () => {
    const { oracle, user, other } = await loadFixture(deployFixture);
    await expect(
      oracle.connect(user).setAuthorizedUpdater(other.address)
    ).to.be.revertedWithCustomError(oracle, "Unauthorized");
    await oracle.setAuthorizedUpdater(other.address);
    expect(await oracle.authorizedUpdater()).to.equal(other.address);
    await expect(
      oracle.setAuthorizedUpdater(ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(oracle, "ZeroAddress");
  });

  it("lets the owner pause updates and bounds the freshness policy", async () => {
    const { oracle, user } = await loadFixture(deployFixture);
    await oracle.setUpdatesPaused(true);
    await expect(pushJackpot(oracle, 200)).to.be.revertedWithCustomError(
      oracle,
      "OracleUpdatesPaused"
    );
    await expect(
      oracle.connect(user).setUpdatesPaused(false)
    ).to.be.revertedWithCustomError(oracle, "Unauthorized");
    await expect(
      oracle.setStalenessThreshold(60)
    ).to.be.revertedWithCustomError(oracle, "InvalidStalenessThreshold");
    await expect(
      oracle.setStalenessThreshold(2 * DAY)
    ).to.be.revertedWithCustomError(oracle, "InvalidStalenessThreshold");
  });

  it("uses two-step ownership transfer", async () => {
    const { oracle, user, other } = await loadFixture(deployFixture);
    await oracle.transferOwnership(other.address);
    expect(await oracle.owner()).to.not.equal(other.address);
    expect(await oracle.pendingOwner()).to.equal(other.address);
    await expect(
      oracle.connect(user).acceptOwnership()
    ).to.be.revertedWithCustomError(oracle, "Unauthorized");
    await oracle.connect(other).acceptOwnership();
    expect(await oracle.owner()).to.equal(other.address);
    expect(await oracle.pendingOwner()).to.equal(ethers.ZeroAddress);
  });

  it("rejects unsafe constructor configuration", async () => {
    const { deployer } = await loadFixture(deployFixture);
    const Oracle = await ethers.getContractFactory("JackpotOracle");
    await expect(
      Oracle.deploy(ethers.ZeroAddress, deployer.address, STALENESS)
    ).to.be.revertedWithCustomError(Oracle, "ZeroAddress");
    await expect(
      Oracle.deploy(deployer.address, ethers.ZeroAddress, STALENESS)
    ).to.be.revertedWithCustomError(Oracle, "ZeroAddress");
    await expect(
      Oracle.deploy(deployer.address, deployer.address, 0)
    ).to.be.revertedWithCustomError(Oracle, "InvalidStalenessThreshold");
  });
});

describe("MoonballToken (fixed-supply ERC-20)", () => {
  it("mints the entire supply to the recipient at genesis", async () => {
    const { moonToken, recipient } = await loadFixture(deployFixture);
    const expected = SUPPLY * WAD;
    expect(await moonToken.name()).to.equal("Moonball");
    expect(await moonToken.symbol()).to.equal("MOON");
    expect(await moonToken.decimals()).to.equal(18);
    expect(await moonToken.TOTAL_SUPPLY()).to.equal(expected);
    expect(await moonToken.totalSupply()).to.equal(expected);
    expect(await moonToken.balanceOf(recipient.address)).to.equal(expected);
  });

  it("has no public mint or redeem (supply is immutable)", async () => {
    const { moonToken } = await loadFixture(deployFixture);
    expect((moonToken as any).mint).to.equal(undefined);
    expect((moonToken as any).redeem).to.equal(undefined);
    expect((moonToken as any).seedMint).to.equal(undefined);
    expect((moonToken as any).treasuryBalance).to.equal(undefined);
  });

  it("hardcodes the supply and accepts only a recipient constructor argument", async () => {
    const Moon = await ethers.getContractFactory("MoonballToken");
    expect(Moon.interface.deploy.inputs).to.have.length(1);
    expect(Moon.interface.deploy.inputs[0].type).to.equal("address");
    await expect(Moon.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      Moon,
      "ZeroAddress"
    );
  });

  it("transfers tokens and emits Transfer", async () => {
    const { moonToken, recipient, user } = await loadFixture(deployFixture);
    await expect(moonToken.connect(recipient).transfer(user.address, moon("100")))
      .to.emit(moonToken, "Transfer")
      .withArgs(recipient.address, user.address, moon("100"));
    expect(await moonToken.balanceOf(user.address)).to.equal(moon("100"));
  });

  it("reverts on transfer beyond balance", async () => {
    const { moonToken, user, other } = await loadFixture(deployFixture);
    await expect(
      moonToken.connect(user).transfer(other.address, moon("1"))
    ).to.be.revertedWithCustomError(moonToken, "InsufficientBalance");
  });

  it("reverts on transfer to the zero address", async () => {
    const { moonToken, recipient } = await loadFixture(deployFixture);
    await expect(
      moonToken.connect(recipient).transfer(ethers.ZeroAddress, moon("1"))
    ).to.be.revertedWithCustomError(moonToken, "ZeroAddress");
  });

  it("supports approve + transferFrom and decrements the allowance", async () => {
    const { moonToken, recipient, user, other } = await loadFixture(deployFixture);
    await moonToken.connect(recipient).approve(user.address, moon("50"));
    expect(await moonToken.allowance(recipient.address, user.address)).to.equal(moon("50"));

    await moonToken
      .connect(user)
      .transferFrom(recipient.address, other.address, moon("30"));
    expect(await moonToken.balanceOf(other.address)).to.equal(moon("30"));
    expect(await moonToken.allowance(recipient.address, user.address)).to.equal(moon("20"));
  });

  it("treats max allowance as infinite (does not decrement)", async () => {
    const { moonToken, recipient, user, other } = await loadFixture(deployFixture);
    await moonToken.connect(recipient).approve(user.address, ethers.MaxUint256);
    await moonToken
      .connect(user)
      .transferFrom(recipient.address, other.address, moon("100"));
    expect(await moonToken.allowance(recipient.address, user.address)).to.equal(
      ethers.MaxUint256
    );
  });

  it("reverts transferFrom beyond the approved allowance", async () => {
    const { moonToken, recipient, user, other } = await loadFixture(deployFixture);
    await moonToken.connect(recipient).approve(user.address, moon("10"));
    await expect(
      moonToken.connect(user).transferFrom(recipient.address, other.address, moon("11"))
    ).to.be.revertedWithCustomError(moonToken, "InsufficientAllowance");
  });
});

describe("MoonVestingWallet", () => {
  const DAY = 24 * 60 * 60;
  const YEAR = 365 * DAY;

  // Founder schedule: 1yr cliff / 4yr linear vest, 20M MOON.
  async function vestingFixture() {
    const { moonToken, recipient, user: founder } = await loadFixture(deployFixture);
    const start = (await time.latest()) + DAY; // begins tomorrow
    const cliff = YEAR;
    const duration = 4 * YEAR;
    const amount = moon("20000");

    const Vesting = await ethers.getContractFactory("MoonVestingWallet");
    const vesting: any = await Vesting.deploy(founder.address, start, duration, cliff);
    await vesting.waitForDeployment();

    // Treasury (recipient) funds the wallet.
    await moonToken.connect(recipient).transfer(await vesting.getAddress(), amount);

    return { moonToken, founder, vesting, start, cliff, duration, amount };
  }

  it("sets the beneficiary as owner and exposes the cliff/end schedule", async () => {
    const { vesting, founder, start, cliff, duration } = await loadFixture(vestingFixture);
    expect(await vesting.owner()).to.equal(founder.address);
    expect(await vesting.start()).to.equal(start);
    expect(await vesting.cliff()).to.equal(start + cliff);
    expect(await vesting.end()).to.equal(start + duration);
  });

  it("holds the full allocation locked with nothing releasable before the cliff", async () => {
    const { moonToken, vesting, amount, start, cliff } = await loadFixture(vestingFixture);
    expect(await moonToken.balanceOf(await vesting.getAddress())).to.equal(amount);
    const moonAddr = await moonToken.getAddress();
    expect(await vesting["releasable(address)"](moonAddr)).to.equal(0n);

    // One second before the cliff: still nothing.
    await time.increaseTo(start + cliff - 2);
    expect(await vesting["releasable(address)"](moonAddr)).to.equal(0n);
  });

  it("releases the linear vested amount only after the cliff", async () => {
    const { moonToken, founder, vesting, amount, start, duration } =
      await loadFixture(vestingFixture);
    const moonAddr = await moonToken.getAddress();

    // Jump to 2 years in (half the 4yr vest, well past the 1yr cliff).
    await time.increaseTo(start + duration / 2);
    const releasable: bigint = await vesting["releasable(address)"](moonAddr);
    // ~50% vested; allow a tiny block-time delta.
    expect(releasable).to.be.closeTo(amount / 2n, moon("1"));

    await vesting.connect(founder)["release(address)"](moonAddr);
    const got: bigint = await moonToken.balanceOf(founder.address);
    expect(got).to.be.closeTo(amount / 2n, moon("1"));
  });

  it("fully vests by the end of the schedule", async () => {
    const { moonToken, founder, vesting, amount, start, duration } =
      await loadFixture(vestingFixture);
    const moonAddr = await moonToken.getAddress();
    await time.increaseTo(start + duration + 1);
    expect(await vesting["releasable(address)"](moonAddr)).to.equal(amount);
    await vesting.connect(founder)["release(address)"](moonAddr);
    expect(await moonToken.balanceOf(founder.address)).to.equal(amount);
    expect(await moonToken.balanceOf(await vesting.getAddress())).to.equal(0n);
  });

  it("supports a zero-cliff linear schedule (investor with no cliff)", async () => {
    const { moonToken, recipient, other: investor } = await loadFixture(deployFixture);
    const start = await time.latest();
    const duration = 2 * YEAR;
    const amount = moon("15000");

    const Vesting = await ethers.getContractFactory("MoonVestingWallet");
    const vesting: any = await Vesting.deploy(investor.address, start, duration, 0);
    await moonToken.connect(recipient).transfer(await vesting.getAddress(), amount);

    await time.increaseTo(start + duration / 2);
    const moonAddr = await moonToken.getAddress();
    expect(await vesting["releasable(address)"](moonAddr)).to.be.closeTo(amount / 2n, moon("1"));
  });
});
