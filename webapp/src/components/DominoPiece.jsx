import React from 'react';

const dotPositions = {
  0: [],
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [
    [25, 25],
    [25, 75],
    [75, 25],
    [75, 75],
  ],
  5: [
    [25, 25],
    [25, 75],
    [50, 50],
    [75, 25],
    [75, 75],
  ],
  6: [
    [25, 25],
    [25, 50],
    [25, 75],
    [75, 25],
    [75, 50],
    [75, 75],
  ],
};

function renderHalf(value) {
  const dots = dotPositions[value] || [];
  return (
    <div className="domino-half">
      {dots.map(([top, left], idx) => (
        <span
          key={idx}
          className="domino-dot"
          style={{ top: `${top}%`, left: `${left}%` }}
        />
      ))}
    </div>
  );
}

export default function DominoPiece({ left, right, vertical = false }) {
  return (
    <div className={`domino-piece ${vertical ? 'domino-vert' : ''}`}>
      {renderHalf(left)}
      <span className="domino-divider" />
      {renderHalf(right)}
    </div>
  );
}
