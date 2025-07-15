import React from 'react';

const COLS = 20;
const ROWS = 30;

export default function BoardGridOverlay({ className = '' }) {
  const lines = [];
  for (let i = 0; i <= COLS; i++) {
    lines.push(
      <line
        key={`v${i}`}
        x1={i}
        y1={0}
        x2={i}
        y2={ROWS}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={0.05}
      />,
    );
  }
  for (let j = 0; j <= ROWS; j++) {
    lines.push(
      <line
        key={`h${j}`}
        x1={0}
        y1={j}
        x2={COLS}
        y2={j}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={0.05}
      />,
    );
  }
  // Sequential numbers for each cell

  const cellLabels = [];
  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      const cellNumber = j * COLS + i + 1;
      cellLabels.push(
        <text
          key={`c${i}-${j}`}
          x={i + 0.5}
          y={j + 0.6}
          textAnchor="middle"
          fontSize={1}
          fill="white"
          opacity={0.7}
        >
          {cellNumber}
        </text>
      );
    }
  }

  return (
    <svg
      className={`fixed inset-0 w-screen h-screen pointer-events-none ${className}`}
      viewBox="-0.5 -0.5 21 31"
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
    >
      {lines}
      {cellLabels}
    </svg>
  );
}
