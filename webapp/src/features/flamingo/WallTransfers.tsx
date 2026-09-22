import {
  dismissWallUpload,
  getWallUploads,
  reselectWallUpload,
  setWallUploadStatus,
  startWallUploadQueue,
  subscribeWallUploads
} from './wallUploadQueue.js';
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
  const uploads = useSyncExternalStore(
    subscribeWallUploads,
    getWallUploads,
    getWallUploads
  );
  const [queueError, setQueueError] = useState('');
  useEffect(() => {
    startWallUploadQueue();
  }, []);
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
    const published = (event: Event) => {
      if ((event as CustomEvent).detail)
        onPublished((event as CustomEvent).detail);
    };
    window.addEventListener('wall-upload-published', published);
    window.addEventListener(OPEN_WALL_TRANSFERS, open);
    return () => {
      window.removeEventListener(OPEN_WALL_TRANSFERS, open);
      window.removeEventListener('wall-upload-published', published);
    };
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
  const count = (visibleUpload ? 1 : 0) + downloads.length + uploads.length;
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
                Up to five files upload at a time. You can keep using the app.
                Saved uploads continue in the background where supported and
                resume automatically if your browser pauses them.
              </p>
              {queueError && <p role="alert">{queueError}</p>}
              {uploads.map((job) => (
                <article
                  className="wall-transfer-item"
                  key={job.id}
                  aria-label={`Upload ${job.name}`}
                >
                  <strong>{job.name}</strong>
                  <span role="status">
                    {job.operation === 'cancel'
                      ? job.status === 'error'
                        ? 'Cancellation needs attention'
                        : 'Cancelling…'
                      : job.status === 'complete'
                        ? 'Published'
                        : job.status === 'uploading'
                          ? job.phase === 'publishing'
                            ? 'Publishing…'
                            : `Uploading · ${Math.round((100 * job.bytes) / job.size)}%`
                          : job.status === 'pending'
                            ? job.retryAt > Date.now()
                              ? 'Waiting to retry automatically…'
                              : 'Queued'
                            : job.status === 'paused'
                              ? 'Paused'
                              : job.status === 'staging'
                                ? 'Saving to device…'
                                : 'Needs attention'}
                  </span>
                  {job.status === 'uploading' && (
                    <progress
                      value={job.bytes}
                      max={job.size}
                      aria-label={`Upload progress for ${job.name}`}
                    />
                  )}
                  {!job.persistent && job.status !== 'complete' && (
                    <small>
                      Not saved on this device. Keep the app open, or choose
                      this file again after reopening.
                    </small>
                  )}
                  {job.error && <small role="alert">{job.error}</small>}
                  <div className="wall-transfer-actions">
                    {job.operation !== 'cancel' &&
                      ['uploading', 'pending'].includes(job.status) && (
                        <button
                          onClick={() =>
                            void setWallUploadStatus(job.id, 'paused').catch(
                              (error) => setQueueError(error.message)
                            )
                          }
                        >
                          <Pause />
                          Pause
                        </button>
                      )}
                    {['paused', 'error', 'staging'].includes(job.status) && (
                      <button
                        onClick={() =>
                          void setWallUploadStatus(job.id, 'pending').catch(
                            (error) => setQueueError(error.message)
                          )
                        }
                      >
                        <Play />
                        Resume
                      </button>
                    )}
                    {job.status === 'needs-file' && (
                      <label className="wall-transfer-reselect">
                        Choose original file
                        <input
                          type="file"
                          aria-label={`Choose original ${job.name}`}
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            setQueueError('');
                            try {
                              await reselectWallUpload(job.id, file);
                            } catch (error) {
                              setQueueError((error as Error).message);
                            }
                          }}
                        />
                      </label>
                    )}
                    <button
                      aria-label={`${job.status === 'complete' ? 'Dismiss' : 'Cancel'} upload ${job.name}`}
                      onClick={() =>
                        void dismissWallUpload(job.id).catch((error) =>
                          setQueueError(error.message)
                        )
                      }
                    >
                      <X />
                      {job.status === 'complete' ? 'Dismiss' : 'Cancel'}
                    </button>
                  </div>
                </article>
              ))}
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
