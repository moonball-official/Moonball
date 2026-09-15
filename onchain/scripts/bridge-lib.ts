import { getAddress, id, isAddress, solidityPackedKeccak256 } from "ethers";

export interface SourceObservation {
  source: string;
  value: number;
  cashValue: number;
  fetchedAt: string;
}

export interface LiveData {
  estimated: number;
  cashValue: number;
  lastDrawISO: string;
  nextDrawISO: string;
  cycleId: string;
  drawId: string;
  winner: "Yes" | "No";
  drawsInCurrentCycle: number;
  verificationStatus: "verified" | "unconfirmed";
  verificationSources: string[];
  sourceObservations: SourceObservation[];
  sourceObservedAt: string;
  verifiedAt: string;
}

export interface OracleUpdate {
  sequence: bigint;
  snapshotId: string;
  cycleId: string;
  drawId: string;
  jackpotAmountUsd: bigint;
  cashValueUsd: bigint;
  lastDrawTimestamp: bigint;
  nextDrawTimestamp: bigint;
  sourceTimestamp: bigint;
  hadWinner: boolean;
  drawsSinceReset: number;
}

export interface DeploymentRecord {
  status?: string;
  oracle?: string;
}

export function validateDashboardUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("DASHBOARD_URL must be a valid absolute URL.");
  }
  if (url.username || url.password) {
    throw new Error("DASHBOARD_URL must not contain embedded credentials.");
  }
  const hostname = url.hostname.toLowerCase();
  const isLoopback =
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
    throw new Error("DASHBOARD_URL must use HTTPS except for a loopback development URL.");
  }
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

const MIN_JACKPOT_USD = 20_000_000n;
const MAX_JACKPOT_USD = 5_000_000_000n;
const MAX_CLOCK_SKEW_SECONDS = 5 * 60;
const MAX_UINT32 = 2 ** 32 - 1;
const MAX_UINT64 = (1n << 64n) - 1n;
const CONSENSUS_TOLERANCE_MILLIONS = 5;

