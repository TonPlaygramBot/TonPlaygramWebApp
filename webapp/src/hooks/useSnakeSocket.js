import { useEffect, useState } from 'react';
import { socket } from '../utils/socket';
import { getSnakeBoard } from '../utils/api.js';

export default function useSnakeSocket(roomId, playerId, name) {
  const [players, setPlayers] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [snakes, setSnakes] = useState({});
  const [ladders, setLadders] = useState({});
  const [lastRoll, setLastRoll] = useState(null);
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    if (!roomId || !playerId) return;

    getSnakeBoard(roomId)
      .then(({ snakes = {}, ladders = {} }) => {
        setSnakes(snakes);
        setLadders(ladders);
      })
      .catch(() => {});

    socket.emit('joinRoom', { roomId, playerId, name });

    const handlePlayerJoined = ({ playerId: id, name }) => {
      setPlayers((arr) => {
        if (arr.some((p) => p.id === id)) return arr;
        return [...arr, { id, name, position: 0 }];
      });
    };
    const handleTurnChanged = ({ playerId: id }) => setCurrentTurn(id);
    const handleDiceRolled = ({ playerId: id, value }) => {
      setLastRoll({ playerId: id, value });
    };
    const updatePos = ({ playerId: id, to }) => {
      setPlayers((arr) => arr.map((p) => (p.id === id ? { ...p, position: to } : p)));
    };
    const handlePlayerReset = ({ playerId: id }) => {
      setPlayers((arr) => arr.map((p) => (p.id === id ? { ...p, position: 0 } : p)));
    };
    const handlePlayerLeft = ({ playerId: id }) => {
      setPlayers((arr) => arr.filter((p) => p.id !== id));
    };
    const handleGameWon = ({ playerId: id }) => {
      setRanking((r) => [...r, id]);
    };

    socket.on('playerJoined', handlePlayerJoined);
    socket.on('turnChanged', handleTurnChanged);
    socket.on('movePlayer', updatePos);
    socket.on('snakeOrLadder', updatePos);
    socket.on('diceRolled', handleDiceRolled);
    socket.on('playerReset', handlePlayerReset);
    socket.on('gameWon', handleGameWon);
    socket.on('playerLeft', handlePlayerLeft);

    return () => {
      socket.off('playerJoined', handlePlayerJoined);
      socket.off('turnChanged', handleTurnChanged);
      socket.off('movePlayer', updatePos);
      socket.off('snakeOrLadder', updatePos);
      socket.off('diceRolled', handleDiceRolled);
      socket.off('playerReset', handlePlayerReset);
      socket.off('gameWon', handleGameWon);
      socket.off('playerLeft', handlePlayerLeft);
    };
  }, [roomId, playerId, name]);

  const rollDice = () => socket.emit('rollDice');

  return { players, currentTurn, snakes, ladders, lastRoll, ranking, rollDice };
}
