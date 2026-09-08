import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Download, MoreVertical, X } from 'lucide-react';
import './wall-video.css';

export type VideoFile = {
  src: string;
  name: string;
  size: number;
  type: string;
  duration?: number;
  premium?: boolean;
  priceTpg?: number;
};
export type VideoQuality = {
  quality: string;
  label: string;
  status: string;
  url?: string;
  size?: number;
  name?: string;
  type?: string;
  width?: number;
  height?: number;
  error?: string;
};
type QualityManifest = {
  qualities: VideoQuality[];
  processing?: boolean;
  error?: string;
};
type VideoProps = {
  file: VideoFile;
  postId: string;
  apiBase: string;
  headers: () => Record<string, string>;
};
const bytes = (size?: number) =>
  size == null
    ? ''
    : size >= 1024 ** 3
      ? `${(size / 1024 ** 3).toFixed(1)} GB`
      : `${(size / 1024 ** 2).toFixed(1)} MB`;
const original = (file: VideoFile): VideoQuality => ({
  quality: 'original',
  label: 'Original',
  status: 'ready',
  url: file.src,
  size: file.size,
  name: file.name,
  type: file.type
});
const absolute = (apiBase: string, url: string) =>
  /^https?:|^blob:/i.test(url) ? url : `${apiBase}${url}`;
let scrollLocks = 0;
let previousOverflow = '';
export function lockWallVideoScroll() {
  if (!scrollLocks++) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  return () => {
    if (!--scrollLocks) document.body.style.overflow = previousOverflow;
  };
}

function useVideoQualities(
  { file, postId, apiBase, headers }: VideoProps,
  enabled: boolean
) {
  const [manifest, setManifest] = useState<QualityManifest>({
    qualities: [original(file)]
  });
  const [error, setError] = useState('');
  const [revision, refresh] = useState(0);
  const headersRef = useRef(headers);
  const requests = useRef(new Set<AbortController>());
  headersRef.current = headers;
  const endpoint = `${apiBase}/api/flamingo-wall/posts/${postId}/video-qualities`;
  const remote = /^[a-f\d]{24}$/i.test(postId) && !file.src.startsWith('blob:');
  useEffect(() => {
    setManifest({ qualities: [original(file)] });
    setError('');
    return () => {
      requests.current.forEach((controller) => controller.abort());
      requests.current.clear();
    };
  }, [postId, file.src]);
  useEffect(() => {
    if (!enabled || !remote) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const response = await fetch(endpoint, {
          headers: headersRef.current(),
          signal: controller.signal
        });
        const next = await response.json();
        if (!response.ok)
          throw new Error(next.error || 'Could not load video resolutions.');
        if (controller.signal.aborted) return;
        setManifest(next);
        setError('');
        if (next.processing) timer = setTimeout(load, 2000);
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : 'Could not load video resolutions.'
          );
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [enabled, endpoint, remote, revision]);
  const prepare = async (quality: string) => {
    const controller = new AbortController();
    requests.current.add(controller);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          ...headersRef.current(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quality })
      });
      const next = await response.json();
      if (!response.ok)
        throw new Error(next.error || 'This resolution could not be prepared.');
      if (!controller.signal.aborted) {
        setManifest(next);
        refresh((value) => value + 1);
      }
    } finally {
      requests.current.delete(controller);
    }
  };
  return {
    ...manifest,
    error: error || manifest.error,
    prepare,
    retry: () => prepare('probe'),
    resolve: (choice: VideoQuality) =>
      choice.quality === 'original' ? file.src : absolute(apiBase, choice.url!)
  };
}

