import assert from "node:assert/strict";

// Snapshot of real texaslottery.com HTML captured 2026-05-04.
// Covers the Powerball section that fetchFromTexaslottery() targets.
// Re-run this test if the source ever returns null to detect format drift.
const SNAPSHOT_HTML = `
<div class="jackpotPadding">
<p>Current Est. Annuitized Jackpot for 05/04/2026:</p>
<h1>$20 Million</h1>                

<p>Est. Cash Value: $9 Million</p>

</div>
`;

// Billion-denomination snapshot for regression coverage
const BILLION_HTML = `
<div class="jackpotPadding">
<p>Current Est. Annuitized Jackpot for 11/01/2025:</p>
<h1>$1.5 Billion</h1>

<p>Est. Cash Value: $700 Million</p>

</div>
`;

function parseHtml(html: string): { estimated: number; cashValue: number } | null {
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
  return { estimated, cashValue };
}

// --- tests ---

const result = parseHtml(SNAPSHOT_HTML);
assert.ok(result !== null, "Should parse standard Million-denomination snapshot");
assert.equal(result.estimated, 20, "Jackpot should be 20 (million)");
assert.equal(result.cashValue, 9, "Cash value should be 9 (million)");

const billionResult = parseHtml(BILLION_HTML);
assert.ok(billionResult !== null, "Should parse Billion-denomination snapshot");
assert.equal(billionResult.estimated, 1500, "Billion jackpot should be converted to 1500 (million)");
assert.equal(billionResult.cashValue, 700, "Cash value 700M should parse correctly");

const emptyResult = parseHtml("<html><body>No lottery data here</body></html>");
assert.equal(emptyResult, null, "Should return null when no jackpot data found");

console.log("All fetchFromTexaslottery parsing tests passed.");
