import { ArrowLeft, Image, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';

import MediaWall from '../features/flamingo/MediaWall';
import '../features/flamingo/community-wall.css';
import { API_BASE_URL } from '../utils/api.js';

type ProfileSummary = { author: string; authorAvatar?: string; posts: number };

export default function WallProfile() {
  const { accountId = '' } = useParams();
  const [profile, setProfile] = useState<ProfileSummary>({ author: 'TonPlayGram member', posts: 0 });

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/api/flamingo-wall/posts`, { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(({ posts = [] }) => {
        const ownPosts = posts.filter((post: { authorAccountId?: string }) => post.authorAccountId === accountId);
        if (active && ownPosts.length) setProfile({ author: ownPosts[0].author, authorAvatar: ownPosts[0].authorAvatar, posts: ownPosts.length });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [accountId]);

  return (
    <main className="community-wall-page wall-profile-page">
      <section className="wall-profile-shell">
        <Link className="wall-profile-back" to="/wall"><ArrowLeft /> TonPlayGram Wall</Link>
        <div className="wall-profile-cover" aria-hidden="true" />
        <header className="wall-profile-header">
          {profile.authorAvatar ? <img src={profile.authorAvatar} alt={`${profile.author} profile`} /> : <span>{profile.author.slice(0, 2).toUpperCase()}</span>}
          <div><h1>{profile.author}</h1><p><Users /> TonPlayGram community member</p></div>
        </header>
        <div className="wall-profile-stats"><span><b>{profile.posts}</b> posts</span><span><Image /> Photos, videos & files</span></div>
        <MediaWall profileAccountId={accountId} showComposer={false} showHeading={false} />
      </section>
    </main>
  );
}
