import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Gamepad2,
  Gift,
  MessageCircle,
  ShoppingBag,
  Sparkles,
  Trophy,
  WalletCards
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

const deliveredHighlights = [
  { value: '12+', label: 'Playable games', detail: 'Solo, AI & multiplayer' },
  { value: '1', label: 'Connected profile', detail: 'Games, social & wallet' },
  { value: 'Live', label: 'Core platform', detail: 'Rewards, store & community' }
];

export default function HomeIntroduction() {
  return (
    <section className="home-intro" aria-labelledby="home-intro-title">
      <div className="home-intro__hero">
        <div className="home-intro__glow" aria-hidden="true" />
        <h1 id="home-intro-title">TonPlayGram is built for players — not the house.</h1>
        <div className="home-intro__message">
          <p>
            TonPlayGram is a <strong>gaming platform, not a gambling platform</strong>. Players compete against players, and we do not use algorithms to choose, influence, or predetermine winners.
          </p>
          <p>
            There is no house playing against you and no house advantage. <strong>Players win — TonPlayGram simply powers the experience.</strong>
          </p>
          <p>A small service fee helps us operate, maintain, and grow the ecosystem.</p>
        </div>
        <div className="home-intro__actions">
          <Link to="/games" className="home-intro__primary">Explore games <ArrowRight size={17} /></Link>
          <Link to="/ecosystem" className="home-intro__secondary">How it works</Link>
        </div>
        <SocialChannels variant="hero" />
      </div>

      <div className="home-progress" aria-labelledby="home-progress-title">
        <div className="home-progress__heading">
          <span className="home-progress__icon"><Sparkles size={16} /></span>
          <div>
            <span>BUILT SO FAR</span>
            <h2 id="home-progress-title">From concept to a working ecosystem</h2>
          </div>
          <span className="home-progress__status"><i /> LIVE</span>
        </div>
        <p className="home-progress__lede">A growing platform already brings the essential player journey together—from the first match to rewards, friendships and digital ownership.</p>
        <div className="home-progress__grid">
          {deliveredHighlights.map((item) => (
            <div className="home-progress__metric" key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
              <small>{item.detail}</small>
            </div>
          ))}
        </div>
        <Link to="/achievements" className="home-progress__link">See every milestone <ArrowRight size={15} /></Link>
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
