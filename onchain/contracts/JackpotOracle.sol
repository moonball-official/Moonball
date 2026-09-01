// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IJackpotOracle.sol";

/**
 * @title JackpotOracle
 * @notice Oracle contract that receives verified Powerball jackpot data from an
 *         authorized off-chain data pipeline (the Moonball dashboard bridge).
 *
 * @dev ARCHITECTURE:
 *      Off-chain: Multi-source verifier → consensus → bridge → fulfillJackpotData()
 *      On-chain:  This contract stores the latest verified snapshot.
 *
 *      The oracle enforces:
 *      - Only authorized updaters can push data
 *      - Staleness detection (configurable threshold)
 *      - Sanity bounds on jackpot values ($20M–$5B range)
 *      - Multi-sig or timelock can update the authorized updater
 */
contract JackpotOracle is IJackpotOracle {

    // ─── STATE ────────────────────────────────────────────────────────
    JackpotData private _latestData;

    address public owner;
    address public authorizedUpdater;    // Bridge / keeper address
    uint64  public stalenessThreshold;   // Seconds before data is considered stale

    // Sanity bounds (fixed)
    uint256 public constant MIN_JACKPOT = 20_000_000;    // $20M minimum (post-reset)
    uint256 public constant MAX_JACKPOT = 5_000_000_000; // $5B upper sanity bound

    // Reference-value model (informational only — NOT a peg or tradable price)
    uint256 public constant WAD = 1e18;

    // ─── EVENTS ───────────────────────────────────────────────────────
    event UpdaterChanged(address indexed oldUpdater, address indexed newUpdater);
    event StalenessThresholdChanged(uint64 oldThreshold, uint64 newThreshold);
    event JackpotReset(uint256 newJackpot, uint64 timestamp);

    // ─── ERRORS ───────────────────────────────────────────────────────
    error Unauthorized();
    error JackpotOutOfBounds(uint256 amount);
    error InvalidTimestamp();

    // ─── MODIFIERS ────────────────────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyUpdater() {
        if (msg.sender != authorizedUpdater) revert Unauthorized();
        _;
    }

    // ─── CONSTRUCTOR ──────────────────────────────────────────────────
    constructor(address _updater, uint64 _stalenessThreshold) {
        owner = msg.sender;
        authorizedUpdater = _updater;
        stalenessThreshold = _stalenessThreshold;
    }

    // ─── ORACLE UPDATE (called by off-chain bridge / keeper) ───────────
    /**
     * @notice Push new jackpot data from the off-chain oracle pipeline.
     * @dev Called by the authorized updater after data verification.
     *      Includes sanity checks to prevent corrupted data from propagating.
     */
    function fulfillJackpotData(
        uint256 _jackpotAmountUsd,
        uint256 _cashValueUsd,
        uint64  _lastDrawTimestamp,
        uint64  _nextDrawTimestamp,
        bool    _hadWinner,
        uint32  _drawsSinceReset
    ) external onlyUpdater {
        // Sanity: jackpot within reasonable bounds
        if (_jackpotAmountUsd < MIN_JACKPOT || _jackpotAmountUsd > MAX_JACKPOT) {
            revert JackpotOutOfBounds(_jackpotAmountUsd);
        }

        // Sanity: timestamps must be reasonable
        if (_lastDrawTimestamp > block.timestamp + 1 hours) {
            revert InvalidTimestamp();
        }

        bool isReset = _hadWinner && _latestData.jackpotAmountUsd > 0;

        _latestData = JackpotData({
            jackpotAmountUsd:  _jackpotAmountUsd,
            cashValueUsd:      _cashValueUsd,
            lastDrawTimestamp:  _lastDrawTimestamp,
            nextDrawTimestamp:  _nextDrawTimestamp,
            hadWinner:         _hadWinner,
            drawsSinceReset:   _drawsSinceReset,
            lastUpdated:       uint64(block.timestamp)
        });

        emit JackpotUpdated(
            _jackpotAmountUsd,
            _hadWinner,
            _drawsSinceReset,
            uint64(block.timestamp)
        );

        if (isReset) {
            emit JackpotReset(_jackpotAmountUsd, uint64(block.timestamp));
        }
    }

    // ─── READ FUNCTIONS ───────────────────────────────────────────────
    function getLatestJackpot() external view override returns (JackpotData memory) {
        return _latestData;
    }

    function getJackpotMillions() external view override returns (uint256) {
        return _latestData.jackpotAmountUsd / 1_000_000;
    }

    /**
     * @notice Informational reference value per MOON, in 18-decimal WAD dollars.
     * @dev Linear model that mirrors the dashboard's oracle reference: a $10 base
     *      value at the $20M jackpot floor, growing $10 for every additional $20M
     *      of jackpot — i.e. (jackpotMillions / 2) dollars. A $225M jackpot yields
     *      $112.50. This is published purely as a reference; the protocol never
     *      mints, redeems, or trades MOON at this value.
     */
    function oracleReferenceValueWad() external view override returns (uint256) {
        uint256 jackpotMillions = _latestData.jackpotAmountUsd / 1_000_000;
        return (jackpotMillions * WAD) / 2;
    }

    function isFresh() external view override returns (bool) {
        if (_latestData.lastUpdated == 0) return false;
        return (block.timestamp - _latestData.lastUpdated) <= stalenessThreshold;
    }

    // ─── ADMIN ────────────────────────────────────────────────────────
    function setAuthorizedUpdater(address _newUpdater) external onlyOwner {
        emit UpdaterChanged(authorizedUpdater, _newUpdater);
        authorizedUpdater = _newUpdater;
    }

    function setStalenessThreshold(uint64 _newThreshold) external onlyOwner {
        emit StalenessThresholdChanged(stalenessThreshold, _newThreshold);
        stalenessThreshold = _newThreshold;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        owner = _newOwner;
    }
}
