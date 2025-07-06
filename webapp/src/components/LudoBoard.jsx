import React, { useState, useEffect } from 'react';

const SIZE = 1;

const ANGLE = 58;

export default function LudoBoard() {

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

  const cells = [
    <div
      key="0-0"
      className="board-cell"
      style={{ backgroundColor: '#6db0ad' }}
    >
      <span className="cell-number">1</span>
    </div>,
  ];

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

      </div>

    </div>

  );

}
