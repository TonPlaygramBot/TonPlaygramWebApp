import React from 'react';
import { Download } from 'lucide-react';

export default function PwaInstallBanner({ mode = 'none', onInstall, onDismiss }) {
  if (mode === 'none') return null;

  const title =
    mode === 'telegram' ? 'Install TonPlaygram on your device' : 'Install TonPlaygram for Telegram';
  const description =
    mode === 'telegram'
      ? 'Open this page in Chrome or Safari, then add it to your home screen.'
      : 'Add to Home Screen to cache the full game shell and cut reload times.';
  const ctaLabel = mode === 'telegram' ? 'Open in browser' : 'Install now';

  return (
    <div className="fixed bottom-[5.5rem] inset-x-0 z-[60] px-4">
      <div className="max-w-3xl mx-auto rounded-2xl border border-accent/60 bg-surface shadow-xl shadow-accent/20 p-4 flex items-start gap-3">
        <div className="shrink-0">
          <Download className="text-accent drop-shadow" size={28} />
        </div>
        <div className="flex-1">
          <p className="text-white text-lg leading-tight">{title}</p>
          <p className="text-sm text-text/80 mt-1">{description}</p>
          <div className="flex gap-3 mt-3">
            <button
              type="button"
              className="bg-primary text-white px-3 py-2 rounded-lg text-sm hover:bg-primary-hover transition"
              onClick={onInstall}
            >
              {ctaLabel}
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
