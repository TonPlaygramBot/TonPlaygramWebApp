import React, { useCallback, useEffect, useState } from 'react';
import { isTelegramWebView } from '../utils/telegram.js';

const DISMISS_KEY = 'tonplaygram_pwa_prompt_dismissed';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [promptType, setPromptType] = useState('native');

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (isStandalone || localStorage.getItem(DISMISS_KEY) === 'true') return undefined;

    if (isTelegramWebView()) {
      setPromptType('telegram');
      setVisible(true);
    }

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      if (localStorage.getItem(DISMISS_KEY) === 'true') return;
      setDeferredPrompt(event);
      setPromptType('native');
      setVisible(true);
    };

    const handleAppInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
      localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice.catch(() => null);
    setDeferredPrompt(null);
    setVisible(false);
    if (choice?.outcome === 'dismissed') {
      localStorage.setItem(DISMISS_KEY, 'true');
    }
  }, [deferredPrompt]);

  const handleDismiss = () => {
    setVisible(false);
    setDeferredPrompt(null);
    localStorage.setItem(DISMISS_KEY, 'true');
  };

  if (!visible) return null;

  const isTelegramPrompt = promptType === 'telegram';

  return (
    <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:w-80 z-50">
      <div className="bg-surface border border-accent/60 rounded-xl shadow-xl p-4 text-white">
        <div className="font-bold text-lg mb-2 text-white">
          {isTelegramPrompt ? 'Install in Telegram' : 'Install TonPlaygram'}
        </div>
        {isTelegramPrompt ? (
          <>
            <p className="text-sm mb-3 text-white/80">
              Add TonPlaygram directly from the Telegram browser so it keeps opening inside Telegram instead of an
              external browser.
            </p>
            <ol className="text-sm text-white/80 list-decimal list-inside space-y-1 mb-4">
              <li>Tap the menu (⋮ on Android or ··· on iOS) in the Telegram browser.</li>
              <li>Select <b>Add to Home Screen</b> / <b>Install app</b>.</li>
              <li>Confirm to pin TonPlaygram to your home screen.</li>
            </ol>
            <div className="flex justify-end">
              <button
                type="button"
                className="bg-primary hover:bg-primary-hover text-white px-3 py-1 rounded"
                onClick={handleDismiss}
              >
                Got it
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm mb-4 text-white/80">
              Add TonPlaygram to your home screen for faster launches, offline-ready caching, and quick access to
              your games and wallet.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded"
                onClick={handleDismiss}
              >
                Not now
              </button>
              <button
                type="button"
                className="bg-primary hover:bg-primary-hover text-white px-3 py-1 rounded"
                onClick={handleInstall}
              >
                Install
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
