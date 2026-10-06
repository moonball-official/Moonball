// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockUniswapV3Factory {
    mapping(address => mapping(address => mapping(uint24 => address))) private _pools;

    function setPool(
        address tokenA,
        address tokenB,
        uint24 fee,
        address pool
    ) external {
        _pools[tokenA][tokenB][fee] = pool;
        _pools[tokenB][tokenA][fee] = pool;
    }

    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external view returns (address pool) {
        return _pools[tokenA][tokenB][fee];
    }
}

contract MockUniswapV3Pool {}
