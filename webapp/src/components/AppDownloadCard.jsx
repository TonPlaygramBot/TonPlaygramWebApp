import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, Smartphone } from 'lucide-react';
import usePwaInstallPrompt from '../hooks/usePwaInstallPrompt.js';
import { getAppDownloadLinks } from '../utils/appDownloads.mjs';

const links = getAppDownloadLinks(import.meta.env);
const actionClass = 'flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-center text-base font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300';

export default function AppDownloadCard() {
  const { canInstall, installed, promptToInstall, openExternalInstall } = usePwaInstallPrompt();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const native = Capacitor.isNativePlatform();
  const inTelegram = Boolean(window.Telegram?.WebApp?.initData);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const install = async () => {
    if (!canInstall) {
      setMessage(ios
        ? 'Open this page in Safari. Choose Share, then Add to Home Screen, then Add.'
        : 'Open your browser menu and choose Install app or Add to Home screen. On a computer, use the install icon in the address bar when available.');
      return;
    }
    setBusy(true);
    try {
      const accepted = await promptToInstall();
      setMessage(accepted ? 'Follow your device’s installation instructions.' : 'Installation cancelled. You can try again from your browser menu.');
    } catch {
      setMessage('Open your browser menu and choose Install app or Add to Home Screen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="download-app" aria-labelledby="download-app-title"
      className="rounded-3xl border border-sky-400/30 bg-gradient-to-br from-[#14273f] to-[#0b1224] p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <Smartphone aria-hidden="true" className="h-8 w-8 shrink-0 text-sky-300" />
        <div>
          <h2 id="download-app-title" className="text-xl font-bold text-white">Get TonPlaygram</h2>
          <p className="text-sm text-slate-300">Games, community and your account in one app.</p>
        </div>
      </div>
      {native ? <p className="text-base text-sky-200">You’re using the TonPlaygram app.</p> : (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {links.android && <a className={actionClass} href={links.android} target="_blank" rel="noopener noreferrer"><Download aria-hidden="true" size={20} />Download Android APK</a>}
            {links.ios && <a className={actionClass} href={links.ios} target="_blank" rel="noopener noreferrer">Download for iPhone / iPad</a>}
            {installed
              ? <p className="p-3 text-base text-sky-200">Installed on this device</p>
              : <button type="button" className={actionClass} disabled={busy} onClick={inTelegram ? openExternalInstall : install}>
                  {busy ? 'Opening installer…' : inTelegram ? 'Open in browser to install' : canInstall ? 'Install on this device' : ios ? 'Install on iPhone / iPad' : 'Install browser app'}
                </button>}
          </div>
          {!links.android && <p className="mt-3 text-sm text-slate-300">Android APK download is not available yet. You can install the browser app now.</p>}
          <p className="mt-3 text-sm text-slate-300">Launch from your home screen. Online features require an internet connection.</p>
          {message && <p role="status" className="mt-3 rounded-xl bg-white/10 p-3 text-base text-white">{message}</p>}
        </>
      )}
    </section>
  );
}
