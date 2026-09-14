import { useEffect, useSyncExternalStore } from 'react';
import {
  dismissInstallBanner,
  getInstallPromptSnapshot,
  initializeInstallPrompt,
  openExternalInstall,
  requestInstall,
  subscribeInstallPrompt
} from '../pwa/installPrompt.js';

// Capture install events before asynchronous bootstrap and React mounting.
export { initializeInstallPrompt } from '../pwa/installPrompt.js';

export default function usePwaInstallPrompt() {
  useEffect(initializeInstallPrompt, []);
  const state = useSyncExternalStore(
    subscribeInstallPrompt,
    getInstallPromptSnapshot,
    getInstallPromptSnapshot
  );
  const { installed, dismissed, promptEvent, telegramDetected, telegramCanAddHomeScreen } = state;
  const canInstall = !installed && !dismissed && Boolean(promptEvent);
  const canShowTelegramInstall = !installed && !dismissed && telegramDetected && !promptEvent;

  return {
    ...state,
    canInstall,
    canShowTelegramInstall,
    canPrompt: !installed && !state.installPending && Boolean(promptEvent || telegramCanAddHomeScreen),
    mode: canInstall ? 'prompt' : canShowTelegramInstall ? 'telegram' : 'none',
    // Preserve the old boolean API; acceptance does not confirm installation.
    promptToInstall: async () => {
      const result = await requestInstall();
      return ['accepted', 'requested', 'installed'].includes(result.outcome);
    },
    requestInstall,
    openExternalInstall,
    dismiss: dismissInstallBanner
  };
}
