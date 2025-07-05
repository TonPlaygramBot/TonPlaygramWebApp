import React from 'react';

export default function LudoToken({ color = 'red' }) {
  return (
    <div
      className="ludo-token"
      style={{ backgroundColor: color }}
    />
  );
}
