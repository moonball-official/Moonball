// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VestingWallet} from "@openzeppelin/contracts/finance/VestingWallet.sol";
import {VestingWalletCliff} from "@openzeppelin/contracts/finance/VestingWalletCliff.sol";

/**
 * @title MoonVestingWallet
 * @notice Concrete, per-beneficiary vesting wallet for locked MOON allocations
 *         (founder + investors). It is a thin concrete instance of OpenZeppelin's
 *         {VestingWalletCliff}, which itself extends {VestingWallet}.
 *
 * @dev DESIGN:
 *      - The beneficiary is the wallet OWNER (VestingWallet sets owner =
 *        beneficiary in its constructor). Only the beneficiary can call
 *        `release(token)` to pull the currently-vested MOON to themselves.
 *      - Vesting is LINEAR from `start` over `duration`, but nothing is
 *        releasable until the `cliff` timestamp passes. Pass `cliffSeconds = 0`
 *        for a pure linear schedule with no cliff (e.g. an investor term with no
 *        cliff). `cliffSeconds` must be <= `durationSeconds`.
 *      - To fund a schedule, transfer MOON into this contract's address. The
 *        vesting math is computed over the running historical allocation
 *        (current balance + already-released), so it works for any ERC-20.
 *      - There is NO clawback / revoke. Tokens sent here can only ever flow to
 *        the beneficiary on the published schedule — that is the whole point:
 *        anyone can verify on-chain that the allocation is genuinely locked.
 *
 *      This contract intentionally adds no logic of its own; it only makes the
 *      abstract OpenZeppelin base deployable with explicit constructor args so
 *      the deploy script can create one wallet per beneficiary.
 */
contract MoonVestingWallet is VestingWalletCliff {
    /**
     * @param beneficiary      Address that owns the vested tokens and calls release().
     * @param startTimestamp   Unix time (seconds) when linear vesting begins.
     * @param durationSeconds  Total length of the linear vest, in seconds.
     * @param cliffSeconds     Cliff length from start, in seconds (0 = no cliff).
     */
    constructor(
        address beneficiary,
        uint64 startTimestamp,
        uint64 durationSeconds,
        uint64 cliffSeconds
    )
        VestingWallet(beneficiary, startTimestamp, durationSeconds)
        VestingWalletCliff(cliffSeconds)
    {}
}
