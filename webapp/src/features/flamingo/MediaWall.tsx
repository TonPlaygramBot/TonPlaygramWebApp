import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  Download,
  FileText,
  Heart,
  Info,
  Maximize2,
  MessageCircle,
  Newspaper,
  Pencil,
  Play,
  Save,
  Send,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X
} from 'lucide-react';
import './media-social.css';
import './wall-remake.css';
import { WallComposerSlot as WallComposer } from './WallTransfers';
import { startWallDownload } from './wallDownloads';
import WallMediaRecovery from './WallMediaRecovery';
import WallVideo, { WallVideoDownload, lockWallVideoScroll, type VideoQuality } from './WallVideo';
import { API_BASE_URL } from '../../utils/api.js';
import { resolveWallMediaUrl } from './mediaUrl.js';
import { reconcileWallPosts } from './wallFeed.js';

type Attachment = {
  name: string;
  size: number;
  type: string;
  src: string;
  blob?: Blob;
  duration?: number;
  premium?: boolean;
  priceTpg?: number;
};
type Reaction = 'like' | 'love' | 'laugh' | 'support' | 'dislike';
type Comment = { id: string; author: string; text: string; createdAt: string };
type Poll = { question: string; options: string[]; votes: number[] };
type Post = {
  id: string;
  text: string;
  title?: string;
  author: string;
  authorAvatar?: string;
  authorAccountId?: string;
  createdAt: string;
  source?: 'community' | 'telegram';
  attachment?: Attachment;
  poll?: Poll;
  canManage?: boolean;
};
type Engagement = {
  reaction?: Reaction;
  counts: Record<Reaction, number>;
  comments: Comment[];
  commentVotes: Record<string, 1 | -1>;
};
type WallIdentity = {
  author: string;
  authorAvatar: string;
  accountId?: string;
};

const TIKTOK_CHANNEL = 'https://www.tiktok.com/@tonplaygram';
const initialPosts: Post[] = [];
const DB_NAME = 'flamingo-media-wall';
const STORE_NAME = 'posts';
const ENGAGEMENT_KEY = 'fr-media-engagement-v2';
const OWNER_TOKEN_KEY = 'fr-media-wall-owner-token';
const imageExtensions = /\.(avif|heic|heif|jpe?g|png|webp)$/i;
const videoExtensions = /\.(m4v|mov|mp4|webm)$/i;
const reactionMeta: { id: Reaction; label: string; emoji: string }[] = [
  { id: 'like', label: 'Like', emoji: '👍' },
  { id: 'love', label: 'Love', emoji: '❤️' },
  { id: 'laugh', label: 'Laugh', emoji: '😂' },
  { id: 'support', label: 'Support', emoji: '✊' },
  { id: 'dislike', label: 'Dislike', emoji: '👎' }
];
const socialNetworks = [
  { id: 'tiktok', label: 'TikTok', mark: '♪' },
  { id: 'facebook', label: 'Facebook', mark: 'f' },
  { id: 'x', label: 'X', mark: '𝕏' },
  { id: 'instagram', label: 'Instagram', mark: '◎' },
  { id: 'snapchat', label: 'Snapchat', mark: '◉' },
  { id: 'youtube', label: 'YouTube', mark: '▶' }
] as const;

