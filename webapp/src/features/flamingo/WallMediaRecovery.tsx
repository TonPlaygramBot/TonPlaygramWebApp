import { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { uploadWallFile } from './wallUpload.js';

type Props = {
  apiBase: string;
  postId: string;
  file: { name: string; size: number; type: string };
  canManage?: boolean;
  headers: () => Record<string, string>;
  onRetry: () => void;
  onRestored: (post: any) => void;
};

export default function WallMediaRecovery({
  apiBase,
  postId,
  file,
  canManage,
  headers,
  onRetry,
  onRestored
}: Props) {
  const [status, setStatus] = useState<
    'checking' | 'missing' | 'playback' | 'unavailable'
  >('checking');
  const [mayRestore, setMayRestore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const upload = useRef<AbortController>();
  const selected = useRef<{ file: File; id: string }>();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (mounted.current) setStatus('unavailable');
      controller.abort();
    }, 10000);
    fetch(`${apiBase}/api/flamingo-wall/posts/${postId}/media-status`, {
      headers: headers(),
      cache: 'no-store',
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unavailable');
        const payload = await response.json();
        if (!mounted.current) return;
        setStatus(
          payload.available
            ? 'playback'
            : payload.code === 'WALL_MEDIA_MISSING'
              ? 'missing'
              : 'unavailable'
        );
        setMayRestore(Boolean(payload.canRestore));
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('unavailable');
      })
      .finally(() => clearTimeout(timer));
    return () => {
      mounted.current = false;
      clearTimeout(timer);
      controller.abort();
      upload.current?.abort();
    };
  }, [apiBase, postId, headers]);

  async function restore(original?: File) {
    if (busy) return;
    setError('');
    if (original) {
      if (original.size !== file.size)
        return setError(
          `Choose the original ${file.name}; its file size must match.`
        );
      const id =
        globalThis.crypto?.randomUUID?.() ||
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const n = Math.floor(Math.random() * 16);
          return (c === 'x' ? n : (n & 3) | 8).toString(16);
        });
      selected.current = { file: original, id };
    }
    const selection = selected.current;
    if (!selection) return;
    const controller = new AbortController();
    upload.current = controller;
    setBusy(true);
    try {
      const result = await uploadWallFile({
        baseUrl: apiBase,
        headers: headers(),
        file: selection.file,
        uploadId: selection.id,
        restorePostId: postId,
        text: '',
        title: '',
        signal: controller.signal,
        onProgress: (bytes: number) =>
          setProgress(Math.min(100, Math.floor((bytes / file.size) * 100)))
      });
      if (result.post?._id !== postId)
        throw new Error('Restoration was not confirmed. Please retry.');
      if (mounted.current) onRestored(result.post);
    } catch (failure: any) {
      if (mounted.current)
        setError(
          failure.name === 'AbortError'
            ? 'Restoration paused. Keep this page open to resume.'
            : failure.message || 'Restoration failed. Please retry.'
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <div className="wall-media-error" role="status">
      <AlertCircle />
      <strong>
        {status === 'checking'
          ? 'Checking media…'
          : status === 'missing'
            ? 'Original media is missing'
            : status === 'playback'
              ? 'Media could not play'
              : 'Media is temporarily unavailable'}
      </strong>
      <span>
        {status === 'missing'
          ? 'Your post is saved, but the original file is no longer available on the server.'
          : status === 'playback'
            ? 'The file is available. Try loading it again in this browser.'
            : 'Try again in a moment.'}
      </span>
      {status === 'missing' && canManage && mayRestore && (
        <>
          <span className="wall-restore-file">
            Restore {file.name} into this post. Your caption and reactions stay
            here.
          </span>
          <input
            ref={input}
            type="file"
            accept={
              file.type.startsWith('video/')
                ? 'video/*'
                : file.type.startsWith('image/')
                  ? 'image/*'
                  : undefined
            }
            hidden
            aria-label="Choose original media"
            onChange={(event) => {
              const original = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (original) void restore(original);
            }}
          />
          {busy ? (
            <>
              <span aria-live="polite">Restoring media… {progress}%</span>
              <button type="button" onClick={() => upload.current?.abort()}>
                Pause restoration
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() =>
                selected.current ? void restore() : input.current?.click()
              }
            >
              {selected.current
                ? 'Resume restoration'
                : file.type.startsWith('video/')
                  ? 'Restore video'
                  : 'Restore original'}
            </button>
          )}
        </>
      )}
      {error && <span role="alert">{error}</span>}
      {!busy && (
        <button type="button" onClick={onRetry}>
          Retry media
        </button>
      )}
    </div>
  );
}