function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Dashboard response must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, name: string): string {
  const value = record[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value;
}

function requireFiniteNumber(record: Record<string, unknown>, name: string): number {
  const value = record[name];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number.`);
  }
  return value;
}

function isoSeconds(value: string, name: string): number {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error(`${name} must be a valid ISO timestamp.`);
  return Math.floor(milliseconds / 1000);
}

function millionsToWholeUsd(value: number, name: string): bigint {
  const wholeUsd = Math.round(value * 1_000_000);
  if (!Number.isSafeInteger(wholeUsd)) {
    throw new Error(`${name} cannot be represented as whole USD.`);
  }
  return BigInt(wholeUsd);
}

/** Validate the public API snapshot and deterministically encode an oracle update. */
export function buildOracleUpdate(
  input: unknown,
  currentSequence: bigint,
  stalenessThreshold: number,
  nowSeconds = Math.floor(Date.now() / 1000)
): OracleUpdate {
  const live = requireObject(input);
  if (live.verificationStatus !== "verified") {
    throw new Error(`Refusing non-verified snapshot (status=${String(live.verificationStatus)}).`);
  }
  if (!Number.isSafeInteger(stalenessThreshold) || stalenessThreshold <= 0) {
    throw new Error("On-chain staleness threshold is invalid.");
  }
  if (currentSequence < 0n || currentSequence >= MAX_UINT64) {
    throw new Error("On-chain oracle sequence cannot be incremented safely.");
  }

  const estimated = requireFiniteNumber(live, "estimated");
  const cashValue = requireFiniteNumber(live, "cashValue");
  const jackpotAmountUsd = millionsToWholeUsd(estimated, "estimated");
  const cashValueUsd = millionsToWholeUsd(cashValue, "cashValue");
  if (jackpotAmountUsd < MIN_JACKPOT_USD || jackpotAmountUsd > MAX_JACKPOT_USD) {
    throw new Error(`estimated is outside the $20M-$5B oracle bounds.`);
  }
  if (cashValueUsd <= 0n || cashValueUsd > jackpotAmountUsd) {
    throw new Error("cashValue must be positive and no greater than estimated.");
  }

  const lastDrawISO = requireString(live, "lastDrawISO");
  const nextDrawISO = requireString(live, "nextDrawISO");
  const sourceObservedAt = requireString(live, "sourceObservedAt");
  const verifiedAt = requireString(live, "verifiedAt");
  const lastDrawTimestamp = isoSeconds(lastDrawISO, "lastDrawISO");
  const nextDrawTimestamp = isoSeconds(nextDrawISO, "nextDrawISO");
  const sourceTimestamp = isoSeconds(sourceObservedAt, "sourceObservedAt");
  const verifiedTimestamp = isoSeconds(verifiedAt, "verifiedAt");
  if (
    lastDrawTimestamp >= nextDrawTimestamp ||
    lastDrawTimestamp > sourceTimestamp ||
    sourceTimestamp >= nextDrawTimestamp
  ) {
    throw new Error("Draw and source timestamps are not chronological.");
  }
  if (sourceTimestamp > nowSeconds + MAX_CLOCK_SKEW_SECONDS) {
    throw new Error("Source observation is too far in the future.");
  }
  if (nowSeconds > sourceTimestamp && nowSeconds - sourceTimestamp > stalenessThreshold) {
    throw new Error("Source observation is already stale.");
  }
  if (verifiedTimestamp < sourceTimestamp || verifiedTimestamp > nowSeconds + MAX_CLOCK_SKEW_SECONDS) {
    throw new Error("verifiedAt is inconsistent with the source observation.");
  }

  const cycleReference = requireString(live, "cycleId");
  if (!/^powerball-cycle:\d{4}-\d{2}-\d{2}$/.test(cycleReference)) {
    throw new Error("cycleId must use the canonical powerball-cycle:YYYY-MM-DD form.");
  }
  const drawReference = requireString(live, "drawId");
  const expectedDrawReference = `powerball-draw:${new Date(lastDrawTimestamp * 1000).toISOString()}`;
  if (drawReference !== expectedDrawReference) {
    throw new Error("drawId does not match lastDrawISO.");
  }

  const winner = live.winner;
  if (winner !== "Yes" && winner !== "No") {
    throw new Error('winner must be exactly "Yes" or "No".');
  }
  const drawsSinceReset = requireFiniteNumber(live, "drawsInCurrentCycle");
  if (!Number.isSafeInteger(drawsSinceReset) || drawsSinceReset < 0 || drawsSinceReset > MAX_UINT32) {
    throw new Error("drawsInCurrentCycle must fit in uint32.");
  }

  if (!Array.isArray(live.verificationSources) || live.verificationSources.length < 2) {
    throw new Error("At least two verificationSources are required.");
  }
  const verificationSources = live.verificationSources.map((value) => {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error("verificationSources must contain non-empty strings.");
    }
    return value;
  });
  if (new Set(verificationSources).size !== verificationSources.length) {
    throw new Error("verificationSources must be unique.");
  }
  if (!Array.isArray(live.sourceObservations)) {
    throw new Error("sourceObservations must be an array.");
  }

  const observationBySource = new Map<string, SourceObservation>();
  for (const value of live.sourceObservations) {
    const observation = requireObject(value);
    const source = requireString(observation, "source");
    if (observationBySource.has(source)) {
      throw new Error(`sourceObservations contains duplicate source ${source}.`);
    }
    observationBySource.set(source, {
      source,
      value: requireFiniteNumber(observation, "value"),
      cashValue: requireFiniteNumber(observation, "cashValue"),
      fetchedAt: requireString(observation, "fetchedAt"),
    });
  }

  let latestAgreedObservation = 0;
  const agreedObservations: SourceObservation[] = [];
  for (const source of verificationSources) {
    const observation = observationBySource.get(source);
    if (!observation) throw new Error(`Missing provenance for verification source ${source}.`);
    if (Math.abs(observation.value - estimated) > CONSENSUS_TOLERANCE_MILLIONS) {
      throw new Error(`Verification source ${source} does not agree with estimated.`);
    }
    const observed = isoSeconds(observation.fetchedAt, `${source}.fetchedAt`);
    if (observed > nowSeconds + MAX_CLOCK_SKEW_SECONDS) {
      throw new Error(`Verification source ${source} is dated in the future.`);
    }
    if (nowSeconds > observed && nowSeconds - observed > stalenessThreshold) {
      throw new Error(`Verification source ${source} is stale.`);
    }
    latestAgreedObservation = Math.max(latestAgreedObservation, observed);
    agreedObservations.push(observation);
  }
  if (latestAgreedObservation !== sourceTimestamp) {
    throw new Error("sourceObservedAt must equal the latest agreeing source observation.");
  }
  const agreedValues = agreedObservations.map((observation) => observation.value);
  if (Math.max(...agreedValues) - Math.min(...agreedValues) > CONSENSUS_TOLERANCE_MILLIONS) {
    throw new Error("verificationSources do not fit within one consensus range.");
  }
  const expectedEstimated = Math.round(
    agreedValues.reduce((sum, value) => sum + value, 0) / agreedValues.length
  );
  if (estimated !== expectedEstimated) {
    throw new Error("estimated does not equal the consensus of verificationSources.");
  }
  const agreedCashValues = agreedObservations
    .filter(
      (observation) =>
        observation.cashValue > 0 && observation.cashValue <= observation.value
    )
    .map((observation) => observation.cashValue);
  if (agreedCashValues.length === 0) {
    throw new Error("verificationSources do not provide a valid cash value.");
  }
  const expectedCashValue = Math.round(
    agreedCashValues.reduce((sum, value) => sum + value, 0) /
      agreedCashValues.length
  );
  if (cashValue !== expectedCashValue) {
    throw new Error("cashValue does not equal the consensus of verificationSources.");
  }

  const sequence = currentSequence + 1n;
  const cycleId = id(cycleReference);
  const drawId = id(drawReference);
  const hadWinner = winner === "Yes";
  const snapshotId = solidityPackedKeccak256(
    [
      "bytes32",
      "bytes32",
      "uint256",
      "uint256",
      "uint64",
      "uint64",
      "uint64",
      "bool",
      "uint32",
    ],
    [
      cycleId,
      drawId,
      jackpotAmountUsd,
      cashValueUsd,
      lastDrawTimestamp,
      nextDrawTimestamp,
      sourceTimestamp,
      hadWinner,
      drawsSinceReset,
    ]
  );

  return {
    sequence,
    snapshotId,
    cycleId,
    drawId,
    jackpotAmountUsd,
    cashValueUsd,
    lastDrawTimestamp: BigInt(lastDrawTimestamp),
    nextDrawTimestamp: BigInt(nextDrawTimestamp),
    sourceTimestamp: BigInt(sourceTimestamp),
    hadWinner,
    drawsSinceReset,
  };
}

export function validateDeploymentRecord(input: unknown): string {
  const record = requireObject(input) as DeploymentRecord;
  if (record.status === "deprecated") {
    throw new Error("Refusing deprecated deployment record.");
  }
  if (!record.oracle || !isAddress(record.oracle)) {
    throw new Error("Deployment record does not contain a valid oracle address.");
  }
  return getAddress(record.oracle);
}

export async function withRetries<T>(
  operation: () => Promise<T>,
  attempts: number,
  delayMs: number,
  sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds))
): Promise<T> {
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 10) {
    throw new Error("Retry attempts must be a whole number from 1 through 10.");
  }
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(delayMs);
    }
  }
  throw lastError;
}
