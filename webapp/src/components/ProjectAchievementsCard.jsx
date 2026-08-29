import { ArrowRight, BarChart3, Check, CircleDot, Coins, Flag, Gamepad2, ShieldCheck, Sparkles, Trophy, Users, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import gamesCatalog from '../config/gamesCatalog.js';

const summaries = [
  { title: 'Achievements', kicker: 'What is live', copy: 'See the product pillars already connecting identity, multiplayer, rewards and social play.', to: '/achievements', icon: Trophy, accent: '#65e0b8', meta: '6 product pillars', progress: 76 },
  { title: 'Roadmap', kicker: 'Where we are going', copy: 'Follow every delivery track, its current progress and the outcomes planned next.', to: '/roadmap', icon: Flag, accent: '#74a8ff', meta: '6 delivery tracks', progress: 58 },
  { title: 'Tokenomics', kicker: 'How value moves', copy: 'Understand platform fees, reward allocation and the utility designed around TPG.', to: '/tokenomics', icon: Coins, accent: '#e5c66f', meta: 'Transparent flow', progress: 84 },
  { title: 'Platform stats', kicker: 'Live operations', copy: 'Open one dashboard for community, games, transactions and token activity.', to: '/platform-stats', icon: BarChart3, accent: '#c59bff', meta: 'Operational view', progress: 67 }
];

const journey = [
  { label: 'Play', icon: Gamepad2 },
  { label: 'Connect', icon: Users },
  { label: 'Earn', icon: Sparkles },
  { label: 'Own', icon: WalletCards }
];

export default function ProjectAchievementsCard() {
  return (
    <section className="wide-card overflow-hidden rounded-[1.8rem] border border-[#d7b96e]/25 bg-[#090e16] text-[#f5f1e8] shadow-2xl shadow-black/30">
      <header className="relative isolate overflow-hidden border-b border-white/10 px-5 pb-5 pt-6">
        <div className="pointer-events-none absolute -right-20 -top-28 -z-10 h-64 w-64 rounded-full bg-[#d7b96e]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 -z-10 h-56 w-56 rounded-full bg-cyan-400/[0.08] blur-3xl" />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.26em] text-[#e2c676]"><CircleDot size={12} /> Inside TonPlaygram</div>
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.14em] text-emerald-300">Ecosystem map</span>
        </div>
        <h2 className="mt-4 max-w-[18rem] font-serif text-[1.8rem] leading-[1.06] text-white">The ecosystem,<br /><span className="text-[#dfc475]">at a glance.</span></h2>
        <p className="mt-3 max-w-md text-[11px] leading-[1.7] text-slate-400">One player identity connects competitive games, community, rewards and digital ownership. Explore what is available now, what comes next and how every part works together.</p>

        <div className="relative mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-3.5">
          <div className="absolute left-[12%] right-[12%] top-[29px] h-px bg-gradient-to-r from-transparent via-[#d7b96e]/60 to-transparent" />
          <div className="relative grid grid-cols-4 gap-1">
            {journey.map(({ label, icon: Icon }, index) => (
              <div key={label} className="flex min-w-0 flex-col items-center text-center">
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#d7b96e]/20 bg-[#101721] text-[#e1c474] shadow-[0_5px_15px_rgba(0,0,0,.3)]"><Icon size={16} /></span>
                <strong className="mt-2 text-[9px] text-slate-200">{label}</strong>
                <span className="mt-0.5 text-[7px] uppercase tracking-wider text-slate-600">0{index + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat value={gamesCatalog.length} label="Playable games" />
          <Stat value="6" label="Core pillars" />
          <Stat value="1" label="Player identity" />
        </div>
      </header>

      <div className="p-4">
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div><span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#d7b96e]">Explore the system</span><h3 className="mt-1 text-sm font-bold text-white">A clearer view of every layer</h3></div>
          <ShieldCheck size={20} className="mb-0.5 shrink-0 text-slate-600" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {summaries.map(({ title, kicker, copy, to, icon: Icon, accent, meta, progress }) => (
            <Link key={title} to={to} className="group relative overflow-hidden rounded-2xl border border-white/[0.09] bg-gradient-to-br from-white/[0.065] to-white/[0.015] p-4 no-underline transition-colors hover:border-white/20">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-10 blur-2xl" style={{ background: accent }} />
              <div className="relative flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border" style={{ background: `${accent}12`, borderColor: `${accent}28`, color: accent }}><Icon size={18} /></span>
                <span className="min-w-0 flex-1"><span className="block text-[8px] font-bold uppercase tracking-[0.16em]" style={{ color: accent }}>{kicker}</span><strong className="mt-0.5 block text-sm text-white">{title}</strong></span>
                <ArrowRight size={15} className="mt-1 shrink-0 text-slate-500 transition-transform group-hover:translate-x-1" />
              </div>
              <p className="relative mt-3 text-[10px] leading-[1.55] text-slate-400">{copy}</p>
              <div className="relative mt-3 flex items-center gap-2">
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.07]"><span className="block h-full rounded-full" style={{ width: `${progress}%`, background: accent }} /></span>
                <span className="flex items-center gap-1 text-[8px] font-semibold text-slate-500"><Check size={10} style={{ color: accent }} />{meta}</span>
              </div>
            </Link>
          ))}
        </div>
        <Link to="/ecosystem" className="mt-4 flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#b99750] via-[#dfc579] to-[#efd993] px-4 py-3 text-[#10141b] shadow-lg shadow-[#d7b96e]/10 no-underline">
          <span><span className="block text-[8px] font-bold uppercase tracking-[0.17em] opacity-60">The complete story</span><strong className="mt-0.5 block text-xs">Open the TonPlaygram guide</strong></span>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/10"><ArrowRight size={16} /></span>
        </Link>
        <p className="mt-3 text-center text-[9px] leading-relaxed text-slate-600">Detailed sections · Product roadmap · Downloadable PDF</p>
      </div>
    </section>
  );
}

function Stat({ value, label }) {
  return <div className="rounded-xl border border-white/[0.08] bg-black/20 px-1.5 py-2.5 text-center"><div className="font-serif text-lg leading-none text-white">{value}</div><div className="mt-1.5 text-[7px] uppercase leading-tight tracking-[0.1em] text-slate-500">{label}</div></div>;
}