const blankCounts = (): Record<Reaction, number> => ({
  like: 0,
  love: 0,
  laugh: 0,
  support: 0,
  dislike: 0
});
const blankEngagement = (): Engagement => ({
  counts: blankCounts(),
  comments: [],
  commentVotes: {}
});
function openMediaDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!('indexedDB' in window))
      return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME))
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function savedPosts() {
  const db = await openMediaDb();
  return new Promise<Post[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.transaction.oncomplete = () => db.close();
  });
}
function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
function downloadUrl(file: Attachment) {
  if (file.src.startsWith('blob:')) return file.src;
  const separator = file.src.includes('?') ? '&' : '?';
  return `${file.src}${separator}download=1&name=${encodeURIComponent(file.name)}`;
}
function postId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `post-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}
function identityHeaders(extra: Record<string, string> = {}) {
  const headers = { ...extra, 'X-Wall-Owner-Token': OWNER_TOKEN };
  const account = localStorage.getItem('accountId');
  const google = localStorage.getItem('googleId');
  const initData = (window as any).Telegram?.WebApp?.initData;
  if (account) headers['X-Tpc-Account-Id'] = account;
  if (google) headers['X-Google-Id'] = google;
  if (initData) headers['X-Telegram-Init-Data'] = initData;
  return headers;
}
const OWNER_TOKEN = localStorage.getItem(OWNER_TOKEN_KEY) || postId();
localStorage.setItem(OWNER_TOKEN_KEY, OWNER_TOKEN);
async function downloadAttachment(file: Attachment, postIdValue?: string, choice?: VideoQuality) {
  const requiresGrant = postIdValue && /^[a-f\d]{24}$/i.test(postIdValue) &&
    (file.type.startsWith('video/') || file.premium);
  startWallDownload({
    url: downloadUrl(file),
    name: choice?.name || file.name,
    ...(requiresGrant ? { grant: {
      url: `${API_BASE_URL}/api/flamingo-wall/posts/${postIdValue}/download`,
      headers: identityHeaders(),
      quality: choice?.quality || 'original'
    } } : {})
  });
}

function AttachmentPreview({
  file,
  onExpand,
  postId,
  canManage,
  onRestored
}: {
  file: Attachment;
  onExpand: () => void;
  postId: string;
  canManage?: boolean;
  onRestored: (post: any) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => setFailed(false), [file.src]);
  const retry = () => {
    setFailed(false);
    setRevision((value) => value + 1);
  };
  if (failed || !file.src)
    return (
      <WallMediaRecovery
        apiBase={API_BASE_URL}
        postId={postId}
        file={file}
        canManage={canManage}
        headers={identityHeaders}
        onRetry={retry}
        onRestored={(post) => {
          retry();
          onRestored(post);
        }}
      />
    );
  if (file.type.startsWith('video/'))
    return (
      <div className="fr-video-frame">
        <WallVideo
          key={`${file.src}-${revision}`}
          file={file}
          postId={postId}
          apiBase={API_BASE_URL}
          headers={identityHeaders}
          onError={() => setFailed(true)}
        />
        <button
          type="button"
          className="fr-expand-video"
          onClick={onExpand}
          aria-label="Open video full screen"
        >
          <Maximize2 />
        </button>
      </div>
    );
  if (file.type.startsWith('image/'))
    return (
      <img
        key={`${file.src}-${revision}`}
        className="fr-post-image"
        src={file.src}
        alt={file.name}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  return (
    <a
      className="fr-file-card"
      href={downloadUrl(file)}
      target="_blank"
      rel="noopener noreferrer"
    >
      <FileText />
      <span>
        <strong>{file.name}</strong>
        <small>{formatBytes(file.size)} · Download file</small>
      </span>
      <Download />
    </a>
  );
}

function PostBody({
  text,
  article = false
}: {
  text: string;
  article?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > (article ? 340 : 500);
  return (
    <div className="wall-post-body">
      <p>
        {long && !expanded
          ? `${text.slice(0, article ? 340 : 500).trimEnd()}…`
          : text}
      </p>
      {long && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : article ? 'Read article' : 'Read more'}
        </button>
      )}
    </div>
  );
}
function postTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60000)
  );
  return minutes < 1
    ? 'Just now'
    : minutes < 60
      ? `${minutes}m`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h`
        : date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            ...(date.getFullYear() !== new Date().getFullYear()
              ? { year: 'numeric' as const }
              : {})
          });
}

