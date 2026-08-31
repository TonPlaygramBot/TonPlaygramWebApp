import { ArrowLeft, Bell, PenLine } from 'lucide-react';
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
            <strong>Protesta shqiptare</strong>
            <small>Komuniteti TonPlayGram</small>
          </span>
        </div>
        <div className="community-wall-header-actions">
          <button aria-label="Njoftimet"><Bell /></button>
          <a href="#wall-composer" aria-label="Krijo një postim"><PenLine /></a>
        </div>
      </header>
      <main>
        <MediaWall />
      </main>
    </div>
  );
}
