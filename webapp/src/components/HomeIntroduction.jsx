import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Gamepad2,
  Gift,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  Trophy,
  WalletCards,
  Zap
} from 'lucide-react';

import { getGameThumbnail } from '../config/gameAssets.js';
import SocialChannels from './SocialChannels.jsx';

const featuredGames = [
  { key: 'poolroyale', name: 'Pool Royale', mode: '3D cue sports', to: '/games/poolroyale/lobby' },
  { key: 'texasholdem', name: 'Texas Hold’em', mode: 'Cards & strategy', to: '/games/texasholdem/lobby' },
  { key: 'chessbattleroyal', name: 'Chess Battle', mode: 'Tactical arena', to: '/games/chessbattleroyal/lobby' },
  { key: 'ludobattleroyal', name: 'Ludo Royale', mode: 'Fast social play', to: '/games/ludobattleroyal/lobby' }
];

const ecosystem = [
  { icon: Gamepad2, title: 'Play', text: 'Solo, AI and live multiplayer games.', to: '/games', tone: 'cyan' },
  { icon: Trophy, title: 'Earn', text: 'Daily rewards, tasks and challenges.', to: '/earn', tone: 'violet' },
  { icon: MessageCircle, title: 'Connect', text: 'Friends, groups, chat and invites.', to: '/social', tone: 'pink' },
  { icon: WalletCards, title: 'Wallet', text: 'Keep your TPG activity in one place.', to: '/wallet', tone: 'blue' },
  { icon: ShoppingBag, title: 'Collect', text: 'Discover gear, gifts and themes.', to: '/store', tone: 'amber' },
  { icon: Gift, title: 'Invite', text: 'Bring friends and grow together.', to: '/referral', tone: 'green' }
];

export default function HomeIntroduction() {
  return (
    <section className="home-intro" aria-labelledby="home-intro-title">
      <div className="home-intro__hero">
        <div className="home-intro__glow" aria-hidden="true" />
        <div className="home-intro__eyebrow"><Zap size={13} fill="currentColor" /> PLAY · CONNECT · EARN</div>
        <h1 id="home-intro-title">Your world of<br /><span>play, in one place.</span></h1>
        <p>TonPlayGram brings competitive games, community, rewards and digital collectibles into one mobile-first ecosystem.</p>
        <div className="home-intro__actions">
          <Link to="/games" className="home-intro__primary">Explore games <ArrowRight size={17} /></Link>
          <Link to="/ecosystem" className="home-intro__secondary">How it works</Link>
        </div>
        <div className="home-intro__trust"><ShieldCheck size={16} /><span>One profile. Clear activity. Built for players.</span></div>
        <SocialChannels variant="hero" />
      </div>

      <div className="home-section-heading">
        <div><span>FEATURED</span><h2>Pick your next game</h2></div>
        <Link to="/games">View all <ArrowRight size={14} /></Link>
      </div>
      <div className="home-featured-games">
        {featuredGames.map((game) => (
          <Link to={game.to} className="home-game-tile" key={game.key}>
            <img src={getGameThumbnail(game.key)} alt={`${game.name} game thumbnail`} />
            <div className="home-game-tile__shade" />
            <div className="home-game-tile__copy"><strong>{game.name}</strong><span>{game.mode}</span></div>
            <span className="home-game-tile__play" aria-hidden="true">▶</span>
          </Link>
        ))}
      </div>

      <div className="home-section-heading home-section-heading--ecosystem">
        <div><span>EVERYTHING CONNECTED</span><h2>Inside TonPlayGram</h2></div>
      </div>
      <p className="home-ecosystem-lede">Start with a game, meet your community and build your journey. Every area is easy to reach and works around one player identity.</p>
      <div className="home-ecosystem-grid">
        {ecosystem.map(({ icon: Icon, title, text, to, tone }) => (
          <Link to={to} className={`home-ecosystem-card home-ecosystem-card--${tone}`} key={title}>
            <span className="home-ecosystem-card__icon"><Icon size={20} /></span>
            <span><strong>{title}</strong><small>{text}</small></span>
            <ArrowRight className="home-ecosystem-card__arrow" size={15} />
          </Link>
        ))}
      </div>
    </section>
  );
}