export default function WallVideo(
  props: VideoProps & {
    autoPlay?: boolean;
    loop?: boolean;
    preload?: 'auto' | 'metadata' | 'none';
    onError?: () => void;
    className?: string;
  }
) {
  const {
    file,
    postId,
    autoPlay,
    loop,
    preload = 'metadata',
    onError,
    className = ''
  } = props;
  const video = useRef<HTMLVideoElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<VideoQuality>(() => original(file));
  const [pending, setPending] = useState<string>();
  const [notice, setNotice] = useState('');
  const [speed, setSpeed] = useState(1);
  const resume = useRef<{
    time: number;
    playing: boolean;
    rate: number;
    muted: boolean;
    volume: number;
  }>();
  const qualities = useVideoQualities(props, open || Boolean(pending));
  const choose = (next: VideoQuality) => {
    if (next.quality !== choice.quality && video.current && !resume.current) {
      const current = video.current;
      resume.current = {
        time: current.currentTime,
        playing: !current.paused,
        rate: current.playbackRate,
        muted: current.muted,
        volume: current.volume
      };
    }
    setChoice(next);
    setPending(undefined);
    setNotice('');
    setOpen(false);
    menuButton.current?.focus();
  };
  useEffect(() => {
    setChoice(original(file));
    setPending(undefined);
    resume.current = undefined;
  }, [postId, file.src]);
  useEffect(() => {
    if (!open) return;
    menu.current
      ?.querySelector<HTMLButtonElement>('[role="menuitemradio"]')
      ?.focus();
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => {
    if (!pending) return;
    const ready = qualities.qualities.find((item) => item.quality === pending);
    if (ready?.status === 'ready') choose(ready);
    else if (ready?.status === 'failed') {
      setNotice(ready.error || 'This resolution could not be prepared.');
      setPending(undefined);
    } else if (qualities.error) {
      setNotice(qualities.error);
      setPending(undefined);
    }
  }, [pending, qualities.qualities, qualities.error]);
  const select = async (next: VideoQuality) => {
    if (next.status === 'ready') return choose(next);
    setPending(next.quality);
    setNotice('');
    try {
      await qualities.prepare(next.quality);
    } catch (failure) {
      setPending(undefined);
      setNotice(
        failure instanceof Error
          ? failure.message
          : 'Could not prepare this resolution.'
      );
    }
  };
  return (
    <div className={`wall-video-player ${className}`}>
      <video
        ref={video}
        src={qualities.resolve(choice)}
        controls
        controlsList="nodownload noremoteplayback nofullscreen noplaybackrate"
        disablePictureInPicture
        playsInline
        autoPlay={autoPlay}
        loop={loop}
        preload={preload}
        onRateChange={(event) => setSpeed(event.currentTarget.playbackRate)}
        onLoadedMetadata={() => {
          const current = video.current;
          if (!current || !resume.current) return;
          const saved = resume.current;
          resume.current = undefined;
          current.currentTime = Math.min(
            saved.time,
            Math.max(0, current.duration - 0.05)
          );
          current.playbackRate = saved.rate;
          current.muted = saved.muted;
          current.volume = saved.volume;
          if (saved.playing) void current.play().catch(() => {});
        }}
        onError={() => {
          if (choice.quality !== 'original') {
            setChoice(original(file));
            setNotice(
              'This resolution could not play. Switched back to the original.'
            );
          } else if (onError) onError();
          else setNotice('This video could not be loaded. Try reopening it.');
        }}
      />
      <div
        ref={menu}
        className="wall-video-options"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            setOpen(false);
            menuButton.current?.focus();
          }
          if (
            open &&
            !(event.target instanceof HTMLSelectElement) &&
            ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
          ) {
            event.preventDefault();
            event.stopPropagation();
            const items = Array.from(
              menu.current!.querySelectorAll<HTMLButtonElement>(
                '[role="menuitemradio"]'
              )
            );
            const index = items.indexOf(
              document.activeElement as HTMLButtonElement
            );
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? items.length - 1
                  : (index +
                      (event.key === 'ArrowDown' ? 1 : -1) +
                      items.length) %
                    items.length;
            items[next]?.focus();
          }
        }}
      >
        <button
          ref={menuButton}
          type="button"
          className="wall-video-more"
          aria-label="Video options"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <MoreVertical />
        </button>
        {open && (
          <div
            className="wall-quality-menu"
            role="menu"
            aria-label="Video resolution"
          >
            <strong>Resolution</strong>
            {qualities.qualities.map((item) => (
              <button
                key={item.quality}
                type="button"
                role="menuitemradio"
                aria-checked={choice.quality === item.quality}
                onClick={() => void select(item)}
              >
                <span>
                  {item.label}
                  <small>
                    {item.status === 'ready'
                      ? item.width
                        ? `${item.width} × ${item.height}`
                        : 'As uploaded'
                      : ['queued', 'processing'].includes(item.status)
                        ? 'Preparing…'
                        : 'Prepare this resolution'}
                  </small>
                </span>
                {choice.quality === item.quality && (
                  <Check aria-hidden="true" />
                )}
              </button>
            ))}
            <label className="wall-video-speed">
              Playback speed
              <select
                aria-label="Playback speed"
                value={speed}
                onChange={(event) => {
                  const rate = Number(event.target.value);
                  setSpeed(rate);
                  if (video.current) video.current.playbackRate = rate;
                }}
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <option key={rate} value={rate}>
                    {rate === 1 ? 'Normal' : `${rate}×`}
                  </option>
                ))}
              </select>
            </label>
            {qualities.processing && qualities.qualities.length === 1 && (
              <p role="status">Reading video details…</p>
            )}
            {qualities.error && (
              <p role="alert">
                {qualities.error}
                <button
                  type="button"
                  onClick={() =>
                    qualities.retry().catch((error) => setNotice(error.message))
                  }
                >
                  Try again
                </button>
              </p>
            )}
          </div>
        )}
      </div>
      {(pending || notice) && (
        <div className="wall-video-notice" role={notice ? 'alert' : 'status'}>
          {pending ? `Preparing ${pending}… You can keep watching.` : notice}
        </div>
      )}
    </div>
  );
}

