import React, { useEffect, useRef, useState } from 'react';
import DominoPiece from './DominoPiece.jsx';

export default function DominoZigZagBoard({ pieces = [], highlight = null, onSlotsChange }) {
  const boardRef = useRef(null);
  const [positions, setPositions] = useState([]);
  const [slotLeft, setSlotLeft] = useState(null);
  const [slotRight, setSlotRight] = useState(null);

  const H_WIDTH = 64;
  const H_HEIGHT = 32;
  const V_WIDTH = 32;
  const V_HEIGHT = 64;

  const layout = (list, width, height) => {
    let dir = 'right';
    let x = width / 2 - H_WIDTH;
    let y = height / 2 - H_HEIGHT / 2;
    const pos = [];

    list.forEach((piece, idx) => {
      const isDouble = piece.left === piece.right;
      const vertical = (dir === 'up' || dir === 'down') && !isDouble;
      const w = vertical ? V_WIDTH : H_WIDTH;
      const h = vertical ? V_HEIGHT : H_HEIGHT;

      if (x < 0) x = 0;
      if (x + w > width) x = width - w;
      if (y < 0) y = 0;
      if (y + h > height) y = height - h;

      pos.push({ left: x, top: y, vertical });

      const next = list[idx + 1];
      const nextDouble = next && next.left === next.right;
      const nextVert = (dir === 'up' || dir === 'down') && !nextDouble;
      const nextW = nextVert ? V_WIDTH : H_WIDTH;
      const nextH = nextVert ? V_HEIGHT : H_HEIGHT;

      if (dir === 'right') {
        if (x + w + nextW > width) {
          dir = 'down';
          y += h;
        } else {
          x += w;
        }
      } else if (dir === 'down') {
        if (y + h + nextH > height) {
          dir = 'left';
          x -= w;
        } else {
          y += h;
        }
      } else if (dir === 'left') {
        if (x - nextW < 0) {
          dir = 'up';
          y -= h;
        } else {
          x -= w;
        }
      } else if (dir === 'up') {
        if (y - nextH < 0) {
          dir = 'right';
          x += w;
        } else {
          y -= h;
        }
      }
    });

    return { pos, dir, x, y };
  };

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const boardWidth = board.clientWidth;
    const boardHeight = board.clientHeight;

    const { pos } = layout(pieces, boardWidth, boardHeight);
    setPositions(pos);

    let leftPos = null;
    let rightPos = null;
    if (highlight && (highlight.left || highlight.right)) {
      if (highlight.left) {
        const { pos: p } = layout([highlight.piece, ...pieces], boardWidth, boardHeight);
        leftPos = p[0];
        setSlotLeft(leftPos);
      } else {
        setSlotLeft(null);
      }
      if (highlight.right) {
        const { pos: p } = layout([...pieces, highlight.piece], boardWidth, boardHeight);
        rightPos = p[p.length - 1];
        setSlotRight(rightPos);
      } else {
        setSlotRight(null);
      }
    } else {
      setSlotLeft(null);
      setSlotRight(null);
    }
    if (onSlotsChange) onSlotsChange({ left: leftPos, right: rightPos });
  }, [pieces, highlight, onSlotsChange]);

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
        {highlight && highlight.left && slotLeft && (
          <div
            className={`highlight-slot ${slotLeft.vertical ? 'domino-vert' : ''}`}
            style={{ position: 'absolute', top: slotLeft.top, left: slotLeft.left }}
          />
        )}
        {highlight && highlight.right && slotRight && (
          <div
            className={`highlight-slot ${slotRight.vertical ? 'domino-vert' : ''}`}
            style={{ position: 'absolute', top: slotRight.top, left: slotRight.left }}
          />
        )}
      </div>
    </div>
  );
}
