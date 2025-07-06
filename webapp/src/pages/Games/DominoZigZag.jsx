import { useState, useEffect } from 'react';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import DominoZigZagBoard from '../../components/DominoZigZagBoard.jsx';
import DominoPiece from '../../components/DominoPiece.jsx';
import { generateDominoSet, shuffle } from '../../utils/domino.js';

const HAND_SIZE = 7;

function initGame() {
  const deck = shuffle(generateDominoSet());
  const hands = [[], []];
  for (let i = 0; i < HAND_SIZE; i++) {
    for (let p = 0; p < 2; p++) {
      hands[p].push(deck.pop());
    }
  }

  for (let v = 6; v >= 0; v--) {
    const i0 = hands[0].findIndex((d) => d.left === v && d.right === v);
    const i1 = hands[1].findIndex((d) => d.left === v && d.right === v);
    if (i0 !== -1) {
      const piece = hands[0].splice(i0, 1)[0];
      return { hands, deck, board: [piece], startPlayer: 1 };
    }
    if (i1 !== -1) {
      const piece = hands[1].splice(i1, 1)[0];
      return { hands, deck, board: [piece], startPlayer: 0 };
    }
    const dIdx = deck.findIndex((d) => d.left === v && d.right === v);
    if (dIdx !== -1) {
      const piece = deck.splice(dIdx, 1)[0];
      return { hands, deck, board: [piece], startPlayer: 0 };
    }
  }
  const piece = deck.pop();
  return { hands, deck, board: [piece], startPlayer: 0 };
}

export default function DominoZigZag() {
  useTelegramBackButton();
  const [game, setGame] = useState(() => initGame());
  const [turn, setTurn] = useState(game.startPlayer);
  const [selected, setSelected] = useState(null); // {index, piece}
  const [highlight, setHighlight] = useState(null); // {left:true,right:false,piece}
  const [winner, setWinner] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const [slots, setSlots] = useState({ left: null, right: null });

  const boardEnds = () => {
    const left = game.board[0].left;
    const right = game.board[game.board.length - 1].right;
    return { left, right };
  };

  const canPlay = (piece) => {
    if (game.board.length === 0) return true;
    const { left, right } = boardEnds();
    return piece.left === left || piece.right === left || piece.left === right || piece.right === right;
  };

  const updateHighlight = (piece) => {
    if (!piece) {
      setHighlight(null);
      return;
    }
    if (game.board.length === 0) {
      setHighlight({ left: true, right: true, piece });
      return;
    }
    const { left, right } = boardEnds();
    setHighlight({
      left: piece.left === left || piece.right === left,
      right: piece.left === right || piece.right === right,
      piece,
    });
  };

  const placePiece = (side) => {
    if (!selected) return;
    const idx = selected.index;
    const piece = game.hands[turn][idx];
    if (!canPlay(piece)) return;
    setGame((g) => {
      const hands = g.hands.map((h) => [...h]);
      const board = [...g.board];
      hands[turn].splice(idx, 1);
      if (side === 'left') {
        const end = board[0].left;
        if (piece.right === end) board.unshift({ left: piece.left, right: piece.right });
        else board.unshift({ left: piece.right, right: piece.left });
      } else {
        const end = board[board.length - 1].right;
        if (piece.left === end) board.push({ left: piece.left, right: piece.right });
        else board.push({ left: piece.right, right: piece.left });
      }
      return { ...g, hands, board };
    });
    setSelected(null);
    setHighlight(null);
    checkWinner(turn);
    setTurn((t) => (t === 0 ? 1 : 0));
  };

  const drawTile = (index) => {
    if (game.deck.length <= 2) return;
    setGame((g) => {
      const deck = [...g.deck];
      const hands = g.hands.map((h) => [...h]);
      hands[turn].push(deck.splice(index, 1)[0]);
      return { ...g, deck, hands };
    });
  };

  const checkWinner = (player) => {
    if (game.hands[player].length === 0) {
      setWinner(player);
    }
  };

  useEffect(() => {
    if (selected) updateHighlight(selected.piece);
  }, [selected, game.board]);

  const startDrag = (idx, piece, e) => {
    if (turn !== 0 || winner) return;
    setSelected({ index: idx, piece });
    setDragPos({ x: e.clientX, y: e.clientY });
  };

  const onDrag = (e) => {
    if (!dragPos) return;
    setDragPos({ x: e.clientX, y: e.clientY });
  };

  const endDrag = (e) => {
    if (!dragPos) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = dragPos.x - rect.left;
    const y = dragPos.y - rect.top;
    if (highlight?.left && slotMatch(x, y, slots.left)) {
      placePiece('left');
    } else if (highlight?.right && slotMatch(x, y, slots.right)) {
      placePiece('right');
    }
    setDragPos(null);
  };

  const slotMatch = (x, y, slot) => {
    if (!slot) return false;
    return (
      x >= slot.left &&
      x <= slot.left + (slot.vertical ? 32 : 64) &&
      y >= slot.top &&
      y <= slot.top + (slot.vertical ? 64 : 32)
    );
  };

  return (
    <div className="relative p-4 space-y-4 flex flex-col items-center overflow-hidden text-text" onPointerMove={onDrag} onPointerUp={endDrag}>
      <h2 className="text-xl font-bold text-center">Domino ZigZag</h2>
      {winner !== null && <div className="text-center">Player {winner + 1} wins!</div>}
      <DominoZigZagBoard pieces={game.board} highlight={highlight} onSlotsChange={setSlots} />
      <div className="flex space-x-2 overflow-x-auto">
        {game.hands[turn].map((p, i) => (
          <div key={i} className="cursor-pointer" onPointerDown={(e) => startDrag(i, p, e)}>
            <DominoPiece left={p.left} right={p.right} vertical />
          </div>
        ))}
      </div>
      <div className="domino-stack flex flex-col absolute right-2 top-2">
        {game.deck.map((p, i) => (
          <div key={i} className={`cursor-pointer ${i >= game.deck.length - 2 ? 'opacity-50 pointer-events-none' : ''}`} onClick={() => drawTile(i)}>
            <DominoPiece left={-1} right={-1} />
          </div>
        ))}
      </div>
      {dragPos && selected && (
        <DominoPiece
          left={selected.piece.left}
          right={selected.piece.right}
          vertical
          style={{
            position: 'fixed',
            top: dragPos.y - 32,
            left: dragPos.x - 16,
            pointerEvents: 'none',
            zIndex: 50,
          }}
        />
      )}
    </div>
  );
}
