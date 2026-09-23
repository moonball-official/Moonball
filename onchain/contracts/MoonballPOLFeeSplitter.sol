// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title MoonballPOLFeeSplitter
 * @notice Distributes fees collected from Moonball-owned Uniswap positions.
 * @dev The standard pool fee is charged by Uniswap before tokens arrive here.
 *      This contract adds no swap surcharge and cannot access third-party LPs.
 *
 *      Anyone may trigger distribution, but funds can only reach the two
 *      recipients configured by the Safe-controlled owner. Per-token cumulative
 *      accounting carries indivisible-unit remainders between distributions so
 *      the treasury receives floor(total collected * 12%) and POL receives every
 *      remaining unit.
 */
contract MoonballPOLFeeSplitter is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant TREASURY_SHARE_BPS = 1_200;

    address public treasuryRecipient;
    address public polRecipient;

    mapping(address token => uint256 amount) public cumulativeDistributed;
    mapping(address token => uint256 amount) public cumulativeTreasuryDistributed;

    event RecipientsChanged(
        address indexed oldTreasuryRecipient,
        address indexed newTreasuryRecipient,
        address oldPolRecipient,
        address newPolRecipient
    );
    event FeesDistributed(
        address indexed token,
        uint256 collectedAmount,
        uint256 treasuryAmount,
        uint256 polAmount,
        uint256 cumulativeCollected,
        uint256 cumulativeTreasuryAmount
    );

    error ZeroAddress();
    error DuplicateRecipient();
    error SelfRecipient();
    error InvalidToken(address token);
    error NothingToDistribute(address token);
    error OwnershipRenunciationDisabled();

    constructor(
        address initialOwner,
        address initialTreasuryRecipient,
        address initialPolRecipient
    ) Ownable(initialOwner) {
        _setRecipients(initialTreasuryRecipient, initialPolRecipient);
    }

    /**
     * @notice Sends the splitter's complete balance of `token` to the configured
     *         recipients using the cumulative 12/88 policy.
     * @dev Designed for standard ERC-20 tokens such as MOON and USDC. Tokens with
     *      transfer fees or rebasing behavior are outside the supported market.
     */
    function distribute(
        address token
    ) external nonReentrant returns (uint256 treasuryAmount, uint256 polAmount) {
        if (token == address(0) || token.code.length == 0) {
            revert InvalidToken(token);
        }

        IERC20 asset = IERC20(token);
        uint256 collectedAmount = asset.balanceOf(address(this));
        if (collectedAmount == 0) revert NothingToDistribute(token);

        uint256 newCumulative = cumulativeDistributed[token] + collectedAmount;
        uint256 newCumulativeTreasury = Math.mulDiv(
            newCumulative,
            TREASURY_SHARE_BPS,
            BPS_DENOMINATOR
        );

        treasuryAmount =
            newCumulativeTreasury -
            cumulativeTreasuryDistributed[token];
        polAmount = collectedAmount - treasuryAmount;

        cumulativeDistributed[token] = newCumulative;
        cumulativeTreasuryDistributed[token] = newCumulativeTreasury;

        if (treasuryAmount != 0) {
            asset.safeTransfer(treasuryRecipient, treasuryAmount);
        }
        if (polAmount != 0) {
            asset.safeTransfer(polRecipient, polAmount);
        }

        emit FeesDistributed(
            token,
            collectedAmount,
            treasuryAmount,
            polAmount,
            newCumulative,
            newCumulativeTreasury
        );
    }

    /**
     * @notice Updates destinations for future distributions.
     * @dev Historical cumulative accounting is intentionally preserved.
     */
    function setRecipients(
        address newTreasuryRecipient,
        address newPolRecipient
    ) external onlyOwner {
        _setRecipients(newTreasuryRecipient, newPolRecipient);
    }

    /// @dev Infrastructure ownership must remain recoverable by the Safe.
    function renounceOwnership() public pure override {
        revert OwnershipRenunciationDisabled();
    }

    function _setRecipients(
        address newTreasuryRecipient,
        address newPolRecipient
    ) private {
        if (
            newTreasuryRecipient == address(0) ||
            newPolRecipient == address(0)
        ) revert ZeroAddress();
        if (newTreasuryRecipient == newPolRecipient) revert DuplicateRecipient();
        if (
            newTreasuryRecipient == address(this) ||
            newPolRecipient == address(this)
        ) revert SelfRecipient();

        address oldTreasuryRecipient = treasuryRecipient;
        address oldPolRecipient = polRecipient;
        treasuryRecipient = newTreasuryRecipient;
        polRecipient = newPolRecipient;

        emit RecipientsChanged(
            oldTreasuryRecipient,
            newTreasuryRecipient,
            oldPolRecipient,
            newPolRecipient
        );
    }
}
