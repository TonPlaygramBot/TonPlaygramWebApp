import React from 'react';

export default function DominoPiece({ left, right, vertical = false }) {
  return (
    <div className={`domino-piece ${vertical ? 'domino-vert' : ''}`}> 
      <div className="domino-half">{left}</div>
      <span className="domino-divider" />
      <div className="domino-half">{right}</div>
    </div>
  );
}
