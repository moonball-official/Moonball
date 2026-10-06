// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

interface IUniswapV3Factory {
    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external view returns (address pool);
}

/**
 * @title OfficialMarketRegistry
 * @notice Safe-controlled source of truth for Moonball's one official market.
 * @dev Registration does not create a pool, move liquidity, trade, or consult
 *      the jackpot oracle. The supplied pool must be the canonical pool returned
 *      by the configured Uniswap v3 factory for MOON/USDC and the chosen fee tier.
 */
contract OfficialMarketRegistry is Ownable2Step {
    uint24 public constant LAUNCH_FEE_TIER = 10_000;

    address public immutable uniswapV3Factory;
    address public immutable moonToken;
    address public immutable quoteToken;

    address public officialPool;
    uint24 public officialFeeTier;
    uint64 public marketVersion;

    event OfficialMarketChanged(
        address indexed oldPool,
        address indexed newPool,
        uint24 oldFeeTier,
        uint24 newFeeTier,
        uint64 version
    );

    error ZeroAddress();
    error AddressNotContract(address account);
    error IdenticalTokens();
    error InvalidLaunchFeeTier(uint24 suppliedFeeTier);
    error NotCanonicalPool(address suppliedPool, address canonicalPool);
    error MarketAlreadyOfficial(address pool, uint24 feeTier);
    error OwnershipRenunciationDisabled();

    constructor(
        address initialOwner,
        address factory,
        address moon,
        address quote
    ) Ownable(initialOwner) {
        if (
            factory == address(0) ||
            moon == address(0) ||
            quote == address(0)
        ) revert ZeroAddress();
        if (moon == quote) revert IdenticalTokens();
        if (factory.code.length == 0) revert AddressNotContract(factory);
        if (moon.code.length == 0) revert AddressNotContract(moon);
        if (quote.code.length == 0) revert AddressNotContract(quote);

        uniswapV3Factory = factory;
        moonToken = moon;
        quoteToken = quote;
    }

    /**
     * @notice Designates a canonical Uniswap v3 pool as Moonball's official
     *         continuing MOON/USDC market.
     * @dev A later Safe-approved migration may deliberately select another
     *      canonical pool or fee tier; no automatic migration exists.
     */
    function setOfficialMarket(address pool, uint24 feeTier) external onlyOwner {
        if (pool == address(0)) revert ZeroAddress();
        if (pool.code.length == 0) revert AddressNotContract(pool);
        if (marketVersion == 0 && feeTier != LAUNCH_FEE_TIER) {
            revert InvalidLaunchFeeTier(feeTier);
        }

        address canonicalPool = IUniswapV3Factory(uniswapV3Factory).getPool(
            moonToken,
            quoteToken,
            feeTier
        );
        if (canonicalPool != pool) {
            revert NotCanonicalPool(pool, canonicalPool);
        }
        if (pool == officialPool && feeTier == officialFeeTier) {
            revert MarketAlreadyOfficial(pool, feeTier);
        }

        address oldPool = officialPool;
        uint24 oldFeeTier = officialFeeTier;
        uint64 newVersion = marketVersion + 1;

        officialPool = pool;
        officialFeeTier = feeTier;
        marketVersion = newVersion;

        emit OfficialMarketChanged(
            oldPool,
            pool,
            oldFeeTier,
            feeTier,
            newVersion
        );
    }

    function isOfficialPool(address pool) external view returns (bool) {
        return pool != address(0) && pool == officialPool;
    }

    /// @dev Infrastructure ownership must remain recoverable by the Safe.
    function renounceOwnership() public pure override {
        revert OwnershipRenunciationDisabled();
    }
}
