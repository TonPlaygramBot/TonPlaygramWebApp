import { useEffect, useRef, useState } from 'react';
import { FileText, Image, Play } from 'lucide-react';
import { Link } from 'react-router-dom';

// A tile is a link, not another player. Load a muted first frame only when near
// the viewport; the full post uses the shared, exclusive WallVideo player.
export default function ProfilePostTile({ post }: { post: {
  id: string; text: string; title?: string; author: string;
  attachment?: { type: string; src: string; name: string };
  poll?: { question: string };
} }) {
  const tile = useRef<HTMLAnchorElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const file = post.attachment;
  const video = file?.type.startsWith('video/');
  const photo = file?.type.startsWith('image/');
  const caption = post.title || post.text || post.poll?.question || file?.name || 'Post';
  useEffect(() => {
    if (!video || !tile.current) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '160px' });
    observer.observe(tile.current);
    return () => observer.disconnect();
  }, [video]);
  useEffect(() => setFailed(false), [file?.src]);
  return <Link ref={tile} className="wall-profile-tile" to={`/wall#post-${post.id}`}
    aria-label={`Open ${video ? 'video' : photo ? 'photo' : 'post'}: ${caption}`}>
    {!failed && photo && <img src={file!.src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />}
    {!failed && video && visible && <video src={file!.src} muted playsInline preload="metadata" aria-hidden="true"
      tabIndex={-1} onLoadedMetadata={event => {
        // A tiny seek makes the first frame visible on mobile without playing.
        const element = event.currentTarget;
        if (Number.isFinite(element.duration) && element.duration > 0) element.currentTime = Math.min(0.1, element.duration / 2);
      }} onError={() => setFailed(true)} />}
    <span className="wall-profile-tile-type" aria-hidden="true">{video ? <Play fill="currentColor" /> : photo ? <Image /> : <FileText />}</span>
    {(!file || (!video && !photo) || failed) && <span className="wall-profile-tile-text">{caption}</span>}
    <span className="wall-profile-tile-caption">{caption}</span>
  </Link>;
}
