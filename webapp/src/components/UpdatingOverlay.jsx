import React from 'react';

export default function UpdatingOverlay({ active }) {
  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
      <div className="bg-surface/90 border border-accent rounded-2xl p-6 text-center shadow-2xl w-full max-w-sm">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" aria-hidden />
        <h2 className="text-xl font-semibold mb-2">Updating…</h2>
        <p className="text-sm text-gray-200/90">
          A new build is ready. Hold tight while we refresh your session.
        </p>
      </div>
    </div>
  );
}
