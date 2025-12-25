import React from 'react';
import { Download } from 'lucide-react';

export default function PwaInstallBanner({ canInstall, onInstall, onDismiss }) {
  if (!canInstall) return null;

  return (
    <div className="fixed bottom-[5.5rem] inset-x-0 z-[60] px-4">
      <div className="max-w-3xl mx-auto rounded-2xl border border-accent/60 bg-surface shadow-xl shadow-accent/20 p-4 flex items-start gap-3">
        <div className="shrink-0">
          <Download className="text-accent drop-shadow" size={28} />
        </div>
        <div className="flex-1">
          <p className="text-white text-lg leading-tight">Install TonPlaygram for Telegram</p>
          <p className="text-sm text-text/80 mt-1">
            Add to Home Screen to cache the full game shell and cut reload times.
          </p>
          <div className="flex gap-3 mt-3">
            <button
              type="button"
              className="bg-primary text-white px-3 py-2 rounded-lg text-sm hover:bg-primary-hover transition"
              onClick={onInstall}
            >
              Install now
            </button>
            <button
              type="button"
              className="text-sm text-text/80 hover:text-white transition underline"
              onClick={onDismiss}
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
