# Phase 2 — Oracle Pipeline Hardening

- **Status:** Implemented in source; not audited or deployed
- **Implementation date:** 2026-09-02
- **Scope:** verifier -> public API -> bridge -> `JackpotOracle`

Phase 2 hardens the informational jackpot-reference pipeline. It does not give
the oracle authority over MOON balances, the Uniswap pool, POL, fee collection,
redemption, minting, burning, or market-price behavior.

## Snapshot contract

Every accepted update contains:

- a strictly increasing `sequence`;
- deterministic `snapshotId`, `cycleId`, and `drawId` values;
- jackpot and cash value in whole USD;
- actual last-draw, next-draw, and source-observation timestamps;
- winner state and draws-since-reset; and
- a separate on-chain publication timestamp.

The oracle recomputes the snapshot hash and rejects mismatched or reused IDs,
skipped or repeated sequences, source-time or draw-time regressions, stale or
future source observations, invalid draw chronology, missing identifiers,
jackpots outside $20M-$5B, and cash values that are zero or exceed the jackpot.
Freshness is measured from the source observation, not from transaction time.

The Safe-controlled owner can pause oracle writes, rotate the limited updater,
and adjust staleness only within the contract's 5-minute to 24-hour bounds.
Ownership transfers require nomination and acceptance. A configured Safe is
installed as owner in the deployment constructor, avoiding a one-step public
deployment handoff.

## Verifier and API

The verifier deduplicates source names and selects the unique largest cluster
whose complete value range is within $5M. It rejects equal-sized competing
clusters; input ordering cannot choose the result. The API exposes contributing
source names, all source observations and fetch timestamps, the consensus
observation time, the actual last/next draw timestamps, and canonical cycle and
draw references.

An old last-known value may still be displayed as `unconfirmed`, but it cannot
be published by the bridge as a verified snapshot.

## Bridge

The bridge independently reconstructs the verifier's jackpot and cash
consensus from the API provenance. It rejects missing, duplicate, contradictory,
future, or stale observations and does not fabricate timestamps or fallback draw
dates. It derives the deterministic on-chain IDs, reads the current sequence,
skips the exact current snapshot, and refuses replay of any older accepted ID.

`ONCE=1` retries only up to `RETRY_ATTEMPTS` and exits nonzero if the update still
fails. Daemon mode uses the same bounded retry policy per polling cycle. The
bridge also verifies that its wallet is the oracle's configured updater and
refuses a deployment record marked `deprecated`.

## Still required before production

Phase 2 is defense in depth, not a production approval. A professional audit,
managed key custody, redundant RPC policy, transaction/nonce monitoring,
freshness and failure alerting, incident runbooks, and an end-to-end Base Sepolia
deployment rehearsal remain required.
