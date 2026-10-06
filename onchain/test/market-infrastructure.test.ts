import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("MoonballPOLFeeSplitter", () => {
  async function splitterFixture() {
    const [owner, treasury, pol, caller, nextTreasury, nextPol] =
      await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockUSDC");
    const token: any = await Token.deploy();

    const Splitter = await ethers.getContractFactory("MoonballPOLFeeSplitter");
    const splitter: any = await Splitter.deploy(
      owner.address,
      treasury.address,
      pol.address
    );

    return {
      owner,
      treasury,
      pol,
      caller,
      nextTreasury,
      nextPol,
      token,
      splitter,
    };
  }

  it("applies 12% at token precision and sends every remainder unit to POL", async () => {
    const { treasury, pol, caller, token, splitter } = await loadFixture(
      splitterFixture
    );
    const splitterAddress = await splitter.getAddress();
    const tokenAddress = await token.getAddress();
    const collected = 1_000_003n;

    await token.mint(splitterAddress, collected);
    await expect(splitter.connect(caller).distribute(tokenAddress))
      .to.emit(splitter, "FeesDistributed")
      .withArgs(tokenAddress, collected, 120_000n, 880_003n, collected, 120_000n);

    expect(await token.balanceOf(treasury.address)).to.equal(120_000n);
    expect(await token.balanceOf(pol.address)).to.equal(880_003n);
    expect(await token.balanceOf(splitterAddress)).to.equal(0n);
  });

  it("carries indivisible-unit remainders across distributions", async () => {
    const { treasury, pol, caller, token, splitter } = await loadFixture(
      splitterFixture
    );
    const splitterAddress = await splitter.getAddress();
    const tokenAddress = await token.getAddress();

    for (const amount of [1n, 7n, 1n, 91n]) {
      await token.mint(splitterAddress, amount);
      await splitter.connect(caller).distribute(tokenAddress);
    }

    expect(await splitter.cumulativeDistributed(tokenAddress)).to.equal(100n);
    expect(await splitter.cumulativeTreasuryDistributed(tokenAddress)).to.equal(
      12n
    );
    expect(await token.balanceOf(treasury.address)).to.equal(12n);
    expect(await token.balanceOf(pol.address)).to.equal(88n);
  });

  it("allows anyone to trigger distribution but only the owner to change recipients", async () => {
    const {
      owner,
      caller,
      nextTreasury,
      nextPol,
      token,
      splitter,
    } = await loadFixture(splitterFixture);

    await expect(
      splitter
        .connect(caller)
        .setRecipients(nextTreasury.address, nextPol.address)
    )
      .to.be.revertedWithCustomError(splitter, "OwnableUnauthorizedAccount")
      .withArgs(caller.address);

    await splitter
      .connect(owner)
      .setRecipients(nextTreasury.address, nextPol.address);
    await token.mint(await splitter.getAddress(), 100n);
    await splitter.connect(caller).distribute(await token.getAddress());

    expect(await token.balanceOf(nextTreasury.address)).to.equal(12n);
    expect(await token.balanceOf(nextPol.address)).to.equal(88n);
  });

  it("validates recipients, token addresses, and nonzero balances", async () => {
    const { owner, treasury, pol, caller, token, splitter } = await loadFixture(
      splitterFixture
    );
    const Splitter = await ethers.getContractFactory("MoonballPOLFeeSplitter");

    await expect(
      Splitter.deploy(owner.address, ethers.ZeroAddress, pol.address)
    ).to.be.revertedWithCustomError(Splitter, "ZeroAddress");
    await expect(
      Splitter.deploy(owner.address, treasury.address, treasury.address)
    ).to.be.revertedWithCustomError(Splitter, "DuplicateRecipient");
    await expect(
      splitter.connect(owner).setRecipients(ethers.ZeroAddress, pol.address)
    ).to.be.revertedWithCustomError(splitter, "ZeroAddress");
    await expect(
      splitter.connect(owner).setRecipients(treasury.address, treasury.address)
    ).to.be.revertedWithCustomError(splitter, "DuplicateRecipient");
    await expect(
      splitter.connect(owner).setRecipients(await splitter.getAddress(), pol.address)
    ).to.be.revertedWithCustomError(splitter, "SelfRecipient");
    await expect(
      splitter.connect(owner).setRecipients(treasury.address, await splitter.getAddress())
    ).to.be.revertedWithCustomError(splitter, "SelfRecipient");
    await expect(splitter.connect(caller).distribute(ethers.ZeroAddress))
      .to.be.revertedWithCustomError(splitter, "InvalidToken")
      .withArgs(ethers.ZeroAddress);
    await expect(splitter.connect(caller).distribute(caller.address))
      .to.be.revertedWithCustomError(splitter, "InvalidToken")
      .withArgs(caller.address);
    await expect(splitter.connect(caller).distribute(await token.getAddress()))
      .to.be.revertedWithCustomError(splitter, "NothingToDistribute")
      .withArgs(await token.getAddress());
  });

  it("uses two-step ownership and disables renunciation", async () => {
    const { owner, caller, nextTreasury, nextPol, splitter } = await loadFixture(
      splitterFixture
    );

    await expect(splitter.connect(owner).renounceOwnership()).to.be.revertedWithCustomError(
      splitter,
      "OwnershipRenunciationDisabled"
    );
    await splitter.connect(owner).transferOwnership(caller.address);
    expect(await splitter.owner()).to.equal(owner.address);
    expect(await splitter.pendingOwner()).to.equal(caller.address);
    await splitter.connect(caller).acceptOwnership();
    await splitter
      .connect(caller)
      .setRecipients(nextTreasury.address, nextPol.address);
    expect(await splitter.owner()).to.equal(caller.address);
  });
});

