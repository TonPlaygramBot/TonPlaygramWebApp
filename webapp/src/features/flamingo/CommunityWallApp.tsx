import { ArrowLeft, PenLine } from 'lucide-react';
import { Link } from 'react-router-dom';

import MediaWall from './MediaWall';
import './community-wall.css';

export default function CommunityWallApp() {
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
