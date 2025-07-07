import React from 'react';

export default function Branding({ scale = 1, offsetY = 0 }) {
  return (
    <div className="text-center py-6 space-y-2">
      <img

        src="/assets/icons/TonPlayGramLogo.webp"
        alt="TonPlaygram Logo"
        className="mx-auto"
        style={{ transform: `scale(${scale})`, marginTop: offsetY }}
      />
    </div>
  );
}
