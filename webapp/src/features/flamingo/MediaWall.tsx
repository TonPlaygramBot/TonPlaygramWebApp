import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2, ChevronDown, Download, FileText, Heart, Image, Maximize2, MessageCircle,
  Newspaper, Paperclip, Pencil, Play, Plus, Save, Search, Send, Share2, ThumbsDown,
  ThumbsUp, Trash2, Upload, Video, Vote, X,
} from 'lucide-react';
import './media-social.css';
import { API_BASE_URL } from '../../utils/api.js';
import { resolveWallMediaUrl } from './mediaUrl.js';
import { reconcileWallPosts } from './wallFeed.js';

type Attachment = { name: string; size: number; type: string; src: string; blob?: Blob; duration?: number; premium?: boolean; priceTpg?: number };
type Reaction = 'like' | 'love' | 'laugh' | 'support' | 'dislike';
type Comment = { id: string; author: string; text: string; createdAt: string };
type Poll = { question: string; options: string[]; votes: number[] };
type Post = { id: string; text: string; title?: string; author: string; authorAvatar?: string; createdAt: string; source?: 'community' | 'telegram'; attachment?: Attachment; poll?: Poll; canManage?: boolean };
type Engagement = { reaction?: Reaction; counts: Record<Reaction, number>; comments: Comment[]; commentVotes: Record<string, 1 | -1> };
type WallIdentity = { author: string; authorAvatar: string };

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
const TIKTOK_CHANNEL = 'https://www.tiktok.com/@tonplaygram';
const initialPosts: Post[] = [];
const DB_NAME = 'flamingo-media-wall';
const STORE_NAME = 'posts';
const ENGAGEMENT_KEY = 'fr-media-engagement-v2';
const OWNER_TOKEN_KEY = 'fr-media-wall-owner-token';
const UPLOAD_REQUEST_TIMEOUT_MS = 30_000;
const imageExtensions = /\.(avif|heic|heif|jpe?g|png|webp)$/i;
const videoExtensions = /\.(m4v|mov|mp4|webm)$/i;
const reactionMeta: { id: Reaction; label: string; emoji: string }[] = [
  { id: 'like', label: 'Pëlqej', emoji: '👍' }, { id: 'love', label: 'Dashuri', emoji: '❤️' },
  { id: 'laugh', label: 'Gëzim', emoji: '😂' }, { id: 'support', label: 'Mbështes', emoji: '✊' },
  { id: 'dislike', label: 'Nuk pëlqej', emoji: '👎' },
];
const socialNetworks = [
  { id: 'tiktok', label: 'TikTok', mark: '♪' }, { id: 'facebook', label: 'Facebook', mark: 'f' },
  { id: 'x', label: 'X', mark: '𝕏' }, { id: 'instagram', label: 'Instagram', mark: '◎' },
  { id: 'snapchat', label: 'Snapchat', mark: '◉' }, { id: 'youtube', label: 'YouTube', mark: '▶' },
] as const;

