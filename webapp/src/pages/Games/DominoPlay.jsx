import { useState, useEffect } from 'react';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import DominoBoard from '../../components/DominoBoard.jsx';
import DominoPiece from '../../components/DominoPiece.jsx';
import { dealHands } from '../../utils/domino.js';

export default function DominoPlay() {
  useTelegramBackButton();
  const [mode, setMode] = useState('ai-easy');
  const [started, setStarted] = useState(false);
  const [token, setToken] = useState('TPC');
  const [amount, setAmount] = useState(0);
  const [hands, setHands] = useState([]);
  const [deck, setDeck] = useState([]);
  const [board, setBoard] = useState([]);
  const [turn, setTurn] = useState(0);
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tok = params.get('token');
    const amt = params.get('amount');
    if (tok) setToken(tok.toUpperCase());
    if (amt) setAmount(Number(amt));
    if (tok || amt) {
      startGame();
    }
  }, []);

  useEffect(() => {
    if (started && mode.startsWith('ai') && turn === 1 && !winner) {
      setTimeout(() => aiMove(), 500);
    }
  }, [turn, started, mode, winner]);

  const startGame = () => {
    const { hands: dealt, deck } = dealHands(28, 2);
    const start = dealt[0].findIndex((d) => d.left === d.right && d.left === 6);
    let first;
    if (start !== -1) {
      first = dealt[0].splice(start, 1)[0];
    } else {
      first = deck.pop();
    }
    setHands(dealt);
    setDeck(deck);
    setBoard([first]);
    setTurn(0);
    setWinner(null);
    setStarted(true);
  };

  const play = (idx) => {
    if (winner || turn !== 0) return;
    const piece = hands[0][idx];
    if (!canPlay(piece)) return;
    placePiece(0, idx, piece);
  };

  const canPlay = (piece) => {
    if (board.length === 0) return true;
    const leftEnd = board[0].left;
    const rightEnd = board[board.length - 1].right;
    return piece.left === leftEnd || piece.right === leftEnd || piece.left === rightEnd || piece.right === rightEnd;
  };

  const placePiece = (player, index, piece) => {
    setHands((h) => {
      const copy = h.map((hand) => [...hand]);
      copy[player].splice(index, 1);
      return copy;
    });
    setBoard((b) => {
      const next = [...b];
      if (next.length === 0) {
        next.push(piece);
      } else {
        const leftEnd = next[0].left;
        const rightEnd = next[next.length - 1].right;
        if (piece.right === leftEnd) {
          next.unshift({ left: piece.left, right: piece.right });
        } else if (piece.left === leftEnd) {
          next.unshift({ left: piece.right, right: piece.left });
        } else if (piece.left === rightEnd) {
          next.push({ left: piece.left, right: piece.right });
        } else {
          next.push({ left: piece.right, right: piece.left });
        }
      }
      return next;
    });
    checkWinner(player);
    setTurn((t) => (t === 0 ? 1 : 0));
  };

  const aiMove = () => {
    for (let i = 0; i < hands[1].length; i++) {
      if (canPlay(hands[1][i])) {
        placePiece(1, i, hands[1][i]);
        return;
      }
    }
    // draw if cannot play
    if (deck.length) {
      setHands((h) => {
        const copy = h.map((hand) => [...hand]);
        copy[1].push(deck.pop());
        return copy;
      });
      setDeck([...deck]);
      aiMove();
    } else {
      setTurn(0);
    }
  };

  const checkWinner = (p) => {
    if (hands[p].length === 1) {
      setWinner(p);
    }
  };

  if (!started) {
    return (
      <div className="relative p-4 space-y-4 text-text flex flex-col items-center overflow-hidden">
        <img
          src="/assets/icons/file_0000000091786243919bf8966d4d73ce.png"
          className="background-behind-board object-cover"
          alt=""
        />
        <h2 className="text-xl font-bold text-center">DominoPlay</h2>
        <div className="flex justify-center space-x-4">
          <button className="px-4 py-2 bg-primary rounded text-white" onClick={startGame}>Start vs AI</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative p-4 space-y-4 text-text flex flex-col items-center overflow-hidden">
      <img
        src="/assets/icons/file_0000000091786243919bf8966d4d73ce.png"
        className="background-behind-board object-cover"
        alt=""
      />
      <h2 className="text-xl font-bold text-center">DominoPlay</h2>
      <p className="text-center">Stake: {amount} {token}</p>
      {winner !== null && <div className="text-center">Player {winner + 1} wins!</div>}
      <DominoBoard pieces={board} />
      <div className="flex space-x-2 overflow-x-auto">
        {hands[0].map((p, i) => (
          <div key={i} onClick={() => play(i)} className="cursor-pointer">
            <DominoPiece left={p.left} right={p.right} />
          </div>
        ))}
      </div>
    </div>
  );
}