describe("OfficialMarketRegistry", () => {
  async function registryFixture() {
    const [owner, treasury, user] = await ethers.getSigners();

    const Moon = await ethers.getContractFactory("MoonballToken");
    const moon: any = await Moon.deploy(treasury.address);
    const Quote = await ethers.getContractFactory("MockUSDC");
    const quote: any = await Quote.deploy();
    const Factory = await ethers.getContractFactory("MockUniswapV3Factory");
    const factory: any = await Factory.deploy();
    const Pool = await ethers.getContractFactory("MockUniswapV3Pool");
    const launchPool: any = await Pool.deploy();
    const migratedPool: any = await Pool.deploy();

    const Registry = await ethers.getContractFactory("OfficialMarketRegistry");
    const registry: any = await Registry.deploy(
      owner.address,
      await factory.getAddress(),
      await moon.getAddress(),
      await quote.getAddress()
    );

    await factory.setPool(
      await moon.getAddress(),
      await quote.getAddress(),
      10_000,
      await launchPool.getAddress()
    );

    return {
      owner,
      treasury,
      user,
      moon,
      quote,
      factory,
      launchPool,
      migratedPool,
      registry,
      Registry,
    };
  }

  it("registers the canonical 1% MOON/USDC pool", async () => {
    const { launchPool, registry } = await loadFixture(registryFixture);
    const poolAddress = await launchPool.getAddress();

    expect(await registry.LAUNCH_FEE_TIER()).to.equal(10_000);
    await expect(registry.setOfficialMarket(poolAddress, 10_000))
      .to.emit(registry, "OfficialMarketChanged")
      .withArgs(ethers.ZeroAddress, poolAddress, 0, 10_000, 1);

    expect(await registry.officialPool()).to.equal(poolAddress);
    expect(await registry.officialFeeTier()).to.equal(10_000);
    expect(await registry.marketVersion()).to.equal(1);
    expect(await registry.isOfficialPool(poolAddress)).to.equal(true);
  });

  it("rejects unofficial, code-less, and duplicate registrations", async () => {
    const { user, launchPool, migratedPool, registry } = await loadFixture(
      registryFixture
    );
    const launchPoolAddress = await launchPool.getAddress();
    const migratedPoolAddress = await migratedPool.getAddress();

    await expect(registry.connect(user).setOfficialMarket(launchPoolAddress, 10_000))
      .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount")
      .withArgs(user.address);
    await expect(registry.setOfficialMarket(user.address, 10_000))
      .to.be.revertedWithCustomError(registry, "AddressNotContract")
      .withArgs(user.address);
    await expect(registry.setOfficialMarket(migratedPoolAddress, 10_000))
      .to.be.revertedWithCustomError(registry, "NotCanonicalPool")
      .withArgs(migratedPoolAddress, launchPoolAddress);

    await registry.setOfficialMarket(launchPoolAddress, 10_000);
    await expect(registry.setOfficialMarket(launchPoolAddress, 10_000))
      .to.be.revertedWithCustomError(registry, "MarketAlreadyOfficial")
      .withArgs(launchPoolAddress, 10_000);
  });

  it("permits only an explicit owner-approved canonical migration", async () => {
    const { moon, quote, factory, launchPool, migratedPool, registry } =
      await loadFixture(registryFixture);
    await registry.setOfficialMarket(await launchPool.getAddress(), 10_000);
    await factory.setPool(
      await moon.getAddress(),
      await quote.getAddress(),
      3_000,
      await migratedPool.getAddress()
    );

    await registry.setOfficialMarket(await migratedPool.getAddress(), 3_000);
    expect(await registry.officialPool()).to.equal(await migratedPool.getAddress());
    expect(await registry.officialFeeTier()).to.equal(3_000);
    expect(await registry.marketVersion()).to.equal(2);
  });

  it("requires the 1% tier for the first official market", async () => {
    const { moon, quote, factory, migratedPool, registry } = await loadFixture(
      registryFixture
    );
    await factory.setPool(
      await moon.getAddress(),
      await quote.getAddress(),
      3_000,
      await migratedPool.getAddress()
    );

    await expect(registry.setOfficialMarket(await migratedPool.getAddress(), 3_000))
      .to.be.revertedWithCustomError(registry, "InvalidLaunchFeeTier")
      .withArgs(3_000);
  });

  it("uses two-step ownership and disables renunciation", async () => {
    const { owner, user, launchPool, registry } = await loadFixture(
      registryFixture
    );
    await expect(registry.connect(owner).renounceOwnership()).to.be.revertedWithCustomError(
      registry,
      "OwnershipRenunciationDisabled"
    );
    await registry.connect(owner).transferOwnership(user.address);
    await registry.connect(user).acceptOwnership();
    await registry.connect(user).setOfficialMarket(await launchPool.getAddress(), 10_000);
    expect(await registry.owner()).to.equal(user.address);
  });

  it("rejects unsafe constructor inputs", async () => {
    const { owner, user, moon, quote, factory, Registry } = await loadFixture(
      registryFixture
    );

    await expect(
      Registry.deploy(
        owner.address,
        user.address,
        await moon.getAddress(),
        await quote.getAddress()
      )
    )
      .to.be.revertedWithCustomError(Registry, "AddressNotContract")
      .withArgs(user.address);
    await expect(
      Registry.deploy(
        owner.address,
        await factory.getAddress(),
        await moon.getAddress(),
        await moon.getAddress()
      )
    ).to.be.revertedWithCustomError(Registry, "IdenticalTokens");
  });
});
