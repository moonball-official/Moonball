import assert from "node:assert/strict";
import { runConsensus, type SourceResult } from "./jackpot-verifier";

const observedAt = "2026-09-02T12:00:00.000Z";
const testNow = Date.parse("2026-09-02T12:01:00.000Z");
const source = (
  name: string,
  value: number,
  cashValue = Math.round(value / 2),
  fetchedAt = observedAt
): SourceResult => ({ source: name, value, cashValue, fetchedAt });

const largest = runConsensus([
  source("outlier-a", 400),
  source("agree-c", 202),
  source("agree-a", 200),
  source("outlier-b", 405),
  source("agree-b", 201),
], testNow);
assert.ok(largest, "a unique largest agreement group should verify");
assert.equal(largest.consensusValue, 201);
assert.deepEqual(largest.agreedSources, ["agree-a", "agree-b", "agree-c"]);

const reordered = runConsensus([
  source("agree-b", 201),
  source("agree-a", 200),
  source("agree-c", 202),
  source("outlier-a", 400),
], testNow);
assert.deepEqual(
  reordered?.agreedSources,
  largest.agreedSources,
  "input ordering must not choose the consensus"
);

const tie = runConsensus([
  source("low-a", 100),
  source("low-b", 102),
  source("high-a", 300),
  source("high-b", 303),
], testNow);
assert.equal(tie, null, "equal-sized competing groups must fail closed");

const chained = runConsensus([
  source("a", 100),
  source("b", 105),
  source("c", 110),
], testNow);
assert.equal(
  chained,
  null,
  "a group must fit inside one full tolerance range, not only match a center"
);

const duplicateSource = runConsensus([
  source("same-source", 200, 100, "2026-09-02T11:59:00.000Z"),
  source("same-source", 400, 200, observedAt),
  source("independent", 200),
], testNow);
assert.equal(
  duplicateSource,
  null,
  "duplicate observations from one source must not create quorum"
);

const invalidCash = runConsensus([
  source("a", 200, 250),
  source("b", 201, 100),
], testNow);
assert.equal(invalidCash?.consensusCashValue, 100);

const stale = runConsensus(
  [
    source("a", 200, 100, "2026-09-02T11:50:00.000Z"),
    source("b", 201, 100, "2026-09-02T11:51:00.000Z"),
  ],
  testNow
);
assert.equal(stale, null, "stale source observations must not become verified");

console.log("All jackpot consensus-selection tests passed.");
