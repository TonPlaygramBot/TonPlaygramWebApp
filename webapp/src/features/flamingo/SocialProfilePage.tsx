import { ArrowLeft, Download, Image as ImageIcon, Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API_BASE_URL } from '../../utils/api.js';
import { resolveWallMediaUrl } from './mediaUrl.js';
import './community-wall.css';
import './media-social.css';

type Profile = { accountId: string; username: string; photo: string; bio: string };
type Post = { _id: string; text: string; createdAt: string; downloadCount?: number; attachment?: { url: string; type: string; name: string; size: number } };

export default function SocialProfilePage() {
  const { accountId } = useParams();
  const [data, setData] = useState<{ profile: Profile; posts: Post[] }>();
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/flamingo-wall/profiles/${encodeURIComponent(accountId || '')}`, { cache: 'no-store' })
      .then(async response => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error); return payload; })
      .then(setData).catch(reason => setError(reason.message || 'Profile could not be loaded.'));
  }, [accountId]);
  return <div className="community-wall-page"><header className="community-wall-header"><div><Link to="/wall" aria-label="Back to wall"><ArrowLeft /></Link><span><strong>Social profile</strong><small>TonPlayGram Community</small></span></div></header><main className="fr-profile-page">
    {error && <p className="fr-feed-empty">{error}</p>}
    {!data && !error && <p className="fr-feed-empty">Loading profile…</p>}
    {data && <><section className="fr-profile-hero">{data.profile.photo ? <img src={data.profile.photo} alt={`${data.profile.username}'s profile`} /> : <span>{data.profile.username.slice(0, 2).toUpperCase()}</span>}<div><h1>{data.profile.username}</h1>{data.profile.bio && <p>{data.profile.bio}</p>}<small>{data.posts.length} public {data.posts.length === 1 ? 'post' : 'posts'}</small></div></section><div className="fr-feed-label"><strong>Posts</strong></div><div className="fr-social-feed">{data.posts.map(post => <article className="fr-social-post" key={post._id}><header><strong>{data.profile.username}</strong><small>{new Date(post.createdAt).toLocaleString()}</small></header>{post.text && <p>{post.text}</p>}{post.attachment && (post.attachment.type.startsWith('image/') ? <img className="fr-post-image" src={resolveWallMediaUrl(API_BASE_URL, post.attachment.url, post.attachment.size)} alt={post.attachment.name} /> : post.attachment.type.startsWith('video/') ? <div className="fr-video-frame"><video controls playsInline preload="metadata" src={resolveWallMediaUrl(API_BASE_URL, post.attachment.url, post.attachment.size)} /><span><Video /> VIDEO</span></div> : <p><ImageIcon /> {post.attachment.name}</p>)}{post.attachment && <div className="fr-profile-downloads"><Download /> {post.downloadCount || 0} downloads</div>}</article>)}</div></>}
  </main></div>;
}
