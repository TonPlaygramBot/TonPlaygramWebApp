import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'tonplaygram-pwa-dismissed';

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true ||
  window.Telegram?.WebApp?.isExpanded;

export default function usePwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');

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

  const markDismissed = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, '1');
  };

  const promptToInstall = async () => {
    if (!promptEvent) return false;
    promptEvent.prompt();
    const result = await promptEvent.userChoice.catch(() => ({ outcome: 'dismissed' }));
    if (result?.outcome === 'accepted') {
      setInstalled(true);
      setPromptEvent(null);
      return true;
    }
    markDismissed();
    return false;
  };

  const canInstall = useMemo(
    () => !installed && !dismissed && Boolean(promptEvent),
    [dismissed, installed, promptEvent]
  );

  return {
    canInstall,
    installed,
    dismissed,
    promptToInstall,
    dismiss: markDismissed
  };
}
