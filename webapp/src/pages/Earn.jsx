import { Coins, ListChecks, Pickaxe } from 'lucide-react';
import Mining from './Mining.jsx';
import Tasks from './Tasks.jsx';

export default function Earn() {
  return (
    <main className="hub-page earn-page">
      <header className="hub-hero">
        <span className="hub-kicker"><Coins size={15} /> Rewards centre</span>
        <h1>Earn</h1>
        <p>Mine TPG and complete rewarding tasks from one organised place.</p>
        <nav className="hub-jump-links" aria-label="Earn sections">
          <a href="#mining"><Pickaxe size={16} /> Mining</a>
          <a href="#tasks"><ListChecks size={16} /> Tasks</a>
        </nav>
      </header>
      <section id="mining" className="hub-section">
        <div className="hub-section-title"><Pickaxe /><div><h2>Mining</h2><p>Start cycles, boost earnings and review rewards.</p></div></div>
        <Mining />
      </section>
      <section id="tasks" className="hub-section">
        <div className="hub-section-title"><ListChecks /><div><h2>Tasks</h2><p>Check in, complete quests and claim bonuses.</p></div></div>
        <Tasks />
      </section>
    </main>
  );
}
