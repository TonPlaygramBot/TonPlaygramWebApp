import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import MediaWall from './MediaWall';
import './community-wall.css';

export default function CommunityWallApp() {
  return (
    <div className="community-wall-page">
      <header className="community-wall-header">
        <div>
          <Link to="/" aria-label="Kthehu në faqen kryesore">
            <ArrowLeft />
          </Link>
          <span>
            <strong>TonPlayGram</strong>
            <small>Community Wall</small>
          </span>
        </div>
      </header>
      <main>
        <MediaWall />
      </main>
    </div>
  );
}
