import { ArrowRight, BarChart3, CheckCircle2, CircleDot, Coins, Flag, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import gamesCatalog from '../config/gamesCatalog.js';

const summaries = [
  { title: 'Achievements', kicker: '6 product pillars', copy: 'Identity, multiplayer, rewards, wallet, social and marketplace systems.', to: '/achievements', icon: Trophy, accent: '#65e0b8', visual: 'checks' },
  { title: 'Roadmap', kicker: '6 delivery tracks', copy: 'Priorities, progress indicators, outcomes and accountable next steps.', to: '/roadmap', icon: Flag, accent: '#74a8ff', visual: 'bars' },
  { title: 'Tokenomics', kicker: 'Transparent value flow', copy: 'A visual breakdown of the platform fee and TPG ecosystem utility.', to: '/tokenomics', icon: Coins, accent: '#e5c66f', visual: 'donut' },
  { title: 'Platform stats', kicker: 'Live operations view', copy: 'Community, game, transaction and token activity in one dashboard.', to: '/platform-stats', icon: BarChart3, accent: '#c59bff', visual: 'chart' }
];

export default function ProjectAchievementsCard() {
  return (
    <section className="wide-card overflow-hidden rounded-[1.6rem] border border-[#d7b96e]/25 bg-[#0b1018] text-[#f5f1e8] shadow-2xl shadow-black/25">
      <header className="relative overflow-hidden border-b border-white/10 px-5 py-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#d7b96e]/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d7b96e]"><CircleDot size={12} /> Inside TonPlaygram</div>
          <h2 className="mt-2 font-serif text-[1.65rem] leading-tight text-white">The ecosystem, at a glance.</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">Explore what is delivered, what comes next, how value moves and how the platform performs.</p>
          <div className="mt-5 grid grid-cols-2 gap-2 text-center">
            <Stat value={gamesCatalog.length} label="Playable games" />
            <Stat value="1" label="Connected ecosystem" />
          </div>
        </div>
      </header>

      <div className="grid gap-3 p-4">
        {summaries.map(({ title, kicker, copy, to, icon: Icon, accent, visual }) => (
          <Link key={title} to={to} className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.055] to-transparent no-underline">
            <MiniVisual type={visual} accent={accent} />
            <div className="p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${accent}18`, color: accent }}><Icon size={19} /></span>
              <span className="min-w-0 flex-1"><span className="block text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: accent }}>{kicker}</span><strong className="mt-0.5 block text-sm text-white">{title}</strong><span className="mt-1 block text-[11px] leading-relaxed text-slate-400">{copy}</span></span>
              <ArrowRight size={16} className="mt-1 shrink-0 text-[#d7b96e] transition-transform group-hover:translate-x-1" />
            </div>
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

function MiniVisual({ type, accent }) {
  return <div className="relative flex h-24 items-end gap-2 overflow-hidden border-b border-white/[0.06] bg-[#080d14] px-4 pb-3 pt-4">
    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
    {type === 'bars' && [38, 54, 46, 72, 88].map((height, i) => <span key={height} className="relative flex-1 rounded-t-sm" style={{ height: `${height}%`, background: i === 4 ? accent : `${accent}55` }} />)}
    {type === 'checks' && <div className="relative grid w-full grid-cols-3 gap-2">{['Play', 'Earn', 'Own'].map(label => <span key={label} className="rounded-lg border border-white/10 bg-white/5 p-2 text-center text-[8px] uppercase tracking-wider text-slate-300"><CheckCircle2 size={13} className="mx-auto mb-1" style={{ color: accent }} />{label}</span>)}</div>}
    {type === 'donut' && <><span className="relative h-16 w-16 rounded-full" style={{ background: `conic-gradient(${accent} 0 40%, #6887a8 40% 70%, #875ee3 70% 90%, #4dd9ae 90%)` }}><span className="absolute inset-[9px] flex items-center justify-center rounded-full bg-[#0b111b] text-[9px] font-bold text-white">10% fee</span></span><div className="relative mb-1 grid flex-1 grid-cols-2 gap-x-2 gap-y-1 text-[8px] text-slate-400"><span>Rewards 4%</span><span>Treasury 3%</span><span>Product 2%</span><span>Growth 1%</span></div></>}
    {type === 'chart' && <svg className="relative h-full w-full" viewBox="0 0 260 70" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="stat-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor={accent} stopOpacity=".35"/><stop offset="1" stopColor={accent} stopOpacity="0"/></linearGradient></defs><path d="M0 64 L0 54 L35 49 L70 55 L108 33 L142 39 L180 17 L214 25 L260 5 L260 70 Z" fill="url(#stat-fill)"/><path d="M0 54 L35 49 L70 55 L108 33 L142 39 L180 17 L214 25 L260 5" fill="none" stroke={accent} strokeWidth="3"/></svg>}
  </div>;
}

function Stat({ value, label }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.035] px-2 py-3"><div className="font-serif text-xl text-white">{value}</div><div className="mt-0.5 text-[9px] uppercase tracking-[0.13em] text-slate-500">{label}</div></div>;
}
