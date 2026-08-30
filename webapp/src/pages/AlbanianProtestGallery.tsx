import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowLeft, Check, Download, FileText, Image, LockKeyhole, Play, Send, Upload, Video, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE_URL, flamingoMediaApi } from '../utils/api.js';
import './protest-gallery.css';

type Attachment = { name: string; size: number; type: string; url?: string; src: string; blob?: Blob };
type GalleryPost = { id: string; text: string; author: string; createdAt: string; attachment?: Attachment };

const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;
function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fileType(file: File) {
  if (file.type) return file.type;
  if (/\.(jpe?g|png|webp|avif|heic|heif)$/i.test(file.name)) return 'image/*';
  if (/\.(mp4|mov|m4v|webm)$/i.test(file.name)) return 'video/*';
  return 'application/octet-stream';
}

function downloadUrl(file: Attachment) {
  if (file.src.startsWith('blob:')) return file.src;
  return `${file.src}${file.src.includes('?') ? '&' : '?'}download=1&name=${encodeURIComponent(file.name)}`;
}

function MediaPreview({ file }: { file: Attachment }) {
  if (file.type.startsWith('image/')) return <img src={file.src} alt={file.name} loading="lazy" />;
  if (file.type.startsWith('video/')) return <div className="pg-video"><video src={file.src} controls playsInline preload="metadata" /><span><Play /> VIDEO</span></div>;
  return <div className="pg-document"><FileText /><span><b>{file.name}</b><small>Dokument • {formatBytes(file.size)}</small></span></div>;
}

