import React from 'react';
import LudoToken from './LudoToken.jsx';

const SIZE = 15;

export default function LudoBoard({ players = [] }) {
  const cells = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      let cls = 'ludo-cell';
      if (r < 6 && c < 6) cls += ' ludo-red';
      else if (r < 6 && c >= 9) cls += ' ludo-green';
      else if (r >= 9 && c < 6) cls += ' ludo-yellow';
      else if (r >= 9 && c >= 9) cls += ' ludo-blue';
      cells.push(<div key={`${r}-${c}`} className={cls}></div>);
    }
  }

  return (
    <div className="ludo-board">
      {cells}
      {players.map((p) =>
        p.tokens.map((t, i) => {
          if (t < 0) return null;
          const pos = PATH[t] || { r: 7, c: 7 };
          return (
            <div
              key={`${p.id}-${i}`}
              className="token-wrapper"
              style={{ gridRowStart: pos.r + 1, gridColumnStart: pos.c + 1 }}
            >
              <LudoToken color={p.color} />
            </div>
          );
        })
      )}
    </div>
  );
}

// simplified path coordinates
export const PATH = [
  { r: 0, c: 6 },
  { r: 1, c: 6 },
  { r: 2, c: 6 },
  { r: 3, c: 6 },
  { r: 4, c: 6 },
  { r: 5, c: 6 },
  { r: 6, c: 5 },
  { r: 6, c: 4 },
  { r: 6, c: 3 },
  { r: 6, c: 2 },
  { r: 6, c: 1 },
  { r: 6, c: 0 },
  { r: 7, c: 0 },
  { r: 8, c: 0 },
  { r: 8, c: 1 },
  { r: 8, c: 2 },
  { r: 8, c: 3 },
  { r: 8, c: 4 },
  { r: 8, c: 5 },
  { r: 9, c: 6 },
  { r: 10, c: 6 },
  { r: 11, c: 6 },
  { r: 12, c: 6 },
  { r: 13, c: 6 },
  { r: 14, c: 6 },
  { r: 14, c: 7 },
  { r: 14, c: 8 },
  { r: 13, c: 8 },
  { r: 12, c: 8 },
  { r: 11, c: 8 },
  { r: 10, c: 8 },
  { r: 9, c: 8 },
  { r: 8, c: 9 },
  { r: 8, c: 10 },
  { r: 8, c: 11 },
  { r: 8, c: 12 },
  { r: 8, c: 13 },
  { r: 8, c: 14 },
  { r: 7, c: 14 },
  { r: 6, c: 14 },
  { r: 6, c: 13 },
  { r: 6, c: 12 },
  { r: 6, c: 11 },
  { r: 6, c: 10 },
  { r: 6, c: 9 },
  { r: 5, c: 8 },
  { r: 4, c: 8 },
  { r: 3, c: 8 },
  { r: 2, c: 8 },
  { r: 1, c: 8 },
  { r: 0, c: 8 },
  { r: 0, c: 7 }
];
