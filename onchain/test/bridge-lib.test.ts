import { expect } from "chai";
import {
  buildOracleUpdate,
  validateDeploymentRecord,
  validateDashboardUrl,
  withRetries,
} from "../scripts/bridge-lib";

const NOW = Math.floor(Date.parse("2026-09-02T18:00:00.000Z") / 1000);
const LAST_DRAW = "2026-09-01T02:59:00.000Z";
const NEXT_DRAW = "2026-09-03T02:59:00.000Z";
const OBSERVED = "2026-09-02T17:59:00.000Z";

function live(overrides: Record<string, unknown> = {}) {
  return {
    estimated: 225,
    cashValue: 102,
    lastDrawISO: LAST_DRAW,
    nextDrawISO: NEXT_DRAW,
    cycleId: "powerball-cycle:2026-08-15",
    drawId: `powerball-draw:${LAST_DRAW}`,
    winner: "No",
    drawsInCurrentCycle: 8,
    verificationStatus: "verified",
    verificationSources: ["powerball.com", "texaslottery.com"],
    sourceObservations: [
      {
        source: "powerball.com",
        value: 224,
        cashValue: 101,
        fetchedAt: "2026-09-02T17:58:30.000Z",
      },
      {
        source: "texaslottery.com",
        value: 226,
        cashValue: 102,
        fetchedAt: OBSERVED,
      },
    ],
    sourceObservedAt: OBSERVED,
    verifiedAt: "2026-09-02T17:59:01.000Z",
    ...overrides,
  };
}

describe("oracle bridge snapshot validation", () => {
  it("builds whole-USD values, real timestamps, and a deterministic snapshot id", () => {
    const first = buildOracleUpdate(live(), 0n, 14_400, NOW);
    const laterSequence = buildOracleUpdate(live(), 9n, 14_400, NOW);
    expect(first.sequence).to.equal(1n);
    expect(laterSequence.sequence).to.equal(10n);
    expect(first.jackpotAmountUsd).to.equal(225_000_000n);
    expect(first.cashValueUsd).to.equal(102_000_000n);
    expect(first.lastDrawTimestamp).to.equal(BigInt(Date.parse(LAST_DRAW) / 1000));
    expect(first.snapshotId).to.equal(laterSequence.snapshotId);
  });

  it("rejects unverified, stale, and chronologically invalid snapshots", () => {
    expect(() =>
      buildOracleUpdate(live({ verificationStatus: "unconfirmed" }), 0n, 14_400, NOW)
    ).to.throw("Refusing non-verified snapshot");
    expect(() =>
      buildOracleUpdate(live(), 0n, 30, NOW)
    ).to.throw("Source observation is already stale");
    expect(() =>
      buildOracleUpdate(live({ nextDrawISO: LAST_DRAW }), 0n, 14_400, NOW)
    ).to.throw("not chronological");
  });

  it("rejects missing or contradictory source provenance", () => {
    expect(() =>
      buildOracleUpdate(
        live({ verificationSources: ["powerball.com", "missing.example"] }),
        0n,
        14_400,
        NOW
      )
    ).to.throw("Missing provenance");
    expect(() =>
      buildOracleUpdate(
        live({ verificationSources: ["powerball.com", "powerball.com"] }),
        0n,
        14_400,
        NOW
      )
    ).to.throw("verificationSources must be unique");
    expect(() =>
      buildOracleUpdate(live({ sourceObservedAt: "2026-09-02T17:58:30.000Z" }), 0n, 14_400, NOW)
    ).to.throw("latest agreeing source observation");
  });

  it("rejects invalid value and reference fields", () => {
    expect(() =>
      buildOracleUpdate(live({ cashValue: 226 }), 0n, 14_400, NOW)
    ).to.throw("cashValue must be positive");
    expect(() =>
      buildOracleUpdate(live({ drawId: "powerball-draw:wrong" }), 0n, 14_400, NOW)
    ).to.throw("drawId does not match");
    expect(() =>
      buildOracleUpdate(live({ cycleId: "August cycle" }), 0n, 14_400, NOW)
    ).to.throw("canonical");
  });

  it("rejects deprecated or malformed deployment records", () => {
    expect(() =>
      validateDeploymentRecord({
        status: "deprecated",
        oracle: "0x0000000000000000000000000000000000000001",
      })
    ).to.throw("deprecated");
    expect(() => validateDeploymentRecord({ status: "candidate" })).to.throw(
      "valid oracle address"
    );
    expect(
      validateDeploymentRecord({
        status: "candidate",
        oracle: "0x0000000000000000000000000000000000000001",
      })
    ).to.equal("0x0000000000000000000000000000000000000001");
  });

  it("requires authenticated transport except on loopback", () => {
    expect(validateDashboardUrl("https://dashboard.moonball.example/")).to.equal(
      "https://dashboard.moonball.example"
    );
    expect(validateDashboardUrl("http://127.0.0.1:5000/")).to.equal(
      "http://127.0.0.1:5000"
    );
    expect(() => validateDashboardUrl("http://dashboard.example")).to.throw(
      "must use HTTPS"
    );
    expect(() => validateDashboardUrl("https://user:pass@dashboard.example")).to.throw(
      "must not contain embedded credentials"
    );
  });

  it("retries only up to the configured bound", async () => {
    let attempts = 0;
    const result = await withRetries(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error("temporary");
        return "ok";
      },
      3,
      0,
      async () => undefined
    );
    expect(result).to.equal("ok");
    expect(attempts).to.equal(3);

    attempts = 0;
    let failure: unknown;
    try {
      await withRetries(
        async () => {
          attempts++;
          throw new Error("permanent");
        },
        2,
        0,
        async () => undefined
      );
    } catch (error) {
      failure = error;
    }
    expect((failure as Error).message).to.equal("permanent");
    expect(attempts).to.equal(2);
  });
});
