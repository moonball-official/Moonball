import { storage } from "./storage";
import { fetchLivePowerballData } from "./powerball";
import { ALL_CYCLES, CURRENT_CYCLE, JACKPOT_DATA } from "./constants";
import type { Cycle } from "@shared/schema";

const RESET_THRESHOLD = 50;
const CYCLE_COLORS = ["#60A5FA", "#A78BFA", "#34D399", "#F5A623", "#FB923C", "#F472B6", "#22D3EE", "#A3E635"];

interface Draw {
  date: string;
  jackpot: number;
}

function formatMonthYear(dateStr: string): string {
  const cleaned = dateStr.replace(/^[A-Za-z]+,\s*/, "");
  const d = new Date(cleaned);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function formatShortDate(dateStr: string): string {
  const cleaned = dateStr.replace(/^[A-Za-z]+,\s*/, "").replace(/,?\s*\d{4}$/, "");
  return cleaned;
}

export async function seedHistoricalCycles(): Promise<void> {
  const existingCycles = await storage.getCycles();
  if (existingCycles.length > 0) return;

  console.log("Seeding historical cycle data...");

  for (const cycle of ALL_CYCLES) {
    await storage.createCycle({
      label: cycle.label,
      winner: cycle.winner,
      peak: cycle.peak,
      color: cycle.color,
      isActive: cycle.id === ALL_CYCLES.length,
      draws: cycle.draws,
    });
  }

  const existingJackpot = await storage.getJackpotData();
  if (!existingJackpot) {
    await storage.createJackpotData({
      estimated: JACKPOT_DATA.estimated,
      cashValue: String(JACKPOT_DATA.cashValue),
      nextDraw: JACKPOT_DATA.nextDraw,
      nextDrawTime: JACKPOT_DATA.nextDrawTime,
      lastDraw: JACKPOT_DATA.lastDraw,
      winningNumbers: JACKPOT_DATA.winningNumbers,
      powerball: JACKPOT_DATA.powerball,
      winner: JACKPOT_DATA.winner,
      cycleStart: JACKPOT_DATA.cycleStart,
      drawsWithoutWinner: JACKPOT_DATA.drawsWithoutWinner,
      jackpotGrowth: JACKPOT_DATA.jackpotGrowth,
      moonPriceAtReset: JACKPOT_DATA.moonPriceAtReset,
    });
  }

  console.log("Historical cycle data seeded.");
}

const POWERBALL_MINIMUM = 20;

export async function repairCycleData(): Promise<void> {
  try {
    const allCycles = await storage.getCycles();

    // ── Repair 1: close stale active cycle that spans Apr 29 + May 2 ──
    const active = allCycles.find((c) => c.isActive);
    if (active) {
      const draws = (active.draws as Draw[]) || [];
      const hasMay2 = draws.some((d) => d.date === "May 2" && d.jackpot <= POWERBALL_MINIMUM);
      const hasApr29 = draws.some((d) => d.date === "Apr 29");
      if (hasMay2 && hasApr29) {
        console.log(`[repair] Active cycle C${active.id} has stale Apr 29+May 2 draws — closing and creating new cycle.`);
        const winnerMonth = "May 2026";
        const startLabel = active.label.split("–")[0]?.trim() || "Apr 2026";
        await storage.updateCycle(active.id, {
          isActive: false,
          winner: winnerMonth,
          peak: POWERBALL_MINIMUM,
          label: `${startLabel} – ${winnerMonth}`,
        });
        const newColor = CYCLE_COLORS[allCycles.length % CYCLE_COLORS.length];
        await storage.createCycle({
          label: "May 2026 – Now",
          winner: null,
          peak: null,
          color: newColor,
          isActive: true,
          draws: [{ date: "May 2", jackpot: POWERBALL_MINIMUM }],
        });
        const jackpotRow = await storage.getJackpotData();
        if (jackpotRow) {
          await storage.updateJackpotData(jackpotRow.id, {
            cycleStart: "May 2, 2026",
            moonPriceAtReset: POWERBALL_MINIMUM,
            winner: "Yes",
            drawsWithoutWinner: 1,
            jackpotGrowth: 0,
          });
        }
        console.log("[repair] Stale active cycle repaired.");
      }
    }

    // ── Repair 2: ensure every closed cycle's first draw is at the $20M minimum ──
    // Powerball always resets to $20M after a win. If a cycle's opening draw was
    // recorded at a higher value (due to a live-data race at cycle creation time),
    // correct it so the chart shows the proper reset dip between cycles.
    const refreshed = await storage.getCycles();
    for (const cycle of refreshed) {
      if (cycle.isActive) continue;
      const draws = (cycle.draws as Draw[]) || [];
      if (draws.length > 0 && draws[0].jackpot > POWERBALL_MINIMUM) {
        const fixed = [{ ...draws[0], jackpot: POWERBALL_MINIMUM }, ...draws.slice(1)];
        await storage.updateCycle(cycle.id, { draws: fixed });
        console.log(`[repair] C${cycle.id}: corrected opening draw from $${draws[0].jackpot}M → $${POWERBALL_MINIMUM}M`);
      }
    }
  } catch (err) {
    console.error("[repair] Error repairing cycle data:", err);
  }
}

export async function syncCycleState(): Promise<void> {
  try {
    const allCycles = await storage.getCycles();
    if (allCycles.length === 0) {
      await seedHistoricalCycles();
      return;
    }

    const activeCycle = allCycles.find((c) => c.isActive);
    if (!activeCycle) return;

    const jackpotRow = await storage.getJackpotData();
    if (!jackpotRow) return;

    const liveData = await fetchLivePowerballData(jackpotRow.cycleStart, jackpotRow.estimated);
    const liveEstimated = liveData.estimated;
    const storedEstimated = jackpotRow.estimated;

    const draws = (activeCycle.draws as Draw[]) || [];
    const lastDrawDate = formatShortDate(liveData.lastDraw);

    const POWERBALL_MINIMUM = 20;
    // Detect winner at minimum: jackpot never grew above threshold but a new draw
    // appeared after we already recorded a draw at the minimum — must be a new cycle
    const wonAtMinimum =
      liveEstimated <= POWERBALL_MINIMUM &&
      storedEstimated <= POWERBALL_MINIMUM &&
      draws.length >= 1 &&
      draws[draws.length - 1].date !== lastDrawDate;

    const MIN_DRAWS_FOR_RESET = 3;
    if (
      wonAtMinimum ||
      (liveEstimated <= RESET_THRESHOLD && storedEstimated > RESET_THRESHOLD && draws.length >= MIN_DRAWS_FOR_RESET)
    ) {
      console.log(`Cycle reset detected! Jackpot dropped from $${storedEstimated}M to $${liveEstimated}M`);

      const peakValue = Math.max(storedEstimated, ...draws.map((d) => d.jackpot));
      const winnerMonth = formatMonthYear(liveData.lastDraw);
      const startLabel = activeCycle.label.split("–")[0]?.trim() || "";
      const newLabel = startLabel ? `${startLabel} – ${winnerMonth}` : activeCycle.label;

      await storage.updateCycle(activeCycle.id, {
        isActive: false,
        winner: winnerMonth,
        peak: peakValue,
        label: newLabel,
      });

      const newCycleColor = CYCLE_COLORS[(allCycles.length) % CYCLE_COLORS.length];
      const cycleStartDate = formatMonthYear(liveData.lastDraw);

      await storage.createCycle({
        label: `${cycleStartDate} – Now`,
        winner: null,
        peak: null,
        color: newCycleColor,
        isActive: true,
        draws: [{ date: lastDrawDate, jackpot: liveEstimated }],
      });

      await storage.updateJackpotData(jackpotRow.id, {
        estimated: liveEstimated,
        cashValue: String(liveData.cashValue),
        nextDraw: liveData.nextDraw,
        nextDrawTime: liveData.nextDrawTime,
        lastDraw: liveData.lastDraw,
        winningNumbers: liveData.winningNumbers,
        powerball: liveData.powerball,
        winner: "Yes",
        cycleStart: liveData.lastDraw.replace(/^[A-Za-z]+,\s*/, ""),
        drawsWithoutWinner: 1,
        jackpotGrowth: 0,
        moonPriceAtReset: liveEstimated,
        verificationStatus: liveData.verificationStatus,
        verificationSources: liveData.verificationSources,
        verifiedAt: new Date(liveData.verifiedAt),
      });

      console.log("Cycle reset complete. New cycle started.");
      return;
    }

    let updated = false;

    const lastDrawParsed = new Date(liveData.lastDraw);
    const lastDrawIsInFuture = !isNaN(lastDrawParsed.getTime()) && lastDrawParsed > new Date();

    if (!lastDrawIsInFuture && (draws.length === 0 || draws[draws.length - 1].date !== lastDrawDate)) {
      if (liveEstimated > 0) {
        const newDraws = [...draws, { date: lastDrawDate, jackpot: liveEstimated }];
        await storage.updateCycle(activeCycle.id, { draws: newDraws });
        updated = true;
      }
    } else if (!lastDrawIsInFuture && draws.length > 0 && draws[draws.length - 1].jackpot !== liveEstimated && liveEstimated > 0) {
      const newDraws = draws.map((d, i) =>
        i === draws.length - 1 ? { ...d, jackpot: liveEstimated } : d
      );
      await storage.updateCycle(activeCycle.id, { draws: newDraws });
      updated = true;
    }

    const currentDrawCount = updated ? draws.length + 1 : draws.length;
    // draws[0] is always the reset entry, so real draws without a winner = count - 1
    const realDrawsWithoutWinner = Math.max(0, currentDrawCount - 1);
    const winnerStatus = currentDrawCount <= 1 ? "Yes" : "No";

    // If jackpot has settled at the Powerball minimum ($20M) but our stored
    // reset baseline is higher, the lottery truly reset — correct the baseline.
    const trueResetPrice =
      liveEstimated <= POWERBALL_MINIMUM && jackpotRow.moonPriceAtReset > POWERBALL_MINIMUM
        ? POWERBALL_MINIMUM
        : jackpotRow.moonPriceAtReset;

    await storage.updateJackpotData(jackpotRow.id, {
      estimated: liveEstimated,
      cashValue: String(liveData.cashValue),
      nextDraw: liveData.nextDraw,
      nextDrawTime: liveData.nextDrawTime,
      lastDraw: liveData.lastDraw,
      winningNumbers: liveData.winningNumbers,
      powerball: liveData.powerball,
      winner: winnerStatus,
      drawsWithoutWinner: realDrawsWithoutWinner,
      moonPriceAtReset: trueResetPrice,
      jackpotGrowth: liveEstimated - trueResetPrice,
      verificationStatus: liveData.verificationStatus,
      verificationSources: liveData.verificationSources,
      verifiedAt: new Date(liveData.verifiedAt),
    });

    if (updated) {
      console.log(`Cycle data updated: $${liveEstimated}M, ${draws.length + 1} draws`);
    }
  } catch (err) {
    console.error("Error syncing cycle state:", err);
  }
}
