import React from 'react';
import useAppUpdate from '../hooks/useAppUpdate.js';

export default function AppUpdateOverlay({ children }) {
  const { status, latestBuild, currentBuild } = useAppUpdate();
  const isUpdating = status === 'updating';

  return (
    <div className="relative">
      {children}
      {isUpdating && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-surface/95 backdrop-blur-sm text-center px-6 py-8">
          <div
            className="h-14 w-14 rounded-full border-4 border-accent border-t-transparent animate-spin mb-4"
            aria-hidden="true"
          />
          <h2 className="text-2xl font-bold mb-2">Updating…</h2>
          <p className="text-sm opacity-80 leading-relaxed">
            Applying the latest build to keep your games fresh.
            <br />
            {latestBuild ? `Build ${currentBuild} → ${latestBuild}` : `Current build ${currentBuild}`}
          </p>
        </div>
      )}
    </div>
  );
}

