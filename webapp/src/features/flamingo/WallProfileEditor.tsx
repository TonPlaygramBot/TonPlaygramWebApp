import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { socialRequest } from './wallFollowing';
import './wall-social.css';

// Resize camera images before sending. The server validates and re-encodes too.
export async function profilePhoto(file: File): Promise<string> {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 20 * 1024 ** 2
  )
    throw new Error('Choose a JPG, PNG or WebP photo up to 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error('This photo could not be opened.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error('Photo editing is unavailable in this browser.');
    const edge = Math.min(image.naturalWidth, image.naturalHeight);
    context.drawImage(
      image,
      (image.naturalWidth - edge) / 2,
      (image.naturalHeight - edge) / 2,
      edge,
      edge,
      0,
      0,
      512,
      512
    );
    return canvas.toDataURL('image/jpeg', 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}
export default function WallProfileEditor({
  name,
  onSaved
}: {
  name: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const [photo, setPhoto] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const generation = useRef(0);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLInputElement>('input')?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        generation.current++;
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open, busy]);
  return (
    <>
      <button
        ref={trigger}
        className="wall-profile-edit-button"
        onClick={() => {
          setValue(name);
          setPhoto(undefined);
          setError('');
          setOpen(true);
        }}
      >
        Edit profile
      </button>
      {open &&
        createPortal(
          <div className="wall-social-overlay">
            <div
              ref={panel}
              className="wall-social-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Edit profile"
            >
              <div className="wall-social-dialog-title">
                <strong>Edit profile</strong>
                <button
                  type="button"
                  disabled={busy}
                  aria-label="Close profile editor"
                  onClick={() => {
                    generation.current++;
                    setOpen(false);
                    trigger.current?.focus();
                  }}
                >
                  <X />
                </button>
              </div>
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (busy) return;
                  setBusy(true);
                  setError('');
                  try {
                    await socialRequest('/profile', 'PATCH', {
                      name: value,
                      ...(photo ? { photo } : {})
                    });
                    window.dispatchEvent(new Event('profilePhotoUpdated'));
                    window.dispatchEvent(new Event('accountUpdated'));
                    onSaved();
                    setOpen(false);
                    trigger.current?.focus();
                  } catch (error) {
                    setError((error as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Username
                  <input
                    aria-label="Profile username"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    minLength={2}
                    maxLength={40}
                    required
                    disabled={busy}
                  />
                </label>
                <label>
                  Profile photo
                  <input
                    aria-label="Profile photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const version = ++generation.current;
                      setBusy(true);
                      setError('');
                      try {
                        const next = await profilePhoto(file);
                        if (version === generation.current) setPhoto(next);
                      } catch (error) {
                        if (version === generation.current)
                          setError((error as Error).message);
                      } finally {
                        if (version === generation.current) setBusy(false);
                      }
                    }}
                  />
                </label>
                {photo && (
                  <img
                    className="wall-profile-preview"
                    src={photo}
                    alt="New profile photo"
                  />
                )}
                {error && <p role="alert">{error}</p>}
                <button type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Save profile'}
                </button>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
