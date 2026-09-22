import { useWallFollowing } from './wallFollowing';
import { ArrowLeft, Download, PenLine, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

import MediaWall from './MediaWall';
import WallNotifications from './WallNotifications';
import './community-wall.css';

export default function CommunityWallApp() {
  const { accountId } = useWallFollowing();
  const location = useLocation();
  useEffect(() => {
    if (location.hash !== '#wall-composer') return;
    // The slot registers the persistent composer after the route has mounted.
    const frame = requestAnimationFrame(() => window.dispatchEvent(new Event('wall-compose')));
    return () => cancelAnimationFrame(frame);
  }, [location.key, location.hash]);
  return (
    <div className="community-wall-page">
      <header className="community-wall-header">
        <div>
          <Link to="/" aria-label="Back to home">
            <ArrowLeft />
          </Link>
          <span>
            <strong>TonPlayGram</strong>
            <small>Social wall</small>
          </span>
        </div>
        <div className="community-wall-header-actions">
          {!window.location.pathname.startsWith('/social-app/') && <a href="/social-app/install" aria-label="Install TonPlayGram Social"><Download /></a>}
          {accountId && (
            <Link
              to={`/wall/profile/${encodeURIComponent(accountId)}`}
              aria-label="My profile"
            >
              <UserRound />
            </Link>
          )}
          <WallNotifications />
          <button
            type="button"
            className="wall-header-compose"
            aria-label="Create a post"
            onClick={() => window.dispatchEvent(new Event('wall-compose'))}
          >
            <PenLine />
          </button>
        </div>
      </header>
      <main>
        <MediaWall />
      </main>
    </div>
  );
}
