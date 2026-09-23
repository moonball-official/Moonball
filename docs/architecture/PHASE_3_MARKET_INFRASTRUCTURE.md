# Phase 3 Market Infrastructure

- **Status:** Implemented in source with local tests
- **Release posture:** Unaudited and undeployed
- **Excluded:** Pool creation, liquidity, position-NFT custody, automated fee
  collection, swaps, oracle-driven market actions, and mainnet deployment

Phase 3 implements the two narrowly scoped contracts required to identify
Moonball's official market and route fees already collected from
Moonball-owned protocol liquidity (POL). It does not deploy or initialize a
Uniswap pool and does not authorize liquidity or mainnet activity.

## `MoonballPOLFeeSplitter`

The splitter receives ERC-20 balances after the Moonball 2-of-3 Safe collects
fees from a Moonball-owned Uniswap v3 position. Anyone may trigger distribution,
but funds can only reach the owner-configured treasury and POL recipients.

For each token, the contract records cumulative collected and treasury amounts.
On every distribution it computes:

```text
cumulative treasury = floor(cumulative collected * 1,200 / 10,000)
current treasury     = cumulative treasury - treasury already distributed
current POL          = current collected - current treasury
```

This carries indivisible-token rounding forward instead of repeatedly losing a
fraction on small collections. At token precision, the aggregate treasury share
is 12% rounded down and POL receives every remaining unit. With standard MOON
and USDC precision, ordinary fee collections therefore follow the approved
12/88 policy exactly.

The splitter:

- adds no swap surcharge or transfer tax;
- has no access to third-party LP positions or fees;
- cannot trade, mint, redeem, or access a Uniswap position NFT;
- uses safe ERC-20 transfers and a reentrancy guard;
- permits only the owner to change recipients; and
- rejects itself as a recipient so a misconfiguration cannot re-count retained
  tokens on later distributions; and
- uses two-step ownership with renunciation disabled so control can be handed to
  the Safe without accidentally becoming unrecoverable.

Fee-on-transfer and rebasing tokens are intentionally unsupported. The intended
assets are standard ERC-20s such as MOON and USDC.
Direct deposits from any sender are also treated as distributable funds; the
splitter does not prove that a token transfer came from POL fee collection.

## `OfficialMarketRegistry`

The registry stores one official MOON/USDC market. A proposed pool is accepted
only when it has deployed code and is exactly the pool returned by the immutable
Uniswap v3 factory for the immutable MOON token, quote token, and selected fee
tier. The approved launch tier is exposed as `LAUNCH_FEE_TIER = 10000` (1%).
The first registration must use that tier.

Only the owner can designate or migrate the official market. A later migration
to another canonical pool or fee tier therefore requires an explicit Safe
transaction; there is no TVL trigger or automatic migration. Each change
increments `marketVersion` and emits the previous and new pool and fee tier.

The registry does not create pools, initialize prices, transfer liquidity,
trade, read the jackpot oracle, or prevent third parties from creating unofficial
Uniswap pools. Applications must read the registry to determine which market
Moonball recognizes.

## Verification completed

The focused test suite covers:

- an exact 12/88 distribution;
- cumulative rounding across multiple sub-threshold balances;
- permissionless triggering with owner-only recipient changes;
- invalid token, recipient, and empty-balance rejection;
- two-step ownership and disabled renunciation;
- canonical 1% market registration;
- rejection of a non-1% first official market;
- rejection of unauthorized, unofficial, code-less, and duplicate markets; and
- an explicit owner-approved migration to another canonical fee tier.

On 2026-09-21, the contracts and guarded Base Sepolia preparation scripts
compiled successfully, all 73 on-chain tests and the TypeScript check passed,
and a live read-only market preflight passed. No market transaction was sent.

The Base Sepolia-only scripts pin the existing MOON/USDC candidate, the
canonical Uniswap v3 factory, the 1-of-3 rehearsal Safe, and the user-designated
treasury and POL recipients. A future deployment must be separately approved,
uses a hidden private-key prompt, creates a durable partial marker before any
broadcast, and verifies the creation transactions against compiled artifacts and
constructor arguments before writing a candidate record. It deploys neither a
pool nor liquidity.

## Remaining release gates

The [Phase 3 audit handoff](../security/PHASE_3_MARKET_AUDIT_HANDOFF.md)
records the trust assumptions and independent-review checklist.

Before these contracts are deployed or used with liquidity:

1. obtain an independent professional audit and resolve its findings;
2. obtain separate approval for the guarded deployment and independently
   verify its candidate record; the source-only scripts do not authorize a run;
3. confirm custody of the treasury destination and deploy with the Safe as
   initial owner (or complete a two-step handoff if a different deployment path
   is later approved); a 1-of-3 Safe is rehearsal-only, while production
   requires 2-of-3;
4. rehearse pool creation, initial-price approval, liquidity minting, and Safe
   custody of the position NFT on Base Sepolia;
5. rehearse collection to the splitter and verify both MOON and USDC 12/88
   distributions end to end; and
6. publish addresses and connect the application only after the deployment is
   independently verified.

None of these source changes authorize a pool, liquidity, another oracle update,
vesting, or a Base mainnet transaction.
