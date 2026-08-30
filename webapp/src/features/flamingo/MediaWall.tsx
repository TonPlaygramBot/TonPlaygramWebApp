import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3, CheckCircle2, ChevronDown, Download, ExternalLink, FileText,
  Image, Maximize2, MessageCircle, Newspaper, Paperclip, Play, Plus, Search, Send, Share2,
  ThumbsDown, ThumbsUp, Upload, Users, Video, Vote, X,
} from 'lucide-react';
import './media-social.css';
import { API_BASE_URL } from '../../utils/api.js';

type Attachment = { name: string; size: number; type: string; src: string; blob?: Blob };
type Reaction = 'like' | 'love' | 'laugh' | 'support' | 'dislike';
type Comment = { id: string; author: string; text: string; createdAt: string };
type Poll = { question: string; options: string[]; votes: number[] };
type Post = { id: string; text: string; title?: string; author: string; createdAt: string; source?: 'community' | 'telegram'; attachment?: Attachment; poll?: Poll };
type Engagement = { reaction?: Reaction; counts: Record<Reaction, number>; comments: Comment[]; commentVotes: Record<string, 1 | -1> };

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
const TIKTOK_CHANNEL = 'https://www.tiktok.com/@tonplaygram';
const initialPosts: Post[] = [
  { id: 'official-protest', author: 'TonPlaygram • Zyrtare', createdAt: 'Videoja më e fundit', text: 'Pamjet më të fundit nga protesta janë publikuar në kanalin zyrtar TonPlaygram në TikTok. Shiko, reago dhe ndaje zërin qytetar.' },
  { id: 'welcome', author: 'Ekipi TonPlayGram', createdAt: 'Sot • 09:30', text: 'Mirë se erdhët në murin e komunitetit. Ndani foto, video dhe dokumente të dobishme me burim të qartë.' },
];
const DB_NAME = 'flamingo-media-wall';
const STORE_NAME = 'posts';
const ENGAGEMENT_KEY = 'fr-media-engagement-v2';
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
const communityPoll = { id: 'priority', question: 'Cila temë duhet të ketë përparësi këtë javë?', options: ['Transparenca', 'Shërbimet publike', 'Mjedisi'], votes: [48, 31, 21] };

