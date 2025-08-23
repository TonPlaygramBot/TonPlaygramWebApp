import React from 'react';

export default function GameLayoutWithBackground({ imageUrl, aspectRatio = 16 / 9, children }) {
  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio }}>
      {imageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
      )}
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}
