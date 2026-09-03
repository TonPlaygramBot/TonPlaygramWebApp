import { ArrowLeft, Bell, PenLine } from 'lucide-react';
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
            <strong>TonPlayGram Social Wall</strong>
            <small>TonPlayGram Community</small>
          </span>
        </div>
        <div className="community-wall-header-actions">
          <button aria-label="Notifications"><Bell /></button>
          <a href="#wall-composer" aria-label="Create a post"><PenLine /></a>
        </div>
      </header>
      <main>
        <MediaWall />
      </main>
    </div>
  );
}