const blankCounts = (): Record<Reaction, number> => ({ like: 0, love: 0, laugh: 0, support: 0, dislike: 0 });
const blankEngagement = (): Engagement => ({ counts: blankCounts(), comments: [], commentVotes: {} });
function openMediaDb() { return new Promise<IDBDatabase>((resolve, reject) => { if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable')); const request = indexedDB.open(DB_NAME, 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function savedPosts() { const db = await openMediaDb(); return new Promise<Post[]>((resolve, reject) => { const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); request.transaction.oncomplete = () => db.close(); }); }
async function savePost(post: Post) { const db = await openMediaDb(); return new Promise<void>((resolve, reject) => { const transaction = db.transaction(STORE_NAME, 'readwrite'); transaction.objectStore(STORE_NAME).put({ ...post, attachment: post.attachment ? { ...post.attachment, src: '' } : undefined }); transaction.oncomplete = () => { db.close(); resolve(); }; transaction.onerror = () => reject(transaction.error); }); }
function formatBytes(bytes: number) { if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`; if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`; return `${Math.max(1, Math.round(bytes / 1024))} KB`; }
function attachmentType(file: File) { if (file.type) return file.type; if (imageExtensions.test(file.name)) return 'image/*'; if (videoExtensions.test(file.name)) return 'video/*'; return 'application/octet-stream'; }
function downloadUrl(file: Attachment) { if (file.src.startsWith('blob:')) return file.src; const separator = file.src.includes('?') ? '&' : '?'; return `${file.src}${separator}download=1&name=${encodeURIComponent(file.name)}`; }
function postId() { return globalThis.crypto?.randomUUID?.() || `post-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function downloadAttachment(file: Attachment) {
  const url = downloadUrl(file);
  const telegram = (window as any).Telegram?.WebApp;
  if (!url.startsWith('blob:') && typeof telegram?.downloadFile === 'function') {
    telegram.downloadFile({ url: new URL(url, location.href).href, file_name: file.name });
    return;
  }
  if (!url.startsWith('blob:') && typeof telegram?.openLink === 'function') {
    telegram.openLink(new URL(url, location.href).href, { try_instant_view: false });
    return;
  }
  const link = document.createElement('a'); link.href = url; link.download = file.name; link.target = '_blank'; link.rel = 'noopener'; link.click();
}
function AttachmentPreview({ file }: { file: Attachment }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { if (!expanded) return; const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); }; window.addEventListener('keydown', close); return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', close); }; }, [expanded]);
  if (file.type.startsWith('video/')) return <><div className="fr-video-frame"><video key={file.src} src={file.src} controls playsInline preload="metadata" /><span><Play /> VIDEO</span><button type="button" className="fr-expand-video" onClick={() => setExpanded(true)} aria-label="Hap videon në ekran të plotë"><Maximize2 /> Ekran i plotë</button></div>{expanded && createPortal(<div className="fr-video-fullscreen" role="dialog" aria-modal="true" aria-label={`Video: ${file.name}`}><header><strong>{file.name}</strong><button type="button" onClick={() => setExpanded(false)} aria-label="Mbyll videon"><X /></button></header><video src={file.src} controls autoPlay playsInline preload="auto" /><button type="button" className="fr-fullscreen-download" onClick={() => downloadAttachment(file)}><Download /> Shkarko videon</button></div>, document.body)}</>;
  if (file.type.startsWith('image/')) return <img className="fr-post-image" src={file.src} alt={file.name} loading="lazy" />;
  return <button type="button" className="fr-file-card" onClick={() => downloadAttachment(file)}><FileText /><span><strong>{file.name}</strong><small>{formatBytes(file.size)} • Prek për ta shkarkuar</small></span><Download /></button>;
}

async function uploadLargePost(file: Blob, name: string, text: string, onProgress: (percent: number) => void) {
  const encoded = (value: string) => encodeURIComponent(value);
  const started = await fetch(`${API_BASE_URL}/api/flamingo-wall/uploads`, { method: 'POST', headers: { 'X-Upload-Size': String(file.size), 'X-Upload-Name': encoded(name), 'X-Upload-Type': encoded(file.type || 'application/octet-stream'), 'X-Upload-Text': encoded(text), 'X-Upload-Author': encoded('Anëtar i komunitetit') } });
  const session = await started.json();
  if (!started.ok) throw new Error(session.error || 'Ngarkimi nuk mund të fillonte.');
  const chunkSize = session.chunkBytes || 8 * 1024 * 1024;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try { response = await fetch(`${API_BASE_URL}/api/flamingo-wall/uploads/${session.uploadId}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'X-Upload-Offset': String(offset) }, body: chunk }); if (response.ok) break; } catch { /* retry this small chunk */ }
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
    if (!response?.ok) throw new Error('Lidhja me serverin u ndërpre. Provo përsëri.');
    onProgress(Math.round(Math.min(offset + chunk.size, file.size) / file.size * 100));
  }
  const completed = await fetch(`${API_BASE_URL}/api/flamingo-wall/uploads/${session.uploadId}/complete`, { method: 'POST' });
  const payload = await completed.json();
  if (!completed.ok) throw new Error(payload.error || 'Publikimi dështoi.');
  return payload;
}

function OfficialTikTok() {
  return <a className="fr-tiktok-feature" href={TIKTOK_CHANNEL} target="_blank" rel="noreferrer" aria-label="Shiko videon më të fundit të protestës në kanalin zyrtar TonPlaygram">
    <div className="fr-tiktok-visual"><span className="fr-tiktok-note">♪</span><i /><div><b>VIDEO E RE</b><strong>Protesta,<br />drejtpërdrejt.</strong></div><Play /></div>
    <div className="fr-tiktok-copy"><span><b>@tonplaygram</b><small>Kanali zyrtar • TikTok</small></span><em>Shiko videon e fundit <ExternalLink /></em></div>
  </a>;
}

