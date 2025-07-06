import React, { useState, useEffect } from 'react';

const ROWS = 11;
const COLS = 11;
const CROSS = 3; // thickness of the cross arms
const ANGLE = 58;

export default function LudoBoard() {
  const [cell, setCell] = useState(60);

  useEffect(() => {
    const update = () => {
      const width = Math.min(window.innerWidth, 900);
      const cw = Math.floor(width / COLS);
      setCell(cw);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const centerRow = Math.floor((ROWS - CROSS) / 2);
  const centerCol = Math.floor((COLS - CROSS) / 2);
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const inVertical = c >= centerCol && c < centerCol + CROSS;
      const inHorizontal = r >= centerRow && r < centerRow + CROSS;
      if (!inVertical && !inHorizontal) continue; // skip cells outside the cross

      let colorClass = '';
      if (r < centerRow && c < centerCol) colorClass = 'ludo-red';
      else if (r < centerRow && c >= centerCol + CROSS) colorClass = 'ludo-yellow';
      else if (r >= centerRow + CROSS && c < centerCol) colorClass = 'ludo-green';
      else if (r >= centerRow + CROSS && c >= centerCol + CROSS) colorClass = 'ludo-blue';

      cells.push(
        <div
          key={`${r}-${c}`}
          className={`ludo-cell ${colorClass}`}
          style={{
            gridRowStart: r + 1,
            gridColumnStart: c + 1,
          }}
        />
      );
    }
  }

  return (
    <div className="ludo-board-tilt">
      <div
        className="ludo-board-grid board-3d-grid"
        style={{
          width: `${cell * COLS}px`,
          height: `${cell * ROWS}px`,
          gridTemplateColumns: `repeat(${COLS}, ${cell}px)`,
          gridTemplateRows: `repeat(${ROWS}, ${cell}px)`,
          '--cell-width': `${cell}px`,
          '--cell-height': `${cell}px`,
          '--board-angle': `${ANGLE}deg`,
          transform: `translateZ(-50px) rotateX(${ANGLE}deg) scale(1.3)`,
        }}
      >
        {cells}
      </div>
    </div>
  );
}
