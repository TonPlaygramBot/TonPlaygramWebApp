import React from 'react';

export default function TileFrame({ rect, adjustX = 0, adjustY = 0 }) {

  if (!rect) return null;
  const style = {
    position: 'absolute',
    pointerEvents: 'none',
    left: rect.x - rect.width / 2 + adjustX,
    top: rect.y - rect.height / 2 + adjustY,
    width: rect.width,
    height: rect.height,
    zIndex: 4,
  };
  return <div className="tile-frame" style={style} />;
}
