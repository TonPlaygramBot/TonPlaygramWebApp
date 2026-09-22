import React from 'react';
import { Link } from 'react-router-dom';
import { Radio, ArrowUpRight } from 'lucide-react';

export default function CreatorHomeCard() {
  return (
    <Link to="/creator-studio?tab=accounts" className="home-creator-card" aria-label="Open Creator Studio to connect your social accounts">
        <div className="home-creator-card__heading"><span><Radio aria-hidden="true" /> TPG CREATOR STUDIO</span><ArrowUpRight aria-hidden="true" /></div>
        <h2>One studio. All your audiences.</h2>
        <p>Connect your accounts. Share posts and go live.</p>
        <div className="home-creator-card__platforms"><span>YouTube</span><span>Facebook</span><span>Instagram</span><span>TikTok</span></div>
        <strong>Connect your socials <ArrowUpRight aria-hidden="true" /></strong>
      </Link>
  );
}
