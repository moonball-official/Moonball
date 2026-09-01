export interface SourceResult {
  source: string;
  value: number;
  cashValue: number;
  fetchedAt: string;
}

export interface VerificationResult {
  verifiedValue: number;
  verifiedCashValue: number;
  verificationStatus: "verified" | "unconfirmed";
  verificationSources: string[];
  verifiedAt: Date;
}

const CONSENSUS_TOLERANCE = 5;
const DRAW_DAYS = [1, 3, 6]; // Mon, Wed, Sat (getDay())
const DRAW_HOUR_ET = 22;
const DRAW_MINUTE_ET = 59;
const POST_DRAW_WINDOW_MS = 90 * 60 * 1000;
const AGGRESSIVE_INTERVAL_MS = 60 * 1000;
const NORMAL_CACHE_MS = 5 * 60 * 1000;

let lastVerifiedResult: VerificationResult | null = null;
let cacheTimestamp = 0;

let powerballCatchupTimer: ReturnType<typeof setTimeout> | null = null;
let aggressivePollingTimer: ReturnType<typeof setTimeout> | null = null;
let aggressivePollingActive = false;
let awaitingPostDrawUpdate = false;
let preDrawVerifiedValue = 0;

function isDST(date: Date): boolean {
  const year = date.getFullYear();
  const marSecondSun = new Date(year, 2, 8 + ((7 - new Date(year, 2, 1).getDay()) % 7));
  const novFirstSun = new Date(year, 10, 1 + ((7 - new Date(year, 10, 1).getDay()) % 7));
  return date >= marSecondSun && date < novFirstSun;
}

function formatAsETtoUTC(year: number, month: number, day: number, hour: number, minute: number): Date {
  const check = new Date(year, month, day);
  const utcOffset = isDST(check) ? 4 : 5;
  return new Date(Date.UTC(year, month, day, hour + utcOffset, minute, 0));
}

function getLastDrawTime(): Date {
  const now = new Date();
  for (let i = 0; i <= 7; i++) {
    const checkDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const etStr = checkDate.toLocaleString("en-US", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
    });
    const [m, d, y] = etStr.split("/").map(Number);
    const candidate = new Date(y, m - 1, d);
    if (!DRAW_DAYS.includes(candidate.getDay())) continue;
    const drawTimeUTC = formatAsETtoUTC(y, m - 1, d, DRAW_HOUR_ET, DRAW_MINUTE_ET);
    if (drawTimeUTC <= now) return drawTimeUTC;
  }
  return new Date(0);
}

function isPostDrawWindow(): boolean {
  const lastDraw = getLastDrawTime();
  const timeSinceDraw = Date.now() - lastDraw.getTime();
  return timeSinceDraw >= 0 && timeSinceDraw <= POST_DRAW_WINDOW_MS;
}

function getCacheDuration(): number {
  return awaitingPostDrawUpdate ? AGGRESSIVE_INTERVAL_MS : NORMAL_CACHE_MS;
}

