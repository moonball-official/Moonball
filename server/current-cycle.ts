import { VERIFIED_HISTORICAL_CYCLES } from "../client/src/lib/verified-powerball-history";

const DRAW_DAYS = new Set([1, 3, 6]); // Monday, Wednesday, Saturday

function parseDrawDate(value: string | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T12:00:00Z`)
    : new Date(`${trimmed} 12:00:00 GMT`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDrawDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

// The database may predate a published jackpot win if the app did not observe
// the reset while it happened. The verified archive supplies a minimum start;
// a newer live cycle date still takes precedence after a future win.
export function effectiveCurrentCycleStart(storedStart: string | undefined): string {
  const latestWinner = VERIFIED_HISTORICAL_CYCLES.reduce(
    (latest, cycle) =>
      cycle.winnerDate > latest ? cycle.winnerDate : latest,
    "",
  );
  const firstDraw = parseDrawDate(latestWinner);
  if (!firstDraw) throw new Error("Verified Powerball winner date is unavailable");
  do {
    firstDraw.setUTCDate(firstDraw.getUTCDate() + 1);
  } while (!DRAW_DAYS.has(firstDraw.getUTCDay()));

  const storedDate = parseDrawDate(storedStart);
  return formatDrawDate(storedDate && storedDate > firstDraw ? storedDate : firstDraw);
}
