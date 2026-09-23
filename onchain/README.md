# Moonball On-Chain Protocol

The on-chain half of Moonball: a fixed-supply ERC-20 token (**MOON**) that trades
as a **DEX event market** on Base. MOON's price is discovered entirely on a
decentralized exchange (e.g. a MOON/USDC Uniswap v3 pool). A read-only
`JackpotOracle` publishes a **reference value** derived from the verified
Powerball jackpot — informational only, **not** a peg or a price the protocol
trades at.

There is **no protocol mint, no redemption, no collateral treasury, and no peg
to defend.** The token is immutable and ownerless once deployed.

The accepted v1 architecture is defined in
[`../docs/architecture/FOUNDER_DECISIONS.md`](../docs/architecture/FOUNDER_DECISIONS.md).
This README describes the current implementation and its remaining gaps; the
founder decision record controls if the two conflict.

This is an **isolated Hardhat project**. It has its own `package.json`,
config, and test/scripts and does **not** touch the running dashboard
(Express/React/Postgres). The dashboard is the off-chain data source; the
`bridge` script is the only link between the two.

> ⚠️ There is no production deployment and the contracts are not audited. The
> addresses in `deployments/baseSepolia.json` are a Base Sepolia `candidate`
> only. The obsolete 2026-06-08 addresses are archived under
> `deployments/history/` and remain explicitly deprecated. See **Production gaps**.

## Contracts

| Contract | Purpose |
| --- | --- |
| `MoonballToken.sol` | The MOON ERC-20. Exactly 100M MOON is hardcoded and minted once at deployment to a single recipient. No mint, redeem, peg, treasury, or admin — immutable and ownerless after deployment. |
| `JackpotOracle.sol` | Stores sequenced, source-timestamped jackpot snapshots and exposes an informational reference value. Enforces replay, chronology, cash, $20M–$5B, and source-age guards. |
| `MoonballPOLFeeSplitter.sol` | Safe-controlled recipients for fees collected from Moonball-owned POL positions. Cumulative accounting sends 12% to treasury and every remaining token unit to POL without adding a trader fee. |
| `OfficialMarketRegistry.sol` | Safe-controlled source of truth for the canonical MOON/USDC Uniswap v3 pool. Registration must match the configured factory and does not create a pool or move liquidity. |
| `interfaces/IJackpotOracle.sol` | Oracle interface. |
| `mocks/MockUSDC.sol` | 6-decimal test USDC (open `mint`), usable as a DEX pair token in tests. Test only. |

### Key design points

- **Price is set by the market, not the protocol.** MOON has a fixed supply that
  is minted in full at deployment (100M tokens). The protocol never creates or
  destroys tokens after that and never holds collateral. V1 has no automatic,
  mandatory, or price-defense trading. Whatever the DEX pool says MOON is worth,
  that's the price.
- **The oracle publishes a reference value, not a peg.** `oracleReferenceValueWad()`
  returns a linear reference derived from public jackpot data ($10 at the $20M
  floor, +$10 per $20M — i.e. `jackpotMillions / 2` dollars, so $225M ⇒ $112.50).
  The token does not read this value; nothing on-chain forces the market price
  toward it. It exists so the on-chain surface can publish the same reference the
  dashboard shows.
- **Oracle integrity.** Only the authorized updater can push. Phase 2 adds
  monotonic sequences, deterministic snapshot/cycle/draw IDs, permanent replay
  protection, cash and draw-chronology checks, and freshness measured from the
  source observation rather than transaction time. See
  [`../docs/architecture/PHASE_2_ORACLE_HARDENING.md`](../docs/architecture/PHASE_2_ORACLE_HARDENING.md).
- **Immutable token.** `MoonballToken` has no owner and no admin functions. What
  ships is what holders get — there is no pause, no fee switch, and no upgrade path.
- **Bounded market infrastructure.** Phase 3 adds an official-market registry and
  POL fee splitter controlled through two-step ownership. Neither contract can
  trade, create a pool, access a position NFT, change token supply, or use the
  oracle. Ownership renunciation is disabled so the Safe cannot accidentally
  strand operational controls. See
  [`../docs/architecture/PHASE_3_MARKET_INFRASTRUCTURE.md`](../docs/architecture/PHASE_3_MARKET_INFRASTRUCTURE.md).