function FullscreenVideoFeed({
  posts,
  initialPostId,
  engagement,
  commentDrafts,
  identity,
  favorites,
  onClose,
  onReact,
  onComment,
  onDraft,
  onShare,
  onDownload,
  onFavorite
}: {
  posts: Post[];
  initialPostId: string;
  engagement: Record<string, Engagement>;
  commentDrafts: Record<string, string>;
  identity: WallIdentity;
  favorites: Record<string, boolean>;
  onClose: () => void;
  onReact: (postId: string, reaction: Reaction) => void;
  onComment: (event: FormEvent, postId: string) => void;
  onDraft: (postId: string, value: string) => void;
  onShare: (post: Post) => void;
  onDownload: (post: Post) => void;
  onFavorite: (postId: string) => void;
}) {
  const feedRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [commentsFor, setCommentsFor] = useState<string>();
  useEffect(() => {
    const releaseScroll = lockWallVideoScroll();
    const closeFromHistory = () => onCloseRef.current();
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') history.back();
    };
    window.addEventListener('popstate', closeFromHistory);
    window.addEventListener('keydown', closeFromKeyboard);
    requestAnimationFrame(() =>
      document
        .getElementById(`fullscreen-video-${initialPostId}`)
        ?.scrollIntoView()
    );
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          const video = entry.target.querySelector('video');
          if (!video) return;
          if (entry.isIntersecting) video.play().catch(() => {});
          else video.pause();
        }),
      { root: feedRef.current, threshold: 0.7 }
    );
    feedRef.current
      ?.querySelectorAll('.fr-fullscreen-slide')
      .forEach((slide) => observer.observe(slide));
    return () => {
      observer.disconnect();
      releaseScroll();
      window.removeEventListener('popstate', closeFromHistory);
      window.removeEventListener('keydown', closeFromKeyboard);
    };
  }, [initialPostId]);
  return createPortal(
    <div
      ref={feedRef}
      className="fr-video-fullscreen-feed"
      role="dialog"
      aria-modal="true"
      aria-label="Wall videos"
    >
      {posts.map((post) => {
        const file = post.attachment!;
        const data = engagement[post.id] || blankEngagement();
        const likes = Object.values(data.counts).reduce(
          (sum, count) => sum + count,
          0
        );
        return (
          <section
            className="fr-fullscreen-slide"
            id={`fullscreen-video-${post.id}`}
            key={post.id}
          >
            <WallVideo
              file={file}
              postId={post.id}
              apiBase={API_BASE_URL}
              headers={identityHeaders}
              autoPlay={post.id === initialPostId}
              loop
              preload={post.id === initialPostId ? 'auto' : 'metadata'}
            />
            <header>
              <button
                type="button"
                onClick={() => history.back()}
                aria-label="Back to the wall"
              >
                <X />
              </button>
              <strong>{file.name}</strong>
            </header>
            <div className="fr-fullscreen-copy">
              <strong>{post.author}</strong>
              {post.text && (
                <PostBody text={post.text} article={Boolean(post.title)} />
              )}
            </div>
            <nav className="fr-fullscreen-actions" aria-label="Video actions">
              <button
                type="button"
                className={data.reaction ? 'active' : ''}
                onClick={() => onReact(post.id, 'like')}
              >
                <span>
                  <ThumbsUp />
                </span>
                <b>{likes || 'Like'}</b>
              </button>
              <button
                type="button"
                onClick={() =>
                  setCommentsFor(commentsFor === post.id ? undefined : post.id)
                }
              >
                <span>
                  <MessageCircle />
                </span>
                <b>{data.comments.length || 'Comment'}</b>
              </button>
              <button type="button" onClick={() => onShare(post)}>
                <span>
                  <Share2 />
                </span>
                <b>Share</b>
              </button>
              <button type="button" onClick={() => onDownload(post)}>
                <span>
                  <Download />
                </span>
                <b>Download</b>
              </button>
              <button
                type="button"
                className={favorites[post.id] ? 'active favorite' : ''}
                onClick={() => onFavorite(post.id)}
              >
                <span>
                  <Heart fill={favorites[post.id] ? 'currentColor' : 'none'} />
                </span>
                <b>{favorites[post.id] ? 'Saved' : 'Favorite'}</b>
              </button>
            </nav>
            {commentsFor === post.id && (
              <div className="fr-fullscreen-comments">
                <header>
                  <strong>Comments ({data.comments.length})</strong>
                  <button
                    type="button"
                    onClick={() => setCommentsFor(undefined)}
                    aria-label="Close comments"
                  >
                    <X />
                  </button>
                </header>
                <div>
                  {data.comments.map((comment) => (
                    <p key={comment.id}>
                      <b>{comment.author}</b>
                      {comment.text}
                    </p>
                  ))}
                </div>
                <form onSubmit={(event) => onComment(event, post.id)}>
                  <span>{identity.author.slice(0, 2).toUpperCase()}</span>
                  <input
                    autoFocus
                    value={commentDrafts[post.id] || ''}
                    onChange={(event) => onDraft(post.id, event.target.value)}
                    placeholder="Write a comment…"
                    aria-label="Write a comment"
                    maxLength={500}
                  />
                  <button aria-label="Send comment">
                    <Send />
                  </button>
                </form>
              </div>
            )}
            <small className="fr-swipe-hint">
              Swipe up or down for the next video
            </small>
          </section>
        );
      })}
    </div>,
    document.body
  );
}

