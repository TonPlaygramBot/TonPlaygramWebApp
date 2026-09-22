import WallFollowButton from './WallFollowButton';
import WallNotifications from './WallNotifications';
import WallProfileEditor from './WallProfileEditor';
import { useWallFollowing } from './wallFollowing';
import {
  ArrowLeft,
  CalendarDays,
  Grid3X3,
  Images,
  ShieldCheck
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../utils/api.js';
import WallAvatar from './WallAvatar';
import MediaWall from './MediaWall';
import './community-wall.css';

type Profile = {
  accountId: string;
  name: string;
  avatar: string;
  bio: string;
  joinedAt?: string;
  followers: number;
  following: number;
  postCount: number;
  mediaCount: number;
};

export default function SocialProfilePage() {
  const { accountId = '' } = useParams();
  const [profile, setProfile] = useState<Profile>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const viewer = useWallFollowing();
  const isFollowing = viewer.following.some(
    (row) => row.authorAccountId === accountId
  );
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setProfile(undefined);
    fetch(
      `${API_BASE_URL}/api/flamingo-wall/profiles/${encodeURIComponent(accountId)}`,
      { cache: 'no-store', signal: controller.signal }
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        return body.profile;
      })
      .then((value) => {
        if (!controller.signal.aborted) setProfile(value);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('This community profile is not available.');
      });
    return () => controller.abort();
  }, [accountId, revision, isFollowing]);
  return (
    <div className="community-wall-page">
      <header className="community-wall-header">
        <div>
          <Link to="/wall" aria-label="Back to social wall">
            <ArrowLeft />
          </Link>
          <span>
            <strong>Community profile</strong>
            <small>TonPlayGram Social Wall</small>
          </span>
        </div>
        <WallNotifications />
      </header>
      <main>
        {error ? (
          <div className="wall-profile-error">
            <strong>Profile not found</strong>
            <p>{error}</p>
            <Link to="/wall">Return to the wall</Link>
          </div>
        ) : !profile ? (
          <div className="wall-profile-loading">Loading profile…</div>
        ) : (
          <>
            <section className="wall-profile-card">
              <div className="wall-profile-cover">
                <span>TPG</span>
              </div>
              <div className="wall-profile-identity">
                <WallAvatar name={profile.name} src={profile.avatar} />
                <div>
                  <h1>
                    {profile.name} <ShieldCheck aria-label="Community member" />
                  </h1>
                  <p>
                    {profile.bio ||
                      'Sharing moments with the TonPlayGram community.'}
                  </p>
                </div>
              </div>
              <div className="wall-profile-actions">
                {viewer.accountId === profile.accountId ? (
                  <WallProfileEditor
                    name={profile.name}
                    onSaved={() => setRevision((value) => value + 1)}
                  />
                ) : (
                  <WallFollowButton
                    accountId={profile.accountId}
                    name={profile.name}
                  />
                )}
              </div>
              <div className="wall-profile-stats">
                <span>
                  <b>{profile.followers || 0}</b>
                  <small>Followers</small>
                </span>
                <span>
                  <b>{profile.following || 0}</b>
                  <small>Following</small>
                </span>
                <span>
                  <Grid3X3 />
                  <b>{profile.postCount}</b>
                  <small>Posts</small>
                </span>
                <span>
                  <Images />
                  <b>{profile.mediaCount}</b>
                  <small>Media</small>
                </span>
                <span>
                  <CalendarDays />
                  <b>
                    {profile.joinedAt
                      ? new Date(profile.joinedAt).getFullYear()
                      : '—'}
                  </b>
                  <small>Joined</small>
                </span>
              </div>
            </section>
            <MediaWall profileAccountId={profile.accountId} hideComposer />
          </>
        )}
      </main>
    </div>
  );
}
