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

    const H_WIDTH = 64;
    const H_HEIGHT = 32;
    const V_WIDTH = 32;
    const V_HEIGHT = 64;

    const pos = [];

    let dir = 'right';
    let x = boardWidth / 2 - H_WIDTH; // start from center, slightly left
    let y = boardHeight - H_HEIGHT; // bottom row

    let leftBound = 0;
    let rightBound = boardWidth - H_WIDTH;
    let topBound = 0;
    let bottomBound = boardHeight - H_HEIGHT;

    pieces.forEach((piece, idx) => {
      const isDouble = piece.left === piece.right;
      const vertical = (dir === 'up' || dir === 'down') && !isDouble;
      const width = vertical ? V_WIDTH : H_WIDTH;
      const height = vertical ? V_HEIGHT : H_HEIGHT;

      // clamp within current bounds
      if (x < leftBound) x = leftBound;
      if (x + width > boardWidth) x = boardWidth - width;
      if (y < topBound) y = topBound;
      if (y + height > boardHeight) y = boardHeight - height;

      pos.push({ top: y, left: x, vertical });

      // determine next orientation (lookahead)
      const nextPiece = pieces[idx + 1];
      const nextDouble = nextPiece && nextPiece.left === nextPiece.right;
      const nextVert = (dir === 'right' || dir === 'left') ? false : !nextDouble;
      const nextWidth = nextVert ? V_WIDTH : H_WIDTH;
      const nextHeight = nextVert ? V_HEIGHT : H_HEIGHT;

      if (dir === 'right') {
        if (x + width + nextWidth > rightBound) {
          dir = 'up';
          rightBound -= V_WIDTH;
          y -= nextHeight;
          x = rightBound;
        } else {
          x += width;
        }
      } else if (dir === 'up') {
        if (y - nextHeight < topBound) {
          dir = 'left';
          topBound += V_HEIGHT;
          x -= nextWidth;
          y = topBound;
        } else {
          y -= height;
        }
      } else if (dir === 'left') {
        if (x - nextWidth < leftBound) {
          dir = 'down';
          leftBound += V_WIDTH;
          y += nextHeight;
          x = leftBound;
        } else {
          x -= width;
        }
      } else if (dir === 'down') {
        if (y + height + nextHeight > bottomBound) {
          dir = 'right';
          bottomBound -= V_HEIGHT;
          x += nextWidth;
          y = bottomBound;
        } else {
          y += height;
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
