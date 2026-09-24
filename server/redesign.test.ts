import { test } from "node:test";
import assert from "node:assert/strict";
import { injectRouteMeta } from "./meta";
import { buildOracleModel } from "./oracle-model";
import { VERIFIED_HISTORICAL_CYCLES } from "../client/src/lib/verified-powerball-history";

test("historical jackpot cycles cover every scheduled draw through the August 2026 win", () => {
  const publishedWinners: [string, number, number][] = [
    ["2025-05-31", 204.5, 15],
    ["2025-09-06", 1787.4, 42],
    ["2025-12-24", 1817, 47],
    ["2026-01-21", 209.3, 12],
    ["2026-03-02", 250.8, 17],
    ["2026-04-06", 230.8, 15],
    ["2026-04-29", 143, 10],
    ["2026-05-02", 20, 1],
    ["2026-08-12", 1040, 44],
  ];
  assert.deepEqual(
    VERIFIED_HISTORICAL_CYCLES.map((cycle) => [cycle.winnerDate, cycle.peak, cycle.draws.length]),
    publishedWinners,
  );
  const allDates = VERIFIED_HISTORICAL_CYCLES.flatMap((cycle) => cycle.draws.map((draw) => draw.date));
  assert.equal(allDates.length, 203);
  assert.equal(allDates[0], "2025-04-28");
  assert.equal(allDates.at(-1), "2026-08-12");
  for (let i = 0; i < allDates.length; i++) {
    const date = new Date(`${allDates[i]}T00:00:00Z`);
    assert.ok([1, 3, 6].includes(date.getUTCDay()), `Unexpected drawing date ${allDates[i]}`);
    if (i > 0) {
      const prior = new Date(`${allDates[i - 1]}T00:00:00Z`);
      const expectedGap = prior.getUTCDay() === 3 ? 3 : 2;
      assert.equal((date.getTime() - prior.getTime()) / 86_400_000, expectedGap);
    }
  }
  for (const cycle of VERIFIED_HISTORICAL_CYCLES) {
    assert.equal(cycle.draws.at(-1)?.date, cycle.winnerDate);
    assert.equal(cycle.draws.at(-1)?.jackpot, cycle.peak);
  }
});

test("confidence follows the published source thresholds without changing reference pricing", () => {
  const sources = [
    "powerball.com",
    "usamega.com",
    "calottery.com",
    "texaslottery.com",
  ];
  for (let count = 0; count <= 4; count++) {
    const model = buildOracleModel(332, sources.slice(0, count), "verified");
    assert.equal(
      model.confidence,
      count >= 3 ? "High" : count === 2 ? "Medium" : "Low",
    );
    assert.equal(model.oracleValue, 166);
  }
  assert.equal(buildOracleModel(332, sources, "unconfirmed").confidence, "Low");
});

test("homepage and dashboard have distinct search metadata", () => {
  const template =
    '<html><head></head><body><div id="root"></div></body></html>';
  const home = injectRouteMeta(template, "/");
  const dashboard = injectRouteMeta(template, "/dashboard");
  assert.match(home, /Big jackpots\. A new kind of market/);
  assert.match(home, /Pre-launch\. Trading is not available yet/);
  assert.match(dashboard, /<title>Jackpot Dashboard \| Moonball<\/title>/);
  assert.match(
    dashboard,
    /rel="canonical" href="https:\/\/moonball.info\/dashboard"/,
  );
  assert.doesNotMatch(dashboard, /noindex/);
});

// Exercise the actual production HTML handler, not the preview server.
test("dashboard direct links, refreshes, and canonical redirects work in production", async () => {
  const { default: express } = await import("express");
  const { once } = await import("node:events");
  const { resolve } = await import("node:path");
  const { serveStatic } = await import("./static");
  const app = express();
  serveStatic(app, resolve("dist/public"));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const dashboard = await fetch(`${base}/dashboard`);
    assert.equal(dashboard.status, 200);
    assert.match(
      await dashboard.text(),
      /<title>Jackpot Dashboard \| Moonball<\/title>/,
    );
    const slash = await fetch(`${base}/dashboard/?view=all`, {
      redirect: "manual",
    });
    assert.equal(slash.status, 301);
    assert.equal(slash.headers.get("location"), "/dashboard?view=all");
    const missing = await fetch(`${base}/not-a-real-route`);
    assert.equal(missing.status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