export default function AlbanianProtestGallery() {
  const [posts, setPosts] = useState<GalleryPost[]>([]);
  const [canPublish, setCanPublish] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<Attachment>();
  const [notice, setNotice] = useState('');
  const objectUrls = useRef<string[]>([]);

  const refreshAccess = useCallback(async (showFailure = false) => {
    const access = await flamingoMediaApi.access();
    const allowed = access?.canPublish === true;
    setCanPublish(allowed);
    if (showFailure && !allowed) setNotice('Hyr me llogarinë e zhvilluesit dhe provo përsëri.');
    return allowed;
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/api/flamingo-wall/posts`).then(response => response.ok ? response.json() : Promise.reject()).then(payload => {
      if (!active) return;
      setPosts((payload.posts || []).map((post: any) => ({
        id: post._id,
        text: post.text,
        author: post.author || 'TonPlayGram • Zyrtare',
        createdAt: new Date(post.createdAt).toLocaleDateString('sq-AL', { day: 'numeric', month: 'long', year: 'numeric' }),
        attachment: post.attachment ? { ...post.attachment, src: `${API_BASE_URL}${post.attachment.url}` } : undefined,
      })));
    }).catch(() => setNotice('Galeria nuk mund të përditësohet tani. Provo përsëri pak më vonë.')).finally(() => active && setLoading(false));

    // Login restoration is asynchronous in Telegram and native shells. Recheck
    // after mount and when returning to the app so the composer unlocks itself.
    const timers = [0, 750, 2000].map(delay => window.setTimeout(() => { if (active) void refreshAccess(); }, delay));
    const recheck = () => { if (active) void refreshAccess(); };
    window.addEventListener('focus', recheck);
    window.addEventListener('storage', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      active = false;
      timers.forEach(window.clearTimeout);
      window.removeEventListener('focus', recheck);
      window.removeEventListener('storage', recheck);
      document.removeEventListener('visibilitychange', recheck);
      objectUrls.current.forEach(URL.revokeObjectURL);
    };
  }, [refreshAccess]);

  const downloadablePosts = useMemo(() => posts.filter(post => post.attachment), [posts]);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) return setNotice('Skedari është më i madh se kufiri 1 GB.');
    const src = URL.createObjectURL(file);
    objectUrls.current.push(src);
    setSelected({ name: file.name, size: file.size, type: fileType(file), src, blob: file });
    setNotice('');
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!canPublish || (!selected && !text.trim())) return;
    setPublishing(true);
    const form = new FormData();
    form.set('text', text.trim());
    form.set('author', 'TonPlayGram • Zyrtare');
    if (selected?.blob) form.set('attachment', selected.blob, selected.name);
    const payload = await flamingoMediaApi.createPost(form);
    if (payload.error) { setNotice(payload.error); setPublishing(false); return; }
    const post = payload.post;
    setPosts(items => [{ id: post._id, text: post.text, author: post.author, createdAt: 'Sot', attachment: post.attachment ? { ...post.attachment, src: `${API_BASE_URL}${post.attachment.url}` } : undefined }, ...items]);
    setText(''); setSelected(undefined); setPublishing(false);
    setNotice('Materiali u publikua me sukses.');
  }

  return <div className="protest-wall-page">
    <header className="pg-header">
      <Link to="/" aria-label="Kthehu në faqen kryesore"><ArrowLeft /></Link>
      <div className="pg-wordmark"><span>TON</span>PLAYGRAM</div>
      <div className="pg-flag" aria-label="Shqipëri"><img src="/assets/flags/albania.svg" alt="" /></div>
    </header>

    <main className="pg-main">
      <section className="pg-hero">
        <span className="pg-label"><i /> ARKIVI PUBLIK</span>
        <h1>TONPLAYGRAM<br /><em>MBËSHTET SHQIPËRINË</em></h1>
        <p>Galeria e protestave.</p>
        <div className="pg-hero-meta"><span><Image /> Foto</span><span><Video /> Video</span><span><FileText /> Dokumente</span></div>
      </section>

      <section className="pg-wall" aria-labelledby="gallery-title">
        <div className="pg-wall-title"><div><span>MURI I MATERIALEVE</span><h2 id="gallery-title">Nga protesta</h2></div><b>{downloadablePosts.length.toString().padStart(2, '0')}</b></div>
        {canPublish ? <form className="pg-dev-wall" onSubmit={publish}>
          <header><div className="pg-dev-avatar">TP</div><div><span>PANELI I ZHVILLUESIT</span><h3>Publiko në mur</h3></div><i>DEV</i></header>
          <textarea value={text} onChange={event => setText(event.target.value)} maxLength={1200} placeholder="Çfarë po ndodh? Ndaje me komunitetin…" />
          {selected && <div className="pg-selected"><FileText /><span><b>{selected.name}</b><small>{formatBytes(selected.size)} • gati për publikim</small></span><button type="button" onClick={() => setSelected(undefined)}>Hiq</button></div>}
          <div className="pg-dev-tools">
            <label><Image /><span>Foto</span><input type="file" accept="image/*,.heic,.heif" onChange={selectFile} /></label>
            <label><Video /><span>Video</span><input type="file" accept="video/*,.mov,.m4v" onChange={selectFile} /></label>
            <label><FileText /><span>Skedar</span><input type="file" accept=".pdf,.doc,.docx,.txt,.zip,.csv" onChange={selectFile} /></label>
            <button type="submit" disabled={publishing || (!selected && !text.trim())}>{publishing ? 'Duke publikuar…' : <><Send /> Publiko</>}</button>
          </div>
          <small className="pg-dev-limit"><Upload /> Deri në 1 GB • publikohet direkt në aplikacion</small>
        </form> : <div className="pg-readonly"><Download /><p><b>Shiko & shkarko.</b><span>Paneli i publikimit shfaqet për llogarinë e zhvilluesit.</span></p><button type="button" onClick={() => void refreshAccess(true)} aria-label="Kontrollo aksesin e zhvilluesit"><LockKeyhole /><span>AKTIVIZO</span></button></div>}

        {notice && <div className="pg-notice"><Check />{notice}<button onClick={() => setNotice('')} aria-label="Mbyll njoftimin"><X /></button></div>}
        {loading && <div className="pg-loading"><i /><span>Duke hapur galerinë…</span></div>}
        {!loading && downloadablePosts.length === 0 && <div className="pg-empty"><div><Image /></div><h3>Galeria po përgatitet.</h3><p>Materialet e para të verifikuara do të shfaqen këtu.</p></div>}

        <div className="pg-grid">{downloadablePosts.map((post, index) => <article className="pg-card" key={post.id}>
          <div className="pg-media"><MediaPreview file={post.attachment!} /><span className="pg-index">{String(index + 1).padStart(2, '0')}</span></div>
          <div className="pg-card-copy"><div><span>{post.author}</span><time>{post.createdAt}</time></div>{post.text && <p>{post.text}</p>}
            <a href={downloadUrl(post.attachment!)} download={post.attachment!.name}><Download /><span><b>Shkarko origjinalin</b><small>{post.attachment!.name} • {formatBytes(post.attachment!.size)}</small></span></a>
          </div>
        </article>)}</div>
      </section>
    </main>

  </div>;
}
