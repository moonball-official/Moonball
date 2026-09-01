import { getVerifiedJackpot } from "./jackpot-verifier";

export interface PowerballLiveData {
  estimated: number;
  cashValue: number;
  nextDraw: string;
  nextDrawTime: string;
  lastDraw: string;
  winningNumbers: number[];
  powerball: number;
  multiplier: number;
  drawsInCurrentCycle: number;
  lastUpdated: string;
  verificationStatus: "verified" | "unconfirmed";
  verificationSources: string[];
  verifiedAt: string;
}

let cachedData: PowerballLiveData | null = null;
let cacheTimestamp = 0;

function getNextDrawDate(fromDate: Date = new Date()): Date {
  const drawDays = [1, 3, 6]; // Mon, Wed, Sat
  const now = fromDate;

  for (let i = 0; i <= 7; i++) {
    const etNow = new Date(
      now.toLocaleString("en-US", { timeZone: "America/New_York" })
    );
    const candidate = new Date(etNow);
    candidate.setDate(etNow.getDate() + i);
    candidate.setHours(22, 59, 0, 0);

    const dayOfWeek = candidate.getDay();
    if (!drawDays.includes(dayOfWeek)) continue;

    const candidateISO = formatAsETtoUTC(
      candidate.getFullYear(),
      candidate.getMonth(),
      candidate.getDate(),
      22,
      59
    );

    if (candidateISO > now) {
      return candidateISO;
    }
  }
  return now;
}

function formatAsETtoUTC(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  const isDST = (() => {
    const marSecondSun = new Date(year, 2, 8 + ((7 - new Date(year, 2, 1).getDay()) % 7));
    const novFirstSun = new Date(year, 10, 1 + ((7 - new Date(year, 10, 1).getDay()) % 7));
    const check = new Date(year, month, day);
    return check >= marSecondSun && check < novFirstSun;
  })();

  const utcOffset = isDST ? 4 : 5;
  const utc = new Date(Date.UTC(year, month, day, hour + utcOffset, minute, 0));
  return utc;
}

function formatDrawDate(date: Date): string {
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(date: Date): string {
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  });
}

async function fetchWinningNumbers(): Promise<{
  numbers: number[];
  powerball: number;
  multiplier: number;
  drawDate: string;
  recentDraws: { date: string; drawDate: Date }[];
}> {
  const res = await fetch(
    "https://data.ny.gov/resource/d6yy-54nr.json?$order=draw_date%20DESC&$limit=50"
  );
  if (!res.ok) throw new Error("Failed to fetch from NY Open Data");
  const data = await res.json();

  if (!data || data.length === 0) throw new Error("No draw data available");

  const latest = data[0];
  const parts = latest.winning_numbers.trim().split(/\s+/).map(Number);
  const whiteBalls = parts.slice(0, 5);
  const pb = parts[5];
  const mult = parseInt(latest.multiplier) || 1;

  const recentDraws = data.map((d: any) => {
    const dateStr = d.draw_date.split("T")[0];
    const [y, m, day] = dateStr.split("-").map(Number);
    const drawDate = new Date(y, m - 1, day, 12, 0, 0);
    return {
      date: formatShortDate(drawDate),
      drawDate,
    };
  });

  const latestDateStr = latest.draw_date.split("T")[0];
  const [ly, lm, ld] = latestDateStr.split("-").map(Number);
  const latestDrawDate = new Date(ly, lm - 1, ld, 12, 0, 0);

  return {
    numbers: whiteBalls,
    powerball: pb,
    multiplier: mult,
    drawDate: latestDrawDate.toISOString(),
    recentDraws,
  };
}

function countDrawsInCycle(
  recentDraws: { date: string; drawDate: Date }[],
  cycleStartDate: Date
): number {
  return recentDraws.filter((d) => d.drawDate >= cycleStartDate).length;
}

export async function fetchLivePowerballData(
  cycleStartDateStr: string,
  fallbackEstimated?: number
): Promise<PowerballLiveData> {
  const now = Date.now();
  if (cachedData && now - cacheTimestamp < 60 * 1000) {
    return cachedData;
  }

  try {
    const [numbersData, verification] = await Promise.all([
      fetchWinningNumbers(),
      getVerifiedJackpot(),
    ]);

    const lastDrawDate = new Date(numbersData.drawDate);
    const nextDrawDate = getNextDrawDate();

    const cycleStart = new Date(cycleStartDateStr);
    const drawsInCycle = countDrawsInCycle(
      numbersData.recentDraws,
      cycleStart
    );

    const estimatedValue =
      verification.verifiedValue > 0
        ? verification.verifiedValue
        : (cachedData?.estimated ?? fallbackEstimated ?? 0);

    const cashValue =
      verification.verifiedCashValue > 0
        ? verification.verifiedCashValue
        : (cachedData?.cashValue ?? 0);

    const result: PowerballLiveData = {
      estimated: estimatedValue,
      cashValue: cashValue,
      nextDraw: formatDrawDate(nextDrawDate),
      nextDrawTime: "10:59 PM ET",
      lastDraw: formatDrawDate(lastDrawDate),
      winningNumbers: numbersData.numbers,
      powerball: numbersData.powerball,
      multiplier: numbersData.multiplier,
      drawsInCurrentCycle: drawsInCycle,
      lastUpdated: new Date().toLocaleString("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
      verificationStatus: verification.verificationStatus,
      verificationSources: verification.verificationSources,
      verifiedAt: verification.verifiedAt.toISOString(),
    };

    cachedData = result;
    cacheTimestamp = now;
    return result;
  } catch (err) {
    console.error("Error fetching live Powerball data:", err);
    if (cachedData) return cachedData;
    throw err;
  }
}

export function getNextDrawDateISO(): string {
  return getNextDrawDate().toISOString();
}
