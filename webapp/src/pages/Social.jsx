import { BarChart3, Trophy, Users } from 'lucide-react';
import HomeSocialHub from '../components/HomeSocialHub.jsx';
import PlatformStatsCard from '../components/PlatformStatsCard.jsx';
import LeaderboardCard from '../components/LeaderboardCard.jsx';

export default function Social() {
  return (
    <main className="hub-page social-page">
      <header className="hub-hero">
        <span className="hub-kicker"><Users size={15} /> Community centre</span>
        <h1>Social</h1>
        <p>Connect with players, follow the rankings and see TonPlaygram grow.</p>
        <nav className="hub-jump-links" aria-label="Social sections">
          <a href="#community"><Users size={16} /> Hub</a>
          <a href="#leaderboard"><Trophy size={16} /> Leaders</a>
          <a href="#platform-stats"><BarChart3 size={16} /> Stats</a>
        </nav>
      </header>
      <section id="community" className="hub-section"><HomeSocialHub /></section>
      <section id="leaderboard" className="hub-section"><LeaderboardCard /></section>
      <section id="platform-stats" className="hub-section"><PlatformStatsCard /></section>
    </main>
  );
}
