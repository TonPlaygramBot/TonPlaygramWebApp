import React, { useCallback, useEffect, useState } from 'react';

const DISMISS_KEY = 'tonplaygram_pwa_prompt_dismissed';

const isTelegramBrowser = () => /Telegram/i.test(navigator.userAgent) || !!window.Telegram?.WebApp;
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [telegramHelpVisible, setTelegramHelpVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return undefined;

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      if (localStorage.getItem(DISMISS_KEY) === 'true') return;
      setDeferredPrompt(event);
      setVisible(true);
      setTelegramHelpVisible(false);
    };

    const handleAppInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
      localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    const telegramFallbackTimer = setTimeout(() => {
      if (!visible && !deferredPrompt && isTelegramBrowser()) {
        setTelegramHelpVisible(true);
      }
    }, 1500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(telegramFallbackTimer);
    };
  }, [deferredPrompt, visible]);

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

  if (!visible && !telegramHelpVisible) return null;

  return (
    <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:w-80 z-50">
      <div className="bg-surface border border-accent/60 rounded-xl shadow-xl p-4 text-white space-y-3">
        <div className="font-bold text-lg text-white">Install TonPlaygram</div>
        {visible && (
          <>
            <p className="text-sm text-white/80">
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

        {telegramHelpVisible && (
          <div className="bg-primary/10 border border-primary/40 rounded-lg p-3 text-sm text-white/90">
            <p className="mb-2 font-semibold text-primary">Telegram browser install</p>
            <ol className="list-decimal list-inside space-y-1 text-white/80">
              <li>Tap the menu (⋮) in the Telegram webview.</li>
              <li>Select "Add to Home Screen" to install the PWA.</li>
              <li>Launch TonPlaygram from your home screen for the full experience.</li>
            </ol>
            <button
              type="button"
              className="mt-3 w-full bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded"
              onClick={() => setTelegramHelpVisible(false)}
            >
              Got it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
