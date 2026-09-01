// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IJackpotOracle
 * @notice Interface for the oracle that provides verified lottery jackpot data.
 * @dev In production, this is backed by an off-chain data pipeline (the Moonball
 *      dashboard's multi-source consensus verifier) that pushes values on-chain.
 */
interface IJackpotOracle {
    /// @notice Jackpot data snapshot from the oracle
    struct JackpotData {
        uint256 jackpotAmountUsd;   // Annuitized jackpot in whole USD (e.g., 169_000_000)
        uint256 cashValueUsd;       // Cash value in whole USD
        uint64  lastDrawTimestamp;  // Unix timestamp of the most recent draw
        uint64  nextDrawTimestamp;  // Unix timestamp of the next scheduled draw
        bool    hadWinner;          // Whether the last draw produced a jackpot winner
        uint32  drawsSinceReset;    // Number of consecutive draws without a winner
        uint64  lastUpdated;        // When the oracle last refreshed this data
    }

    /// @notice Returns the latest verified jackpot data
    function getLatestJackpot() external view returns (JackpotData memory);

    /// @notice Returns the jackpot amount in millions (e.g., 169 for $169M)
    function getJackpotMillions() external view returns (uint256);

    /// @notice Informational reference value per MOON, in 18-decimal WAD dollars,
    ///         derived linearly from public jackpot data. This is NOT a tradable
    ///         price or a peg — MOON trades freely on a DEX. It exists so the
    ///         on-chain surface can publish the same reference the dashboard shows.
    function oracleReferenceValueWad() external view returns (uint256);

    /// @notice Whether the oracle data is considered fresh (within staleness threshold)
    function isFresh() external view returns (bool);

    /// @notice Emitted when oracle data is updated
    event JackpotUpdated(
        uint256 jackpotAmountUsd,
        bool    hadWinner,
        uint32  drawsSinceReset,
        uint64  timestamp
    );
}
