import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { creatorReturnPath } from '../../../../shared/socialApp.js';
import { creatorApi, openCreatorAuthorization, Platform } from './api';

const officialHosts: Record<string, string> = {
  youtube: 'accounts.google.com', facebook: 'www.facebook.com',
  instagram: 'www.instagram.com', tiktok: 'www.tiktok.com'
};
export function checkedAuthorizationUrl(value: unknown, platform: string) {
  try {
    if (typeof value !== 'string') throw new Error();
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== officialHosts[platform] || url.username || url.password || url.port) throw new Error();
    return url.href;
  } catch { throw new Error('The sign-in link could not be verified. Please try Connect again.'); }
}

export default function ConnectAccountButton({ platform, reconnect, disabled, active, onBusyChange }: {
  platform: Platform; reconnect: boolean; disabled: boolean; active: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string; url?: string } | null>(null);
  const request = useRef<AbortController | null>(null);
  const busyCallback = useRef(onBusyChange);
  busyCallback.current = onBusyChange;
  useEffect(() => {
    if (!active) { setPending(false); setFeedback(null); }
    return () => {
      if (request.current) {
        const controller = request.current;
        request.current = null;
        controller.abort();
        busyCallback.current(false);
      }
    };
  }, [active]);

  async function connect() {
    if (disabled || !active || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true); busyCallback.current(true);
    setFeedback({ error: false, text: `Checking ${platform.name} and opening official sign-in…` });
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      // Always ask the server again: a cached catalog must not make taps inert.
      const result = await creatorApi(`/accounts/${platform.id}/connect`, 'POST', { returnTo: creatorReturnPath(location.pathname) }, {}, controller.signal);
      if (request.current !== controller) return;
      if (controller.signal.aborted) throw new DOMException('Timed out', 'AbortError');
      const url = checkedAuthorizationUrl(result.url, platform.id);
      setFeedback({ error: false, text: `Opening ${platform.name}. If you stay here, tap Continue below.`, url });
      try { openCreatorAuthorization(url); }
      catch { setFeedback({ error: false, text: 'Your browser stopped automatic navigation. Tap Continue below.', url }); }
    } catch (error: any) {
      if (request.current !== controller) return;
      setFeedback({ error: true, text: controller.signal.aborted
        ? 'The connection check timed out. Check your internet connection and tap Connect to retry.'
        : error instanceof TypeError ? 'Could not reach TonPlayGram. Check your connection and try again.'
        : error.message || 'This connection could not start. Please try again.' });
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) { request.current = null; setPending(false); busyCallback.current(false); }
    }
  }

  const statusId = `cs-connect-${platform.id}-status`;
  return <div className="cs-connect-action">
    <button type="button" className="cs-secondary" disabled={disabled || pending || !active} aria-busy={pending} aria-describedby={feedback ? statusId : undefined} onClick={connect}>
      {pending && <Loader2 className="cs-spin" size={17} />}
      {pending ? `Opening ${platform.name}…` : `${reconnect ? 'Reconnect' : 'Connect'} ${platform.name}`}<ArrowUpRight size={17} />
    </button>
    {feedback && <div id={statusId} className={`cs-connect-feedback${feedback.error ? ' cs-connect-feedback-error' : ''}`} role={feedback.error ? 'alert' : 'status'}>
      <p>{feedback.text}</p>
      {feedback.url && <a className="cs-secondary" href={feedback.url}>Continue to {platform.name}<ArrowUpRight size={17} /></a>}
    </div>}
  </div>;
}
