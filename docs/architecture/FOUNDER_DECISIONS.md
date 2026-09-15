# Moonball v1 Founder Architecture Decisions

- **Status:** Accepted
- **Decision date:** 2026-09-01
- **Scope:** Moonball v1
- **Authority:** Founder-approved product and protocol architecture

This document is the source of truth for resolving ambiguity in the legacy
Moonball implementation. It records intended behavior; it does not imply that
every item is already implemented. If source code conflicts with this document,
the conflict must be reported before behavior is changed.

## Core principle

> **The oracle describes the external event. The AMM determines the market price.**

Moonball does not promise that MOON will trade at an oracle reference value,
does not redeem MOON at that value, does not automatically defend the market
price, and does not assume the Powerball jackpot's financial liabilities.

## Accepted decisions

### 1. One perpetual MOON token and primary market

MOON is one perpetual token spanning all Powerball jackpot cycles. V1 has one
continuing official MOON/USDC market. A Powerball cycle transition must not
recreate the token or pool, reset supply or liquidity accounting, or force the
AMM price to a new value.

If a drawing has no jackpot winner, the oracle may publish rollover data. If a
winner ends the current Powerball cycle, the oracle may record that event and
begin a new reference cycle once Powerball publishes the new starting jackpot.
The token, pool, liquidity, and market price continue uninterrupted.

### 2. Uniswap v3 for v1

The official v1 market uses canonical Uniswap v3. Do not introduce a v4 hook,
custom AMM, or forked pool unless a requirement is proven impossible or
materially unsafe in v3 and that limitation is reported before the architecture
changes.

### 3. Swap fee and Moonball POL fee allocation

The launch pool charges the trader exactly the standard Uniswap v3 **1% total
swap fee**. Moonball adds no router surcharge, transfer tax, or other protocol
trading fee.

The Moonball fee allocation applies when fees earned by **Moonball-owned POL
positions** are collected:

- **12%** of each collected token amount is sent to the protocol treasury.
- **88%** remains with POL.
- Fees earned by third-party LP positions are not charged or redirected by
  Moonball.

The production 2-of-3 Safe owns the POL position NFTs and initiates or approves
fee collection. Collection may send proceeds to a narrowly scoped fee-splitter
contract that enforces the 12/88 allocation. The splitter must handle indivisible
token-unit rounding transparently and preserve the 12/88 aggregate ratio at
token precision.

This allocation is not Uniswap v3's native protocol-fee switch. V3's native
switch only supports reciprocal shares and is controlled by the Uniswap factory
owner, so it cannot express or route Moonball's exact 12% allocation. No value
may be silently rounded to 12.5% or another percentage.

The pool fee may be changed only through a future approved migration or
configuration decision. A possible 0.30% fee is a future option, not an
automatic TVL-triggered promise.

### 4. Protocol-owned liquidity

Moonball owns its POL position NFTs. Production ownership and control reside in
a Moonball-controlled 2-of-3 Safe, never a founder's permanent personal wallet.
Temporary development or testnet wallets are acceptable only when the assets
and roles can be transferred before production.

POL may be withdrawn or migrated for governance-approved infrastructure needs,
including migrations, security incidents, compromised infrastructure, contract
replacement, or recovery of protocol-owned assets. It must not be used for
routine price support, a price guarantee, or redemption.

### 5. Treasury policy and buybacks

The current 50/50 POL/operations allocation is treasury policy, not immutable
on-chain protocol behavior. Authorized governance may change that policy, with
transparent accounting and disclosure.

V1 has no automatic, algorithmic, mandatory, price-defense, promised, or
guaranteed buyback. Future discretionary treasury action may be considered only
after governance, legal, regulatory, and treasury review. Such discretion does
not create a price-support or redemption obligation.

### 6. Oracle boundary

The oracle may publish informational and reference state such as:

- jackpot and cash-value references;
- drawing and cycle identifiers;
- rollover or winner state;
- calculated reference or fair value; and
- source and publication timestamps or freshness data.

Oracle data must not:

- set or reset the AMM price or reserves;
- guarantee convergence to a reference value;
- trigger redemption or protocol payout liabilities;
- mint or burn MOON in response to demand or jackpot outcomes;
- force POL trades, withdrawals, or other intervention; or
- recreate the token or liquidity pool for a new jackpot cycle.

### 7. Fixed token supply

The intended production supply is exactly **100,000,000 MOON**, minted once.
There is no unrestricted ongoing mint authority. The former deployment script's
1,000,000-MOON default was a legacy conflict removed in Phase 1 and must not be
reintroduced.

### 8. Governance and operational roles

The Moonball-controlled 2-of-3 Safe is the ultimate production authority for:

- treasury assets;
- POL ownership and migration;
- fee-recipient governance;
- appointment and revocation of operational roles; and
- emergency and infrastructure migration actions.

A separate, limited oracle-updater account may publish routine updates. It must
not receive treasury or POL authority, and the Safe must be able to replace it.
A timelock may be added later but is not required for the MVP.

Emergency authority may protect Moonball-controlled components and assets by
pausing controlled functionality, rotating roles, changing fee recipients, or
migrating/recovering POL. It must never enable redemption, forced conversion,
price floors, price-defense trades, confiscation of user tokens or third-party
LP assets, AMM price manipulation, unlimited minting, or Powerball-linked
liabilities.

### 9. Official market creation

Moonball controls which markets are designated and registered as official v1
markets. V1 is Powerball-focused; permissionless creation of additional
Moonball-supported event markets is outside scope.

Because canonical Uniswap v3 is public infrastructure, Moonball cannot prevent
third parties from creating unrelated or unofficial pools. The Safe-controlled
deployment and official-market registry determine which pool the Moonball
application recognizes as official.

### 10. Legacy Base Sepolia deployments

The addresses in `onchain/deployments/baseSepolia.json`, deployed on 2026-06-08,
belong to an obsolete implementation and are retained only for traceability.
They are:

> **DEPRECATED / NOT CURRENT MOONBALL DEPLOYMENT**

Applications and deployment procedures must not present those addresses as the
current Moonball contracts. No historical on-chain deployment needs to be
destroyed or hidden.

## Implementation gates

Before a new deployment is described as current or production-ready, verify at
minimum:

1. exactly 100,000,000 MOON is minted once;
2. the official market is the continuing MOON/USDC Uniswap v3 1% pool;
3. the 2-of-3 Safe owns each Moonball POL NFT;
4. collection of Moonball POL fees produces the exact 12/88 allocation without
   increasing the trader's 1% fee;
5. oracle updates cannot control AMM state, supply, redemption, or POL;
6. the updater has no treasury or POL privileges;
7. emergency actions are limited to Moonball-controlled infrastructure and
   assets;
8. no automatic buyback or price-defense behavior exists; and
9. all obsolete deployment addresses remain clearly labeled deprecated.