export function WallVideoDownload(
  props: VideoProps & {
    onClose: () => void;
    onDownload: (choice: VideoQuality) => Promise<void>;
  }
) {
  const { file, onClose, onDownload } = props;
  const qualities = useVideoQualities(props, true);
  const [selected, setSelected] = useState('original');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const choice = qualities.qualities.find((item) => item.quality === selected);
  const price = file.premium
    ? file.priceTpg || 0
    : file.duration && file.duration >= 20
      ? file.duration > 40
        ? 300
        : 200
      : 0;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const release = lockWallVideoScroll();
    const back = () => closeRef.current();
    window.addEventListener('popstate', back);
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      release();
      window.removeEventListener('popstate', back);
      previous?.focus();
    };
  }, []);
  const select = async (item: VideoQuality) => {
    setSelected(item.quality);
    setError('');
    if (
      item.status === 'ready' ||
      ['queued', 'processing'].includes(item.status)
    )
      return;
    try {
      await qualities.prepare(item.quality);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not prepare this resolution.'
      );
    }
  };
  const download = async () => {
    if (!choice || choice.status !== 'ready' || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await onDownload(choice);
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Download failed.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return createPortal(
    <div
      className="wall-download-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialog}
        className="wall-download-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Download video"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            if (!busy) onClose();
          }
          if (event.key === 'Tab') {
            const buttons = Array.from(
              dialog.current!.querySelectorAll<HTMLButtonElement>(
                'button:not(:disabled)'
              )
            );
            const first = buttons[0],
              last = buttons.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <h2>Download video</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close download options"
          >
            <X />
          </button>
        </header>
        <p className="wall-download-name">{file.name}</p>
        <strong>Choose resolution</strong>
        <div
          role="radiogroup"
          aria-label="Download resolution"
          className="wall-download-qualities"
        >
          {qualities.qualities.map((item) => (
            <button
              key={item.quality}
              type="button"
              role="radio"
              aria-checked={selected === item.quality}
              disabled={busy}
              onClick={() => void select(item)}
            >
              <span>
                {item.label}
                <small>
                  {item.width
                    ? `${item.width} × ${item.height}`
                    : 'As uploaded'}
                  {item.status === 'ready'
                    ? ''
                    : ['queued', 'processing'].includes(item.status)
                      ? ' · Preparing…'
                      : ' · Prepare for download'}
                </small>
              </span>
              <span>
                {bytes(item.size)}
                {selected === item.quality && <Check aria-hidden="true" />}
              </span>
            </button>
          ))}
        </div>
        {qualities.processing && (
          <p role="status">Preparing video options. Keep this window open.</p>
        )}
        {(error || choice?.error || qualities.error) && (
          <p role="alert">{error || choice?.error || qualities.error}</p>
        )}
        {qualities.error && (
          <button
            type="button"
            className="wall-text-button"
            onClick={() =>
              qualities.retry().catch((error) => setError(error.message))
            }
          >
            Try again
          </button>
        )}
        <p className="wall-download-price">
          {price
            ? `${price} TPG will be charged when you tap Download.`
            : 'Free download'}
        </p>
        <button
          type="button"
          className="wall-download-confirm"
          disabled={busy || choice?.status !== 'ready'}
          onClick={() => void download()}
        >
          <Download />
          {busy
            ? 'Starting download…'
            : choice?.status !== 'ready'
              ? 'Preparing resolution…'
              : `Download${price ? ` · ${price} TPG` : ''}`}
        </button>
      </div>
    </div>,
    document.body
  );
}
