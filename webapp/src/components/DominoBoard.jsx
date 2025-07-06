import React, { useEffect, useRef, useState } from 'react';
import DominoPiece from './DominoPiece.jsx';

export default function DominoBoard({ pieces = [], highlight = {}, onPlaceLeft, onPlaceRight }) {
  const boardRef = useRef(null);
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const boardHeight = board.clientHeight;
    const boardWidth = board.clientWidth;

    const GAP = 8;
    const V_HEIGHT = 64;
    const H_HEIGHT = 32;
    const COLUMN_STEP = 40; // width of vertical piece + gap

    let x = boardWidth / 2 - COLUMN_STEP; // start slightly left
    let y = boardHeight / 2 - V_HEIGHT / 2;
    let downward = true;
    const pos = [];

    pieces.forEach((piece) => {
      const isDouble = piece.left === piece.right;
      const height = isDouble ? H_HEIGHT : V_HEIGHT;
      pos.push({ top: y, left: x, vertical: !isDouble });

      if (downward) {
        y += height + GAP;
        if (y + height > boardHeight) {
          downward = false;
          x += COLUMN_STEP;
          y = boardHeight - height;
        }
      } else {
        y -= height + GAP;
        if (y < 0) {
          downward = true;
          x += COLUMN_STEP;
          y = 0;
        }
      }
    });

    setPositions(pos);
  }, [pieces]);

  return (
    <div className="domino-table">
      <div ref={boardRef} className="domino-board relative">
        {positions.map((pos, i) => (
          <DominoPiece
            key={i}
            left={pieces[i].left}
            right={pieces[i].right}
            vertical={pos.vertical}
            style={{ position: 'absolute', top: pos.top, left: pos.left }}
          />
        ))}
      </div>
    </div>
  );
}
