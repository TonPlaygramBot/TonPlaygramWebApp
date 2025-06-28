import React from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';

export default function Store() {
  useTelegramBackButton();
  return (
    <div className="relative p-4 space-y-2 text-text">
      <img
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board object-cover"
        alt=""
      />
      <h2 className="text-xl font-bold">Store</h2>
      <p>Coming soon...</p>
    </div>
  );
}
