// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title Snake & Ladder TPC betting contract
/// @notice Pays out 91% of the pot to the winner and 9% to the developer wallet
contract SnakeLadderTPC {
    IERC20 public immutable tpcToken;
    address public developer;
    address public owner;

    struct GameHistory {
        address winner;
        address[] players;
        uint256 totalBet;
        uint256 timestamp;
    }

    GameHistory[] public games;

    event GameSettled(
        uint256 indexed gameId,
        address indexed winner,
        uint256 winnerAmount,
        uint256 devAmount
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address tokenAddress, address devWallet) {
        require(tokenAddress != address(0), "invalid token");
        require(devWallet != address(0), "invalid dev wallet");
        tpcToken = IERC20(tokenAddress);
        developer = devWallet;
        owner = msg.sender;
    }

    function setDeveloper(address devWallet) external onlyOwner {
        require(devWallet != address(0), "invalid wallet");
        developer = devWallet;
    }

    /// @notice Called by the game backend when a match ends
    /// @param winner Address of the match winner
    /// @param players All participants in the match
    /// @param totalBet Total amount of TPC collected from players
    function settleGame(
        address winner,
        address[] calldata players,
        uint256 totalBet
    ) external onlyOwner {
        require(winner != address(0), "invalid winner");
        require(totalBet > 0, "invalid bet");

        uint256 devAmount = (totalBet * 9) / 100;
        uint256 winnerAmount = totalBet - devAmount;

        require(tpcToken.transfer(winner, winnerAmount), "winner transfer failed");
        require(tpcToken.transfer(developer, devAmount), "dev transfer failed");

        games.push(GameHistory({
            winner: winner,
            players: players,
            totalBet: totalBet,
            timestamp: block.timestamp
        }));

        emit GameSettled(games.length - 1, winner, winnerAmount, devAmount);
    }

    function gameCount() external view returns (uint256) {
        return games.length;
    }

    function getGame(uint256 gameId) external view returns (GameHistory memory) {
        require(gameId < games.length, "invalid id");
        return games[gameId];
    }
}
