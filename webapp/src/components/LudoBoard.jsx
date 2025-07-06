import React, { useState, useEffect } from 'react';

import LudoToken from './LudoToken.jsx';

const SIZE = 15;

const ANGLE = 58;

const START_POSITIONS = {
  red: [
    { r: 1, c: 1 },
    { r: 1, c: 3 },
    { r: 3, c: 1 },
    { r: 3, c: 3 },
  ],
  green: [
    { r: 1, c: 11 },
    { r: 1, c: 13 },
    { r: 3, c: 11 },
    { r: 3, c: 13 },
  ],
  yellow: [
    { r: 11, c: 1 },
    { r: 11, c: 3 },
    { r: 13, c: 1 },
    { r: 13, c: 3 },
  ],
  blue: [
    { r: 11, c: 11 },
    { r: 11, c: 13 },
    { r: 13, c: 11 },
    { r: 13, c: 13 },
  ],
};

function getColorName(color = '') {
  const c = color.toLowerCase();
  if (c.includes('ef4444')) return 'red';
  if (c.includes('22c55e') || c.includes('4ade80')) return 'green';
  if (c.includes('60a5fa') || c.includes('3b82f6') || c.includes('bfdbfe')) return 'blue';
  return 'yellow';
}

export default function LudoBoard({ players = [] }) {

  const [cell, setCell] = useState(60);

  useEffect(() => {

    const update = () => {

      const width = Math.min(window.innerWidth, 900);

      const cw = Math.floor(width / SIZE);

      setCell(cw);

    };

    update();

    window.addEventListener('resize', update);

    return () => window.removeEventListener('resize', update);

  }, []);

  const cells = [];

  for (let r = 0; r < SIZE; r++) {

    for (let c = 0; c < SIZE; c++) {

      let cls = 'ludo-cell board-cell';

      if (r < 6 && c < 6) cls += ' ludo-red';

      else if (r < 6 && c >= 9) cls += ' ludo-green';

      else if (r >= 9 && c < 6) cls += ' ludo-yellow';

      else if (r >= 9 && c >= 9) cls += ' ludo-blue';

      cells.push(<div key={`${r}-${c}`} className={cls}></div>);

    }

  }

  return (

    <div className="ludo-board-tilt">

      <div

        className="ludo-board-grid board-3d-grid"

        style={{

          width: `${cell * SIZE}px`,

          height: `${cell * SIZE}px`,

          gridTemplateColumns: `repeat(${SIZE}, ${cell}px)`,

          gridTemplateRows: `repeat(${SIZE}, ${cell}px)`,

          '--cell-width': `${cell}px`,

          '--cell-height': `${cell}px`,

          '--board-angle': `${ANGLE}deg`,

          transform: `translateZ(-50px) rotateX(${ANGLE}deg) scale(1.3)`

        }}

      >

        {cells}
        <div
          className="ludo-start-frame ludo-red-frame"
          style={{ gridRow: '1 / 7', gridColumn: '1 / 7' }}
        />
        <div
          className="ludo-start-frame ludo-green-frame"
          style={{ gridRow: '1 / 7', gridColumn: '10 / 16' }}
        />
        <div
          className="ludo-start-frame ludo-yellow-frame"
          style={{ gridRow: '10 / 16', gridColumn: '1 / 7' }}
        />
        <div
          className="ludo-start-frame ludo-blue-frame"
          style={{ gridRow: '10 / 16', gridColumn: '10 / 16' }}
        />

        {players.map((p) =>
          p.tokens.map((t, i) => {
            const colorName = getColorName(p.color);
            const pos =
              t < 0
                ? START_POSITIONS[colorName][i] || { r: 7, c: 7 }
                : PATH[t] || { r: 7, c: 7 };
            return (
              <div
                key={`${p.id}-${i}`}
                className="token-wrapper"
                style={{ gridRowStart: pos.r + 1, gridColumnStart: pos.c + 1 }}
              >
                <LudoToken color={p.color} photoUrl={p.photoUrl} />
              </div>
            );
          })
        )}

      </div>

    </div>

  );

}

export const PATH = [

  { r: 0, c: 6 }, { r: 1, c: 6 }, { r: 2, c: 6 }, { r: 3, c: 6 }, { r: 4, c: 6 }, { r: 5, c: 6 },

  { r: 6, c: 5 }, { r: 6, c: 4 }, { r: 6, c: 3 }, { r: 6, c: 2 }, { r: 6, c: 1 }, { r: 6, c: 0 },

  { r: 7, c: 0 }, { r: 8, c: 0 }, { r: 8, c: 1 }, { r: 8, c: 2 }, { r: 8, c: 3 }, { r: 8, c: 4 },

  { r: 8, c: 5 }, { r: 9, c: 6 }, { r: 10, c: 6 }, { r: 11, c: 6 }, { r: 12, c: 6 }, { r: 13, c: 6 },

  { r: 14, c: 6 }, { r: 14, c: 7 }, { r: 14, c: 8 }, { r: 13, c: 8 }, { r: 12, c: 8 }, { r: 11, c: 8 },

  { r: 10, c: 8 }, { r: 9, c: 8 }, { r: 8, c: 9 }, { r: 8, c: 10 }, { r: 8, c: 11 }, { r: 8, c: 12 },

  { r: 8, c: 13 }, { r: 8, c: 14 }, { r: 7, c: 14 }, { r: 6, c: 14 }, { r: 6, c: 13 }, { r: 6, c: 12 },

  { r: 6, c: 11 }, { r: 6, c: 10 }, { r: 6, c: 9 }, { r: 5, c: 8 }, { r: 4, c: 8 }, { r: 3, c: 8 },

  { r: 2, c: 8 }, { r: 1, c: 8 }, { r: 0, c: 8 }, { r: 0, c: 7 }

];