export default function MediaWall({
  compact = false,
  profileAccountId = '',
  hideComposer = false
}: {
  compact?: boolean;
  profileAccountId?: string;
  hideComposer?: boolean;
}) {
  const [filter, setFilter] = useState('all');
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [feedState, setFeedState] = useState<
    'loading' | 'live' | 'reconnecting' | 'error'
  >('loading');
  const [nextCursor, setNextCursor] = useState<string>();
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [identity, setIdentity] = useState<WallIdentity>({
    author: 'Community member',
    authorAvatar: ''
  });
  const [notice, setNotice] = useState('');
  const [downloadPost, setDownloadPost] = useState<Post>();
  const [votes, setVotes] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('fr-media-votes') || '{}');
    } catch {
      return {};
    }
  });
  const [engagement, setEngagement] = useState<Record<string, Engagement>>(
    () => {
      try {
        return JSON.parse(localStorage.getItem(ENGAGEMENT_KEY) || '{}');
      } catch {
        return {};
      }
    }
  );
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {}
  );
  const [openShare, setOpenShare] = useState<string>();
  const [openReactions, setOpenReactions] = useState<string>();
  const [editingPost, setEditingPost] = useState<string>();
  const [editText, setEditText] = useState('');
  const [fullscreenPost, setFullscreenPost] = useState<string>();
  const [favorites, setFavorites] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('fr-video-favorites') || '{}');
    } catch {
      return {};
    }
  });
  const urls = useRef<string[]>([]);
  const pendingPostIds = useRef(new Set<string>());
  const latestFeedRequest = useRef(0);
  const loadedOlderPosts = useRef(false);
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/flamingo-wall/identity`, {
      headers: identityHeaders()
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setIdentity)
      .catch(() => {});
  }, []);
  useEffect(() => {
    let active = true;
    let loadedOnce = false;
    const loadPosts = async (showFallback = false) => {
      const requestId = ++latestFeedRequest.current;
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/flamingo-wall/posts?paginated=1&limit=20${profileAccountId ? `&profile=${encodeURIComponent(profileAccountId)}` : ''}`,
          { headers: identityHeaders(), cache: 'no-store' }
        );
        if (!response.ok) throw new Error('server unavailable');
        const payload = await response.json();
        if (!Array.isArray(payload.posts)) throw new Error('invalid feed');
        if (!active || requestId !== latestFeedRequest.current) return;
        const normalized = payload.posts
          .map((post: any) => ({
            ...post,
            id: post._id || post.id,
            createdAt: post.createdAt,
            attachment: post.attachment
              ? {
                  ...post.attachment,
                  src: resolveWallMediaUrl(
                    API_BASE_URL,
                    post.attachment.url,
                    post.attachment.size
                  )
                }
              : undefined
          }))
          .filter((post: Post) => post.id);
        setNextCursor(payload.nextCursor || undefined);
        setHasMore(Boolean(payload.hasMore));
        loadedOnce = true;
        setFeedState('live');
        setPosts((current) => {
          const refreshed = reconcileWallPosts(
            [...normalized, ...initialPosts],
            current,
            pendingPostIds.current
          );
          if (!loadedOlderPosts.current) return refreshed;
          const seen = new Set(refreshed.map((post) => post.id));
          return [
            ...refreshed,
            ...current.filter((post) => !seen.has(post.id))
          ];
        });
      } catch {
        if (!active) return;
        setFeedState(loadedOnce ? 'reconnecting' : 'error');
        if (!showFallback) return;
        savedPosts()
          .then((items) => {
            if (!active || !items.length) return;
            const hydrated = items.map((post) =>
              post.attachment?.blob
                ? {
                    ...post,
                    attachment: {
                      ...post.attachment,
                      src: URL.createObjectURL(post.attachment.blob)
                    }
                  }
                : post
            );
            hydrated.forEach((post) => {
              if (post.attachment?.src) urls.current.push(post.attachment.src);
            });
            setPosts([...hydrated.reverse(), ...initialPosts]);
          })
          .catch(() => {});
      }
    };
    const refreshNow = () => loadPosts(false);
    loadPosts(true);
    const events = new EventSource(`${API_BASE_URL}/api/flamingo-wall/events`);
    events.addEventListener('wall-change', refreshNow);
    events.onerror = () =>
      setFeedState((state) => (state === 'loading' ? state : 'reconnecting'));
    events.onopen = () => {
      if (loadedOnce) setFeedState('live');
    };
    window.addEventListener('online', refreshNow);
    window.addEventListener('focus', refreshNow);
    const refresh = window.setInterval(refreshNow, 15_000);
    return () => {
      active = false;
      events.close();
      window.clearInterval(refresh);
      window.removeEventListener('online', refreshNow);
      window.removeEventListener('focus', refreshNow);
    };
  }, [profileAccountId]);
  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);
  async function loadOlderPosts() {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/flamingo-wall/posts?paginated=1&limit=20&cursor=${encodeURIComponent(nextCursor)}${profileAccountId ? `&profile=${encodeURIComponent(profileAccountId)}` : ''}`,
        { headers: identityHeaders(), cache: 'no-store' }
      );
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.posts))
        throw new Error(payload.error || 'Older posts could not be loaded.');
      const older = payload.posts
        .map((post: any) => ({
          ...post,
          id: post._id || post.id,
          createdAt: post.createdAt,
          attachment: post.attachment
            ? {
                ...post.attachment,
                src: resolveWallMediaUrl(
                  API_BASE_URL,
                  post.attachment.url,
                  post.attachment.size
                )
              }
            : undefined
        }))
        .filter((post: Post) => post.id);
      setPosts((current) => {
        const seen = new Set(current.map((post) => post.id));
        return [
          ...current,
          ...older.filter((post: Post) => !seen.has(post.id))
        ];
      });
      loadedOlderPosts.current = true;
      setNextCursor(payload.nextCursor || undefined);
      setHasMore(Boolean(payload.hasMore));
      setFeedState('live');
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Older posts could not be loaded.'
      );
    } finally {
      setLoadingOlder(false);
    }
  }

  useEffect(
    () => localStorage.setItem(ENGAGEMENT_KEY, JSON.stringify(engagement)),
    [engagement]
  );
  useEffect(
    () => localStorage.setItem('fr-video-favorites', JSON.stringify(favorites)),
    [favorites]
  );
  const updateEngagement = (
    post: string,
    change: (current: Engagement) => Engagement
  ) =>
    setEngagement((all) => ({
      ...all,
      [post]: change(all[post] || blankEngagement())
    }));
  function onPublished(remote: any) {
    const post = {
      ...remote,
      id: remote._id || remote.id,
      createdAt: remote.createdAt || new Date().toISOString(),
      attachment: remote.attachment
        ? {
            ...remote.attachment,
            src: resolveWallMediaUrl(
              API_BASE_URL,
              remote.attachment.url,
              remote.attachment.size
            )
          }
        : undefined,
      canManage: true
    };
    pendingPostIds.current.add(post.id);
    setPosts((items) => [post, ...items.filter((item) => item.id !== post.id)]);
    setFilter('all');
  }
  function onRestored(remote: any) {
    setPosts((current) =>
      current.map((post) =>
        post.id === remote._id
          ? {
              ...remote,
              id: remote._id,
              canManage: true,
              attachment: {
                ...remote.attachment,
                src: resolveWallMediaUrl(
                  API_BASE_URL,
                  remote.attachment.url,
                  remote.attachment.size
                )
              }
            }
          : post
      )
    );
    setNotice('Original media restored.');
  }
  function react(postIdValue: string, reaction: Reaction) {
    updateEngagement(postIdValue, (current) => {
      const counts = { ...blankCounts(), ...current.counts };
      if (current.reaction)
        counts[current.reaction] = Math.max(0, counts[current.reaction] - 1);
      const nextReaction = current.reaction === reaction ? undefined : reaction;
      if (nextReaction) counts[nextReaction] += 1;
      return { ...current, reaction: nextReaction, counts };
    });
    setOpenReactions(undefined);
  }
  function addComment(event: FormEvent, postIdValue: string) {
    event.preventDefault();
    const value = commentDrafts[postIdValue]?.trim();
    if (!value) return;
    updateEngagement(postIdValue, (current) => ({
      ...current,
      comments: [
        ...current.comments,
        { id: postId(), author: identity.author, text: value, createdAt: 'Now' }
      ]
    }));
    setCommentDrafts((drafts) => ({ ...drafts, [postIdValue]: '' }));
  }
  function voteComment(postIdValue: string, commentId: string, value: 1 | -1) {
    updateEngagement(postIdValue, (current) => ({
      ...current,
      commentVotes: {
        ...current.commentVotes,
        [commentId]:
          current.commentVotes[commentId] === value
            ? (undefined as never)
            : value
      }
    }));
  }
  async function share(post: Post, network?: string) {
    const url =
      post.id === 'official-protest'
        ? TIKTOK_CHANNEL
        : `${location.origin}${location.pathname}#post-${post.id}`;
    const shareText = `${post.author}: ${post.text || post.attachment?.name || 'Post on the TonPlayGram community wall'}`;
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(shareText);
    if (network === 'facebook')
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        '_blank',
        'noopener'
      );
    else if (network === 'x')
      window.open(
        `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
        '_blank',
        'noopener'
      );
    else if (network === 'snapchat')
      window.open(
        `https://www.snapchat.com/scan?attachmentUrl=${encodedUrl}`,
        '_blank',
        'noopener'
      );
    else if (network) {
      await navigator.clipboard.writeText(`${shareText} ${url}`);
      window.open(
        network === 'tiktok' ? TIKTOK_CHANNEL : `https://www.${network}.com/`,
        '_blank',
        'noopener'
      );
      setNotice(`Text and link copied for ${network}.`);
    } else if (navigator.share) await navigator.share({ text: shareText, url });
    else {
      await navigator.clipboard.writeText(`${shareText} ${url}`);
      setNotice('Post link copied.');
    }
    setOpenShare(undefined);
  }
  function vote(topicId: string, option: number) {
    const next = { ...votes, [topicId]: option };
    setVotes(next);
    localStorage.setItem('fr-media-votes', JSON.stringify(next));
    setNotice('Your vote was recorded.');
  }
  async function updatePost(post: Post) {
    const value = editText.trim();
    const response = await fetch(
      `${API_BASE_URL}/api/flamingo-wall/posts/${post.id}`,
      {
        method: 'PATCH',
        headers: identityHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ text: value })
      }
    );
    const payload = await response.json();
    if (!response.ok) return setNotice(payload.error || 'Update failed.');
    setPosts((items) =>
      items.map((item) =>
        item.id === post.id ? { ...item, text: value } : item
      )
    );
    setEditingPost(undefined);
    setNotice('Description saved.');
  }
  async function deletePost(post: Post) {
    if (!window.confirm('Delete this post permanently?')) return;
    const response = await fetch(
      `${API_BASE_URL}/api/flamingo-wall/posts/${post.id}`,
      { method: 'DELETE', headers: identityHeaders() }
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      return setNotice(payload.error || 'Delete failed.');
    }
    setPosts((items) => items.filter((item) => item.id !== post.id));
    setNotice('Post deleted.');
  }
  function openFullscreen(postIdValue: string) {
    history.pushState({ tonPlaygramVideo: postIdValue }, '', location.href);
    setFullscreenPost(postIdValue);
  }
  function requestDownload(post: Post) {
    if (post.attachment?.type.startsWith('video/')) setDownloadPost(post);
    else if (post.attachment) void downloadAttachment(post.attachment, post.id).catch(error => setNotice(error.message));
  }

  const videoPosts = posts.filter((post) =>
    post.attachment?.type.startsWith('video/')
  );
  return (
    <section className={compact ? 'fr-wall compact' : 'fr-wall'}>
      {fullscreenPost && (
        <FullscreenVideoFeed
          posts={videoPosts}
          initialPostId={fullscreenPost}
          engagement={engagement}
          commentDrafts={commentDrafts}
          identity={identity}
          favorites={favorites}
          onClose={() => setFullscreenPost(undefined)}
          onReact={react}
          onComment={addComment}
          onDraft={(postIdValue, value) =>
            setCommentDrafts((drafts) => ({ ...drafts, [postIdValue]: value }))
          }
          onShare={(post) => {
            share(post).catch(() => setNotice('Sharing failed.'));
          }}
          onDownload={requestDownload}
          onFavorite={(postIdValue) =>
            setFavorites((items) => ({
              ...items,
              [postIdValue]: !items[postIdValue]
            }))
          }
        />
      )}
      {!hideComposer && (
        <WallComposer
          identity={identity}
          apiBase={API_BASE_URL}
          headers={identityHeaders}
          onPublished={onPublished}
          onNotice={setNotice}
        />
      )}
      <div className="wall-feed-tabs" aria-label="Filter posts">
        {[
          ['all', 'All posts'],
          ['photos', 'Photos'],
          ['videos', 'Videos'],
          ['articles', 'Articles']
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {notice && (
        <p className="fr-inline-notice" role="status">
          <Info />
          {notice}
          <button onClick={() => setNotice('')} aria-label="Close">
            <X />
          </button>
        </p>
      )}
      <div className="fr-feed-label">
        <strong>{profileAccountId ? 'Posts' : 'Community feed'}</strong>
        <span className={`fr-feed-status ${feedState}`}>
          <i />
          {feedState === 'loading'
            ? 'Loading…'
            : feedState === 'live'
              ? 'Live updates'
              : feedState === 'reconnecting'
                ? 'Reconnecting…'
                : 'Connection failed'}
        </span>
      </div>
      {feedState === 'error' && !posts.length && (
        <div className="fr-feed-empty" role="status">
          <strong>Posts could not be loaded</strong>
          <span>Check your connection. The wall will retry automatically.</span>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('online'))}
          >
            Try again
          </button>
        </div>
      )}
      {feedState === 'loading' && !posts.length && (
        <div className="wall-feed-loading" role="status">
          Loading community posts…
        </div>
      )}
      {feedState === 'live' &&
        !posts.some(
          (post) =>
            filter === 'all' ||
            (filter === 'articles'
              ? Boolean(post.title)
              : filter === 'photos'
                ? post.attachment?.type.startsWith('image/')
                : post.attachment?.type.startsWith('video/'))
        ) && (
          <div className="wall-empty">
            <MessageCircle />
            <strong>
              {posts.length
                ? `No ${filter} in these posts yet`
                : 'Start the conversation'}
            </strong>
            <p>
              {posts.length
                ? 'Try another filter or load older posts.'
                : 'Share a photo, a video, or a story with the community.'}
            </p>
          </div>
        )}
      <div
        className="fr-social-feed"
        aria-label="Media Wall posts"
        aria-live="polite"
      >
        {posts
          .filter(
            (post) =>
              filter === 'all' ||
              (filter === 'articles'
                ? Boolean(post.title)
                : filter === 'photos'
                  ? post.attachment?.type.startsWith('image/')
                  : post.attachment?.type.startsWith('video/'))
          )
          .map((post) => {
            const data = engagement[post.id] || blankEngagement();
            const totalReactions = Object.values(data.counts).reduce(
              (sum, count) => sum + count,
              0
            );
            return (
              <article
                className="fr-social-post"
                id={`post-${post.id}`}
                key={post.id}
              >
                <header>
                  <Link
                    className="fr-author-link"
                    to={
                      post.authorAccountId
                        ? `/wall/profile/${encodeURIComponent(post.authorAccountId)}`
                        : '/wall'
                    }
                    aria-label={`View ${post.author} profile`}
                  >
                    {post.authorAvatar ? (
                      <img
                        className="fr-author-avatar"
                        src={post.authorAvatar}
                        alt=""
                      />
                    ) : (
                      <span>{post.author.slice(0, 2).toUpperCase()}</span>
                    )}
                    <div>
                      <strong>{post.author}</strong>
                      <small>
                        <time title={new Date(post.createdAt).toLocaleString()}>
                          {postTime(post.createdAt)}
                        </time>{' '}
                        · Public
                      </small>
                    </div>
                  </Link>
                  {post.canManage && (
                    <div className="fr-owner-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPost(post.id);
                          setEditText(post.text);
                        }}
                        aria-label="Edit description"
                      >
                        <Pencil />
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePost(post)}
                        aria-label="Delete post"
                      >
                        <Trash2 />
                      </button>
                    </div>
                  )}
                </header>
                {post.title && (
                  <>
                    <div className="wall-article-label">
                      <Newspaper /> Article ·{' '}
                      {Math.max(
                        1,
                        Math.ceil(post.text.split(/\s+/).length / 200)
                      )}{' '}
                      min read
                    </div>
                    <h2 className="fr-post-title">{post.title}</h2>
                  </>
                )}
                {editingPost === post.id ? (
                  <div className="fr-post-edit">
                    <textarea
                      value={editText}
                      onChange={(event) => setEditText(event.target.value)}
                      maxLength={post.title ? 8000 : 1200}
                      aria-label={post.title ? 'Article body' : 'Post caption'}
                    />
                    <div>
                      <button
                        type="button"
                        onClick={() => setEditingPost(undefined)}
                      >
                        <X /> Cancel
                      </button>
                      <button type="button" onClick={() => updatePost(post)}>
                        <Save /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  post.text && (
                    <PostBody text={post.text} article={Boolean(post.title)} />
                  )
                )}
                {post.poll && (
                  <div className="fr-post-poll">
                    <strong>{post.poll.question}</strong>
                    {post.poll.options.map((option, index) => (
                      <button
                        key={option}
                        onClick={() => vote(post.id, index)}
                        className={votes[post.id] === index ? 'selected' : ''}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
                {post.attachment && (
                  <AttachmentPreview
                    postId={post.id}
                    canManage={post.canManage}
                    onRestored={onRestored}
                    file={post.attachment}
                    onExpand={() => openFullscreen(post.id)}
                  />
                )}
                <div className="fr-engagement-summary">
                  <span>
                    {totalReactions
                      ? reactionMeta
                          .filter((item) => data.counts[item.id])
                          .map((item) => item.emoji)
                          .join(' ')
                      : 'Be the first to react'}
                  </span>
                  <span>
                    {totalReactions || ''}
                    {totalReactions && data.comments.length ? ' • ' : ''}
                    {data.comments.length
                      ? `${data.comments.length} comments`
                      : ''}
                  </span>
                </div>
                <div className="fr-post-actions">
                  <div className="fr-reaction-wrap">
                    <button
                      className={data.reaction ? 'active' : ''}
                      onClick={() =>
                        setOpenReactions(
                          openReactions === post.id ? undefined : post.id
                        )
                      }
                    >
                      {data.reaction ? (
                        <span>
                          {
                            reactionMeta.find((x) => x.id === data.reaction)
                              ?.emoji
                          }
                        </span>
                      ) : (
                        <ThumbsUp />
                      )}{' '}
                      {data.reaction
                        ? reactionMeta.find((x) => x.id === data.reaction)
                            ?.label
                        : 'React'}{' '}
                      <ChevronDown />
                    </button>
                    {openReactions === post.id && (
                      <div className="fr-reaction-picker">
                        {reactionMeta.map((item) => (
                          <button
                            key={item.id}
                            title={item.label}
                            onClick={() => react(post.id, item.id)}
                          >
                            {item.emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      document.getElementById(`comment-${post.id}`)?.focus()
                    }
                  >
                    <MessageCircle /> Comment
                  </button>
                  <button
                    onClick={() =>
                      setOpenShare(openShare === post.id ? undefined : post.id)
                    }
                  >
                    <Share2 /> Share
                  </button>
                </div>
                {openShare === post.id && (
                  <div className="fr-share-sheet">
                    <header>
                      <strong>Share this voice everywhere</strong>
                      <button
                        onClick={() => setOpenShare(undefined)}
                        aria-label="Close"
                      >
                        <X />
                      </button>
                    </header>
                    <div>
                      {socialNetworks.map((network) => (
                        <button
                          key={network.id}
                          onClick={() => share(post, network.id)}
                        >
                          <b className={network.id}>{network.mark}</b>
                          <span>{network.label}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      className="fr-more-share"
                      onClick={() => share(post)}
                    >
                      <Share2 /> More options
                    </button>
                  </div>
                )}
                <div className="fr-comments">
                  {data.comments.map((comment) => (
                    <div className="fr-comment" key={comment.id}>
                      <span>{comment.author.slice(0, 2)}</span>
                      <div>
                        <p>
                          <b>{comment.author}</b>
                          {comment.text}
                        </p>
                        <small>
                          {comment.createdAt}
                          <button
                            className={
                              data.commentVotes[comment.id] === 1
                                ? 'active'
                                : ''
                            }
                            onClick={() => voteComment(post.id, comment.id, 1)}
                          >
                            <ThumbsUp />
                          </button>
                          <button
                            className={
                              data.commentVotes[comment.id] === -1
                                ? 'active dislike'
                                : ''
                            }
                            onClick={() => voteComment(post.id, comment.id, -1)}
                          >
                            <ThumbsDown />
                          </button>
                        </small>
                      </div>
                    </div>
                  ))}
                  <form onSubmit={(event) => addComment(event, post.id)}>
                    <span>{identity.author.slice(0, 2).toUpperCase()}</span>
                    <input
                      id={`comment-${post.id}`}
                      value={commentDrafts[post.id] || ''}
                      onChange={(event) =>
                        setCommentDrafts((drafts) => ({
                          ...drafts,
                          [post.id]: event.target.value
                        }))
                      }
                      placeholder="Write a comment…"
                      aria-label="Write a comment"
                      maxLength={500}
                    />
                    <button aria-label="Send comment">
                      <Send />
                    </button>
                  </form>
                </div>
                {post.attachment && (
                  <button
                    type="button"
                    className="fr-post-download"
                    onClick={() => requestDownload(post)}
                  >
                    <Download /> {post.attachment.type.startsWith('video/') ? 'Download video' : 'Download original'}
                    {post.attachment.premium
                      ? ` · Premium ${post.attachment.priceTpg} TPG`
                      : post.attachment.type.startsWith('video/')
                        ? ` · ${post.attachment.duration && post.attachment.duration >= 20 ? (post.attachment.duration > 40 ? 300 : 200) : 0} TPG`
                        : ''}{' '}
                    <small>{formatBytes(post.attachment.size)}</small>
                  </button>
                )}
              </article>
            );
          })}
      </div>
      {downloadPost?.attachment && <WallVideoDownload
        key={downloadPost.id}
        file={downloadPost.attachment}
        postId={downloadPost.id}
        apiBase={API_BASE_URL}
        headers={identityHeaders}
        onClose={() => setDownloadPost(undefined)}
        onDownload={choice => downloadAttachment(downloadPost.attachment!, downloadPost.id, choice)}
      />}
      {hasMore && (
        <button
          type="button"
          className="fr-load-older"
          onClick={loadOlderPosts}
          disabled={loadingOlder}
        >
          {loadingOlder ? 'Loading older posts…' : 'Load older posts'}
        </button>
      )}
    </section>
  );
}