const blankCounts = (): Record<Reaction, number> => ({ like: 0, love: 0, laugh: 0, support: 0, dislike: 0 });
const blankEngagement = (): Engagement => ({ counts: blankCounts(), comments: [], commentVotes: {} });
function openMediaDb() { return new Promise<IDBDatabase>((resolve, reject) => { if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable')); const request = indexedDB.open(DB_NAME, 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function savedPosts() { const db = await openMediaDb(); return new Promise<Post[]>((resolve, reject) => { const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); request.transaction.oncomplete = () => db.close(); }); }
async function savePost(post: Post) { const db = await openMediaDb(); return new Promise<void>((resolve, reject) => { const transaction = db.transaction(STORE_NAME, 'readwrite'); transaction.objectStore(STORE_NAME).put({ ...post, attachment: post.attachment ? { ...post.attachment, src: '' } : undefined }); transaction.oncomplete = () => { db.close(); resolve(); }; transaction.onerror = () => reject(transaction.error); }); }
function formatBytes(bytes: number) { if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`; if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`; return `${Math.max(1, Math.round(bytes / 1024))} KB`; }
function attachmentType(file: File) { if (file.type) return file.type; if (imageExtensions.test(file.name)) return 'image/*'; if (videoExtensions.test(file.name)) return 'video/*'; return 'application/octet-stream'; }
function normalizedAttachmentType(type: string, name: string) { if (type && type !== 'application/octet-stream') return type; if (imageExtensions.test(name)) return 'image/*'; if (videoExtensions.test(name)) return 'video/*'; return type || 'application/octet-stream'; }
function downloadUrl(file: Attachment) { if (file.src.startsWith('blob:')) return file.src; const separator = file.src.includes('?') ? '&' : '?'; return `${file.src}${separator}download=1&name=${encodeURIComponent(file.name)}`; }
function postId() { return globalThis.crypto?.randomUUID?.() || `post-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function identityHeaders(extra: Record<string, string> = {}) { const headers = { ...extra, 'X-Wall-Owner-Token': OWNER_TOKEN }; const account = localStorage.getItem('accountId'); const google = localStorage.getItem('googleId'); const initData = (window as any).Telegram?.WebApp?.initData; if (account) headers['X-Tpc-Account-Id'] = account; if (google) headers['X-Google-Id'] = google; if (initData) headers['X-Telegram-Init-Data'] = initData; return headers; }
function readVideoDuration(file: File) { return new Promise<number>(resolve => { if (!attachmentType(file).startsWith('video/')) return resolve(0); const video = document.createElement('video'); const url = URL.createObjectURL(file); video.preload = 'metadata'; video.onloadedmetadata = () => { const duration = Number.isFinite(video.duration) ? video.duration : 0; URL.revokeObjectURL(url); resolve(duration); }; video.onerror = () => { URL.revokeObjectURL(url); resolve(0); }; video.src = url; }); }
const wait = (milliseconds: number) => new Promise(resolve => window.setTimeout(resolve, milliseconds));
async function fetchUpload(url: string, init: RequestInit, attempts = 4) {
  let lastResponse: Response | undefined;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), UPLOAD_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      lastResponse = response;
      if (response.ok || (response.status < 500 && response.status !== 408 && response.status !== 429)) return response;
    } catch {
      // A mobile connection can briefly disappear while the app is backgrounded.
    } finally {
      window.clearTimeout(timeout);
    }
    if (attempt + 1 < attempts) await wait(750 * 2 ** attempt);
  }
  if (lastResponse) return lastResponse;
  throw new Error('Serveri nuk u arrit. Kontrollo internetin dhe provo përsëri.');
}
async function responsePayload(response: Response) {
  return response.json().catch(() => ({}));
}
const OWNER_TOKEN = localStorage.getItem(OWNER_TOKEN_KEY) || postId();
localStorage.setItem(OWNER_TOKEN_KEY, OWNER_TOKEN);
async function downloadAttachment(file: Attachment, postIdValue?: string) {
  let url = downloadUrl(file);
  if (postIdValue && /^[a-f\d]{24}$/i.test(postIdValue) && (file.type.startsWith('video/') || file.premium)) {
    const response = await fetch(`${API_BASE_URL}/api/flamingo-wall/posts/${postIdValue}/download`, { method: 'POST', headers: identityHeaders() });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Shkarkimi dështoi.');
    url = `${API_BASE_URL}${payload.downloadUrl}`;
  }
  const telegram = (window as any).Telegram?.WebApp;
  const absoluteUrl = url.startsWith('blob:') ? url : new URL(url, location.href).href;
  const browserDownload = () => {
    if (!url.startsWith('blob:') && typeof telegram?.openLink === 'function') {
      telegram.openLink(absoluteUrl, { try_instant_view: false });
      return;
    }
    const link = document.createElement('a'); link.href = absoluteUrl; link.download = file.name; link.target = '_blank'; link.rel = 'noopener'; document.body.appendChild(link); link.click(); link.remove();
  };
  if (!url.startsWith('blob:') && typeof telegram?.downloadFile === 'function') {
    // Telegram requires the callback argument. Falling back when the native
    // download prompt is unavailable also covers older Android/iOS clients.
    try { telegram.downloadFile({ url: absoluteUrl, file_name: file.name }, (accepted: boolean) => { if (!accepted) browserDownload(); }); return; }
    catch { browserDownload(); return; }
  }
  browserDownload();
}
function AttachmentPreview({ file, onExpand }: { file: Attachment; onExpand: () => void }) {
  if (file.type.startsWith('video/')) return <div className="fr-video-frame"><video key={file.src} src={file.src} controls playsInline preload="metadata" /><span><Play /> VIDEO</span><button type="button" className="fr-expand-video" onClick={onExpand} aria-label="Hap videon në ekran të plotë"><Maximize2 /> Ekran i plotë</button></div>;
  if (file.type.startsWith('image/')) return <img className="fr-post-image" src={file.src} alt={file.name} loading="lazy" />;
  return <button type="button" className="fr-file-card" onClick={() => downloadAttachment(file)}><FileText /><span><strong>{file.name}</strong><small>{formatBytes(file.size)} • Prek për ta shkarkuar</small></span><Download /></button>;
}

function FullscreenVideoFeed({ posts, initialPostId, engagement, commentDrafts, identity, favorites, onClose, onReact, onComment, onDraft, onShare, onDownload, onFavorite }: { posts: Post[]; initialPostId: string; engagement: Record<string, Engagement>; commentDrafts: Record<string, string>; identity: WallIdentity; favorites: Record<string, boolean>; onClose: () => void; onReact: (postId: string, reaction: Reaction) => void; onComment: (event: FormEvent, postId: string) => void; onDraft: (postId: string, value: string) => void; onShare: (post: Post) => void; onDownload: (post: Post) => void; onFavorite: (postId: string) => void }) {
  const feedRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [commentsFor, setCommentsFor] = useState<string>();
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeFromHistory = () => onCloseRef.current();
    const closeFromKeyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') history.back(); };
    window.addEventListener('popstate', closeFromHistory);
    window.addEventListener('keydown', closeFromKeyboard);
    requestAnimationFrame(() => document.getElementById(`fullscreen-video-${initialPostId}`)?.scrollIntoView());
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { const video = entry.target.querySelector('video'); if (!video) return; if (entry.isIntersecting) video.play().catch(() => {}); else video.pause(); }), { root: feedRef.current, threshold: 0.7 });
    feedRef.current?.querySelectorAll('.fr-fullscreen-slide').forEach(slide => observer.observe(slide));
    return () => { observer.disconnect(); document.body.style.overflow = previous; window.removeEventListener('popstate', closeFromHistory); window.removeEventListener('keydown', closeFromKeyboard); };
  }, [initialPostId]);
  return createPortal(<div ref={feedRef} className="fr-video-fullscreen-feed" role="dialog" aria-modal="true" aria-label="Videot e murit">
    {posts.map(post => { const file = post.attachment!; const data = engagement[post.id] || blankEngagement(); const likes = Object.values(data.counts).reduce((sum, count) => sum + count, 0); return <section className="fr-fullscreen-slide" id={`fullscreen-video-${post.id}`} key={post.id}>
      <video src={file.src} controls autoPlay={post.id === initialPostId} playsInline loop preload={post.id === initialPostId ? 'auto' : 'metadata'} />
      <header><button type="button" onClick={() => history.back()} aria-label="Kthehu te muri"><X /></button><strong>{file.name}</strong></header>
      <div className="fr-fullscreen-copy"><strong>{post.author}</strong>{post.text && <p>{post.text}</p>}</div>
      <nav className="fr-fullscreen-actions" aria-label="Veprimet e videos">
        <button type="button" className={data.reaction ? 'active' : ''} onClick={() => onReact(post.id, 'like')}><span><ThumbsUp /></span><b>{likes || 'Pëlqej'}</b></button>
        <button type="button" onClick={() => setCommentsFor(commentsFor === post.id ? undefined : post.id)}><span><MessageCircle /></span><b>{data.comments.length || 'Koment'}</b></button>
        <button type="button" onClick={() => onShare(post)}><span><Share2 /></span><b>Ndaje</b></button>
        <button type="button" onClick={() => onDownload(post)}><span><Download /></span><b>Shkarko</b></button>
        <button type="button" className={favorites[post.id] ? 'active favorite' : ''} onClick={() => onFavorite(post.id)}><span><Heart fill={favorites[post.id] ? 'currentColor' : 'none'} /></span><b>{favorites[post.id] ? 'Ruajtur' : 'Favorit'}</b></button>
      </nav>
      {commentsFor === post.id && <div className="fr-fullscreen-comments"><header><strong>Komentet ({data.comments.length})</strong><button type="button" onClick={() => setCommentsFor(undefined)} aria-label="Mbyll komentet"><X /></button></header><div>{data.comments.map(comment => <p key={comment.id}><b>{comment.author}</b>{comment.text}</p>)}</div><form onSubmit={event => onComment(event, post.id)}><span>{identity.author.slice(0, 2).toUpperCase()}</span><input autoFocus value={commentDrafts[post.id] || ''} onChange={event => onDraft(post.id, event.target.value)} placeholder="Shkruaj një koment…" maxLength={500} /><button aria-label="Dërgo komentin"><Send /></button></form></div>}
      <small className="fr-swipe-hint">Rrëshqit lart ose poshtë për videon tjetër</small>
    </section>; })}
  </div>, document.body);
}

async function uploadLargePost(file: Blob, name: string, type: string, text: string, duration: number, premium: boolean, priceTpg: number, onProgress: (percent: number) => void) {
  const encoded = (value: string) => encodeURIComponent(value);
  const uploadId = postId();
  const started = await fetchUpload(`${API_BASE_URL}/api/flamingo-wall/uploads`, { method: 'POST', headers: identityHeaders({ 'X-Upload-Id': uploadId, 'X-Upload-Size': String(file.size), 'X-Upload-Name': encoded(name), 'X-Upload-Type': encoded(normalizedAttachmentType(type || file.type, name)), 'X-Upload-Text': encoded(text), 'X-Upload-Duration': String(duration || 0), 'X-Upload-Premium': premium ? '1' : '0', 'X-Upload-Price-TPG': String(priceTpg) }) });
  const session = await responsePayload(started);
  if (!started.ok) throw new Error(session.error || 'Ngarkimi nuk mund të fillonte.');
  const chunkSize = session.chunkBytes || 32 * 1024 * 1024;
  const offsets = Array.from({ length: Math.ceil(file.size / chunkSize) }, (_, index) => index * chunkSize);
  let uploaded = 0;
  const uploadChunk = async (offset: number) => {
    const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
    let response: Response | undefined;
    response = await fetchUpload(`${API_BASE_URL}/api/flamingo-wall/uploads/${session.uploadId}`, { method: 'PUT', headers: identityHeaders({ 'Content-Type': 'application/octet-stream', 'X-Upload-Offset': String(offset) }), body: chunk }, 5);
    if (!response?.ok) throw new Error('Lidhja me serverin u ndërpre. Provo përsëri.');
    uploaded += chunk.size;
    onProgress(Math.round(uploaded / file.size * 100));
  };
  // Multiple small requests fill fast Wi-Fi/4G links much better than a few
  // large requests and make retries considerably cheaper on an unstable phone.
  const workers = Array.from({ length: Math.min(6, offsets.length) }, async () => {
    while (offsets.length) { const offset = offsets.shift(); if (offset !== undefined) await uploadChunk(offset); }
  });
  await Promise.all(workers);
  const completed = await fetchUpload(`${API_BASE_URL}/api/flamingo-wall/uploads/${session.uploadId}/complete`, { method: 'POST', headers: identityHeaders() });
  const payload = await responsePayload(completed);
  if (!completed.ok) throw new Error(payload.error || 'Publikimi dështoi.');
  return payload;
}

export default function MediaWall({ compact = false }: { compact?: boolean }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts); const [identity, setIdentity] = useState<WallIdentity>({ author: 'Anëtar i komunitetit', authorAvatar: '' }); const [text, setText] = useState(''); const [title, setTitle] = useState(''); const [postKind, setPostKind] = useState<'post' | 'article' | 'poll'>('post'); const [pollQuestion, setPollQuestion] = useState(''); const [pollOptions, setPollOptions] = useState(['', '']); const [selected, setSelected] = useState<Attachment[]>([]); const [notice, setNotice] = useState(''); const [loadingFile, setLoadingFile] = useState(false); const [votes, setVotes] = useState<Record<string, number>>(() => JSON.parse(localStorage.getItem('fr-media-votes') || '{}')); const [engagement, setEngagement] = useState<Record<string, Engagement>>(() => { try { return JSON.parse(localStorage.getItem(ENGAGEMENT_KEY) || '{}'); } catch { return {}; } }); const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({}); const [openShare, setOpenShare] = useState<string>(); const [openReactions, setOpenReactions] = useState<string>(); const [editingPost, setEditingPost] = useState<string>(); const [editText, setEditText] = useState(''); const [fullscreenPost, setFullscreenPost] = useState<string>(); const [premium, setPremium] = useState(false); const [priceTpg, setPriceTpg] = useState(''); const [favorites, setFavorites] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem('fr-video-favorites') || '{}'); } catch { return {}; } }); const urls = useRef<string[]>([]); const pendingPostIds = useRef(new Set<string>()); const latestFeedRequest = useRef(0);
  useEffect(() => { fetch(`${API_BASE_URL}/api/flamingo-wall/identity`, { headers: identityHeaders() }).then(response => response.ok ? response.json() : Promise.reject()).then(setIdentity).catch(() => {}); }, []);
  useEffect(() => { let active = true; const loadPosts = async (showFallback = false) => { const requestId = ++latestFeedRequest.current; try { const response = await fetch(`${API_BASE_URL}/api/flamingo-wall/posts`, { headers: identityHeaders(), cache: 'no-store' }); if (!response.ok) throw new Error('server unavailable'); const { posts: remotePosts } = await response.json(); if (!active || requestId !== latestFeedRequest.current) return; const normalized = (remotePosts || []).map((post: any) => ({ ...post, id: post._id, createdAt: new Date(post.createdAt).toLocaleString('sq-AL'), attachment: post.attachment ? { ...post.attachment, src: resolveWallMediaUrl(API_BASE_URL, post.attachment.url) } : undefined })); setPosts(current => reconcileWallPosts([...normalized, ...initialPosts], current, pendingPostIds.current)); } catch { if (!showFallback) return; savedPosts().then(items => { if (!active || !items.length) return; const hydrated = items.map(post => post.attachment?.blob ? { ...post, attachment: { ...post.attachment, src: URL.createObjectURL(post.attachment.blob) } } : post); hydrated.forEach(post => { if (post.attachment?.src) urls.current.push(post.attachment.src); }); setPosts([...hydrated.reverse(), ...initialPosts]); }).catch(() => setNotice('Media Wall nuk mund të lidhet me serverin. Provo përsëri.')); } }; loadPosts(true); const refresh = window.setInterval(() => loadPosts(false), 10_000); return () => { active = false; window.clearInterval(refresh); }; }, []);
  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);
  useEffect(() => localStorage.setItem(ENGAGEMENT_KEY, JSON.stringify(engagement)), [engagement]);
  useEffect(() => localStorage.setItem('fr-video-favorites', JSON.stringify(favorites)), [favorites]);
  const updateEngagement = (post: string, change: (current: Engagement) => Engagement) => setEngagement(all => ({ ...all, [post]: change(all[post] || blankEngagement()) }));
  async function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    const oversized = files.find(file => file.size > MAX_UPLOAD_BYTES);
    if (oversized) return setNotice(`${oversized.name} tejkalon kufirin maksimal prej 5 GB.`);
    setLoadingFile(true);
    const attachments = await Promise.all(files.map(async file => {
      const src = URL.createObjectURL(file);
      urls.current.push(src);
      return { name: file.name, size: file.size, type: attachmentType(file), src, blob: file, duration: await readVideoDuration(file) };
    }));
    setSelected(current => [...current, ...attachments]);
    setLoadingFile(false);
    setNotice(`${attachments.length} ${attachments.length === 1 ? 'skedar është' : 'skedarë janë'} gati. Prek “Publiko”.`);
  }
  async function publish(event: FormEvent) { event.preventDefault(); if (loadingFile) return; if (premium && (!selected.length || Number(priceTpg) < 1)) return setNotice('Vendos shumën e kërkuar TPG për përmbajtjen premium.'); const validOptions = pollOptions.map(x => x.trim()).filter(Boolean); if (postKind === 'poll' && (!pollQuestion.trim() || validOptions.length < 2)) return setNotice('Shto një pyetje dhe të paktën dy alternativa.'); if (postKind !== 'poll' && !text.trim() && !selected.length) return setNotice('Shkruaj diçka ose zgjidh një skedar.'); if (postKind === 'article' && !title.trim()) return setNotice('Shto titullin e artikullit.'); setLoadingFile(true); try { let payload; if (postKind === 'poll' || postKind === 'article') { const response = await fetch(`${API_BASE_URL}/api/flamingo-wall/posts/content`, { method: 'POST', headers: identityHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ text: text.trim(), title: postKind === 'article' ? title.trim() : undefined, poll: postKind === 'poll' ? { question: pollQuestion.trim(), options: validOptions } : undefined }) }); payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Publikimi dështoi.'); } else if (selected.length) {
      const uploaded = [];
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        if (!file.blob) continue;
        const result = await uploadLargePost(file.blob, file.name, file.type, text.trim(), file.duration || 0, premium, Number(priceTpg) || 0, percent => setNotice(`Duke ngarkuar ${index + 1}/${selected.length}… ${percent}%`));
        uploaded.push(result.post);
      }
      payload = { posts: uploaded };
    } else { const form = new FormData(); form.set('text', text.trim()); const response = await fetch(`${API_BASE_URL}/api/flamingo-wall/posts`, { method: 'POST', headers: identityHeaders(), body: form }); payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Ngarkimi dështoi.'); } const remotePosts = payload.posts || [payload.post]; const normalizedPosts = remotePosts.filter(Boolean).map((remote: any) => ({ ...remote, id: remote._id, createdAt: 'Tani', attachment: remote.attachment ? { ...remote.attachment, src: resolveWallMediaUrl(API_BASE_URL, remote.attachment.url) } : undefined, canManage: true })); normalizedPosts.forEach((post: Post) => pendingPostIds.current.add(post.id)); setPosts(items => [...normalizedPosts.reverse(), ...items]); resetComposer(); setNotice('Postimi u publikua për të gjithë komunitetin.'); } catch (error) { setNotice(error instanceof Error ? error.message : 'Ngarkimi dështoi.'); } finally { setLoadingFile(false); } }
  function resetComposer() { setText(''); setTitle(''); setPollQuestion(''); setPollOptions(['', '']); setSelected([]); setPremium(false); setPriceTpg(''); setPostKind('post'); }
  function react(postIdValue: string, reaction: Reaction) { updateEngagement(postIdValue, current => { const counts = { ...blankCounts(), ...current.counts }; if (current.reaction) counts[current.reaction] = Math.max(0, counts[current.reaction] - 1); const nextReaction = current.reaction === reaction ? undefined : reaction; if (nextReaction) counts[nextReaction] += 1; return { ...current, reaction: nextReaction, counts }; }); setOpenReactions(undefined); }
  function addComment(event: FormEvent, postIdValue: string) { event.preventDefault(); const value = commentDrafts[postIdValue]?.trim(); if (!value) return; updateEngagement(postIdValue, current => ({ ...current, comments: [...current.comments, { id: postId(), author: identity.author, text: value, createdAt: 'Tani' }] })); setCommentDrafts(drafts => ({ ...drafts, [postIdValue]: '' })); }
  function voteComment(postIdValue: string, commentId: string, value: 1 | -1) { updateEngagement(postIdValue, current => ({ ...current, commentVotes: { ...current.commentVotes, [commentId]: current.commentVotes[commentId] === value ? undefined as never : value } })); }
  async function share(post: Post, network?: string) { const url = post.id === 'official-protest' ? TIKTOK_CHANNEL : `${location.origin}${location.pathname}#post-${post.id}`; const shareText = `${post.author}: ${post.text || post.attachment?.name || 'Postim në murin e komunitetit TonPlayGram'}`; const encodedUrl = encodeURIComponent(url); const encodedText = encodeURIComponent(shareText); if (network === 'facebook') window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank', 'noopener'); else if (network === 'x') window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, '_blank', 'noopener'); else if (network === 'snapchat') window.open(`https://www.snapchat.com/scan?attachmentUrl=${encodedUrl}`, '_blank', 'noopener'); else if (network) { await navigator.clipboard.writeText(`${shareText} ${url}`); window.open(network === 'tiktok' ? TIKTOK_CHANNEL : `https://www.${network}.com/`, '_blank', 'noopener'); setNotice(`Teksti dhe lidhja u kopjuan për ${network}.`); } else if (navigator.share) await navigator.share({ text: shareText, url }); else { await navigator.clipboard.writeText(`${shareText} ${url}`); setNotice('Lidhja e postimit u kopjua.'); } setOpenShare(undefined); }
  function vote(topicId: string, option: number) { const next = { ...votes, [topicId]: option }; setVotes(next); localStorage.setItem('fr-media-votes', JSON.stringify(next)); setNotice('Vota jote u regjistrua.'); }
  async function updatePost(post: Post) { const value = editText.trim(); const response = await fetch(`${API_BASE_URL}/api/flamingo-wall/posts/${post.id}`, { method: 'PATCH', headers: identityHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ text: value }) }); const payload = await response.json(); if (!response.ok) return setNotice(payload.error || 'Ndryshimi dështoi.'); setPosts(items => items.map(item => item.id === post.id ? { ...item, text: value } : item)); setEditingPost(undefined); setNotice('Përshkrimi u ruajt.'); }
  async function deletePost(post: Post) { if (!window.confirm('Ta fshijmë këtë postim përgjithmonë?')) return; const response = await fetch(`${API_BASE_URL}/api/flamingo-wall/posts/${post.id}`, { method: 'DELETE', headers: identityHeaders() }); if (!response.ok) { const payload = await response.json().catch(() => ({})); return setNotice(payload.error || 'Fshirja dështoi.'); } setPosts(items => items.filter(item => item.id !== post.id)); setNotice('Postimi u fshi.'); }
  function openFullscreen(postIdValue: string) { history.pushState({ tonPlaygramVideo: postIdValue }, '', location.href); setFullscreenPost(postIdValue); }


  const videoPosts = posts.filter(post => post.attachment?.type.startsWith('video/'));
  return <section className={compact ? 'fr-wall compact' : 'fr-wall'}>
    {fullscreenPost && <FullscreenVideoFeed posts={videoPosts} initialPostId={fullscreenPost} engagement={engagement} commentDrafts={commentDrafts} identity={identity} favorites={favorites} onClose={() => setFullscreenPost(undefined)} onReact={react} onComment={addComment} onDraft={(postIdValue, value) => setCommentDrafts(drafts => ({ ...drafts, [postIdValue]: value }))} onShare={post => { share(post).catch(() => setNotice('Ndarja dështoi.')); }} onDownload={post => downloadAttachment(post.attachment!, post.id).catch(error => setNotice(error.message))} onFavorite={postIdValue => setFavorites(items => ({ ...items, [postIdValue]: !items[postIdValue] }))} />}
    <div className="fr-wall-heading"><div><span className="fr-kicker"><span>🇦🇱</span> PROTESTA SHQIPTARE</span><h1>Zëri ynë, pa barriera.</h1><p>Një hapësirë e lirë ku çdo qytetar mund të publikojë.</p></div><span className="fr-wall-live"><i /> LIVE</span></div>
    <div className="fr-discover"><Search /><span>Kërko në komunitet</span><button>Më të rejat <ChevronDown /></button></div>
    <form className="fr-wall-compose" id="wall-composer" onSubmit={publish}>
      <div className="fr-compose-intro"><div className="fr-compose-person">TI</div><button type="button" onClick={() => setPostKind('post')}>Çfarë dëshiron të ndash?</button></div>
      <div className="fr-compose-kinds"><button type="button" className={postKind === 'post' ? 'active' : ''} onClick={() => setPostKind('post')}><MessageCircle /> Postim</button><button type="button" className={postKind === 'article' ? 'active' : ''} onClick={() => setPostKind('article')}><Newspaper /> Artikull</button><button type="button" className={postKind === 'poll' ? 'active' : ''} onClick={() => setPostKind('poll')}><Vote /> Sondazh</button></div>
      {postKind === 'article' && <input className="fr-article-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="Titulli i artikullit" />}
      {postKind === 'poll' ? <div className="fr-poll-editor"><input value={pollQuestion} onChange={event => setPollQuestion(event.target.value)} placeholder="Bëj një pyetje…" />{pollOptions.map((option, index) => <input key={index} value={option} onChange={event => setPollOptions(items => items.map((item, i) => i === index ? event.target.value : item))} placeholder={`Alternativa ${index + 1}`} />)}{pollOptions.length < 4 && <button type="button" onClick={() => setPollOptions(items => [...items, ''])}><Plus /> Shto alternativë</button>}</div> : <textarea value={text} onChange={event => setText(event.target.value)} maxLength={postKind === 'article' ? 8000 : 1200} placeholder={postKind === 'article' ? 'Shkruaj historinë, faktet dhe burimet…' : 'Çfarë po ndodh? Ndaje me komunitetin…'} />}
      {selected.length > 0 && <div className="fr-selected-files" aria-label={`${selected.length} skedarë të zgjedhur`}>{selected.map((file, index) => <div className="fr-selected-file" key={`${file.name}-${file.size}-${index}`}><Paperclip /><span>{file.name}<small>{formatBytes(file.size)}</small></span><button type="button" onClick={() => setSelected(items => items.filter((_, itemIndex) => itemIndex !== index))}>Hiq</button></div>)}</div>}
      {selected.some(file => file.type.startsWith('image/') || file.type.startsWith('video/')) && <div className={`fr-premium-editor ${premium ? 'active' : ''}`}><label><input type="checkbox" checked={premium} onChange={event => setPremium(event.target.checked)} /><span><b>★ Përmbajtje premium</b><small>Kërko pagesë para shkarkimit</small></span></label>{premium && <label className="fr-premium-price"><input type="number" inputMode="numeric" min="1" max="1000000" step="1" value={priceTpg} onChange={event => setPriceTpg(event.target.value)} placeholder="0" aria-label="Shuma e kërkuar TPG" /><b>TPG</b></label>}</div>}
      <div className="fr-compose-tools"><label><Image /><span>Foto</span><input type="file" accept="image/*,.heic,.heif" multiple onChange={selectFiles} /></label><label><Video /><span>Video</span><input type="file" accept="video/*,.mov,.m4v" multiple onChange={selectFiles} /></label><label><FileText /><span>Dok.</span><input type="file" accept=".pdf,.doc,.docx,.txt,.zip,.csv" onChange={selectFiles} /></label><button type="submit" disabled={loadingFile}>{loadingFile ? 'Duke ngarkuar…' : <><Send /> Publiko</>}</button></div><small className="fr-upload-limit"><Upload /> Zgjidh disa foto ose video • deri në 5 GB secila</small>
    </form>
    {notice && <p className="fr-inline-notice"><CheckCircle2 />{notice}<button onClick={() => setNotice('')} aria-label="Mbyll"><X /></button></p>}
    <div className="fr-feed-label"><strong>Postimet e fundit</strong><span>Të gjithë mund të publikojnë</span></div><div className="fr-social-feed" aria-label="Postimet e Media Wall">{posts.map(post => { const data = engagement[post.id] || blankEngagement(); const totalReactions = Object.values(data.counts).reduce((sum, count) => sum + count, 0); return <article className="fr-social-post" id={`post-${post.id}`} key={post.id}><header>{post.authorAvatar ? <img className="fr-author-avatar" src={post.authorAvatar} alt="" /> : <span>{post.author.slice(0, 2).toUpperCase()}</span>}<div><strong>{post.author}</strong><small>{post.createdAt} · Publik</small></div>{post.canManage && <div className="fr-owner-actions"><button type="button" onClick={() => { setEditingPost(post.id); setEditText(post.text); }} aria-label="Ndrysho përshkrimin"><Pencil /></button><button type="button" onClick={() => deletePost(post)} aria-label="Fshi postimin"><Trash2 /></button></div>}</header>{post.title && <h2 className="fr-post-title">{post.title}</h2>}{editingPost === post.id ? <div className="fr-post-edit"><textarea value={editText} onChange={event => setEditText(event.target.value)} maxLength={1200} aria-label="Përshkrimi i videos" /><div><button type="button" onClick={() => setEditingPost(undefined)}><X /> Anulo</button><button type="button" onClick={() => updatePost(post)}><Save /> Ruaj</button></div></div> : post.text && <p>{post.text}</p>}{post.poll && <div className="fr-post-poll"><strong>{post.poll.question}</strong>{post.poll.options.map((option, index) => <button key={option} onClick={() => vote(post.id, index)} className={votes[post.id] === index ? 'selected' : ''}>{option}</button>)}</div>}{post.attachment && <AttachmentPreview file={post.attachment} onExpand={() => openFullscreen(post.id)} />}
      <div className="fr-engagement-summary"><span>{totalReactions ? reactionMeta.filter(item => data.counts[item.id]).map(item => item.emoji).join(' ') : 'Bëhu i pari që reagon'}</span><span>{totalReactions || ''}{totalReactions && data.comments.length ? ' • ' : ''}{data.comments.length ? `${data.comments.length} komente` : ''}</span></div>
      <div className="fr-post-actions"><div className="fr-reaction-wrap"><button className={data.reaction ? 'active' : ''} onClick={() => setOpenReactions(openReactions === post.id ? undefined : post.id)}>{data.reaction ? <span>{reactionMeta.find(x => x.id === data.reaction)?.emoji}</span> : <ThumbsUp />} {data.reaction ? reactionMeta.find(x => x.id === data.reaction)?.label : 'Reago'} <ChevronDown /></button>{openReactions === post.id && <div className="fr-reaction-picker">{reactionMeta.map(item => <button key={item.id} title={item.label} onClick={() => react(post.id, item.id)}>{item.emoji}</button>)}</div>}</div><button onClick={() => document.getElementById(`comment-${post.id}`)?.focus()}><MessageCircle /> Komento</button><button onClick={() => setOpenShare(openShare === post.id ? undefined : post.id)}><Share2 /> Ndaje</button></div>
      {openShare === post.id && <div className="fr-share-sheet"><header><strong>Ndaje zërin kudo</strong><button onClick={() => setOpenShare(undefined)} aria-label="Mbyll"><X /></button></header><div>{socialNetworks.map(network => <button key={network.id} onClick={() => share(post, network.id)}><b className={network.id}>{network.mark}</b><span>{network.label}</span></button>)}</div><button className="fr-more-share" onClick={() => share(post)}><Share2 /> Më shumë opsione</button></div>}
      <div className="fr-comments">{data.comments.map(comment => <div className="fr-comment" key={comment.id}><span>{comment.author.slice(0, 2)}</span><div><p><b>{comment.author}</b>{comment.text}</p><small>{comment.createdAt}<button className={data.commentVotes[comment.id] === 1 ? 'active' : ''} onClick={() => voteComment(post.id, comment.id, 1)}><ThumbsUp /></button><button className={data.commentVotes[comment.id] === -1 ? 'active dislike' : ''} onClick={() => voteComment(post.id, comment.id, -1)}><ThumbsDown /></button></small></div></div>)}<form onSubmit={event => addComment(event, post.id)}><span>{identity.author.slice(0, 2).toUpperCase()}</span><input id={`comment-${post.id}`} value={commentDrafts[post.id] || ''} onChange={event => setCommentDrafts(drafts => ({ ...drafts, [post.id]: event.target.value }))} placeholder="Shkruaj një koment…" maxLength={500} /><button aria-label="Dërgo komentin"><Send /></button></form></div>
      {post.attachment && <button type="button" className="fr-post-download" onClick={() => downloadAttachment(post.attachment!, post.id).catch(error => setNotice(error.message))}><Download /> Shkarko origjinalin{post.attachment.premium ? ` · Premium ${post.attachment.priceTpg} TPG` : post.attachment.type.startsWith('video/') ? ` · ${post.attachment.duration && post.attachment.duration >= 20 ? (post.attachment.duration > 40 ? 300 : 200) : 0} TPG` : ''} <small>{formatBytes(post.attachment.size)}</small></button>}
    </article>; })}</div>
  </section>;
}
