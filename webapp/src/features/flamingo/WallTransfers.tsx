import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode
} from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  Pause,
  Play,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import WallComposer, {
  type UploadControls,
  type UploadTransfer
} from './WallComposer';
import {
  dismissWallDownload,
  getWallDownloads,
  OPEN_WALL_TRANSFERS,
  retryWallDownload,
  saveWallDownload,
  saveWallDownloadInBrowser,
  subscribeWallDownloads
} from './wallDownloads';
import './wall-transfers.css';

type ComposerProps = ComponentProps<typeof WallComposer>;
type Slot = ComposerProps & { target: HTMLElement };
const SlotContext = createContext<(slot: Slot) => () => void>(() => () => {});

// Only this placeholder belongs to a route. The composer session and actual
// native file inputs live in WallTransfersProvider above the router's Routes.
export function WallComposerSlot(props: ComposerProps) {
  const register = useContext(SlotContext);
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const {
    apiBase,
    headers,
    identity: { author, authorAvatar }
  } = props;
  useLayoutEffect(() => {
    if (!target) return;
    return register({
      target,
      apiBase,
      headers,
      identity: { author, authorAvatar },
      onPublished: (post) => callbacks.current.onPublished(post),
      onNotice: (notice) => callbacks.current.onNotice(notice)
    });
  }, [register, target, apiBase, headers, author, authorAvatar]);
  return <div ref={setTarget} data-wall-composer-slot />;
}

const downloadLabels = {
  preparing: 'Preparing download…',
  ready: 'Ready to save',
  requested: 'Confirm on your device',
  sent: 'Sent to device',
  cancelled: 'Download cancelled',
  error: 'Download needs attention'
};

export function WallTransfersProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Slot>();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const activeSlot = useRef<Slot>();
  const controls = useRef<UploadControls>(null);
  const [upload, setUpload] = useState<UploadTransfer>();
  const downloads = useSyncExternalStore(
    subscribeWallDownloads,
    getWallDownloads,
    getWallDownloads
  );
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const register = useCallback((slot: Slot) => {
    activeSlot.current = slot;
    setConfig(slot);
    setTarget(slot.target);
    return () => {
      if (activeSlot.current === slot) {
        activeSlot.current = undefined;
        setTarget(null);
      }
    };
  }, []);
  const onPublished = useCallback(
    (post: any) => activeSlot.current?.onPublished(post),
    []
  );
  const onNotice = useCallback(
    (notice: string) => activeSlot.current?.onNotice(notice),
    []
  );
  const previousCount = useRef(0);
  useEffect(() => {
    const open = () => setExpanded(true);
    window.addEventListener(OPEN_WALL_TRANSFERS, open);
    return () => window.removeEventListener(OPEN_WALL_TRANSFERS, open);
  }, []);
  useEffect(() => {
    if (downloads.length > previousCount.current) setExpanded(true);
    previousCount.current = downloads.length;
  }, [downloads.length]);
  useEffect(() => {
    if (!expanded) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [expanded]);
  const visibleUpload = upload && upload.phase !== 'idle';
  const count = (visibleUpload ? 1 : 0) + downloads.length;
  return (
    <SlotContext.Provider value={register}>
      {children}
      {config && (
        <WallComposer
          {...config}
          portalTarget={target}
          transferRef={controls}
          onPublished={onPublished}
          onNotice={onNotice}
          onTransfer={setUpload}
        />
      )}
      {!!count && (
        <aside className="wall-transfers" aria-label="Transfers">
          <button
            type="button"
            className="wall-transfers-toggle"
            aria-expanded={expanded}
            aria-controls="wall-transfer-list"
            onClick={() => setExpanded(!expanded)}
          >
            {upload?.phase === 'uploading' ? (
              <ArrowUpFromLine />
            ) : (
              <ArrowDownToLine />
            )}
            Transfers ·{' '}
            {upload?.phase === 'uploading' ? `${upload.percent}%` : count}
            <ChevronDown className={expanded ? 'is-open' : ''} />
          </button>
          {expanded && (
            <section id="wall-transfer-list" className="wall-transfer-list">
              <p>
                You can browse while transfers continue. Keep TonPlayGram open
                for uploads.
              </p>
              {visibleUpload && (
                <article
                  className="wall-transfer-item"
                  aria-label="Upload transfer"
                >
                  <strong>{upload.label}</strong>
                  <span role="status">
                    {upload.phase === 'uploading'
                      ? `Uploading · ${upload.percent}%`
                      : upload.phase === 'paused'
                        ? 'Upload paused'
                        : upload.phase === 'complete'
                          ? 'Published'
                          : 'Upload needs attention'}
                  </span>
                  {upload.phase === 'uploading' && (
                    <progress
                      max={100}
                      value={upload.percent}
                      aria-label="Background upload progress"
                    />
                  )}
                  <small>{upload.detail}</small>
                  <div className="wall-transfer-actions">
                    {upload.phase === 'uploading' && (
                      <button
                        type="button"
                        onClick={() => controls.current?.pause()}
                      >
                        <Pause /> Pause
                      </button>
                    )}
                    {['paused', 'error'].includes(upload.phase) && (
                      <button
                        type="button"
                        onClick={() =>
                          upload.unreadable
                            ? controls.current?.reselect()
                            : controls.current?.resume()
                        }
                      >
                        <Play />{' '}
                        {upload.unreadable
                          ? 'Choose from Files'
                          : 'Resume upload'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        navigate('/wall');
                        setExpanded(false);
                      }}
                    >
                      View wall
                    </button>
                    {upload.phase === 'complete' && (
                      <button
                        type="button"
                        onClick={() => controls.current?.dismiss()}
                        aria-label="Dismiss upload"
                      >
                        <X />
                      </button>
                    )}
                  </div>
                </article>
              )}
              {downloads.map((job) => (
                <article
                  className="wall-transfer-item"
                  key={job.id}
                  aria-label="Download transfer"
                >
                  <strong>{job.name}</strong>
                  <span role="status">{downloadLabels[job.phase]}</span>
                  {job.error && <small role="alert">{job.error}</small>}
                  {job.phase === 'sent' && (
                    <small>Check your device’s downloads for progress.</small>
                  )}
                  <div className="wall-transfer-actions">
                    {['ready', 'cancelled'].includes(job.phase) && (
                      <button
                        type="button"
                        onClick={() =>
                          job.error
                            ? saveWallDownloadInBrowser(job.id)
                            : saveWallDownload(job.id)
                        }
                      >
                        <ArrowDownToLine />{' '}
                        {job.error ? 'Save in browser' : 'Save to device'}
                      </button>
                    )}
                    {job.phase === 'error' && (
                      <button
                        type="button"
                        onClick={() => retryWallDownload(job.id)}
                      >
                        Retry download
                      </button>
                    )}
                    {!['preparing', 'requested'].includes(job.phase) && (
                      <button
                        type="button"
                        onClick={() => dismissWallDownload(job.id)}
                        aria-label={`Dismiss download ${job.name}`}
                      >
                        <X />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </section>
          )}
        </aside>
      )}
    </SlotContext.Provider>
  );
}
