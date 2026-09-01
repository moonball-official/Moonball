/**
 * Moonball oracle bridge.
 *
 * Reads the dashboard's verified jackpot (the multi-source consensus value from
 * /api/powerball/live) and pushes it on-chain via JackpotOracle.fulfillJackpotData().
 * Standalone: uses ethers v6 directly, so it never pulls the dashboard's app code
 * or web3 libraries into the running server.
 *
 * Run once (CI / cron):     ONCE=1 npx hardhat run scripts/bridge.ts
 * Run as a daemon:          POLL_SECONDS=300 npx hardhat run scripts/bridge.ts
 * Local test (hardhat node): RPC_URL=http://127.0.0.1:8545 PRIVATE_KEY=0x.. \
 *                            ORACLE_ADDRESS=0x.. ONCE=1 npx hardhat run scripts/bridge.ts
 *
 * Config (env / .env):
 *   RPC_URL          — chain RPC endpoint (required)
 *   PRIVATE_KEY      — updater key authorized on the oracle (required)
 *   ORACLE_ADDRESS   — JackpotOracle address; falls back to deployments/<NETWORK>.json
 *   NETWORK          — deployments file to read when ORACLE_ADDRESS is unset (default: localhost)
 *   DASHBOARD_URL    — base URL of the Moonball dashboard (default: http://localhost:5000)
 *   REQUIRE_VERIFIED — only push consensus-verified values (default: true)
 *   POLL_SECONDS     — daemon poll interval; 0 / unset + ONCE=1 means single run
 *   ONCE             — set to run a single update and exit
 */
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const ORACLE_ABI = [
  "function fulfillJackpotData(uint256 jackpotAmountUsd, uint256 cashValueUsd, uint64 lastDrawTimestamp, uint64 nextDrawTimestamp, bool hadWinner, uint32 drawsSinceReset) external",
  "function getJackpotMillions() external view returns (uint256)",
  "function isFresh() external view returns (bool)",
  "function MIN_JACKPOT() external view returns (uint256)",
  "function MAX_JACKPOT() external view returns (uint256)",
];

interface LiveData {
  estimated: number; // jackpot in millions USD
  cashValue: number; // cash value in millions USD
  nextDrawISO?: string;
  winner?: string; // "Yes" | "No"
  drawsInCurrentCycle?: number;
  verificationStatus?: "verified" | "unconfirmed";
}

function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function resolveOracleAddress(): string {
  if (process.env.ORACLE_ADDRESS) return process.env.ORACLE_ADDRESS;
  const net = process.env.NETWORK || "localhost";
  const file = path.join(__dirname, "..", "deployments", `${net}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`ORACLE_ADDRESS unset and ${file} not found. Deploy first or set ORACLE_ADDRESS.`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8")).oracle as string;
}

async function fetchLive(dashboardUrl: string): Promise<LiveData> {
  const url = `${dashboardUrl.replace(/\/$/, "")}/api/powerball/live`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Dashboard returned ${res.status} for ${url}`);
  return (await res.json()) as LiveData;
}

async function pushUpdate(oracle: ethers.Contract, live: LiveData): Promise<boolean> {
  const requireVerified = env("REQUIRE_VERIFIED", "true").toLowerCase() !== "false";
  if (requireVerified && live.verificationStatus !== "verified") {
    console.log(`⏭  Skipping: jackpot not consensus-verified (status=${live.verificationStatus}).`);
    return false;
  }

  const jackpotUsd = BigInt(Math.round(live.estimated)) * 1_000_000n;
  const cashUsd = BigInt(Math.round(live.cashValue || 0)) * 1_000_000n;

  // Respect oracle sanity bounds to avoid a guaranteed revert.
  const min = await oracle.MIN_JACKPOT();
  const max = await oracle.MAX_JACKPOT();
  if (jackpotUsd < min || jackpotUsd > max) {
    console.log(`⏭  Skipping: $${live.estimated}M outside oracle bounds.`);
    return false;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const nextDraw = live.nextDrawISO
    ? Math.floor(new Date(live.nextDrawISO).getTime() / 1000)
    : nowSec + 2 * 24 * 60 * 60;
  const hadWinner = (live.winner || "No").toLowerCase() === "yes";
  const drawsSinceReset = Math.max(0, Math.floor(live.drawsInCurrentCycle ?? 0));

  console.log(
    `→ Pushing $${live.estimated}M (cash $${live.cashValue}M, draws ${drawsSinceReset}, winner ${hadWinner})…`
  );
  const tx = await oracle.fulfillJackpotData(
    jackpotUsd,
    cashUsd,
    BigInt(nowSec),
    BigInt(nextDraw),
    hadWinner,
    drawsSinceReset
  );
  const receipt = await tx.wait();
  console.log(`✓ Confirmed in block ${receipt?.blockNumber}. On-chain now reads $${await oracle.getJackpotMillions()}M, fresh=${await oracle.isFresh()}.`);
  return true;
}

async function main() {
  const rpcUrl = env("RPC_URL");
  const privateKey = env("PRIVATE_KEY");
  const dashboardUrl = env("DASHBOARD_URL", "http://localhost:5000");
  const oracleAddress = resolveOracleAddress();

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const oracle = new ethers.Contract(oracleAddress, ORACLE_ABI, wallet);

  console.log(`Bridge → oracle ${oracleAddress} as ${wallet.address}`);
  console.log(`Source → ${dashboardUrl}/api/powerball/live`);

  const pollSeconds = Number(process.env.POLL_SECONDS || 0);
  const once = process.env.ONCE === "1" || pollSeconds <= 0;

  const tick = async () => {
    try {
      const live = await fetchLive(dashboardUrl);
      await pushUpdate(oracle, live);
    } catch (e) {
      console.error(`✗ Update failed: ${(e as Error).message}`);
    }
  };

  await tick();
  if (once) return;

  console.log(`Polling every ${pollSeconds}s. Ctrl+C to stop.`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise((r) => setTimeout(r, pollSeconds * 1000));
    await tick();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
