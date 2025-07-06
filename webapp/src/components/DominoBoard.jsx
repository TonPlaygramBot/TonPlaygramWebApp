import React from 'react';
import DominoPiece from './DominoPiece.jsx';

export default function DominoBoard({ pieces = [] }) {
  return (
    <div className="domino-table">
      <div className="domino-board">
        {pieces.map((p, i) => (
          <DominoPiece key={i} left={p.left} right={p.right} />
        ))}
      </div>
    </div>
  );
}
