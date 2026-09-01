// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MoonballToken
 * @notice MOON is the fixed-supply ERC-20 event-market token for the Moonball
 *         protocol. Its price is discovered entirely on a DEX (for example a
 *         MOON/USDC Uniswap v3 pool). The protocol does NOT mint, redeem, or
 *         defend any peg, and holds no redemption obligation to holders.
 *
 * @dev DESIGN (V2 — DEX event market):
 *      - The entire supply is minted ONCE, at deployment, to a single recipient
 *        (the deployer or a treasury/LP address) so it can seed DEX liquidity.
 *      - There is no public mint and no redeem. There is no collateral treasury
 *        and no peg-reinforcement logic. Supply is fixed forever after the
 *        constructor runs.
 *      - The separate on-chain JackpotOracle publishes a REFERENCE value derived
 *        from public Powerball jackpot data. That value is informational only —
 *        it is not a price the protocol will trade at or guarantee.
 *
 *      This is a deliberately minimal, immutable ERC-20: no owner, no admin
 *      functions, no upgrade path. What ships is what holders get.
 */
contract MoonballToken {
    // ─── ERC-20 METADATA ──────────────────────────────────────────────
    string public constant name = "Moonball";
    string public constant symbol = "MOON";
    uint8 public constant decimals = 18;

    // ─── ERC-20 STATE ─────────────────────────────────────────────────
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // ─── EVENTS ───────────────────────────────────────────────────────
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ─── ERRORS ───────────────────────────────────────────────────────
    error InsufficientBalance(uint256 requested, uint256 available);
    error InsufficientAllowance(uint256 requested, uint256 available);
    error ZeroAddress();
    error ZeroAmount();

    /**
     * @param initialSupply Whole MOON tokens to mint at genesis (18 decimals are
     *        applied here, so pass 1_000_000 for one million MOON).
     * @param recipient Address that receives the entire initial supply, e.g. the
     *        account that will seed the DEX pool.
     */
    constructor(uint256 initialSupply, address recipient) {
        if (recipient == address(0)) revert ZeroAddress();
        if (initialSupply == 0) revert ZeroAmount();
        uint256 supply = initialSupply * (10 ** uint256(decimals));
        totalSupply = supply;
        balanceOf[recipient] = supply;
        emit Transfer(address(0), recipient, supply);
    }

    // ─── ERC-20 STANDARD FUNCTIONS ────────────────────────────────────
    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert InsufficientAllowance(amount, allowed);
            unchecked {
                allowance[from][msg.sender] = allowed - amount;
            }
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();
        uint256 bal = balanceOf[from];
        if (bal < amount) revert InsufficientBalance(amount, bal);
        unchecked {
            balanceOf[from] = bal - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }
}
