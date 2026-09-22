import React from 'react';
import ReactDOM from 'react-dom/client';
import SocialApp from './SocialApp';
import { initializeSocialInstall } from './install';
import './social-base.css';
import '../pages/messages.css';

initializeSocialInstall();
(window as any).Telegram?.WebApp?.ready?.();
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Keep the main app's worker and download caches intact. There is no forced
  // reload while publishing: updates activate after the old Social windows close.
  navigator.serviceWorker.register('/social-app/service-worker.js', { scope: '/social-app/', updateViaCache: 'none' })
    .then(registration => {
      const check = () => { if (!document.hidden) void registration.update().catch(() => {}); };
      window.addEventListener('online', check);
      document.addEventListener('visibilitychange', check);
    }).catch(() => { /* Browsing and foreground uploads still work. */ });
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><SocialApp /></React.StrictMode>);
