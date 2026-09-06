import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent
} from 'react';
import {
  AlertCircle,
  ChevronUp,
  FileText,
  Globe2,
  Image,
  Newspaper,
  Pause,
  Plus,
  Send,
  Video,
  Vote,
  X
} from 'lucide-react';
import { uploadWallFile, wallRequest } from './wallUpload.js';

type Kind = 'post' | 'article' | 'poll';
type Selection = { id: string; file: File; src: string; duration: number };
type Identity = { author: string; authorAvatar: string };
const MAX_BYTES = 5 * 1024 ** 3;
export const formatUploadBytes = (bytes: number) =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
    : bytes >= 1024 ** 2
      ? `${(bytes / 1024 ** 2).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const id = () => crypto.randomUUID();
const fileType = (file: File) =>
  file.type && file.type !== 'application/octet-stream'
    ? file.type
    : /\.(mp4|m4v)$/i.test(file.name)
      ? 'video/mp4'
      : /\.mov$/i.test(file.name)
        ? 'video/quicktime'
        : /\.webm$/i.test(file.name)
          ? 'video/webm'
          : /\.(jpe?g|png|gif|webp|avif|heic|heif)$/i.test(file.name)
            ? `image/${file.name.split('.').pop()}`
            : 'application/octet-stream';

function videoDuration(file: File) {
  if (!file.type.startsWith('video/')) return Promise.resolve(0);
  return new Promise<number>((resolve) => {
    const video = document.createElement('video');
    const src = URL.createObjectURL(file);
    const done = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onerror = null;
      URL.revokeObjectURL(src);
      video.removeAttribute('src');
      video.load();
      resolve(duration);
    };
    const timer = window.setTimeout(done, 5000);
    video.onloadedmetadata = done;
    video.onerror = done;
    video.preload = 'metadata';
    video.src = src;
  });
}

export default function WallComposer({
  identity,
  apiBase,
  headers,
  onPublished,
  onNotice
}: {
  identity: Identity;
  apiBase: string;
  headers: () => Record<string, string>;
  onPublished: (post: any) => void;
  onNotice: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('post');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [selected, setSelected] = useState<Selection[]>([]);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const [premium, setPremium] = useState(false);
  const [price, setPrice] = useState('');
  const [progress, setProgress] = useState<{
    bytes: number;
    total: number;
    index: number;
    count: number;
    phase: string;
  }>();
  const files = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController>();
  const selectionRef = useRef(selected);
  selectionRef.current = selected;
  const contentId = useRef(id());
  useEffect(
    () => () => {
      controller.current?.abort();
      selectionRef.current.forEach((item) => URL.revokeObjectURL(item.src));
    },
    []
  );
  useEffect(() => {
    const show = () => {
      setOpen(true);
      document
        .getElementById('wall-composer')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.addEventListener('wall-compose', show);
    return () => window.removeEventListener('wall-compose', show);
  }, []);

  function chooseKind(next: Kind) {
    if (
      selected.length &&
      (next === 'poll' ||
        (next === 'article' &&
          (selected.length > 1 || !selected[0].file.type.startsWith('image/'))))
    ) {
      setError(
        next === 'poll'
          ? 'Remove the attachments before creating a poll.'
          : 'An article supports one cover photo. Remove other attachments first.'
      );
      return;
    }
    setKind(next);
    setOpen(true);
    setError('');
  }
  function pick(accept: string) {
    if (busy || preparing) return;
    setOpen(true);
    if (files.current) {
      files.current.accept = accept;
      files.current.multiple = kind === 'post';
      files.current.click();
    }
  }
  async function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files || []);
    event.target.value = '';
    if (!incoming.length || busy || preparing) return;
    if (incoming.some((file) => !file.size))
      return setError('Empty files cannot be uploaded. Choose another file.');
    if (
      selected.reduce((sum, item) => sum + item.file.size, 0) +
        incoming.reduce((sum, file) => sum + file.size, 0) >
      MAX_BYTES
    )
      return setError('Select up to 5 GB of files in total.');
    if (selected.length + incoming.length > 20)
      return setError('Select up to 20 files at a time.');
    if (
      kind === 'article' &&
      (selected.length + incoming.length > 1 ||
        incoming.some((file) => !fileType(file).startsWith('image/')))
    )
      return setError('Choose one photo for the article cover.');
    setPreparing(true);
    setError('');
    try {
      const next: Selection[] = [];
      for (const original of incoming) {
        const file = new File([original], original.name, {
          type: fileType(original),
          lastModified: original.lastModified
        });
        next.push({
          id: id(),
          file,
          src: URL.createObjectURL(file),
          duration: await videoDuration(file)
        });
      }
      setSelected((current) => [...current, ...next]);
    } catch {
      setError('This file could not be opened. Choose it again.');
    } finally {
      setPreparing(false);
    }
  }
  function remove(item: Selection) {
    URL.revokeObjectURL(item.src);
    setSelected((current) => current.filter((file) => file.id !== item.id));
    setProgress(undefined);
  }
  async function publish(event: FormEvent) {
    event.preventDefault();
    if (busy || preparing) return;
    const choices = options.map((value) => value.trim()).filter(Boolean);
    if (kind === 'article' && (!title.trim() || !text.trim()))
      return setError('Add a title and write your article.');
    if (kind === 'poll' && (!question.trim() || choices.length < 2))
      return setError('Add a question and at least two choices.');
    if (kind === 'post' && !text.trim() && !selected.length)
      return setError('Write something or add a photo or video.');
    if (
      premium &&
      selected.length &&
      (!Number.isInteger(Number(price)) ||
        Number(price) < 1 ||
        Number(price) > 1_000_000)
    )
      return setError('Enter a whole premium price from 1 to 1,000,000 TPG.');
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    let published = 0;
    try {
      if (selected.length) {
        const total = selected.reduce((sum, item) => sum + item.file.size, 0);
        let completed = 0;
        for (let index = 0; index < selected.length; index += 1) {
          const item = selected[index];
          const result = await uploadWallFile({
            baseUrl: apiBase,
            headers: headers(),
            file: item.file,
            uploadId: item.id,
            text: text.trim(),
            title: kind === 'article' ? title.trim() : undefined,
            duration: item.duration,
            premium,
            priceTpg: Number(price) || 0,
            signal: abort.signal,
            onProgress: (bytes: number, phase: string) =>
              setProgress({
                bytes: completed + bytes,
                total,
                index: index + 1,
                count: selected.length,
                phase
              })
          });
          if (!result.post?._id)
            throw new Error(
              'The server did not confirm publication. Retry to check your post.'
            );
          onPublished(result.post);
          published += 1;
          completed += item.file.size;
          remove(item);
        }
      } else {
        const result = await wallRequest(
          `${apiBase}/api/flamingo-wall/posts/content`,
          {
            method: 'POST',
            headers: { ...headers(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: contentId.current,
              text: kind === 'poll' ? '' : text.trim(),
              title: kind === 'article' ? title.trim() : undefined,
              poll:
                kind === 'poll'
                  ? { question: question.trim(), options: choices }
                  : undefined
            })
          },
          { signal: abort.signal }
        );
        if (!result.post?._id)
          throw new Error(
            'The server did not confirm publication. Retry to check your post.'
          );
        onPublished(result.post);
        published += 1;
      }
      setText('');
      setTitle('');
      setQuestion('');
      setOptions(['', '']);
      setPremium(false);
      setPrice('');
      setKind('post');
      setOpen(false);
      setProgress(undefined);
      contentId.current = id();
      onNotice(
        published > 1
          ? `${published} posts published.`
          : 'Your post is published.'
      );
    } catch (failure) {
      const message =
        failure instanceof Error && failure.name === 'AbortError'
          ? 'Upload paused. Keep this page open and tap Publish to resume.'
          : failure instanceof Error
            ? failure.message
            : 'Publishing failed. Please retry.';
      setError(
        `${published ? `${published} posts published. ` : ''}${message}`
      );
    } finally {
      setBusy(false);
      controller.current = undefined;
    }
  }
  const percent = progress
    ? Math.min(100, Math.round((progress.bytes / progress.total) * 100))
    : 0;
  return (
    <form
      className={`wall-composer ${open ? 'is-open' : ''}`}
      id="wall-composer"
      onSubmit={publish}
    >
      <div className="wall-compose-prompt">
        {identity.authorAvatar ? (
          <img
            className="wall-compose-avatar"
            src={identity.authorAvatar}
            alt=""
          />
        ) : (
          <span className="wall-compose-avatar">
            {identity.author.slice(0, 2).toUpperCase()}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="wall-compose-editor"
        >
          Share something,{' '}
          {identity.author === 'Community member'
            ? 'TonPlayGram'
            : identity.author.split(' ')[0]}
          …
        </button>
        {open && (
          <button
            className="wall-icon-button"
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Collapse composer"
          >
            <ChevronUp />
          </button>
        )}
      </div>
      {!open && (
        <div className="wall-compose-shortcuts">
          <button type="button" onClick={() => pick('image/*,.heic,.heif')}>
            <Image /> Photo
          </button>
          <button type="button" onClick={() => pick('video/*,.mov,.m4v')}>
            <Video /> Video
          </button>
          <button type="button" onClick={() => chooseKind('article')}>
            <Newspaper /> Article
          </button>
        </div>
      )}
      <input
        ref={files}
        type="file"
        hidden
        onChange={selectFiles}
        aria-label="Choose attachments"
      />
      <div id="wall-compose-editor" hidden={!open}>
        <fieldset disabled={busy || preparing}>
          <div className="wall-compose-tabs" aria-label="Post format">
            {(
              [
                ['post', 'Post', Send],
                ['article', 'Article', Newspaper],
                ['poll', 'Poll', Vote]
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={kind === value}
                onClick={() => chooseKind(value)}
              >
                <Icon />
                {label}
              </button>
            ))}
          </div>
          {kind === 'article' && (
            <label className="wall-field">
              Title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                placeholder="Give your story a headline"
              />
            </label>
          )}
          {kind === 'poll' ? (
            <div className="wall-poll-fields">
              <label className="wall-field">
                Question
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  maxLength={300}
                  placeholder="Ask the community…"
                />
              </label>
              {options.map((option, index) => (
                <label className="wall-field" key={index}>
                  Choice {index + 1}
                  <input
                    value={option}
                    maxLength={160}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((value, i) =>
                          i === index ? event.target.value : value
                        )
                      )
                    }
                  />
                </label>
              ))}
              {options.length < 4 && (
                <button
                  className="wall-text-button"
                  type="button"
                  onClick={() => setOptions((current) => [...current, ''])}
                >
                  <Plus /> Add choice
                </button>
              )}
            </div>
          ) : (
            <label className="wall-field wall-body-field">
              <span className="wall-sr-only">
                {kind === 'article' ? 'Article body' : 'Post caption'}
              </span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={kind === 'article' ? 8000 : 1200}
                rows={kind === 'article' ? 7 : 3}
                placeholder={
                  kind === 'article'
                    ? 'Write your article…'
                    : 'What’s happening?'
                }
              />
              <small>
                {text.length.toLocaleString()} /{' '}
                {kind === 'article' ? '8,000' : '1,200'}
              </small>
            </label>
          )}
          {!!selected.length && (
            <>
              <div className="wall-selected-media">
                {selected.map((item) => (
                  <div className="wall-media-tile" key={item.id}>
                    {item.file.type.startsWith('image/') ? (
                      <img src={item.src} alt={item.file.name} />
                    ) : item.file.type.startsWith('video/') ? (
                      <video
                        src={item.src}
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <FileText />
                    )}
                    <button
                      type="button"
                      className="wall-remove-media"
                      onClick={() => remove(item)}
                      aria-label={`Remove ${item.file.name}`}
                    >
                      <X />
                    </button>
                    <div>
                      <strong>{item.file.name}</strong>
                      <small>{formatUploadBytes(item.file.size)}</small>
                    </div>
                  </div>
                ))}
              </div>
              <small className="wall-compose-help">
                {selected.length > 1
                  ? 'Each file will publish as a separate post. '
                  : ''}
                {formatUploadBytes(
                  selected.reduce((sum, item) => sum + item.file.size, 0)
                )}{' '}
                selected · 5 GB maximum
              </small>
            </>
          )}
          {kind !== 'poll' && (
            <div className="wall-add-media">
              <button type="button" onClick={() => pick('image/*,.heic,.heif')}>
                <Image />
                {kind === 'article' ? 'Cover photo' : 'Photo'}
              </button>
              {kind === 'post' && (
                <>
                  <button
                    type="button"
                    onClick={() => pick('video/*,.mov,.m4v')}
                  >
                    <Video />
                    Video
                  </button>
                  <button
                    type="button"
                    onClick={() => pick('.pdf,.doc,.docx,.txt,.zip,.csv')}
                  >
                    <FileText />
                    File
                  </button>
                </>
              )}
            </div>
          )}
          {selected.some((item) => /^(image|video)\//.test(item.file.type)) && (
            <details className="wall-premium">
              <summary>Download settings</summary>
              <label>
                <input
                  type="checkbox"
                  checked={premium}
                  onChange={(event) => setPremium(event.target.checked)}
                />
                Premium download
              </label>
              {premium && (
                <label className="wall-field">
                  Price in TPG
                  <input
                    type="number"
                    inputMode="numeric"
                    value={price}
                    min={1}
                    max={1000000}
                    step={1}
                    onChange={(event) => setPrice(event.target.value)}
                  />
                </label>
              )}
            </details>
          )}
          <div className="wall-compose-footer">
            <span>
              <Globe2 /> Public
            </span>
            <button className="wall-publish" type="submit">
              <Send />
              {preparing ? 'Preparing…' : 'Publish'}
            </button>
          </div>
        </fieldset>
        {busy && (
          <div className="wall-upload-progress" role="status">
            <div>
              <strong>
                {progress
                  ? progress.phase === 'publishing'
                    ? `Saving post ${progress.index} of ${progress.count}…`
                    : `Uploading ${progress.index} of ${progress.count} · ${percent}%`
                  : 'Publishing…'}
              </strong>
              <button type="button" onClick={() => controller.current?.abort()}>
                <Pause />
                Pause
              </button>
            </div>
            {progress && (
              <>
                <progress
                  max={100}
                  value={percent}
                  aria-label="Upload progress"
                />
                <small>
                  {formatUploadBytes(progress.bytes)} of{' '}
                  {formatUploadBytes(progress.total)} · Keep this page open
                </small>
              </>
            )}
          </div>
        )}
      </div>
      {error && (
        <div className="wall-compose-error" role="alert">
          <AlertCircle />
          <span>{error}</span>
        </div>
      )}
    </form>
  );
}
