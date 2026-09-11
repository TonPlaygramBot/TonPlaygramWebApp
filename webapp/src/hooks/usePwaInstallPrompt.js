import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'tonplaygram-pwa-dismissed';

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)')?.matches ||
  window.navigator.standalone === true;

const isTelegramWebApp = () => Boolean(window.Telegram?.WebApp);

export default function usePwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });
  const [telegramDetected, setTelegramDetected] = useState(() => isTelegramWebApp());

  useEffect(() => {
    const handler = event => {
      event.preventDefault();
      setPromptEvent(event);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  useEffect(() => {
    if (isTelegramWebApp()) {
      setTelegramDetected(true);
    }
  }, []);

  const markDismissed = () => {
    setDismissed(true);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* Storage may be disabled. */ }
  };

  const promptToInstall = async () => {
    if (!promptEvent) return false;
    const event = promptEvent;
    setPromptEvent(null); // A browser install prompt can only be used once.
    await event.prompt();
    const result = await event.userChoice.catch(() => ({ outcome: 'dismissed' }));
    if (result?.outcome === 'accepted') {
      // appinstalled confirms completion; accepting the prompt is not installation.
      return true;
    }
    markDismissed();
    return false;
  };

  const canInstall = useMemo(
    () => !installed && !dismissed && Boolean(promptEvent),
    [dismissed, installed, promptEvent]
  );

  const canShowTelegramInstall = useMemo(
    () => !installed && !dismissed && telegramDetected && !promptEvent,
    [dismissed, installed, promptEvent, telegramDetected]
  );

  const openExternalInstall = () => {
    const url = window.location.href;
    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(url, { try_instant_view: false });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const mode = canInstall ? 'prompt' : canShowTelegramInstall ? 'telegram' : 'none';

  return {
    canInstall,
    canShowTelegramInstall,
    mode,
    installed,
    dismissed,
    promptToInstall,
    openExternalInstall,
    dismiss: markDismissed
  };
}