async function fetchFromPowerball(): Promise<SourceResult | null> {
  try {
    const res = await fetch("https://www.powerball.com/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    let estimated = 0;
    let cashValue = 0;

    const jackpotMatch = html.match(
      /Estimated Jackpot[\s\S]*?game-jackpot-number[^>]*>\s*\$([0-9,.]+)\s*(Million|Billion)/i
    );
    if (jackpotMatch) {
      estimated = parseFloat(jackpotMatch[1].replace(/,/g, ""));
      if (jackpotMatch[2].toLowerCase() === "billion") estimated *= 1000;
    }

    const cashMatch = html.match(
      /Cash Value[\s\S]*?game-jackpot-number[^>]*>\s*\$([0-9,.]+)\s*(Million|Billion)/i
    );
    if (cashMatch) {
      cashValue = parseFloat(cashMatch[1].replace(/,/g, ""));
      if (cashMatch[2].toLowerCase() === "billion") cashValue *= 1000;
    }

    if (estimated === 0) return null;
    return { source: "powerball.com", value: estimated, cashValue, fetchedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}

async function fetchFromUsamega(): Promise<SourceResult | null> {
  try {
    const res = await fetch("https://www.usamega.com/powerball/jackpot", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    let estimated = 0;
    let cashValue = 0;

    const jackpotPatterns = [
      /\$([0-9,.]+)\s*[Mm]illion/,
      /jackpot[^$]*\$([0-9,.]+)/i,
      /([0-9,.]+)\s*million/i,
    ];
    for (const pat of jackpotPatterns) {
      const m = html.match(pat);
      if (m) {
        const val = parseFloat(m[1].replace(/,/g, ""));
        if (val > 15 && val < 5000) { estimated = val; break; }
      }
    }

    const cashPatterns = [
      /cash\s*(?:value|option)[^$]*\$([0-9,.]+)\s*[Mm]illion/i,
      /lump\s*sum[^$]*\$([0-9,.]+)/i,
    ];
    for (const pat of cashPatterns) {
      const m = html.match(pat);
      if (m) {
        const val = parseFloat(m[1].replace(/,/g, ""));
        if (val > 5 && val < 5000) { cashValue = val; break; }
      }
    }

    if (estimated === 0) return null;
    return { source: "usamega.com", value: estimated, cashValue, fetchedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}

// fetchFromTexaslottery scrapes the Texas Lottery Powerball HTML page (not a JSON API).
// Verified 2026-05-04: the page structure that Pattern 1 targets is:
//   <p>Current Est. Annuitized Jackpot for MM/DD/YYYY:</p>
//   <h1>$20 Million</h1>
//   <p>Est. Cash Value: $9 Million</p>
// Pattern 1 of jackpotPatterns and cashPatterns both match this layout.
// If parsing silently returns null, re-inspect the live page for layout changes.
async function fetchFromTexaslottery(): Promise<SourceResult | null> {
  try {
    const res = await fetch(
      "https://www.texaslottery.com/export/sites/lottery/Games/Powerball/index.html",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) return null;
    const html = await res.text();

    let estimated = 0;
    let cashValue = 0;

    const jackpotPatterns = [
      /[Cc]urrent\s+[Ee]st\.?\s+[Aa]nnuitized\s+[Jj]ackpot[\s\S]{0,200}?\$\s*([0-9,.]+)\s*(Million|Billion)/i,
      /[Ee]stimated\s+[Jj]ackpot[\s\S]{0,200}?\$\s*([0-9,.]+)\s*(Million|Billion)/i,
      /\$\s*([0-9,.]+)\s*(Million|Billion)[\s\S]{0,50}[Jj]ackpot/i,
    ];
    for (const pat of jackpotPatterns) {
      const m = html.match(pat);
      if (m) {
        let val = parseFloat(m[1].replace(/,/g, ""));
        if (m[2].toLowerCase() === "billion") val *= 1000;
        if (val > 5 && val < 5000) { estimated = val; break; }
      }
    }

    const cashPatterns = [
      /[Ee]st\.?\s+[Cc]ash\s+[Vv]alue[^$]*\$\s*([0-9,.]+)\s*(Million|Billion)/i,
      /[Cc]ash\s+[Vv]alue[^$]*\$\s*([0-9,.]+)\s*(Million|Billion)/i,
      /[Cc]ash\s+[Oo]ption[^$]*\$\s*([0-9,.]+)\s*(Million|Billion)/i,
    ];
    for (const pat of cashPatterns) {
      const m = html.match(pat);
      if (m) {
        let val = parseFloat(m[1].replace(/,/g, ""));
        if (m[2].toLowerCase() === "billion") val *= 1000;
        if (val > 5 && val < 5000) { cashValue = val; break; }
      }
    }

    if (estimated === 0) return null;
    return { source: "texaslottery.com", value: estimated, cashValue, fetchedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}

async function fetchFromCalottery(): Promise<SourceResult | null> {
  try {
    const res = await fetch(
      "https://www.calottery.com/api/DrawGameApi/GetDrawGamePastDrawResults/10/1/1",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();

    const jackpotStr: string =
      data?.DrawGamePastDrawResults?.[0]?.NextJackpot ||
      data?.DrawGamePastDrawResults?.[0]?.Jackpot ||
      "";
    if (!jackpotStr) return null;

    const numStr = jackpotStr.replace(/[^0-9.]/g, "");
    let estimated = parseFloat(numStr);
    if (isNaN(estimated) || estimated === 0) return null;
    if (jackpotStr.toLowerCase().includes("billion")) estimated *= 1000;
    else if (estimated > 5000) estimated /= 1_000_000;

    return { source: "calottery.com", value: estimated, cashValue: 0, fetchedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}

function runConsensus(results: SourceResult[]): {
  consensusValue: number;
  consensusCashValue: number;
  agreedSources: string[];
} | null {
  if (results.length < 2) return null;

  for (let i = 0; i < results.length; i++) {
    const group = [results[i]];
    for (let j = 0; j < results.length; j++) {
      if (i === j) continue;
      if (Math.abs(results[i].value - results[j].value) <= CONSENSUS_TOLERANCE) {
        group.push(results[j]);
      }
    }
    if (group.length >= 2) {
      const consensusValue = Math.round(
        group.reduce((sum, r) => sum + r.value, 0) / group.length
      );
      const cashValues = group.filter((r) => r.cashValue > 0);
      const consensusCashValue =
        cashValues.length > 0
          ? Math.round(cashValues.reduce((sum, r) => sum + r.cashValue, 0) / cashValues.length)
          : 0;
      return { consensusValue, consensusCashValue, agreedSources: group.map((r) => r.source) };
    }
  }
  return null;
}

function startPowerballCatchup(consensusValue: number) {
  if (powerballCatchupTimer) return;
  const startTime = Date.now();
  const MAX_CATCHUP_MS = POST_DRAW_WINDOW_MS;

  const poll = async () => {
    powerballCatchupTimer = null;
    const result = await fetchFromPowerball();
    if (result && Math.abs(result.value - consensusValue) <= CONSENSUS_TOLERANCE) {
      console.log(`[verifier] powerball.com converged to $${result.value}M`);
      return;
    }
    if (result) {
      console.log(`[verifier] powerball.com still lagging: $${result.value}M vs consensus $${consensusValue}M`);
    }
    if (Date.now() - startTime > MAX_CATCHUP_MS) {
      console.log("[verifier] Powerball catch-up polling timed out (90min)");
      return;
    }
    powerballCatchupTimer = setTimeout(poll, AGGRESSIVE_INTERVAL_MS);
  };

  powerballCatchupTimer = setTimeout(poll, AGGRESSIVE_INTERVAL_MS);
}

function startAggressivePolling(baseline: number) {
  if (aggressivePollingActive) return;
  aggressivePollingActive = true;
  awaitingPostDrawUpdate = true;
  preDrawVerifiedValue = baseline;
  const windowStart = Date.now();
  console.log(`[verifier] Post-draw aggressive polling started (pre-draw: $${preDrawVerifiedValue}M)`);

  const poll = async () => {
    if (!isPostDrawWindow() || Date.now() - windowStart > POST_DRAW_WINDOW_MS) {
      console.log("[verifier] Post-draw window expired — reverting to normal cache");
      aggressivePollingActive = false;
      awaitingPostDrawUpdate = false;
      return;
    }

    cacheTimestamp = 0;
    await getVerifiedJackpot();

    const newValue = lastVerifiedResult?.verifiedValue ?? 0;
    if (newValue > 0 && newValue !== preDrawVerifiedValue && lastVerifiedResult?.verificationStatus === "verified") {
      console.log(`[verifier] New value confirmed: $${newValue}M — reverting to normal cache`);
      aggressivePollingActive = false;
      awaitingPostDrawUpdate = false;
      return;
    }
    aggressivePollingTimer = setTimeout(poll, AGGRESSIVE_INTERVAL_MS);
  };

  aggressivePollingTimer = setTimeout(poll, AGGRESSIVE_INTERVAL_MS);
}

export function stopAggressivePolling() {
  if (aggressivePollingTimer) { clearTimeout(aggressivePollingTimer); aggressivePollingTimer = null; }
  if (powerballCatchupTimer) { clearTimeout(powerballCatchupTimer); powerballCatchupTimer = null; }
  aggressivePollingActive = false;
  awaitingPostDrawUpdate = false;
}

async function fetchAndVerify(): Promise<VerificationResult> {
  const settled = await Promise.allSettled([
    fetchFromPowerball(),
    fetchFromUsamega(),
    fetchFromCalottery(),
    fetchFromTexaslottery(),
  ]);

  const results: SourceResult[] = settled
    .filter((r): r is PromiseFulfilledResult<SourceResult> => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value);

  console.log(
    `[verifier] Sources: ${results.map((r) => `${r.source}=$${r.value}M`).join(", ") || "none"}`
  );

  const consensus = runConsensus(results);

  if (consensus) {
    const outliers = results.filter((r) => !consensus.agreedSources.includes(r.source));
    if (outliers.length > 0) {
      console.log(`[verifier] Outlier(s): ${outliers.map((r) => `${r.source}=$${r.value}M`).join(", ")}`);
      const pbOutlier = outliers.find((r) => r.source === "powerball.com");
      if (pbOutlier) startPowerballCatchup(consensus.consensusValue);
    }

    const result: VerificationResult = {
      verifiedValue: consensus.consensusValue,
      verifiedCashValue: consensus.consensusCashValue,
      verificationStatus: "verified",
      verificationSources: consensus.agreedSources,
      verifiedAt: new Date(),
    };
    lastVerifiedResult = result;
    cacheTimestamp = Date.now();
    return result;
  }

  console.warn(`[verifier] No consensus — holding last verified ($${lastVerifiedResult?.verifiedValue ?? 0}M)`);

  if (lastVerifiedResult) {
    return { ...lastVerifiedResult, verificationStatus: "unconfirmed" };
  }

  return {
    verifiedValue: 0,
    verifiedCashValue: 0,
    verificationStatus: "unconfirmed",
    verificationSources: [],
    verifiedAt: new Date(),
  };
}

export async function getVerifiedJackpot(): Promise<VerificationResult> {
  const now = Date.now();
  const cacheDuration = getCacheDuration();
  const postDraw = isPostDrawWindow();

  if (lastVerifiedResult && now - cacheTimestamp < cacheDuration && !awaitingPostDrawUpdate) {
    return lastVerifiedResult;
  }

  const baselineBeforeFetch = lastVerifiedResult?.verifiedValue ?? 0;

  const result = await fetchAndVerify();

  if (postDraw && !aggressivePollingActive && !awaitingPostDrawUpdate) {
    startAggressivePolling(baselineBeforeFetch);
  }

  return result;
}
