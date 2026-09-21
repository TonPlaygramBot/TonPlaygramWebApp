import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, Plus, X } from 'lucide-react';
import { saveFollowing, useWallFollowing } from './wallFollowing';
import './wall-social.css';

export default function WallFollowButton({
  accountId,
  name,
  compact = false
}: {
  accountId?: string;
  name: string;
  compact?: boolean;
}) {
  const state = useWallFollowing();
  const followed = state.following.find(
    (row) => row.authorAccountId === accountId
  );
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  if (!accountId || accountId === state.accountId) return null;
  async function save(following: boolean, notify: boolean) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await saveFollowing(accountId!, following, notify);
      setOpen(false);
      trigger.current?.focus();
      if (following && notify)
        window.dispatchEvent(new Event('wall-notifications-open'));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`wall-follow-button ${compact ? 'is-compact' : ''}`}
        aria-label={`${followed ? 'Following' : 'Follow'} ${name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setError('');
          setOpen(true);
        }}
      >
        {followed ? followed.notify ? <Bell /> : <Check /> : <Plus />}
        {!compact && (followed ? 'Following' : 'Follow')}
      </button>
      {open &&
        createPortal(
          <div
            className="wall-social-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget && !busy) setOpen(false);
            }}
          >
            <div
              ref={panel}
              className="wall-social-dialog"
              role="dialog"
              aria-modal="true"
              aria-label={`Follow ${name}`}
              aria-busy={busy}
            >
              <div className="wall-social-dialog-title">
                <strong>{name}</strong>
                <button
                  type="button"
                  aria-label="Close follow options"
                  onClick={() => setOpen(false)}
                >
                  <X />
                </button>
              </div>
              <p>
                {followed
                  ? 'Choose notifications for this creator.'
                  : 'Follow this creator and choose when to hear from them.'}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void save(true, true)}
              >
                <Bell /> Every post {followed?.notify && <Check />}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void save(true, false)}
              >
                <Check /> Follow · No notifications{' '}
                {followed && !followed.notify && <Check />}
              </button>
              {followed && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save(false, false)}
                >
                  Unfollow
                </button>
              )}
              <small>
                “Every post” uses the Telegram or browser alerts you enable
                next.
              </small>
              {error && <p role="alert">{error}</p>}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
