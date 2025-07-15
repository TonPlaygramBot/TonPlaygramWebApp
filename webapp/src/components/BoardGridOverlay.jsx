import React from 'react';

const COLS = 20;
const ROWS = 30;
const LETTERS = 'ABCDEFGHIJKLMNOPQRST'.split('');

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
  const letterLabels = LETTERS.map((l, i) => (
    <text
      key={`l${i}`}
      x={i + 0.5}
      y={-0.3}
      textAnchor="middle"
      fontSize={0.8}
      fill="white"
    >
      {l}
    </text>
  ));
  const numberLabels = Array.from({ length: ROWS }, (_, j) => (
    <text
      key={`n${j}`}
      x={-0.3}
      y={j + 0.7}
      textAnchor="end"
      fontSize={0.8}
      fill="white"
    >
      {j + 1}
    </text>
  ));

  const cellLabels = [];
  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      cellLabels.push(
        <text
          key={`c${i}-${j}`}
          x={i + 0.5}
          y={j + 0.6}
          textAnchor="middle"
          fontSize={0.6}
          fill="white"
          opacity={0.5}
        >
          {`${LETTERS[i]}${j + 1}`}
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
      {letterLabels}
      {numberLabels}
      {cellLabels}
    </svg>
  );
}