## Token Supply & Allocation

The full 100M MOON is minted at genesis to the treasury/LP-seeder wallet. **Not
all 100M is released at once.** The treasury holds and releases tokens according
to the allocation buckets below. The Safe approves the initial pool seed and
price. Oracle values are informational inputs, not an automatic price-setting
instruction.

| Bucket | % | MOON | Notes |
|---|---|---|---|
| Founder | 20% | 20M | Solo founder. 1-year cliff, 4-year vesting. |
| Investors | 15% | 15M | Seed round that funds initial pool capital and operations. Vesting per term sheet. |
| Treasury | 35% | 35M | Funds the initial MOON/USDC pool seed (POL), future POL management, and operations. Phased release by governance. |
| Community & Incentives | 30% | 30M | Trading rewards, LP incentives, ecosystem growth. Gradual 4-year release. |

> The initial pool seed (protocol-owned liquidity) is funded out of the Treasury
> bucket — it is not a separate named allocation. The seed amount is computed at
> launch using the pool size calculator.

**Buybacks:** v1 contains no automatic, mandatory, price-defense, promised, or
guaranteed buyback. Governance may consider future discretionary treasury action
only after legal, regulatory, treasury, and governance review; that possibility
does not create a price-support or redemption obligation.

## Fee Structure

The trader pays the standard Uniswap v3 pool fee only. The token has no transfer
fee and Moonball adds no router surcharge.

| Layer | Parameter | Value |
|---|---|---|
| Token contract | Transfer fee | 0% — immutable, no fee switch |
| DEX pool | Swap fee tier | 1% (Uniswap v3 10000-bps tier) at launch |
| Moonball protocol allocation | On collection of Moonball POL fees | 12% of each collected token amount → protocol treasury |
| POL retained share | Remainder of collected Moonball POL fees | 88% remains with POL |

Fees earned by third-party LP positions are unaffected. The 12/88 allocation is
not Uniswap v3's native protocol-fee switch; it occurs only when the Safe
collects fees earned by Moonball-owned POL positions. The Safe may collect
directly to an audited, narrowly scoped splitter while retaining ownership of
the position NFT.

### Treasury Policy

The current treasury policy targets 50% for POL and 50% for operations. This is
not an immutable or automatic on-chain split. The Safe may change treasury
policy through authorized governance with transparent accounting. POL may be
withdrawn or migrated for legitimate governance, security, recovery, or
infrastructure reasons, but never to satisfy a redemption or price guarantee.

### Fee Tier Glide Path

The launch fee is 1%. A future governance-approved migration may consider a
lower fee such as 0.30%; TVL does not trigger an automatic change.

| Pool TVL | Fee tier | Trigger |
|---|---|---|
| Launch | 1.00% (10000 bps) | Initial deployment |
| Future option | 0.30% (3000 bps) | Separate governance-approved migration or configuration |

### Pool Seeding Formula

The initial MOON/USDC seed amounts are chosen so pool depth is sized to approved
liquidity and volume assumptions:

   `USDC_needed = daily_volume × 0.05 / (target_impact_pct / 100)`

   where target_impact_pct is the desired max price impact per trade (e.g. 1%).

   `MOON_needed = USDC_needed / launch_price`

The launch price is an explicit Safe/governance-approved deployment parameter.
The oracle reference may be displayed as a scenario, but it must not
automatically initialize the pool or be represented as a guaranteed price.

## Layout

```
onchain/
  contracts/        Solidity sources
  test/             Hardhat + chai test suite
  scripts/
    deploy.ts             Deploy oracle + token, record addresses (deployments/<network>.json)
    bridge.ts             Off-chain oracle bridge (dashboard → on-chain)
    bridge-lib.ts         Strict payload validation + deterministic snapshot encoding
    transfer-ownership.ts Start/complete the oracle's two-step ownership transfer
  hardhat.config.ts
```

## Usage

