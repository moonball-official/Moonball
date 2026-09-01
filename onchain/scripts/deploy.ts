/**
 * Deploys the Moonball V2 protocol (DEX event market) and records the addresses
 * in onchain/deployments/<network>.json for the bridge and dashboard to consume.
 *
 *   - JackpotOracle: read-only on-chain reference (jackpot millions + reference
 *     value), fed by the off-chain consensus bridge.
 *   - MoonballToken: a fixed-supply ERC-20 whose entire supply is minted to the
 *     LP seeder. MOON has NO protocol mint/redeem and NO collateral treasury;
 *     price is discovered on a DEX (e.g. a MOON/USDC Uniswap v3 pool) that the
 *     recipient seeds from its balance after deployment.
 *
 * Local:  npx hardhat node          (terminal 1)
 *         npx hardhat run scripts/deploy.ts --network localhost   (terminal 2)
 *
 * Config (env / .env):
 *   UPDATER_ADDRESS    — oracle updater / bridge keeper (default: deployer)
 *   ORACLE_STALENESS   — seconds before oracle data is stale (default: 14400 = 4h)
 *   MOON_SUPPLY        — whole MOON minted at genesis (default: 1_000_000)
 *   SUPPLY_RECIPIENT   — receives the entire initial supply (default: deployer)
 *   SEED_JACKPOT_M     — optional jackpot in millions to push to the oracle now
 *   USDC_ADDRESS       — DEX pair quote token; if unset a MockUSDC is deployed (test only)
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Network:  ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const updater = process.env.UPDATER_ADDRESS || deployer.address;
  const staleness = Number(process.env.ORACLE_STALENESS || 14400);
  const supply = BigInt(process.env.MOON_SUPPLY || 1_000_000);
  const recipient = process.env.SUPPLY_RECIPIENT || deployer.address;

  // DEX pair quote token (for the eventual MOON/USDC pool). Not wired into the
  // token — MOON has no collateral. We only record it for the dashboard.
  let usdcAddress = process.env.USDC_ADDRESS;
  if (!usdcAddress) {
    console.log("No USDC_ADDRESS set — deploying MockUSDC as a DEX pair token (test only).");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mock = await MockUSDC.deploy();
    await mock.waitForDeployment();
    usdcAddress = await mock.getAddress();
  }
  console.log(`USDC:     ${usdcAddress}  (DEX pair quote token)`);

  // Oracle (read-only on-chain reference)
  const Oracle = await ethers.getContractFactory("JackpotOracle");
  const oracle = await Oracle.deploy(updater, staleness);
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log(`Oracle:   ${oracleAddress}  (updater ${updater}, staleness ${staleness}s)`);

  // Optional: push an initial jackpot so the reference value is live immediately.
  if (process.env.SEED_JACKPOT_M) {
    const jackpotM = Number(process.env.SEED_JACKPOT_M);
    const now = Math.floor(Date.now() / 1000);
    await (
      await oracle.fulfillJackpotData(
        BigInt(jackpotM) * 1_000_000n,
        (BigInt(jackpotM) * 1_000_000n) / 2n,
        now,
        now + 3 * 24 * 60 * 60,
        false,
        1
      )
    ).wait();
    console.log(
      `Pushed $${jackpotM}M → reference $${ethers.formatEther(await oracle.oracleReferenceValueWad())}/MOON`
    );
  }

  // Token (fixed supply, entire supply to the LP seeder)
  const Moon = await ethers.getContractFactory("MoonballToken");
  const moonToken = await Moon.deploy(supply, recipient);
  await moonToken.waitForDeployment();
  const moonAddress = await moonToken.getAddress();
  console.log(
    `MOON:     ${moonAddress}  (${supply.toString()} MOON minted to ${recipient})`
  );

  // Persist addresses for the bridge + dashboard
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const out = {
    network: network.name,
    usdc: usdcAddress,
    oracle: oracleAddress,
    moon: moonAddress,
    updater,
    staleness,
    supply: supply.toString(),
    recipient,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dir, `${network.name}.json`), JSON.stringify(out, null, 2));
  console.log(`\nSaved deployments/${network.name}.json`);

  // Frontend wiring: paste these into the dashboard's environment so the
  // Protocol page can read the live oracle reference + token supply.
  const chainId =
    network.name === "base" ? 8453 : network.name === "baseSepolia" ? 84532 : 31337;
  console.log("\n── Dashboard env (Protocol page) ──");
  console.log(`VITE_CHAIN_ID=${chainId}`);
  console.log(`VITE_MOON_ADDRESS=${moonAddress}`);
  console.log(`VITE_ORACLE_ADDRESS=${oracleAddress}`);
  console.log(`VITE_USDC_ADDRESS=${usdcAddress}`);
  console.log("\nNext: seed a MOON/USDC DEX pool from the recipient balance to open the market.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
