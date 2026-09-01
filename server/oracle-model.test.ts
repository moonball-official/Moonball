import assert from "node:assert/strict";
import {
  BASE_VALUE,
  RESET_JACKPOT_M,
  buildOracleModel,
  computeOracleValue,
  computeResetRisk,
} from "./oracle-model";

// --- Locked fair-value model ---------------------------------------------
// The risk-adjusted fair value MUST be the raw Oracle Value discounted by the
// survival probability (the chance the jackpot is NOT won at the next draw):
//
//   riskAdjustedValue = oracleValue * (1 - resetRisk)
//
// It must NOT be a blended expected value (e.g. adding back base * resetRisk).
// This is the benchmark behind the "Market Efficiency" metric, so a deviation
// silently corrupts that number. If this test fails, the formula drifted.

const SAMPLES = [0, 20, 100, 225, 500, 1000, 2000];

for (const jackpotM of SAMPLES) {
  const model = buildOracleModel(jackpotM, ["powerball.com", "usamega.com"], "verified");

  const oracleValue = computeOracleValue(jackpotM);
  const resetRisk = computeResetRisk(jackpotM);
  const expected = oracleValue * (1 - resetRisk);

  // buildOracleModel rounds to 2dp, so compare against the same rounding.
  const expectedRounded = Math.round(expected * 100) / 100;
  assert.equal(
    model.riskAdjustedValue,
    expectedRounded,
    `riskAdjustedValue for $${jackpotM}M must equal oracleValue*(1-resetRisk) (=${expectedRounded}), got ${model.riskAdjustedValue}`,
  );

  // Guard against the old blended formula reappearing.
  const blended = oracleValue * (1 - resetRisk) + BASE_VALUE * resetRisk;
  const blendedRounded = Math.round(blended * 100) / 100;
  if (resetRisk > 0 && oracleValue > BASE_VALUE) {
    assert.notEqual(
      model.riskAdjustedValue,
      blendedRounded,
      `riskAdjustedValue for $${jackpotM}M must NOT use the blended expected-value formula`,
    );
  }

  // The risk-adjusted value is always a discount on the raw value (never above).
  assert.ok(
    model.riskAdjustedValue <= model.oracleValue + 1e-9,
    `riskAdjustedValue (${model.riskAdjustedValue}) must not exceed oracleValue (${model.oracleValue})`,
  );
}

// At a fresh reset there is effectively no upside to discount.
const atReset = buildOracleModel(RESET_JACKPOT_M, ["powerball.com"], "verified");
assert.equal(atReset.oracleValue, BASE_VALUE, "Oracle value at reset jackpot should equal the base value");

console.log(`All oracle-model fair-value tests passed (${SAMPLES.length} samples).`);
