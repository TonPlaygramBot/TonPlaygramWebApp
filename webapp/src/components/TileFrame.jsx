import React from 'react';

export default function TileFrame({ rect }) {
  if (!rect) return null;
  const style = {
    position: 'fixed',
    pointerEvents: 'none',
    left: rect.x - rect.width / 2,
    top: rect.y - rect.height / 2,
    width: rect.width,
    height: rect.height,
    zIndex: 4,
  };
  return <div className="tile-frame" style={style} />;
}
