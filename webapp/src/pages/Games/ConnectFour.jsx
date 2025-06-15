import { useState } from 'react';
import ConnectWallet from '../../components/ConnectWallet.jsx';
import RoomPopup from '../../components/RoomPopup.jsx';
import RewardPopup from '../../components/RewardPopup.tsx';
import { getWalletBalance, updateBalance, addTransaction } from '../../utils/api.js';
import { getTelegramId } from '../../utils/telegram.js';
import OpenInTelegram from '../../components/OpenInTelegram.jsx';

const ROWS = 6;
const COLS = 7;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function checkWinner(board, row, col, player) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];
  for (const [dx, dy] of directions) {
    let count = 1;
    let r = row + dx;
    let c = col + dy;
    while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
      count++; r += dx; c += dy;
    }
    r = row - dx;
    c = col - dy;
    while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
      count++; r -= dx; c -= dy;
    }
    if (count >= 4) return true;
  }
  return false;
}

export default function ConnectFour() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <OpenInTelegram />;
  }
  const [selection, setSelection] = useState(null);
  const [showRoom, setShowRoom] = useState(true);
  const [board, setBoard] = useState(createBoard());
  const [current, setCurrent] = useState('R');
  const [winner, setWinner] = useState(null);
  const [reward, setReward] = useState(null);

  const resetGame = () => {
    setBoard(createBoard());
    setCurrent('R');
    setWinner(null);
  };

  const handleStake = async () => {
    if (!selection || selection.token !== 'TPC') return;
    const balRes = await getWalletBalance(telegramId);
    if ((balRes.balance || 0) < selection.amount) {
      alert('Insufficient balance');
      setShowRoom(true);
      return false;
    }
    const newBal = (balRes.balance || 0) - selection.amount;
    await updateBalance(telegramId, newBal);
    await addTransaction(telegramId, -selection.amount, 'connectfour-stake');
    return true;
  };

  const handleWin = async (player) => {
    setWinner(player);
    if (selection && selection.token === 'TPC') {
      const balRes = await getWalletBalance(telegramId);
      const rewardAmt = selection.amount * 2;
      const newBal = (balRes.balance || 0) + rewardAmt;
      await updateBalance(telegramId, newBal);
      await addTransaction(telegramId, rewardAmt, 'connectfour-win');
      setReward(rewardAmt);
    }
  };

  const drop = (col) => {
    if (winner) return;
    const newBoard = board.map((r) => r.slice());
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!newBoard[r][col]) {
        newBoard[r][col] = current;
        setBoard(newBoard);
        if (checkWinner(newBoard, r, col, current)) {
          handleWin(current);
        } else if (newBoard.every((row) => row.every(Boolean))) {
          setWinner('draw');
        } else {
          setCurrent(current === 'R' ? 'Y' : 'R');
        }
        break;
      }
    }
  };

  return (
    <div className="p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold">Connect Four</h2>
      <RoomPopup
        open={showRoom}
        selection={selection}
        setSelection={setSelection}
        onConfirm={async () => {
          const ok = await handleStake();
          if (ok !== false) setShowRoom(false);
        }}
      />
      <ConnectWallet />
      <div className="grid grid-rows-6 grid-cols-7 gap-1 max-w-xs mx-auto mt-4">
        {board.map((row, r) =>
          row.map((cell, c) => (
            <div
              key={`${r}-${c}`}
              onClick={() => drop(c)}
              className="w-10 h-10 bg-gray-700 flex items-center justify-center rounded-full cursor-pointer"
            >
              {cell && (
                <div
                  className={`w-8 h-8 rounded-full ${
                    cell === 'R' ? 'bg-red-500' : 'bg-yellow-300'
                  }`}
                />
              )}
            </div>
          ))
        )}
      </div>
      {winner && (
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">
            {winner === 'draw' ? 'Draw game!' : `${winner === 'R' ? 'Red' : 'Yellow'} wins!`}
          </p>
          <button
            onClick={resetGame}
            className="px-4 py-1 border border-yellow-500 rounded text-yellow-500"
          >
            Play Again
          </button>
        </div>
      )}
      <RewardPopup reward={reward} onClose={() => setReward(null)} />
    </div>
  );
}
