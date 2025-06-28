import React from 'react';

export default function Branding({ small = false }) {
  const classes = small ? 'text-center pt-2 pb-4 space-y-2' : 'text-center py-6 space-y-2';
  return (
    <div className={classes}>
      <img
        src="/assets/TonPlayGramLogo.jpg"
        alt="TonPlaygram Logo"
        className={`mx-auto ${small ? 'scale-95 -mt-2' : ''}`}
      />
    </div>
  );
}
