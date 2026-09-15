# Moonball Pre-Audit Readiness Review — 2026-09-02

- **Status:** Internal engineering review complete
- **Release posture:** Local and Base Sepolia rehearsal only
- **Not a substitute for:** an independent professional smart-contract audit

## Scope reviewed

- fixed-supply `MoonballToken` and vesting wallet;
- Phase 2 `JackpotOracle` state, roles, pause, freshness, and replay rules;
- multi-source verifier, public API provenance, and bridge validation;
- deployment, ownership, vesting, and verification scripts; and
- dependency lockfile and production dependency advisories.

## Findings remediated

1. Public networks can no longer use `SEED_JACKPOT_M`; public oracle state must
   arrive through the verified bridge.
2. The oracle exposes schema version 2. The bridge and deployment verifier reject
   obsolete or incompatible oracle contracts.
3. The bridge requires HTTPS for non-loopback dashboard endpoints and rejects
   URLs containing embedded credentials.
4. New deployment records archive the prior file under `deployments/history/`
   before replacement, preserving deprecated-address traceability.
5. Vesting deployment rejects deprecated token records, wrong token bytecode or
   supply, zero/duplicate beneficiaries, negative or fractional amounts, unsafe
   schedule values, and allocations above total supply before sending a vesting
   transaction.
6. A read-only public-network preflight validates chain ID, deployer balance,
   official USDC code/decimals, configuration, and 2-of-3 Safe shape.
7. A post-deployment verifier checks recorded addresses against code and on-chain
   state, including fixed supply, oracle schema/roles/staleness, USDC decimals,
   and vesting allocations.
8. The npm lockfile no longer references the inaccessible internal registry.
   Patched compatible releases are pinned, including Drizzle ORM 0.45.2, ethers
   6.17.0, ws 8.21.x, and PostCSS 8.5.26.

## Verification evidence

- application TypeScript check and production build pass;
- verifier regression tests pass;
- on-chain TypeScript check passes;
- Hardhat contract/bridge/deployment tests pass;
- local deployment, bridge publication, vesting funding, and read-only
  post-deployment verification pass; and
- `npm audit --omit=dev` reports zero production dependency advisories.

## Open risks and release blockers

1. **Independent audit required.** No contract in this repository is approved
   for mainnet until an external audit is completed and findings are resolved.
2. **Off-chain trust remains.** Source provenance is auditable but not
   cryptographically attested by each lottery source. Compromise of the dashboard
   and updater together can still publish fabricated in-bounds data.
3. **Single operational updater.** Production needs managed key custody,
   rotation and incident procedures, balance monitoring, redundant RPCs, nonce
   management, and bridge/freshness alerting.
4. **Large-change policy.** The oracle allows legitimate jackpot resets and
   rollovers but has no automated per-update deviation circuit breaker. Large
   changes require monitoring and an explicit incident policy.
5. **Development tool advisories.** The full npm audit still reports 24
   development/deployment findings (14 low, 2 moderate, 8 high), primarily in the
   Hardhat 2 toolchain. They are excluded from the production application audit,
   but the deployment workstation must be isolated and the Hardhat 3 migration
   evaluated before mainnet signing.
6. **Market infrastructure remains incomplete.** The official Uniswap v3 pool,
   official-market registry, POL operational controls, and audited 12/88 POL fee
   splitter are separate implementation gates.
7. **Legal and regulatory review remains required** for the jackpot-referenced
   event-market design.

## Recommendation

Proceed only to a controlled Base Sepolia rehearsal after the local `.env` is
configured and the read-only preflight passes. Do not proceed to Base mainnet or
real liquidity from this review alone.