All commands run **from `onchain/`**. Dependencies live in the repo root
`node_modules` (Node resolves them from here).

```bash
# Compile
npx hardhat compile

# Run the test suite
npx hardhat test
```

### Local end-to-end (node + deploy + bridge)

```bash
# Terminal 1: local chain
npx hardhat node

# Terminal 2: deploy (deploys a MockUSDC pair token + the oracle + the token)
SEED_JACKPOT_M=225 npx hardhat run scripts/deploy.ts --network localhost

# Terminal 2: local-only bridge example
RPC_URL=http://127.0.0.1:8545 PRIVATE_KEY=0x... \
DASHBOARD_URL=http://localhost:5000 ONCE=1 \
  npx hardhat run scripts/bridge.ts --network localhost
```

After deployment, Moonball's authorized workflow seeds and registers the
official MOON/USDC pool. Public Uniswap infrastructure may contain unofficial
third-party pools, but the application must recognize only the Safe-approved
official v1 market. The bridge reads `GET /api/powerball/live`, independently
checks the contributing observations and consensus calculation, converts values
to whole USD, derives deterministic identifiers, and calls
`fulfillJackpotData`. Verification cannot be disabled. The bridge never
fabricates draw/source timestamps and refuses deprecated deployment records.
Use `POLL_SECONDS=300` for daemon mode; one-shot failures exit nonzero after the
configured bounded retries. Public-network sends additionally require the exact
`EXPECTED_SNAPSHOT_ID` and `EXPECTED_SEQUENCE` produced by a reviewed dry run.
On Windows, use `bridge-base-sepolia-preflight.ps1` and
`publish-base-sepolia-snapshot-with-key.ps1` so the updater key is never saved in
the synced checkout.

### Configuration (env / `.env`)

| Var | Used by | Meaning |
| --- | --- | --- |
| `RPC_URL` | bridge, config | Chain RPC endpoint |
| `PRIVATE_KEY` | bridge | Authorized updater key |
| `DEPLOYER_PRIVATE_KEY` | deploy/config | Deployer key |
| `DEPLOYER_ADDRESS` | preflight only | Public deployer address; permits read-only checks without a key and must match the signer if one is configured |
| `ORACLE_ADDRESS` | bridge | Oracle to update (else read from `deployments/<NETWORK>.json`) |
| `DASHBOARD_URL` | bridge | Dashboard base URL (default `http://localhost:5000`) |
| `DRY_RUN` | bridge | `1` performs full read-only validation and transaction simulation without loading a key |
| `EXPECTED_SNAPSHOT_ID` / `EXPECTED_SEQUENCE` | public-network bridge | Exact values from the explicitly approved dry run |
| `POLL_SECONDS` / `ONCE` | bridge | Daemon interval / single run |
| `RETRY_ATTEMPTS` / `RETRY_DELAY_MS` | bridge | Bounded retries per run/cycle (defaults: 3 / 2000ms) |
| `USDC_ADDRESS` | deploy | DEX pair quote token; required and checked against official USDC on Base public networks; MockUSDC fallback is local only |
| `UPDATER_ADDRESS` | deploy | Limited oracle updater / bridge keeper; required on public networks and separate from the Safe |
| `ORACLE_STALENESS` | deploy | Seconds before oracle data is stale (default 14400) |
| `SUPPLY_RECIPIENT` | deploy | Address receiving the hardcoded 100M supply; required publicly and must be the Safe on Base mainnet |
| `SEED_JACKPOT_M` | deploy | Optional `localhost`/Hardhat-only seed; requires deployer to be updater, otherwise use the bridge |
| `SAFE_ADDRESS` | deploy, transfer-ownership | Base Sepolia rehearsal accepts 1-of-3 or 2-of-3; Base mainnet requires a contract-validated 2-of-3 Safe |