export default function MediaWall({ compact = false }: { compact?: boolean }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts); const [text, setText] = useState(''); const [title, setTitle] = useState(''); const [postKind, setPostKind] = useState<'post' | 'article' | 'poll'>('post'); const [pollQuestion, setPollQuestion] = useState(''); const [pollOptions, setPollOptions] = useState(['', '']); const [selected, setSelected] = useState<Attachment>(); const [notice, setNotice] = useState(''); const [loadingFile, setLoadingFile] = useState(false); const [votes, setVotes] = useState<Record<string, number>>(() => JSON.parse(localStorage.getItem('fr-media-votes') || '{}')); const [engagement, setEngagement] = useState<Record<string, Engagement>>(() => { try { return JSON.parse(localStorage.getItem(ENGAGEMENT_KEY) || '{}'); } catch { return {}; } }); const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({}); const [openShare, setOpenShare] = useState<string>(); const [openReactions, setOpenReactions] = useState<string>(); const urls = useRef<string[]>([]);
  useEffect(() => { let active = true; fetch(`${API_BASE_URL}/api/flamingo-wall/posts`).then(response => { if (!response.ok) throw new Error('server unavailable'); return response.json(); }).then(({ posts: remotePosts }) => { if (!active) return; const normalized = (remotePosts || []).map((post: any) => ({ ...post, id: post._id, createdAt: new Date(post.createdAt).toLocaleString('sq-AL'), attachment: post.attachment ? { ...post.attachment, src: `${API_BASE_URL}${post.attachment.url}` } : undefined })); setPosts([...normalized, ...initialPosts]); }).catch(() => savedPosts().then(items => { if (!active || !items.length) return; const hydrated = items.map(post => post.attachment?.blob ? { ...post, attachment: { ...post.attachment, src: URL.createObjectURL(post.attachment.blob) } } : post); hydrated.forEach(post => { if (post.attachment?.src) urls.current.push(post.attachment.src); }); setPosts([...hydrated.reverse(), ...initialPosts]); }).catch(() => setNotice('Media Wall nuk mund të lidhet me serverin. Provo përsëri.'))); return () => { active = false; }; }, []);
  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);
  useEffect(() => localStorage.setItem(ENGAGEMENT_KEY, JSON.stringify(engagement)), [engagement]);
  const updateEngagement = (post: string, change: (current: Engagement) => Engagement) => setEngagement(all => ({ ...all, [post]: change(all[post] || blankEngagement()) }));
  async function selectFile(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (file.size > MAX_UPLOAD_BYTES) return setNotice('Skedari tejkalon kufirin maksimal prej 5 GB.'); setLoadingFile(true); const src = URL.createObjectURL(file); urls.current.push(src); setSelected({ name: file.name, size: file.size, type: attachmentType(file), src, blob: file }); setLoadingFile(false); setNotice(`${file.type.startsWith('video/') ? 'Videoja' : 'Skedari'} është gati në cilësinë origjinale. Prek “Publiko”.`); }
  async function publish(event: FormEvent) { event.preventDefault(); if (loadingFile) return; const validOptions = pollOptions.map(x => x.trim()).filter(Boolean); if (postKind === 'poll' && (!pollQuestion.trim() || validOptions.length < 2)) return setNotice('Shto një pyetje dhe të paktën dy alternativa.'); if (postKind !== 'poll' && !text.trim() && !selected) return setNotice('Shkruaj diçka ose zgjidh një skedar.'); if (postKind === 'article' && !title.trim()) return setNotice('Shto titullin e artikullit.'); const localPost: Post = { id: postId(), text: text.trim(), title: postKind === 'article' ? title.trim() : undefined, author: 'Anëtar i komunitetit', createdAt: 'Tani', attachment: selected, poll: postKind === 'poll' ? { question: pollQuestion.trim(), options: validOptions, votes: validOptions.map(() => 0) } : undefined }; if (postKind === 'poll' || postKind === 'article') { await savePost(localPost); setPosts(items => [localPost, ...items]); resetComposer(); setNotice('Publikimi yt është tani live për të gjithë.'); return; } setLoadingFile(true); try { let payload; if (selected?.blob) payload = await uploadLargePost(selected.blob, selected.name, text.trim(), percent => setNotice(`Duke ngarkuar videon… ${percent}%`)); else { const form = new FormData(); form.set('text', text.trim()); form.set('author', 'Anëtar i komunitetit'); const response = await fetch(`${API_BASE_URL}/api/flamingo-wall/posts`, { method: 'POST', body: form }); payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Ngarkimi dështoi.'); } const remote = payload.post; setPosts(items => [{ ...remote, id: remote._id, createdAt: 'Tani', attachment: remote.attachment ? { ...remote.attachment, src: `${API_BASE_URL}${remote.attachment.url}` } : undefined }, ...items]); resetComposer(); setNotice('Postimi u publikua për të gjithë komunitetin.'); } catch (error) { setNotice(error instanceof Error ? error.message : 'Ngarkimi dështoi.'); } finally { setLoadingFile(false); } }
  function resetComposer() { setText(''); setTitle(''); setPollQuestion(''); setPollOptions(['', '']); setSelected(undefined); setPostKind('post'); }
  function react(postIdValue: string, reaction: Reaction) { updateEngagement(postIdValue, current => { const counts = { ...blankCounts(), ...current.counts }; if (current.reaction) counts[current.reaction] = Math.max(0, counts[current.reaction] - 1); const nextReaction = current.reaction === reaction ? undefined : reaction; if (nextReaction) counts[nextReaction] += 1; return { ...current, reaction: nextReaction, counts }; }); setOpenReactions(undefined); }
  function addComment(event: FormEvent, postIdValue: string) { event.preventDefault(); const value = commentDrafts[postIdValue]?.trim(); if (!value) return; updateEngagement(postIdValue, current => ({ ...current, comments: [...current.comments, { id: postId(), author: 'Arta M.', text: value, createdAt: 'Tani' }] })); setCommentDrafts(drafts => ({ ...drafts, [postIdValue]: '' })); }
  function voteComment(postIdValue: string, commentId: string, value: 1 | -1) { updateEngagement(postIdValue, current => ({ ...current, commentVotes: { ...current.commentVotes, [commentId]: current.commentVotes[commentId] === value ? undefined as never : value } })); }
  async function share(post: Post, network?: string) { const url = post.id === 'official-protest' ? TIKTOK_CHANNEL : `${location.origin}${location.pathname}#post-${post.id}`; const shareText = `${post.author}: ${post.text || post.attachment?.name || 'Postim në murin e komunitetit TonPlayGram'}`; const encodedUrl = encodeURIComponent(url); const encodedText = encodeURIComponent(shareText); if (network === 'facebook') window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank', 'noopener'); else if (network === 'x') window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, '_blank', 'noopener'); else if (network === 'snapchat') window.open(`https://www.snapchat.com/scan?attachmentUrl=${encodedUrl}`, '_blank', 'noopener'); else if (network) { await navigator.clipboard.writeText(`${shareText} ${url}`); window.open(network === 'tiktok' ? TIKTOK_CHANNEL : `https://www.${network}.com/`, '_blank', 'noopener'); setNotice(`Teksti dhe lidhja u kopjuan për ${network}.`); } else if (navigator.share) await navigator.share({ text: shareText, url }); else { await navigator.clipboard.writeText(`${shareText} ${url}`); setNotice('Lidhja e postimit u kopjua.'); } setOpenShare(undefined); }
  function vote(topicId: string, option: number) { const next = { ...votes, [topicId]: option }; setVotes(next); localStorage.setItem('fr-media-votes', JSON.stringify(next)); setNotice('Vota jote u regjistrua.'); }

  return <section className={compact ? 'fr-wall compact' : 'fr-wall'}>
    <div className="fr-wall-heading"><div><span className="fr-kicker"><span>🇦🇱</span> PROTESTA SHQIPTARE</span><h1>Zëri ynë, pa barriera.</h1><p>Një hapësirë e lirë ku çdo qytetar mund të publikojë.</p></div><span className="fr-wall-live"><i /> LIVE</span></div>
    <div className="fr-discover"><Search /><span>Kërko në komunitet</span><button>Më të rejat <ChevronDown /></button></div>
    <div className="fr-story-row"><span className="fr-story-add"><b><Plus /></b><small>Historia jote</small></span><a href="https://www.tiktok.com/@tonplaygram" target="_blank" rel="noreferrer"><b>TP</b><small>TonPlaygram</small></a><span><b>✊</b><small>Në terren</small></span><span><b>🇦🇱</b><small>Shqipëria</small></span></div>
    <form className="fr-wall-compose" id="wall-composer" onSubmit={publish}>
      <div className="fr-compose-intro"><div className="fr-compose-person">TI</div><button type="button" onClick={() => setPostKind('post')}>Çfarë dëshiron të ndash?</button></div>
      <div className="fr-compose-kinds"><button type="button" className={postKind === 'post' ? 'active' : ''} onClick={() => setPostKind('post')}><MessageCircle /> Postim</button><button type="button" className={postKind === 'article' ? 'active' : ''} onClick={() => setPostKind('article')}><Newspaper /> Artikull</button><button type="button" className={postKind === 'poll' ? 'active' : ''} onClick={() => setPostKind('poll')}><Vote /> Sondazh</button></div>
      {postKind === 'article' && <input className="fr-article-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="Titulli i artikullit" />}
      {postKind === 'poll' ? <div className="fr-poll-editor"><input value={pollQuestion} onChange={event => setPollQuestion(event.target.value)} placeholder="Bëj një pyetje…" />{pollOptions.map((option, index) => <input key={index} value={option} onChange={event => setPollOptions(items => items.map((item, i) => i === index ? event.target.value : item))} placeholder={`Alternativa ${index + 1}`} />)}{pollOptions.length < 4 && <button type="button" onClick={() => setPollOptions(items => [...items, ''])}><Plus /> Shto alternativë</button>}</div> : <textarea value={text} onChange={event => setText(event.target.value)} maxLength={postKind === 'article' ? 8000 : 1200} placeholder={postKind === 'article' ? 'Shkruaj historinë, faktet dhe burimet…' : 'Çfarë po ndodh? Ndaje me komunitetin…'} />}
      {selected && <div className="fr-selected-file"><Paperclip /><span>{selected.name}<small>{formatBytes(selected.size)}</small></span><button type="button" onClick={() => setSelected(undefined)}>Hiq</button></div>}
      <div className="fr-compose-tools"><label><Image /><span>Foto</span><input type="file" accept="image/*,.heic,.heif" onChange={selectFile} /></label><label><Video /><span>Video</span><input type="file" accept="video/*,.mov,.m4v" onChange={selectFile} /></label><label><FileText /><span>Dok.</span><input type="file" accept=".pdf,.doc,.docx,.txt,.zip,.csv" onChange={selectFile} /></label><button type="submit" disabled={loadingFile}>{loadingFile ? 'Duke ngarkuar…' : <><Send /> Publiko</>}</button></div><small className="fr-upload-limit"><Upload /> Ngarkim i sigurt me pjesë • video deri në 5 GB</small>
    </form>
    {!compact && (() => { const selectedVote = votes[communityPoll.id]; const counts = communityPoll.votes.map((count, index) => count + (selectedVote === index ? 1 : 0)); const total = counts.reduce((sum, count) => sum + count, 0); return <article className="fr-vote-card fr-community-poll"><header><Users /><span><b>SONDAZH I HAPUR</b><small>Publikuar nga komuniteti</small></span><BarChart3 /></header><h2>{communityPoll.question}</h2><div>{communityPoll.options.map((option, index) => <button className={selectedVote === index ? 'selected' : ''} onClick={() => vote(communityPoll.id, index)} key={option}><span>{option}</span><i><em style={{ width: `${Math.round(counts[index] / total * 100)}%` }} /></i><b>{Math.round(counts[index] / total * 100)}%</b></button>)}</div>{selectedVote !== undefined && <small className="fr-vote-confirm"><CheckCircle2 /> Vota u regjistrua • {total} gjithsej</small>}</article>; })()}
    <OfficialTikTok />
    {notice && <p className="fr-inline-notice"><CheckCircle2 />{notice}<button onClick={() => setNotice('')} aria-label="Mbyll"><X /></button></p>}
    <div className="fr-feed-label"><strong>Postimet e fundit</strong><span>Të gjithë mund të publikojnë</span></div><div className="fr-social-feed" aria-label="Postimet e Media Wall">{posts.map(post => { const data = engagement[post.id] || blankEngagement(); const totalReactions = Object.values(data.counts).reduce((sum, count) => sum + count, 0); return <article className="fr-social-post" id={`post-${post.id}`} key={post.id}><header><span>{post.author.slice(0, 2).toUpperCase()}</span><div><strong>{post.author}</strong><small>{post.createdAt} · Publik</small></div><button aria-label="Më shumë">•••</button></header>{post.title && <h2 className="fr-post-title">{post.title}</h2>}{post.text && <p>{post.text}</p>}{post.poll && <div className="fr-post-poll"><strong>{post.poll.question}</strong>{post.poll.options.map((option, index) => <button key={option} onClick={() => vote(post.id, index)} className={votes[post.id] === index ? 'selected' : ''}>{option}</button>)}</div>}{post.id === 'official-protest' && <a className="fr-official-link" href={TIKTOK_CHANNEL} target="_blank" rel="noreferrer"><Play /> Hap videon më të fundit në TikTok <ExternalLink /></a>}{post.attachment && <AttachmentPreview file={post.attachment} />}
      <div className="fr-engagement-summary"><span>{totalReactions ? reactionMeta.filter(item => data.counts[item.id]).map(item => item.emoji).join(' ') : 'Bëhu i pari që reagon'}</span><span>{totalReactions || ''}{totalReactions && data.comments.length ? ' • ' : ''}{data.comments.length ? `${data.comments.length} komente` : ''}</span></div>
      <div className="fr-post-actions"><div className="fr-reaction-wrap"><button className={data.reaction ? 'active' : ''} onClick={() => setOpenReactions(openReactions === post.id ? undefined : post.id)}>{data.reaction ? <span>{reactionMeta.find(x => x.id === data.reaction)?.emoji}</span> : <ThumbsUp />} {data.reaction ? reactionMeta.find(x => x.id === data.reaction)?.label : 'Reago'} <ChevronDown /></button>{openReactions === post.id && <div className="fr-reaction-picker">{reactionMeta.map(item => <button key={item.id} title={item.label} onClick={() => react(post.id, item.id)}>{item.emoji}</button>)}</div>}</div><button onClick={() => document.getElementById(`comment-${post.id}`)?.focus()}><MessageCircle /> Komento</button><button onClick={() => setOpenShare(openShare === post.id ? undefined : post.id)}><Share2 /> Ndaje</button></div>
      {openShare === post.id && <div className="fr-share-sheet"><header><strong>Ndaje zërin kudo</strong><button onClick={() => setOpenShare(undefined)} aria-label="Mbyll"><X /></button></header><div>{socialNetworks.map(network => <button key={network.id} onClick={() => share(post, network.id)}><b className={network.id}>{network.mark}</b><span>{network.label}</span></button>)}</div><button className="fr-more-share" onClick={() => share(post)}><Share2 /> Më shumë opsione</button></div>}
      <div className="fr-comments">{data.comments.map(comment => <div className="fr-comment" key={comment.id}><span>{comment.author.slice(0, 2)}</span><div><p><b>{comment.author}</b>{comment.text}</p><small>{comment.createdAt}<button className={data.commentVotes[comment.id] === 1 ? 'active' : ''} onClick={() => voteComment(post.id, comment.id, 1)}><ThumbsUp /></button><button className={data.commentVotes[comment.id] === -1 ? 'active dislike' : ''} onClick={() => voteComment(post.id, comment.id, -1)}><ThumbsDown /></button></small></div></div>)}<form onSubmit={event => addComment(event, post.id)}><span>AM</span><input id={`comment-${post.id}`} value={commentDrafts[post.id] || ''} onChange={event => setCommentDrafts(drafts => ({ ...drafts, [post.id]: event.target.value }))} placeholder="Shkruaj një koment…" maxLength={500} /><button aria-label="Dërgo komentin"><Send /></button></form></div>
      {post.attachment && <button type="button" className="fr-post-download" onClick={() => downloadAttachment(post.attachment!)}><Download /> Shkarko origjinalin <small>{formatBytes(post.attachment.size)}</small></button>}
    </article>; })}</div>
  </section>;
}
