import { useEffect, useRef, useState } from 'react';
import { Bell, BellRing, X } from 'lucide-react';
import { API_BASE_URL } from '../../utils/api.js';
import { wallAccountHeaders } from './wallIdentity';
import './wall-notifications.css';
import './wall-social.css';

type Settings = {
  accountId: string;
  publicKey: string;
  telegramAvailable: boolean;
  telegramEnabled: boolean;
  telegramScope?: 'all' | 'following';
};
const endpoint = `${API_BASE_URL}/api/flamingo-wall/notifications`;
export const browserPushSupported = () =>
  window.isSecureContext &&
  'Notification' in window &&
  'PushManager' in window &&
  'serviceWorker' in navigator;
export function applicationKey(value: string) {
  const raw = atob(
    value
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(value.length / 4) * 4, '=')
  );
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}
async function request(path = '', method = 'GET', body?: unknown) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${endpoint}${path}`, {
      method,
      cache: 'no-store',
      headers: wallAccountHeaders({ 'Content-Type': 'application/json' }),
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.error || 'Notification settings could not be saved.'
      );
    return result;
  } finally {
    window.clearTimeout(timer);
  }
}
async function activeRegistration() {
  const registration = await navigator.serviceWorker.getRegistration(window.location.href);
  if (registration?.active) return registration;
  throw new Error('The app is still getting ready. Reload and try again.');
}
export default function WallNotifications() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>();
  const [browserEnabled, setBrowserEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [scope, setScope] = useState<'all' | 'following'>('all');
  const fromFollow = useRef(false);
  useEffect(() => {
    const show = () => {
      fromFollow.current = true;
      setScope('following');
      setOpen(true);
    };
    window.addEventListener('wall-notifications-open', show);
    return () => window.removeEventListener('wall-notifications-open', show);
  }, []);
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const supported = browserPushSupported();
  useEffect(() => {
    if (!open) return;
    let active = true;
    setNotice('');
    setSettings(undefined);
    setBrowserEnabled(false);
    setBusy(true);
    void (async () => {
      try {
        const next = await request();
        if (!active) return;
        setSettings(next);
        setScope(
          next.telegramEnabled
            ? next.telegramScope || 'all'
            : fromFollow.current
              ? 'following'
              : 'all'
        );
        if (supported && Notification.permission === 'granted') {
          const registration =
            await navigator.serviceWorker.getRegistration(window.location.href);
          const subscription =
            await registration?.pushManager.getSubscription();
          if (subscription) {
            const status = await request('/browser/status', 'POST', {
              endpoint: subscription.endpoint
            });
            if (active) {
              setBrowserEnabled(status.enabled);
              if (status.enabled) setScope(status.scope || 'all');
            }
          }
        }
      } catch (error) {
        if (active)
          setNotice(
            error instanceof Error
              ? error.message
              : 'Could not load notification settings.'
          );
      } finally {
        if (active) setBusy(false);
      }
    })();
    panel.current
      ?.querySelector<HTMLButtonElement>('[aria-label="Close notifications"]')
      ?.focus();
    const outside = (event: PointerEvent) => {
      if (
        !panel.current?.contains(event.target as Node) &&
        !button.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => {
      active = false;
      document.removeEventListener('pointerdown', outside);
    };
  }, [open, supported]);
  const toggleTelegram = async () => {
    if (!settings || busy) return;
    setBusy(true);
    setNotice('');
    try {
      const result = await request('/telegram', 'PUT', {
        enabled: !settings.telegramEnabled,
        scope
      });
      setSettings({ ...settings, telegramEnabled: result.enabled });
      setNotice(
        result.enabled
          ? 'Telegram notifications are on. Make sure you have started the TonPlayGram bot.'
          : 'Telegram notifications are off.'
      );
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const toggleBrowser = async () => {
    if (!settings || busy || !supported) return;
    setBusy(true);
    setNotice('');
    // Ask directly inside the tap handler: Safari requires a user gesture.
    let newSubscription: PushSubscription | undefined;
    try {
      const granted = await (browserEnabled
        ? Promise.resolve(Notification.permission)
        : Notification.requestPermission());
      if (!browserEnabled && granted !== 'granted')
        throw new Error(
          'Notifications are blocked. Allow them in your browser’s site settings to enable alerts.'
        );
      const registration = await activeRegistration();
      let subscription = await registration.pushManager.getSubscription();
      if (!browserEnabled && !subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationKey(settings.publicKey)
        });
        newSubscription = subscription;
      }
      if (subscription) {
        await request('/browser', 'PUT', {
          enabled: !browserEnabled,
          scope,
          subscription: subscription.toJSON()
        });
        if (browserEnabled) await subscription.unsubscribe().catch(() => false);
      }
      setBrowserEnabled(!browserEnabled);
      setNotice(
        browserEnabled
          ? 'Browser notifications are off.'
          : 'Browser notifications are on for new videos and posts.'
      );
    } catch (error) {
      if (newSubscription)
        await newSubscription.unsubscribe().catch(() => false);
      setNotice(
        (error as Error).message ||
          'This browser could not enable notifications.'
      );
    } finally {
      setBusy(false);
    }
  };
  const enabled = browserEnabled || settings?.telegramEnabled;
  return (
    <div
      className="wall-notifications"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        aria-label="Wall notifications"
        aria-expanded={open}
        aria-controls="wall-notification-settings"
        onClick={() => {
          fromFollow.current = false;
          setOpen((value) => !value);
        }}
      >
        {enabled ? <BellRing /> : <Bell />}
      </button>
      {open && (
        <div
          ref={panel}
          className="wall-notification-panel"
          id="wall-notification-settings"
          role="dialog"
          aria-label="Wall notifications"
          aria-busy={busy}
        >
          <div className="wall-notification-title">
            <strong>Wall notifications</strong>
            <button
              type="button"
              aria-label="Close notifications"
              onClick={() => {
                setOpen(false);
                button.current?.focus();
              }}
            >
              <X />
            </button>
          </div>
          <p>
            Get notified when someone shares a new video or post. You can turn
            these off anytime.
          </p>
          {settings && (
            <label className="wall-alert-scope">
              Notify me about
              <select
                aria-label="Whose posts to notify"
                value={scope}
                disabled={busy}
                onChange={async (event) => {
                  const next = event.target.value as 'all' | 'following';
                  if (!enabled) {
                    setScope(next);
                    return;
                  }
                  setBusy(true);
                  try {
                    await request('/scope', 'PUT', { scope: next });
                    setScope(next);
                    setNotice('Notification choices saved.');
                  } catch (error) {
                    setNotice((error as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <option value="all">All wall posts</option>
                <option value="following">
                  Creators I follow · Every post enabled
                </option>
              </select>
            </label>
          )}
          {fromFollow.current && (
            <p>
              Your creator choice is saved. Enable a channel below to receive
              alerts. Creators set to “No notifications” stay muted.
            </p>
          )}
          {settings?.telegramAvailable && (
            <button
              type="button"
              role="switch"
              aria-checked={settings.telegramEnabled}
              disabled={busy}
              onClick={() => void toggleTelegram()}
              className="wall-notification-choice"
            >
              <span>
                Telegram<small>Messages from the TonPlayGram bot</small>
              </span>
              <b>{settings.telegramEnabled ? 'On' : 'Off'}</b>
            </button>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={browserEnabled}
            disabled={busy || !settings || !supported}
            onClick={() => void toggleBrowser()}
            className="wall-notification-choice"
          >
            <span>
              This browser<small>Alerts for new videos and posts</small>
            </span>
            <b>{browserEnabled ? 'On' : 'Off'}</b>
          </button>
          {!supported && (
            <p>
              Open TonPlayGram in a browser that supports notifications. On
              iPhone or iPad, add it to your Home Screen and open it there.
            </p>
          )}
          {busy && <p role="status">Updating notification settings…</p>}
          {notice && <p role="status">{notice}</p>}
        </div>
      )}
    </div>
  );
}
