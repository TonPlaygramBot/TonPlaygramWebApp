import { ArrowRight, BarChart3, CircleDot, Coins, Flag, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import gamesCatalog from '../config/gamesCatalog.js';

const summaries = [
  { title: 'Achievements', copy: 'See the core systems already delivered across play, rewards, wallets and community.', to: '/achievements', icon: Trophy },
  { title: 'Roadmap', copy: 'Follow the priorities taking TonPlaygram from prototype to a reliable global platform.', to: '/roadmap', icon: Flag },
  { title: 'Tokenomics', copy: 'Understand TPG utility, the platform fee and how value flows through the ecosystem.', to: '/tokenomics', icon: Coins },
  { title: 'Platform stats', copy: 'Explore live community, game, transaction and token activity with transparent data.', to: '/platform-stats', icon: BarChart3 }
];

export default function ProjectAchievementsCard() {
  return (
    <section className="wide-card overflow-hidden rounded-[1.6rem] border border-[#d7b96e]/25 bg-[#0b1018] text-[#f5f1e8] shadow-2xl shadow-black/25">
      <header className="relative overflow-hidden border-b border-white/10 px-5 py-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#d7b96e]/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d7b96e]"><CircleDot size={12} /> Inside TonPlaygram</div>
          <h2 className="mt-2 font-serif text-[1.65rem] leading-tight text-white">A quick view of the ecosystem.</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">The home page stays simple. Open any topic for the complete story, evidence and next steps.</p>
          <div className="mt-5 grid grid-cols-2 gap-2 text-center">
            <Stat value={gamesCatalog.length} label="Playable games" />
            <Stat value="1" label="Connected ecosystem" />
          </div>
        </div>
      </header>

      <div className="grid gap-3 p-4">
        {summaries.map(({ title, copy, to, icon: Icon }) => (
          <Link key={title} to={to} className="group rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 no-underline">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#d7b96e]/10 text-[#dfc57e]"><Icon size={19} /></span>
              <span className="min-w-0 flex-1"><strong className="text-sm text-white">{title}</strong><span className="mt-1 block text-[11px] leading-relaxed text-slate-400">{copy}</span></span>
              <ArrowRight size={16} className="mt-1 shrink-0 text-[#d7b96e] transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
        <Link to="/ecosystem" className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#b99750] to-[#e4ca82] px-4 py-3 text-sm font-bold text-[#10141b] shadow-lg shadow-[#d7b96e]/10 no-underline">
          Read the full TonPlaygram introduction <ArrowRight size={17} />
        </Link>
        <p className="text-center text-[10px] leading-relaxed text-slate-500">The complete guide includes every section and can be downloaded as a PDF.</p>
      </div>
    </section>
  );
}

function Stat({ value, label }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.035] px-2 py-3"><div className="font-serif text-xl text-white">{value}</div><div className="mt-0.5 text-[9px] uppercase tracking-[0.13em] text-slate-500">{label}</div></div>;
}
