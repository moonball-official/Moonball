# Phase 3 Market Infrastructure — Audit Handoff

- **Status (2026-09-21):** Internal source review and local tests only; no independent audit or market-infrastructure deployment.
- **Review target:** `onchain/contracts/MoonballPOLFeeSplitter.sol` and `onchain/contracts/OfficialMarketRegistry.sol`, including their pinned OpenZeppelin dependencies and the Base Sepolia deployment/verification scripts.
- **Not in scope:** Pool creation, liquidity, position-NFT custody, fee collection from Uniswap, oracle publication, vesting, and mainnet execution.
- **Latest chain check:** A prior Base Sepolia read-only preflight passed; a 2026-09-21 rerun from the restricted Codex environment returned `AggregateError [EACCES]` and did not refresh chain state. Local tests and TypeScript validation passed.

## Intended behavior and trust assumptions

1. A trader pays the standard Uniswap v3 1% pool fee. Moonball's POL position earns only its share of that fee. The Safe collects those earnings and transfers them to the splitter; the splitter does not collect from the pool or charge a trader.
2. For each supported ERC-20 token received, cumulative distribution sends `floor(total received * 12 / 100)` units to the treasury and all remaining units to POL. Rounding is cumulative per token. There is no provenance check for deposits: any tokens sent directly to the splitter are treated as distributable funds, so the Safe/operator must reconcile incoming transfers.
3. Anyone can trigger distribution. Only the owner can change recipients or set the official market. The intended owner of both contracts is the Base Sepolia Safe from construction onward.
4. The registry can designate only the pool returned by the pinned Uniswap v3 factory for the pinned MOON/USDC pair. The first designation requires the 1% tier; a later migration requires an explicit owner action.
5. The rehearsal Safe has three distinct owners but threshold one. It is **not** production-grade 2-of-3 control. The founder self-attested control of treasury `0xd46AC2c972c7f49eaD826a40f0F0EEBa0e12847c`; no independent custody proof was performed.

## Internal review change

The splitter now rejects itself as either recipient. Without that guard, a mistaken owner configuration could leave transferred tokens in the splitter, allowing a later `distribute` call to count the same balance again. Regression tests cover both recipient slots. This is an internal fix, **not** an external audit finding or an assertion that the contracts are audit-ready.

## Independent-review checklist

- Verify the 12/88 cumulative accounting, especially dust, recipient changes, unsolicited transfers, and all ERC-20 transfer behaviors. Fee-on-transfer and rebasing assets are expressly unsupported.
- Review token-call and recipient-call reentrancy assumptions, revert behavior, and whether the public `distribute` surface can create a denial of service with the intended MOON/USDC tokens.
- Verify initial Safe ownership, two-step ownership changes, disabled renunciation, and the operational risk of a 1-of-3 rehearsal Safe.
- Verify canonical-pool validation, first-registration 1% enforcement, version/event semantics, and migration authority.
- Review deployment interruption handling, transaction/bytecode verification, compiler settings, dependency lockfile, and any gap between a locally verified candidate and independently verified on-chain source.
- Confirm the full treasury address on a trusted signing device and agree on how incoming POL fees will be reconciled before any distribution rehearsal.

## Release decision

The repository's current Phase 3 release plan requires an independent professional audit and remediation **before deploying these contracts or using them with liquidity**. A source review here, a successful preflight, or the founder's treasury custody statement does not clear that gate. No private key is needed for the audit handoff. Any later Base Sepolia deployment requires a separate, explicit transaction approval; it does not authorize pool creation, liquidity, or mainnet activity.
