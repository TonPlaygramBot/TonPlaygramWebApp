import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { CheckCircle2, Download, Play, Share2, Upload, Video } from 'lucide-react';

type Clip = { id: string; title: string; author: string; src: string; verified: boolean; fileName?: string };
const starterClips: Clip[] = [
  { id: 'welcome', title: 'Zëri ynë, me fakte', author: 'Ekipi i medias', src: '/assets/videos/flamingo-community.mp4', verified: true },
];

export default function MediaWall() {
  const [clips, setClips] = useState<Clip[]>(starterClips);
  const [notice, setNotice] = useState('');
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) return setNotice('Zgjidh një skedar video MP4, WebM ose MOV.');
    if (file.size > 250 * 1024 * 1024) return setNotice('Videoja duhet të jetë më e vogël se 250 MB.');
    const src = URL.createObjectURL(file); urls.current.push(src);
    setClips(items => [{ id: crypto.randomUUID(), title: file.name.replace(/\.[^.]+$/, ''), author: 'Ti • në shqyrtim', src, verified: false, fileName: file.name }, ...items]);
    setNotice('Videoja u shtua privatisht në pajisjen tënde dhe u dërgua për shqyrtim.');
    event.target.value = '';
  }

  async function share(clip: Clip) {
    const text = `${clip.title} — Flamingo Revolution. Material i verifikuar për rishpërndarje.`;
    if (navigator.share) { await navigator.share({ title: clip.title, text, url: location.href }); return; }
    await navigator.clipboard.writeText(`${text} ${location.href}`); setNotice('Teksti dhe lidhja u kopjuan.');
  }

  return <>
    <section className="fr-media-upload"><div><span className="fr-kicker"><Video /> MEDIA WALL</span><h1>Video gati për komunitetin.</h1><p>Anëtarët e certifikuar mund të ngarkojnë video HD. Moderatorët i kontrollojnë para publikimit.</p></div><label><Upload /> Ngarko video HD<input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={upload} /></label><small>MP4, WebM ose MOV • maksimumi 250 MB • kërkohen të drejtat e publikimit</small></section>
    {notice && <p className="fr-inline-notice"><CheckCircle2 />{notice}</p>}
    <div className="fr-media-grid">{clips.map(clip => <article key={clip.id} className="fr-media-card"><div className="fr-video-frame"><video src={clip.src} controls playsInline preload="metadata" poster="/assets/icons/flamingo-revolution.webp" /><span><Play /> HD</span></div><div className="fr-media-copy"><div>{clip.verified ? <b><CheckCircle2 /> CERTIFIKUAR</b> : <b className="pending">NË SHQYRTIM</b>}<small>{clip.author}</small></div><h2>{clip.title}</h2><div className="fr-media-actions"><button onClick={() => share(clip)}><Share2 /> Shpërndaj</button>{clip.fileName && <a href={clip.src} download={clip.fileName}><Download /> Ruaj</a>}</div></div></article>)}</div>
  </>;
}
