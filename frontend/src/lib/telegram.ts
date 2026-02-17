declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
      };
    };
  }
}

export function getTelegramInitData() {
  const webApp = window.Telegram?.WebApp;
  if (!webApp?.initData) return null;
  webApp.ready();
  return webApp.initData;
}