Public-network seed values are prohibited. Before a Base Sepolia transaction,
run `npm run preflight -- --network baseSepolia`; afterward, run
`npm run verify:deployment -- --network baseSepolia`. The complete controlled
procedure is in
[`../docs/deployment/BASE_SEPOLIA_REHEARSAL.md`](../docs/deployment/BASE_SEPOLIA_REHEARSAL.md).
On Windows, `npm.cmd run preflight:signer` confirms local key control through a
hidden prompt without writing the private key to `.env` or sending a transaction.
Using `npm.cmd` avoids PowerShell's blocked `npm.ps1` shim without changing the
system execution policy. The Windows signer and deployment wrappers require the
checksum-verified portable Node 22 runtime under
`%LOCALAPPDATA%\Moonball\runtimes\node-v22.23.2-win-x64`; they reject another
Node major version before any signing operation.
After explicit approval, `npm.cmd run deploy:base-sepolia:interactive -- -Approved`
runs signer preflight, the Base Sepolia candidate deployment, and read-only
post-deployment verification through one hidden, transient-key prompt.

Phase 3 market infrastructure has a separate, Base Sepolia-only preparation
workflow. `npm.cmd run market:base-sepolia:preflight` is read-only and checks the
approved Safe, treasury/POL destinations, current core candidate, and canonical
Uniswap v3 factory. The splitter and registry are not deployed or connected to
a pool. See
[`../docs/deployment/BASE_SEPOLIA_MARKET_INFRASTRUCTURE.md`](../docs/deployment/BASE_SEPOLIA_MARKET_INFRASTRUCTURE.md)
for the exact addresses and remaining approval gates.

## Test coverage

Run `npx hardhat test` in the target checkout to obtain current pass/fail
results. The suite covers:

- **Oracle:** source-based freshness, updater authorization, value/cash and draw
  bounds, monotonic sequences, replay protection, pause, cycle events, two-step
  ownership, reference-value math, and safe admin configuration.
- **Verifier and bridge:** order-independent largest-cluster consensus, tie and
  duplicate-source rejection, provenance/timestamp validation, deterministic
  snapshot encoding, deprecated-deployment refusal, and bounded retries.
- **Reference vs. token decoupling:** the token never reads the oracle and exposes
  no peg/redeem surface.
- **Token:** ERC-20 metadata, genesis supply minted to the recipient, zero-address
  / zero-supply deploy guards, transfer + events, balance/zero-address reverts,
  approve + transferFrom with allowance decrement, infinite (max) allowance, and
  over-allowance revert.

## Production gaps (before any mainnet deploy)

1. **Professional audit** of the ERC-20 and oracle, even though the token is now a
   minimal fixed-supply contract. This is a reference implementation, not audited code.
2. **Oracle operations.** Phase 2 implements source timestamps, identifiers,
   replay protection, a separately limited updater, and bounded bridge retries.
   Production still needs managed key custody, redundant RPCs, nonce/gas policy,
   external alerting, and incident runbooks.
3. **Governance & key management.** Configure the Moonball 2-of-3 Safe as oracle
   owner at deployment. The Safe appoints and can revoke the limited updater; a
   timelock is optional for the MVP. Legacy ownership moves use the two-step
   `scripts/transfer-ownership.ts` flow. (The token is ownerless.)
4. **Oracle bounds heuristics.** The $20M–$5B bounds are heuristics; validate
   against historical Powerball data and add per-update deviation limits.
5. **ERC-20 completeness.** Consider EIP-2612 `permit`, and confirm the minimal
   ERC-20 implementation against the exact integrations (DEXs, bridges) you target.
6. **DEX/POL deployment and audit.** Phase 3 implements the official-market
   registry and cumulative 12/88 POL fee splitter in source, with unit tests.
   They remain unaudited and undeployed. Production still requires a reviewed
   collection workflow, canonical Uniswap v3 integration rehearsal, a 2-of-3
   Safe that owns the POL NFT and both contracts, and explicit Safe approval of
   pool initialization and any later fee-tier migration. The oracle must never
   control those actions.
7. **Operational hardening of the bridge.** Bounded retries and fail-closed
   one-shot exits are implemented. Add alerting, redundant RPCs, nonce management,
   gas strategy, and service monitoring; run it as a managed service.
8. **Legal/regulatory review** of a jackpot-referenced event-market token before any
   public launch.
