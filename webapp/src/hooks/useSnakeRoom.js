import { useEffect, useState, useRef } from 'react';
import { socket } from '../utils/socket.js';
import { getTelegramId, getTelegramFirstName } from '../utils/telegram.js';
import { getSnakeBoard } from '../utils/api.js';

export default function useSnakeRoom(roomId) {
  const playerIdRef = useRef(null);
  const [players, setPlayers] = useState({});
  const [currentTurn, setCurrentTurn] = useState(null);
  const [snakes, setSnakes] = useState({});
  const [ladders, setLadders] = useState({});
  const [dice, setDice] = useState(null);
  const [winner, setWinner] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    playerIdRef.current = getTelegramId();
    const name = getTelegramFirstName() || 'Player';
    socket.emit('joinRoom', { roomId, playerId: playerIdRef.current, name });

    getSnakeBoard(roomId)
      .then(({ snakes = {}, ladders = {} }) => {
        setSnakes(snakes);
        setLadders(ladders);
      })
      .catch(() => {});

    const handleJoined = ({ playerId, name }) => {
      setPlayers((p) => {
        if (p[playerId]) return p;
        const colorIdx = Object.keys(p).length % 4;
        const colors = ['#60a5fa', '#ef4444', '#4ade80', '#facc15'];
        return { ...p, [playerId]: { name, position: 0, color: colors[colorIdx] } };
      });
    };

    const handleLeft = ({ playerId }) => {
      setPlayers((p) => {
        const copy = { ...p };
        delete copy[playerId];
        return copy;
      });
    };

    socket.on('playerJoined', handleJoined);
    socket.on('playerLeft', handleLeft);
    socket.on('gameStarted', () => {});
    socket.on('turnChanged', ({ playerId }) => setCurrentTurn(playerId));
    socket.on('diceRolled', ({ playerId, value }) => setDice({ playerId, value }));
    const updatePos = ({ playerId, to }) => {
      setPlayers((p) => ({ ...p, [playerId]: { ...p[playerId], position: to } }));
    };
    socket.on('movePlayer', updatePos);
    socket.on('snakeOrLadder', updatePos);
    socket.on('playerReset', ({ playerId }) => updatePos({ playerId, to: 0 }));
    socket.on('gameWon', ({ playerId }) => setWinner(playerId));
    socket.on('error', (msg) => setError(msg));

    return () => {
      socket.off('playerJoined', handleJoined);
      socket.off('playerLeft', handleLeft);
      socket.off('gameStarted');
      socket.off('turnChanged');
      socket.off('diceRolled');
      socket.off('movePlayer', updatePos);
      socket.off('snakeOrLadder', updatePos);
      socket.off('playerReset');
      socket.off('gameWon');
      socket.off('error');
    };
  }, [roomId]);

  const rollDice = () => socket.emit('rollDice');

  return {
    players,
    currentTurn,
    snakes,
    ladders,
    dice,
    winner,
    error,
    playerId: playerIdRef.current,
    rollDice,
  };
}
