// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IJackpotOracle
 * @notice Interface for Moonball's verified, reference-only Powerball oracle.
 * @dev Oracle values never mint, redeem, reprice, or otherwise control MOON.
 */
interface IJackpotOracle {
    /// @notice Payload accepted from the authorized off-chain bridge.
    struct JackpotUpdate {
        uint64 sequence;
        bytes32 snapshotId;
        bytes32 cycleId;
        bytes32 drawId;
        uint256 jackpotAmountUsd;
        uint256 cashValueUsd;
        uint64 lastDrawTimestamp;
        uint64 nextDrawTimestamp;
        uint64 sourceTimestamp;
        bool hadWinner;
        uint32 drawsSinceReset;
    }

    /// @notice Latest accepted snapshot plus its on-chain publication time.
    struct JackpotData {
        uint64 sequence;
        bytes32 snapshotId;
        bytes32 cycleId;
        bytes32 drawId;
        uint256 jackpotAmountUsd;
        uint256 cashValueUsd;
        uint64 lastDrawTimestamp;
        uint64 nextDrawTimestamp;
        uint64 sourceTimestamp;
        bool hadWinner;
        uint32 drawsSinceReset;
        uint64 lastUpdated;
    }

    function fulfillJackpotData(JackpotUpdate calldata update) external;

    /// @notice Returns the latest accepted jackpot snapshot.
    function getLatestJackpot() external view returns (JackpotData memory);

    /// @notice Returns the jackpot amount in millions (e.g. 169 for $169M).
    function getJackpotMillions() external view returns (uint256);

    /// @notice Informational reference value per MOON, in 18-decimal WAD dollars.
    /// @dev This is not a tradable price, redemption value, or peg.
    function oracleReferenceValueWad() external view returns (uint256);

    /// @notice Whether the source observation remains within the configured age limit.
    function isFresh() external view returns (bool);

    event JackpotUpdated(
        uint64 indexed sequence,
        bytes32 indexed snapshotId,
        bytes32 indexed drawId,
        bytes32 cycleId,
        uint256 jackpotAmountUsd,
        uint256 cashValueUsd,
        uint64 sourceTimestamp,
        bool hadWinner,
        uint32 drawsSinceReset,
        uint64 publishedAt
    );
}
