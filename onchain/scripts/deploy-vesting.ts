/**
 * Locks the founder + investor MOON allocations into on-chain vesting wallets.
 *
 * For a credible launch, founder (20%) and investor (15%) tokens must be
 * verifiably locked on-chain — not just promised in docs. This script deploys
 * one {MoonVestingWallet} per beneficiary with the correct cliff + duration and
 * transfers the allocated MOON from the treasury (the signer) into each wallet.
 *
 * The signer MUST be the wallet that currently holds the MOON to be locked
 * (i.e. the SUPPLY_RECIPIENT / treasury from scripts/deploy.ts). MOON for each
 * schedule is pulled from the signer's balance.
 *
 * Run:
 *   cd onchain
 *   FOUNDER_ADDRESS=0x... INVESTOR_ADDRESSES=0x...,0x... \
 *     npx hardhat run scripts/deploy-vesting.ts --network baseSepolia
 *
 * Config (env / .env) — all schedules default to the published allocation:
 *
 *   MOON_ADDRESS         — MOON token; falls back to deployments/<network>.json
 *   VESTING_START        — unix seconds when vesting begins (default: now)
 *
 *   FOUNDER_ADDRESS      — founder beneficiary (required to lock the founder bucket)
 *   FOUNDER_AMOUNT       — whole MOON to lock for founder (default: 20_000_000 = 20%)
 *   FOUNDER_CLIFF_DAYS   — cliff length in days (default: 365  = 1 year)
 *   FOUNDER_VEST_DAYS    — total vest length in days (default: 1460 = 4 years)
 *
 *   INVESTOR_ADDRESSES   — comma-separated investor beneficiaries (required to
 *                          lock the investor bucket)
 *   INVESTOR_AMOUNTS     — comma-separated whole-MOON amounts, one per address.
 *                          If omitted, INVESTOR_TOTAL is split evenly.
 *   INVESTOR_TOTAL       — total whole MOON for all investors (default: 15_000_000 = 15%)
 *   INVESTOR_CLIFF_DAYS  — cliff length in days (default: 180 = 6 months)
 *   INVESTOR_VEST_DAYS   — total vest length in days (default: 730 = 2 years)
 *
 *   DRY_RUN=1            — print the plan and validate balances without sending txs
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const DAY = 24 * 60 * 60;
const WAD = 10n ** 18n;

function deploymentsFile(): string {
  return path.join(__dirname, "..", "deployments", `${network.name}.json`);
}

function moonFromDeployments(): string | undefined {
  const file = deploymentsFile();
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, "utf8")).moon;
}

function fmt(wad: bigint): string {
  return ethers.formatEther(wad);
}

async function main() {
  const [signer] = await ethers.getSigners();
  if (!signer) {
    throw new Error("No signer — set DEPLOYER_PRIVATE_KEY in onchain/.env.");
  }
  const dryRun = process.env.DRY_RUN === "1";

  const moonAddress = process.env.MOON_ADDRESS || moonFromDeployments();
  if (!moonAddress || !ethers.isAddress(moonAddress)) {
    throw new Error("MOON_ADDRESS unset and not found in deployments. Deploy MOON first.");
  }

  const start = Number(process.env.VESTING_START || Math.floor(Date.now() / 1000));
  if (!Number.isFinite(start) || start <= 0) {
    throw new Error("VESTING_START must be a positive unix timestamp (seconds).");
  }

  console.log(`Network:  ${network.name}`);
  console.log(`Signer:   ${signer.address}  (treasury / token holder)`);
  console.log(`MOON:     ${moonAddress}`);
  console.log(`Vesting start: ${start} (${new Date(start * 1000).toISOString()})`);
  if (dryRun) console.log("** DRY RUN — no transactions will be sent **");

  const moon = await ethers.getContractAt("MoonballToken", moonAddress);

  // ── Build the schedule plan ───────────────────────────────────────────
  type Plan = {
    label: string;
    beneficiary: string;
    amountWad: bigint;
    cliffDays: number;
    vestDays: number;
  };
  const plans: Plan[] = [];

  // Founder
  const founder = process.env.FOUNDER_ADDRESS;
  if (founder) {
    if (!ethers.isAddress(founder)) throw new Error(`FOUNDER_ADDRESS invalid: ${founder}`);
    const amount = BigInt(process.env.FOUNDER_AMOUNT || 20_000_000);
    const cliffDays = Number(process.env.FOUNDER_CLIFF_DAYS || 365);
    const vestDays = Number(process.env.FOUNDER_VEST_DAYS || 1460);
    if (cliffDays > vestDays) throw new Error("FOUNDER_CLIFF_DAYS must be <= FOUNDER_VEST_DAYS.");
    plans.push({ label: "Founder", beneficiary: founder, amountWad: amount * WAD, cliffDays, vestDays });
  } else {
    console.log("• FOUNDER_ADDRESS unset — skipping founder bucket.");
  }

  // Investors
  const investorsRaw = (process.env.INVESTOR_ADDRESSES || "").trim();
  if (investorsRaw) {
    const addrs = investorsRaw.split(",").map((a) => a.trim()).filter(Boolean);
    for (const a of addrs) {
      if (!ethers.isAddress(a)) throw new Error(`INVESTOR_ADDRESSES contains invalid address: ${a}`);
    }
    const cliffDays = Number(process.env.INVESTOR_CLIFF_DAYS || 180);
    const vestDays = Number(process.env.INVESTOR_VEST_DAYS || 730);
    if (cliffDays > vestDays) throw new Error("INVESTOR_CLIFF_DAYS must be <= INVESTOR_VEST_DAYS.");

    let amountsWad: bigint[];
    if (process.env.INVESTOR_AMOUNTS) {
      const parts = process.env.INVESTOR_AMOUNTS.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length !== addrs.length) {
        throw new Error(
          `INVESTOR_AMOUNTS has ${parts.length} entries but INVESTOR_ADDRESSES has ${addrs.length}.`
        );
      }
      amountsWad = parts.map((p) => BigInt(p) * WAD);
    } else {
      // Split INVESTOR_TOTAL evenly; the remainder (from integer division) is
      // added to the last investor so the bucket sums exactly.
      const total = BigInt(process.env.INVESTOR_TOTAL || 15_000_000) * WAD;
      const each = total / BigInt(addrs.length);
      amountsWad = addrs.map(() => each);
      amountsWad[amountsWad.length - 1] += total - each * BigInt(addrs.length);
    }

    addrs.forEach((a, i) => {
      plans.push({
        label: addrs.length > 1 ? `Investor ${i + 1}` : "Investor",
        beneficiary: a,
        amountWad: amountsWad[i],
        cliffDays,
        vestDays,
      });
    });
  } else {
    console.log("• INVESTOR_ADDRESSES unset — skipping investor bucket.");
  }

  if (plans.length === 0) {
    throw new Error("Nothing to do: set FOUNDER_ADDRESS and/or INVESTOR_ADDRESSES.");
  }

  // ── Validate the signer holds enough MOON ─────────────────────────────
  const totalNeeded = plans.reduce((sum, p) => sum + p.amountWad, 0n);
  const signerBal: bigint = await moon.balanceOf(signer.address);
  console.log(`\nSigner MOON balance: ${fmt(signerBal)} MOON`);
  console.log(`Total to lock:       ${fmt(totalNeeded)} MOON\n`);
  if (signerBal < totalNeeded) {
    throw new Error(
      `Signer holds ${fmt(signerBal)} MOON but ${fmt(totalNeeded)} is required. ` +
        "Run this from the treasury/SUPPLY_RECIPIENT wallet, or lower the amounts."
    );
  }

  // ── Deploy + fund each vesting wallet ─────────────────────────────────
  const Vesting = await ethers.getContractFactory("MoonVestingWallet");
  const results: any[] = [];

  for (const p of plans) {
    const cliffSeconds = p.cliffDays * DAY;
    const vestSeconds = p.vestDays * DAY;
    console.log(
      `── ${p.label} → ${p.beneficiary}\n` +
        `   amount ${fmt(p.amountWad)} MOON · cliff ${p.cliffDays}d · vest ${p.vestDays}d`
    );

    if (dryRun) {
      console.log("   (dry run — not deployed)\n");
      results.push({
        label: p.label,
        beneficiary: p.beneficiary,
        wallet: null,
        amount: fmt(p.amountWad),
        cliffDays: p.cliffDays,
        vestDays: p.vestDays,
      });
      continue;
    }

    const wallet = await Vesting.deploy(p.beneficiary, start, vestSeconds, cliffSeconds);
    await wallet.waitForDeployment();
    const walletAddr = await wallet.getAddress();

    await (await moon.transfer(walletAddr, p.amountWad)).wait();
    const locked: bigint = await moon.balanceOf(walletAddr);
    console.log(`   wallet ${walletAddr} · locked ${fmt(locked)} MOON\n`);

    results.push({
      label: p.label,
      beneficiary: p.beneficiary,
      wallet: walletAddr,
      amount: fmt(p.amountWad),
      cliffDays: p.cliffDays,
      vestDays: p.vestDays,
      cliffTimestamp: start + cliffSeconds,
      endTimestamp: start + vestSeconds,
    });
  }

  if (dryRun) {
    console.log("Dry run complete — no state changed.");
    return;
  }

  // ── Persist the vesting deployment for the dashboard + audits ─────────
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const outFile = path.join(dir, `${network.name}.vesting.json`);
  const out = {
    network: network.name,
    moon: moonAddress,
    vestingStart: start,
    treasury: signer.address,
    wallets: results,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`Saved deployments/${network.name}.vesting.json`);

  // ── Dashboard env (optional locked/unlocked display) ──────────────────
  const founderRes = results.find((r) => r.label === "Founder");
  const investorRes = results.filter((r) => r.label.startsWith("Investor"));
  console.log("\n── Dashboard env (Protocol page vesting display) ──");
  console.log(`VITE_VESTING_START=${start}`);
  if (founderRes) console.log(`VITE_FOUNDER_VESTING_ADDRESS=${founderRes.wallet}`);
  if (investorRes.length) {
    console.log(`VITE_INVESTOR_VESTING_ADDRESSES=${investorRes.map((r) => r.wallet).join(",")}`);
  }
  console.log(
    "\nNext: verify on-chain that each wallet holds its MOON and that " +
      "releasable() is 0 until the cliff passes. Founder/investor tokens are now locked."
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
