import { MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import MediaWall from '../features/flamingo/MediaWall';
import '../features/flamingo/community-wall.css';

export default function Social() {
  return (
    <main className="community-wall-page social-wall-page">
      <div className="social-wall-toolbar">
        <div><small>SOCIAL</small><strong>TonPlayGram Wall</strong></div>
        <Link to="/messages"><MessageCircle /> Messages</Link>
      </div>
      <section className="social-wall-content"><MediaWall /></section>
    </main>
  );
}
