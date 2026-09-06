import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, CloudDownload, Download, ExternalLink, RefreshCw, Smartphone } from 'lucide-react';
import usePwaInstallPrompt from '../hooks/usePwaInstallPrompt.js';
import { cacheOfflineAssets } from '../pwa/offlineCache.js';
import { applyWaitingWebUpdate, checkForWebUpdate, fetchAndroidRelease } from '../pwa/installSupport.js';
import './PwaDownloadFrame.css';

const initialProgress = { completed: 0, total: 0, successes: 0, failures: 0 };

export default function PwaDownloadFrame() {
  const pwa = usePwaInstallPrompt();
  const [release, setRelease] = useState(null);
  const [releaseState, setReleaseState] = useState('loading');
  const [retry, setRetry] = useState(0);
  const [instructions, setInstructions] = useState(false);
  const [installMessage, setInstallMessage] = useState('');
  const [cacheState, setCacheState] = useState('idle');
  const [progress, setProgress] = useState(initialProgress);
  const [cacheError, setCacheError] = useState('');
  const [updateState, setUpdateState] = useState('idle');
  const [updateMessage, setUpdateMessage] = useState('');
  const cacheController = useRef(null);
  const registration = useRef(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cacheController.current?.abort(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setReleaseState('loading');
    fetchAndroidRelease({ signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted) return;
        setRelease(result);
        setReleaseState(result ? 'available' : 'unavailable');
      })
      .catch(() => {
        if (!controller.signal.aborted) setReleaseState('error');
      });
    return () => controller.abort();
  }, [retry]);

  const handleInstall = async () => {
    if (pwa.inTelegram) { pwa.openExternalInstall(); setInstructions(true); return; }
    if (!pwa.canInstall) { setInstructions(value => !value); return; }
    const accepted = await pwa.promptToInstall();
    if (mounted.current) {
      setInstallMessage(accepted ? 'Installation requested. Follow your browser’s confirmation.' : 'Installation was not completed. You can try again from the browser menu.');
    }
  };

  const handleDownload = event => {
    if (pwa.inTelegram && window.Telegram?.WebApp?.openLink) {
      try {
        window.Telegram.WebApp.openLink(release.url, { try_instant_view: false });
        event.preventDefault();
      } catch { /* Keep the normal HTTPS link as the fallback. */ }
    }
  };

  const handleCache = async () => {
    if (cacheController.current) return;
    const controller = new AbortController();
    cacheController.current = controller;
    setCacheState('loading'); setCacheError(''); setProgress(initialProgress);
    try {
      const result = await cacheOfflineAssets({
        baseUrl: import.meta.env?.BASE_URL || '/', signal: controller.signal,
        onUpdate: next => { if (mounted.current) setProgress(next); }
      });
      if (mounted.current) {
        setProgress(result);
        setCacheState(result.failures ? 'partial' : 'success');
      }
    } catch (error) {
      if (mounted.current) {
        setCacheState(error.name === 'AbortError' ? 'cancelled' : 'error');
        setCacheError(error.name === 'AbortError' ? 'Caching stopped. Already saved files can be reused when you retry.' : error.message);
      }
    } finally { cacheController.current = null; }
  };

  const handleUpdate = async () => {
    if (updateState === 'loading') return;
    setUpdateState('loading'); setUpdateMessage('');
    try {
      if (registration.current?.waiting) {
        await applyWaitingWebUpdate(registration.current);
      } else {
        registration.current = await checkForWebUpdate();
      }
      if (!mounted.current) return;
      const ready = Boolean(registration.current?.waiting);
      setUpdateState(ready ? 'ready' : 'idle');
      setUpdateMessage(ready ? 'Update ready. Apply it when you have finished playing.' : 'No waiting web-app update was found.');
    } catch (error) {
      if (mounted.current) { setUpdateState('error'); setUpdateMessage(error.message); }
    }
  };

  const percent = progress.total ? Math.round(progress.completed / progress.total * 100) : 0;
  const androidAllowed = pwa.platform !== 'ios';
  const installLabel = pwa.installed ? 'Web app installed' : pwa.installing ? 'Opening install prompt…' : pwa.inTelegram ? 'Open in browser to install' : pwa.canInstall ? 'Install web app' : 'How to install the web app';

  return (
    <section className="tpg-install" aria-labelledby="tpg-install-title">
      <header className="tpg-install__header">
        <span className="tpg-install__icon" aria-hidden="true"><Smartphone size={25} /></span>
        <div><span className="tpg-install__eyebrow">TAKE TONPLAYGRAM WITH YOU</span><h3 id="tpg-install-title">Get TonPlaygram</h3></div>
      </header>
      <p className="tpg-install__intro">Your games, account and wallet. One app on your phone.</p>

      <div className="tpg-install__android">
        <div className="tpg-install__row"><strong>Android app</strong><span className="tpg-install__badge">{pwa.native ? 'INSTALLED' : 'APK'}</span></div>
        <p>{pwa.native ? 'You are using the installed TonPlaygram app.' : 'Download and install TonPlaygram on your Android phone.'}</p>
        {releaseState === 'available' && androidAllowed ? (
          <a className="tpg-install__primary" href={release.url} onClick={handleDownload} rel="noopener noreferrer" target="_blank">
            <Download size={19} aria-hidden="true" />{pwa.native ? 'Download latest APK' : 'Download Android APK'}<ChevronRight size={18} aria-hidden="true" />
          </a>
        ) : (
          <button className="tpg-install__primary" type="button" disabled>
            <Download size={19} aria-hidden="true" />{!androidAllowed ? 'APK is for Android only' : releaseState === 'loading' ? 'Checking APK availability…' : releaseState === 'error' ? 'APK check unavailable' : 'APK not published yet'}
          </button>
        )}
        <div className="tpg-install__meta" aria-live="polite">
          {releaseState === 'available' ? <><span>v{release.version} · {(release.size / 1024 / 1024).toFixed(1)} MB</span><a href={release.checksumUrl} target="_blank" rel="noopener noreferrer">SHA-256</a></> :
            <span>{releaseState === 'error' ? 'Could not check the release. Check your connection.' : releaseState === 'unavailable' ? 'The download will appear after the Android release is published.' : 'Checking the official release…'}</span>}
        </div>
        {['error', 'unavailable'].includes(releaseState) && <button type="button" className="tpg-install__text-button" onClick={() => setRetry(value => value + 1)}>Check again</button>}
        {release && androidAllowed && <details className="tpg-install__help"><summary>How to install the APK</summary><p>Download the file, open it and follow Android’s installation prompts. Allow installation from your browser only when you trust the downloaded release. Never disable Play Protect.</p></details>}
      </div>

      {!pwa.native && <div className="tpg-install__web">
        <div className="tpg-install__row"><strong>Prefer the web app?</strong><span className="tpg-install__badge tpg-install__badge--muted">PWA</span></div>
        <p>Add TonPlaygram to your home screen from a supported browser.</p>
        <button type="button" className="tpg-install__secondary" onClick={handleInstall} disabled={pwa.installed || pwa.installing} aria-expanded={instructions}>
          {pwa.installed ? <Check size={18} aria-hidden="true" /> : <ExternalLink size={18} aria-hidden="true" />}{installLabel}
        </button>
        {instructions && <p className="tpg-install__notice">{pwa.inTelegram ? 'Open this page in your regular browser, then use its Install app or Add to Home Screen option. Installation may not be available inside Telegram.' : pwa.platform === 'ios' ? 'Open TonPlaygram in Safari. Use Share, then Add to Home Screen. Turn on Open as Web App when offered.' : 'Open your browser menu and look for Install app or Add to Home Screen. The option depends on your browser and whether the app is already installed.'}</p>}
        {(installMessage || pwa.error) && <p className="tpg-install__notice" role="status">{pwa.error || installMessage}</p>}
      </div>}

      {!pwa.native && <details className="tpg-install__cache">
        <summary><CloudDownload size={17} aria-hidden="true" /><span>Cache &amp; web-app updates</span><ChevronRight size={17} aria-hidden="true" /></summary>
        <p>Optionally save public game files for faster loading. This uses browser storage and is not an app installation. Large games may use substantial data; use Wi-Fi.</p>
        <div className="tpg-install__actions">
          <button type="button" className="tpg-install__secondary" onClick={handleCache} disabled={cacheState === 'loading'}>{cacheState === 'loading' ? `Processing ${percent}%` : cacheState === 'partial' ? 'Retry missing files' : 'Cache game files'}</button>
          {cacheState === 'loading' && <button type="button" className="tpg-install__text-button" onClick={() => cacheController.current?.abort()}>Cancel</button>}
        </div>
        {progress.total > 0 && <><progress max={progress.total} value={progress.completed} aria-label="Game files processed" /><p className="tpg-install__notice" role="status">{progress.successes} of {progress.total} files cached{progress.failures ? ` · ${progress.failures} unavailable` : ''}.{cacheState === 'success' ? ' Listed files saved; this does not guarantee every game works offline.' : ''}</p></>}
        {cacheError && <p className="tpg-install__error" role="alert">{cacheError}</p>}
        <button type="button" className="tpg-install__text-button" disabled={updateState === 'loading' || cacheState === 'loading'} onClick={handleUpdate}><RefreshCw size={15} aria-hidden="true" />{updateState === 'loading' ? 'Checking…' : registration.current?.waiting ? 'Apply update & reload' : 'Check for web-app updates'}</button>
        {updateMessage && <p className="tpg-install__notice" role="status">{updateMessage}</p>}
      </details>}
      <p className="tpg-install__footer">Online games, account services and wallet transactions still need internet.</p>
    </section>
  );
}
