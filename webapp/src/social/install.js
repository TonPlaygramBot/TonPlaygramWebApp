const listeners = new Set();
let started = false;
let snapshot = { prompt: null, installed: false, pending: false, error: '' };
function update(change) {
  snapshot = { ...snapshot, ...change };
  listeners.forEach(listener => listener());
}
export const subscribeSocialInstall = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const getSocialInstall = () => snapshot;
export function initializeSocialInstall() {
  if (started || typeof window === 'undefined') return;
  started = true;
  // The main app also has a standalone window. Only a launch from Social's
  // manifest or its own appinstalled event confirms this particular install.
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  update({ installed: Boolean(standalone && new URLSearchParams(location.search).get('launch') === 'social') });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); update({ prompt: event, error: '' }); });
  window.addEventListener('appinstalled', () => update({ installed: true, pending: false, prompt: null, error: '' }));
}
export async function installSocial() {
  if (snapshot.pending || snapshot.installed) return;
  const prompt = snapshot.prompt;
  if (!prompt) return 'instructions';
  update({ pending: true, prompt: null, error: '' });
  try {
    const [choice, selected] = await Promise.all([prompt.prompt(), prompt.userChoice]);
    return (selected || choice)?.outcome || 'instructions';
  } catch {
    update({ error: 'The install prompt could not open. Use your browser menu below.' });
    return 'instructions';
  } finally { update({ pending: false }); }
}
export function openSocialInBrowser() {
  // Always use a clean URL: Telegram launch credentials stay in the WebView.
  const url = new URL('/social-app/install', window.location.origin).href;
  const app = window.Telegram?.WebApp;
  try {
    if (app?.initData && app.openLink) { app.openLink(url, { try_instant_view: false }); return; }
  } catch { /* Fall back to a regular browser link. */ }
  window.open(url, '_blank', 'noopener,noreferrer');
}
