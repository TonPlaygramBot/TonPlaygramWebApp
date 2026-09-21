import { useWallFollowing } from './wallFollowing';
import { ArrowLeft, PenLine, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';

import MediaWall from './MediaWall';
import WallNotifications from './WallNotifications';
import './community-wall.css';

export default function CommunityWallApp() {
  const { accountId } = useWallFollowing();
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
