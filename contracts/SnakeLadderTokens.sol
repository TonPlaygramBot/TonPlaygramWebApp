// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title Snake & Ladder multi-token betting contract
/// @notice Supports TON and USDT tables with a 9% developer fee
contract SnakeLadderTokens {
    address public developer;
    address public owner;

    struct GameHistory {
        address token;
        address winner;
        address[] players;
        uint256 totalBet;
        uint256 timestamp;
    }

    GameHistory[] public games;

    event GameSettled(
        uint256 indexed gameId,
        address indexed token,
        address indexed winner,
        uint256 winnerAmount,
        uint256 devAmount
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address devWallet) {
        require(devWallet != address(0), "invalid dev wallet");
        developer = devWallet;
        owner = msg.sender;
    }

    function setDeveloper(address devWallet) external onlyOwner {
        require(devWallet != address(0), "invalid wallet");
        developer = devWallet;
    }

    /// @notice Called by the game backend when a match ends
    /// @param token Address of the ERC20 token used for betting
    /// @param winner Address of the match winner
    /// @param players All participants in the match
    /// @param totalBet Total amount of tokens collected from players
    function settleGame(
        address token,
        address winner,
        address[] calldata players,
        uint256 totalBet
    ) external onlyOwner {
        require(token != address(0), "invalid token");
        require(winner != address(0), "invalid winner");
        require(totalBet > 0, "invalid bet");

        uint256 devAmount = (totalBet * 9) / 100;
        uint256 winnerAmount = totalBet - devAmount;

        require(IERC20(token).transfer(winner, winnerAmount), "winner transfer failed");
        require(IERC20(token).transfer(developer, devAmount), "dev transfer failed");

        games.push(GameHistory({
            token: token,
            winner: winner,
            players: players,
            totalBet: totalBet,
            timestamp: block.timestamp
        }));

        emit GameSettled(games.length - 1, token, winner, winnerAmount, devAmount);
    }

    function gameCount() external view returns (uint256) {
        return games.length;
    }

    function getGame(uint256 gameId) external view returns (GameHistory memory) {
        require(gameId < games.length, "invalid id");
        return games[gameId];
    }
}
