import { beforeEach, afterEach, expect, it, vi } from 'vitest';
let installedListeners, install;
beforeEach(async () => {
  vi.resetModules();
  history.replaceState({}, '', '/social-app/');
  installedListeners = vi.spyOn(window, 'addEventListener');
  install = await import('./install');
});
afterEach(() => {
  for (const [event, listener] of installedListeners.mock.calls) window.removeEventListener(event, listener);
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});
it('retains an early browser install event and consumes it only once', async () => {
  install.initializeSocialInstall();
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = vi.fn(async () => undefined);
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(await install.installSocial()).toBe('accepted');
  expect(install.getSocialInstall().installed).toBe(false);
  await install.installSocial();
  expect(event.prompt).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event('appinstalled'));
  expect(install.getSocialInstall().installed).toBe(true);
});
it('does not mistake the main standalone app for an installed Social app', () => {
  window.matchMedia = vi.fn(() => ({ matches: true }));
  install.initializeSocialInstall();
  expect(install.getSocialInstall().installed).toBe(false);
});
it('recognizes a standalone Social manifest launch', () => {
  window.matchMedia = vi.fn(() => ({ matches: true }));
  history.replaceState({}, '', '/social-app/?launch=social');
  install.initializeSocialInstall();
  expect(install.getSocialInstall().installed).toBe(true);
});
it('offers manual instructions if there is no install event', async () => {
  install.initializeSocialInstall();
  expect(await install.installSocial()).toBe('instructions');
  expect(install.getSocialInstall().installed).toBe(false);
});
it('reports a failed prompt and allows browser-menu installation', async () => {
  install.initializeSocialInstall();
  const event = new Event('beforeinstallprompt');
  event.prompt = () => Promise.reject(new Error('Blocked'));
  event.userChoice = Promise.resolve();
  window.dispatchEvent(event);
  expect(await install.installSocial()).toBe('instructions');
  expect(install.getSocialInstall()).toMatchObject({ pending: false, prompt: null });
  expect(install.getSocialInstall().error).toContain('browser menu');
});
it('opens the Social installation page without Telegram credentials or the main app shortcut', () => {
  const openLink = vi.fn(), addToHomeScreen = vi.fn();
  window.Telegram = { WebApp: { initData: 'private', openLink, addToHomeScreen } };
  history.replaceState({}, '', '/social-app/install?tgWebAppData=private#tgWebAppVersion=8');
  install.openSocialInBrowser();
  expect(openLink).toHaveBeenCalledWith('https://tonplaygram-bot.onrender.com/social-app/install', { try_instant_view: false });
  expect(addToHomeScreen).not.toHaveBeenCalled();
  delete window.Telegram;
});
