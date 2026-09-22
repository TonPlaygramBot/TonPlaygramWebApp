import React, { useEffect, useRef, useState } from 'react';
import { creatorApi } from './api';

export default function GoogleStudioSignIn({ onAuthenticated, onError }: { onAuthenticated: (user: any) => Promise<void>; onError: (message: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onAuthenticated, onError });
  callbacks.current = { onAuthenticated, onError };
  const [attempt, setAttempt] = useState(0), [state, setState] = useState<'loading' | 'ready' | 'verifying' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false, timer: ReturnType<typeof setInterval> | undefined;
    const target = container.current;
    setState('loading');
    if (target) target.replaceChildren();
    const fail = (message: string) => {
      if (cancelled) return;
      if (timer) clearInterval(timer);
      setState('error'); callbacks.current.onError(message);
    };
    (async () => {
      try {
        const { clientId, nonce } = await creatorApi('/login/google/identity', 'POST', {});
        if (cancelled) return;
        if (!clientId || !nonce) throw new Error('Google sign-in is temporarily unavailable. Please try again.');
        const deadline = Date.now() + 15000;
        const initialize = () => {
          if (cancelled) return;
          const google = (window as any).google?.accounts?.id;
          if (!google) {
            if (Date.now() >= deadline) fail('Google could not load. Check your connection or open Studio in Chrome or Safari.');
            return;
          }
          if (timer) clearInterval(timer);
          try {
            google.initialize({
              client_id: clientId, nonce, ux_mode: 'popup', auto_select: false,
              callback: async (result: { credential?: string }) => {
                if (cancelled) return;
                setState('verifying');
                try {
                  const user = await creatorApi('/session/google', 'POST', { credential: result.credential });
                  if (!cancelled) await callbacks.current.onAuthenticated(user);
                } catch (error: any) { fail(error.message || 'Google sign-in failed. Please try again.'); }
              }
            });
            // Use Google's actual button; a One Tap prompt can be suppressed by
            // browser settings even when a user explicitly requests sign-in.
            google.renderButton(target, { type: 'standard', theme: 'filled_blue', size: 'large', text: 'continue_with', shape: 'pill', width: Math.min(360, target?.clientWidth || 280) });
            setState('ready');
          } catch { fail('Google could not open sign-in. Please retry in your browser.'); }
        };
        timer = setInterval(initialize, 250); initialize();
      } catch (error: any) { fail(error.message || 'Google sign-in is temporarily unavailable.'); }
    })();
    return () => { cancelled = true; if (timer) clearInterval(timer); if (target) target.replaceChildren(); };
  }, [attempt]);

  return <div className="cs-google-signin">
    <div ref={container} className="cs-google-button" hidden={state === 'error' || state === 'verifying'} />
    {state === 'loading' && <p role="status">Loading Google sign-in…</p>}
    {state === 'verifying' && <p role="status">Verifying your Google account…</p>}
    {state === 'error' && <button className="cs-secondary" onClick={() => setAttempt(value => value + 1)}>Retry Google sign-in</button>}
  </div>;
}
