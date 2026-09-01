// ─── Moonball V2 oracle / reference-value model ──────────────────────────
//
// Moonball V2 is a DEX-traded event market. The oracle does NOT set the price
// and the protocol does NOT redeem, defend, or buy back MOON. Instead the
// oracle publishes a transparent REFERENCE value derived from publicly
// observable Powerball jackpot data. Traders decide the real price on the DEX;
// the reference value is context, not a peg.
//
// Two reference numbers are published:
//   1. Oracle Value (headline)  — the simple, raw mapping of jackpot → MOON.
//   2. Risk-adjusted fair value — the raw Oracle Value discounted by the
//      survival probability (the chance the jackpot is NOT won at the next
//      draw): riskAdjustedValue = oracleValue * (1 - resetRisk). This is used
//      only as a benchmark for "Market Efficiency", never as the headline
//      number a user sees.

// MOON reference value at a fresh jackpot reset (USD).
export const BASE_VALUE = 10;
// Jackpot size (in $M) at a fresh reset.
export const RESET_JACKPOT_M = 20;
// Powerball odds of a single ticket winning the jackpot (1 in 292.2M).
const JACKPOT_ODDS_M = 292.2;
// Tickets sold (in millions) scale roughly with jackpot size. This factor maps
// jackpot $M → tickets (M). Calibrated so a $20M jackpot implies a low reset
// chance (~3%) and a $1B+ jackpot a high one (~75%+).
const TICKETS_PER_JACKPOT_M = 0.4;

// Every source the verifier is configured to query. Used for the transparency
// list and the consensus count shown on the dashboard.
export const CONFIGURED_SOURCES = [
  "powerball.com",
  "usamega.com",
  "calottery.com",
  "texaslottery.com",
] as const;

export interface OracleModel {
  // Raw, headline reference value (USD per MOON).
  oracleValue: number;
  // Probability the NEXT draw produces a winner and resets the jackpot (0..1).
  resetRisk: number;
  // Raw Oracle Value discounted by survival probability — benchmark only (USD per MOON).
  riskAdjustedValue: number;
  // Reference value MOON resets to on a winning draw (USD).
  resetValue: number;
  // Probability-weighted expected drop at the next draw (0..1).
  expectedDropPct: number;
  // How many configured sources currently agree on the jackpot value.
  consensusCount: number;
  // Total number of configured sources.
  totalSources: number;
  // Plain-language confidence in the reference value.
  confidence: "High" | "Medium" | "Low";
  // Per-source transparency list.
  dataSources: { name: string; contributing: boolean }[];
}

/** Raw headline reference value: linear in jackpot size from the reset base. */
export function computeOracleValue(jackpotMillions: number): number {
  if (jackpotMillions <= 0) return BASE_VALUE;
  return BASE_VALUE * (jackpotMillions / RESET_JACKPOT_M);
}

/**
 * Probability the next draw resets the jackpot. Bigger jackpots sell more
 * tickets, so the chance someone hits the winning combination rises with size.
 * Modeled as a Poisson hit probability: p = 1 - e^(-tickets / odds).
 */
export function computeResetRisk(jackpotMillions: number): number {
  if (jackpotMillions <= 0) return 0;
  const ticketsMillions = jackpotMillions * TICKETS_PER_JACKPOT_M;
  const p = 1 - Math.exp(-ticketsMillions / JACKPOT_ODDS_M);
  return Math.min(Math.max(p, 0), 1);
}

function computeConfidence(
  consensusCount: number,
  status: "verified" | "unconfirmed",
): "High" | "Medium" | "Low" {
  if (status !== "verified") return "Low";
  if (consensusCount >= 2) return "High";
  return "Low";
}

export function buildOracleModel(
  jackpotMillions: number,
  verificationSources: string[],
  verificationStatus: "verified" | "unconfirmed",
): OracleModel {
  const oracleValue = computeOracleValue(jackpotMillions);
  const resetRisk = computeResetRisk(jackpotMillions);

  // Raw Oracle Value discounted by the survival probability (the chance the
  // jackpot is NOT won at the next draw). This is the locked fair-value model:
  // riskAdjustedValue = oracleValue * (1 - resetRisk).
  const riskAdjustedValue = oracleValue * (1 - resetRisk);

  const expectedDropPct =
    oracleValue > 0
      ? resetRisk * ((oracleValue - BASE_VALUE) / oracleValue)
      : 0;

  const agreed = new Set(verificationSources);
  const dataSources = CONFIGURED_SOURCES.map((name) => ({
    name,
    contributing: agreed.has(name),
  }));
  const consensusCount = verificationSources.length;

  return {
    oracleValue: Math.round(oracleValue * 100) / 100,
    resetRisk: Math.round(resetRisk * 1000) / 1000,
    riskAdjustedValue: Math.round(riskAdjustedValue * 100) / 100,
    resetValue: BASE_VALUE,
    expectedDropPct: Math.round(expectedDropPct * 1000) / 1000,
    consensusCount,
    totalSources: CONFIGURED_SOURCES.length,
    confidence: computeConfidence(consensusCount, verificationStatus),
    dataSources,
  };
}
