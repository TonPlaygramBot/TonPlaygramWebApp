import { ArrowLeft, Bell, MessageCircle, Newspaper, PenLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

import MediaWall from './MediaWall';
import './community-wall.css';

export default function CommunityWallApp() {
  useTelegramBackButton('/social');

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
        <nav className="community-wall-switch" aria-label="Social hub navigation">
          <Link to="/social"><MessageCircle /> Social hub</Link>
          <Link to="/wall" className="active" aria-current="page"><Newspaper /> Community wall</Link>
        </nav>
        <MediaWall />
      </main>
    </div>
  );
}
