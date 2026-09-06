import { ArrowLeft, CalendarDays, Grid3X3, Images, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../utils/api.js';
import MediaWall from './MediaWall';
import './community-wall.css';

type Profile = { accountId: string; name: string; avatar: string; bio: string; joinedAt?: string; postCount: number; mediaCount: number };

export default function SocialProfilePage() {
  const { accountId = '' } = useParams();
  const [profile, setProfile] = useState<Profile>();
  const [error, setError] = useState('');
  useEffect(() => {
    setError('');
    fetch(`${API_BASE_URL}/api/flamingo-wall/profiles/${encodeURIComponent(accountId)}`, { cache: 'no-store' })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body.profile; })
      .then(setProfile).catch(() => setError('This community profile is not available.'));
  }, [accountId]);
  return <div className="community-wall-page">
    <header className="community-wall-header"><div><Link to="/wall" aria-label="Back to social wall"><ArrowLeft /></Link><span><strong>Community profile</strong><small>TonPlayGram Social Wall</small></span></div></header>
    <main>
      {error ? <div className="wall-profile-error"><strong>Profile not found</strong><p>{error}</p><Link to="/wall">Return to the wall</Link></div> : !profile ? <div className="wall-profile-loading">Loading profile…</div> : <>
        <section className="wall-profile-card">
          <div className="wall-profile-cover"><span>TPG</span></div>
          <div className="wall-profile-identity">{profile.avatar ? <img src={profile.avatar} alt="" /> : <b>{profile.name.slice(0, 2).toUpperCase()}</b>}<div><h1>{profile.name} <ShieldCheck aria-label="Community member" /></h1><p>{profile.bio || 'Sharing moments with the TonPlayGram community.'}</p></div></div>
          <div className="wall-profile-stats"><span><Grid3X3 /><b>{profile.postCount}</b><small>Posts</small></span><span><Images /><b>{profile.mediaCount}</b><small>Media</small></span><span><CalendarDays /><b>{profile.joinedAt ? new Date(profile.joinedAt).getFullYear() : '—'}</b><small>Joined</small></span></div>
        </section>
        <MediaWall profileAccountId={profile.accountId} hideComposer />
      </>}
    </main>
  </div>;
}
