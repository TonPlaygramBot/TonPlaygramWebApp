import React from 'react';
import DominoPiece from './DominoPiece.jsx';

export default function DominoBoard({ pieces = [], highlight = {}, onPlaceLeft, onPlaceRight }) {
  return (
    <div className="domino-table">
      <div className="domino-board">
        {highlight.left && (
          <div className="highlight-slot" onClick={onPlaceLeft} />
        )}
        {pieces.map((p, i) => (
          <DominoPiece
            key={i}
            left={p.left}
            right={p.right}
            vertical={p.left !== p.right}
          />
        ))}
        {highlight.right && (
          <div className="highlight-slot" onClick={onPlaceRight} />
        )}
      </div>
    </div>
  );
}
