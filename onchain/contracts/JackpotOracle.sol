// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IJackpotOracle.sol";

/**
 * @title JackpotOracle
 * @notice Stores verified Powerball snapshots from Moonball's authorized bridge.
 * @dev This contract is reference-only. It has no authority over MOON balances,
 *      Uniswap pools, protocol-owned liquidity, or fee collection.
 */
contract JackpotOracle is IJackpotOracle {
    JackpotData private _latestData;

    address public owner;
    address public pendingOwner;
    address public authorizedUpdater;
    uint64 public stalenessThreshold;
    bool public updatesPaused;

    mapping(bytes32 => bool) public usedSnapshotIds;

    uint256 public constant MIN_JACKPOT = 20_000_000;
    uint256 public constant MAX_JACKPOT = 5_000_000_000;
    uint64 public constant MIN_STALENESS_THRESHOLD = 5 minutes;
    uint64 public constant MAX_STALENESS_THRESHOLD = 24 hours;
    uint64 public constant MAX_CLOCK_SKEW = 5 minutes;
    uint256 public constant ORACLE_SCHEMA_VERSION = 2;
    uint256 public constant WAD = 1e18;

    event UpdaterChanged(address indexed oldUpdater, address indexed newUpdater);
    event StalenessThresholdChanged(uint64 oldThreshold, uint64 newThreshold);
    event UpdatesPausedChanged(bool paused);
    event OwnershipTransferStarted(address indexed owner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event ReferenceCycleChanged(
        bytes32 indexed oldCycleId,
        bytes32 indexed newCycleId,
        uint64 indexed sequence,
        bool hadWinner
    );

    error Unauthorized();
    error ZeroAddress();
    error OracleUpdatesPaused();
    error JackpotOutOfBounds(uint256 amount);
    error CashValueOutOfBounds(uint256 cashValue, uint256 jackpotAmount);
    error InvalidDrawChronology();
    error InvalidSourceTimestamp(uint64 sourceTimestamp);
    error InvalidSequence(uint64 expected, uint64 actual);
    error InvalidIdentifier();
    error SnapshotAlreadyUsed(bytes32 snapshotId);
    error InvalidSnapshotId(bytes32 expected, bytes32 actual);
    error SourceTimestampRegression(uint64 previous, uint64 proposed);
    error DrawTimestampRegression(uint64 previous, uint64 proposed);
    error InvalidStalenessThreshold(uint64 threshold);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyUpdater() {
        if (msg.sender != authorizedUpdater) revert Unauthorized();
        _;
    }

    constructor(
        address initialOwner,
        address initialUpdater,
        uint64 initialStalenessThreshold
    ) {
        if (initialOwner == address(0) || initialUpdater == address(0)) revert ZeroAddress();
        _validateStalenessThreshold(initialStalenessThreshold);

        owner = initialOwner;
        authorizedUpdater = initialUpdater;
        stalenessThreshold = initialStalenessThreshold;

        emit OwnershipTransferred(address(0), initialOwner);
        emit UpdaterChanged(address(0), initialUpdater);
        emit StalenessThresholdChanged(0, initialStalenessThreshold);
    }

    /**
     * @notice Publish a new verified source observation.
     * @dev Sequence, identifier, source-age, value, and draw chronology checks make
     *      stale, duplicate, replayed, and malformed updates fail closed.
     */
    function fulfillJackpotData(JackpotUpdate calldata update) external onlyUpdater {
        if (updatesPaused) revert OracleUpdatesPaused();

        uint64 expectedSequence = _latestData.sequence + 1;
        if (update.sequence != expectedSequence) {
            revert InvalidSequence(expectedSequence, update.sequence);
        }
        if (
            update.snapshotId == bytes32(0) ||
            update.cycleId == bytes32(0) ||
            update.drawId == bytes32(0)
        ) revert InvalidIdentifier();
        if (usedSnapshotIds[update.snapshotId]) {
            revert SnapshotAlreadyUsed(update.snapshotId);
        }
        bytes32 expectedSnapshotId = computeSnapshotId(update);
        if (update.snapshotId != expectedSnapshotId) {
            revert InvalidSnapshotId(expectedSnapshotId, update.snapshotId);
        }
        if (
            update.jackpotAmountUsd < MIN_JACKPOT ||
            update.jackpotAmountUsd > MAX_JACKPOT
        ) revert JackpotOutOfBounds(update.jackpotAmountUsd);
        if (
            update.cashValueUsd == 0 ||
            update.cashValueUsd > update.jackpotAmountUsd
        ) {
            revert CashValueOutOfBounds(update.cashValueUsd, update.jackpotAmountUsd);
        }
        if (
            update.lastDrawTimestamp >= update.nextDrawTimestamp ||
            update.lastDrawTimestamp > update.sourceTimestamp ||
            update.sourceTimestamp >= update.nextDrawTimestamp
        ) revert InvalidDrawChronology();
        if (
            _latestData.sourceTimestamp != 0 &&
            update.sourceTimestamp <= _latestData.sourceTimestamp
        ) {
            revert SourceTimestampRegression(
                _latestData.sourceTimestamp,
                update.sourceTimestamp
            );
        }
        if (update.lastDrawTimestamp < _latestData.lastDrawTimestamp) {
            revert DrawTimestampRegression(
                _latestData.lastDrawTimestamp,
                update.lastDrawTimestamp
            );
        }

        uint64 publishedAt = uint64(block.timestamp);
        if (
            update.sourceTimestamp == 0 ||
            update.sourceTimestamp > publishedAt + MAX_CLOCK_SKEW ||
            (
                publishedAt > update.sourceTimestamp &&
                publishedAt - update.sourceTimestamp > stalenessThreshold
            )
        ) revert InvalidSourceTimestamp(update.sourceTimestamp);

        bytes32 oldCycleId = _latestData.cycleId;
        usedSnapshotIds[update.snapshotId] = true;

        _latestData = JackpotData({
            sequence: update.sequence,
            snapshotId: update.snapshotId,
            cycleId: update.cycleId,
            drawId: update.drawId,
            jackpotAmountUsd: update.jackpotAmountUsd,
            cashValueUsd: update.cashValueUsd,
            lastDrawTimestamp: update.lastDrawTimestamp,
            nextDrawTimestamp: update.nextDrawTimestamp,
            sourceTimestamp: update.sourceTimestamp,
            hadWinner: update.hadWinner,
            drawsSinceReset: update.drawsSinceReset,
            lastUpdated: publishedAt
        });

        emit JackpotUpdated(
            update.sequence,
            update.snapshotId,
            update.drawId,
            update.cycleId,
            update.jackpotAmountUsd,
            update.cashValueUsd,
            update.sourceTimestamp,
            update.hadWinner,
            update.drawsSinceReset,
            publishedAt
        );

        if (oldCycleId != bytes32(0) && oldCycleId != update.cycleId) {
            emit ReferenceCycleChanged(
                oldCycleId,
                update.cycleId,
                update.sequence,
                update.hadWinner
            );
        }
    }

    function getLatestJackpot() external view override returns (JackpotData memory) {
        return _latestData;
    }

    function getJackpotMillions() external view override returns (uint256) {
        return _latestData.jackpotAmountUsd / 1_000_000;
    }

    function oracleReferenceValueWad() external view override returns (uint256) {
        uint256 jackpotMillions = _latestData.jackpotAmountUsd / 1_000_000;
        return (jackpotMillions * WAD) / 2;
    }

    /// @notice Deterministically derives the identifier bound to update contents.
    /// @dev Sequence is excluded so an already accepted observation cannot be
    ///      relabeled with a later sequence and replayed.
    function computeSnapshotId(
        JackpotUpdate calldata update
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                update.cycleId,
                update.drawId,
                update.jackpotAmountUsd,
                update.cashValueUsd,
                update.lastDrawTimestamp,
                update.nextDrawTimestamp,
                update.sourceTimestamp,
                update.hadWinner,
                update.drawsSinceReset
            )
        );
    }

    function isFresh() external view override returns (bool) {
        uint64 sourceTimestamp = _latestData.sourceTimestamp;
        if (sourceTimestamp == 0) return false;
        if (sourceTimestamp > block.timestamp) {
            return sourceTimestamp - block.timestamp <= MAX_CLOCK_SKEW;
        }
        return block.timestamp - sourceTimestamp <= stalenessThreshold;
    }

    function setAuthorizedUpdater(address newUpdater) external onlyOwner {
        if (newUpdater == address(0)) revert ZeroAddress();
        emit UpdaterChanged(authorizedUpdater, newUpdater);
        authorizedUpdater = newUpdater;
    }

    function setStalenessThreshold(uint64 newThreshold) external onlyOwner {
        _validateStalenessThreshold(newThreshold);
        emit StalenessThresholdChanged(stalenessThreshold, newThreshold);
        stalenessThreshold = newThreshold;
    }

    function setUpdatesPaused(bool paused) external onlyOwner {
        updatesPaused = paused;
        emit UpdatesPausedChanged(paused);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert Unauthorized();
        address oldOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(oldOwner, msg.sender);
    }

    function _validateStalenessThreshold(uint64 threshold) private pure {
        if (
            threshold < MIN_STALENESS_THRESHOLD ||
            threshold > MAX_STALENESS_THRESHOLD
        ) revert InvalidStalenessThreshold(threshold);
    }
}
