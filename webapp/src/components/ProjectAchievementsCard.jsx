import { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  CircleDot,
  Landmark,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  WalletCards,
} from 'lucide-react';
import gamesCatalog from '../config/gamesCatalog.js';

const achievements = [
  { title: 'Wallet & public ledgers', detail: 'TPC transfers, deposits, withdrawals, game rewards and mining records are live and auditable.', icon: WalletCards },
  { title: 'Social play', detail: 'Friends, inbox, in-game chat, Telegram notifications and group invitations are available.', icon: Users },
  { title: 'Rewards engine', detail: 'Daily check-ins, mining, rewarded video, social tasks, referrals, Lucky Card and Spin & Win are active.', icon: Sparkles },
  { title: 'Competitive systems', detail: 'Matchmaking, tournament brackets, leaderboards and automated winner gifts are delivered.', icon: Target },
  { title: 'Store & digital items', detail: 'The marketplace, NFT gifts and the majority of the visual store catalogue are available.', icon: ShieldCheck },
];

const roadmap = [
  { title: 'Connection reliability', progress: 85, status: 'Final QA', description: 'Complete reconnection coverage, high-latency testing and multiplayer load validation.' },
  { title: 'Store visual system', progress: 85, status: 'In production', description: 'Replace the remaining legacy placeholders and unify item lighting and metadata.' },
  { title: 'Native mobile launch', progress: 70, status: 'Preparing release', description: 'Finish compliance, tune mid-range device performance and stage Android and iOS rollout.' },
  { title: 'Community operations', progress: 40, status: 'Building', description: 'Introduce structured voting, monthly roadmap reviews and public issue tracking.' },
  { title: 'TPG token utility', progress: 20, status: 'Planning', description: 'Finalize token economics, compliance, minting and the in-app utility rollout.' },
  { title: 'Exchange readiness', progress: 10, status: 'Planned', description: 'Prepare documentation, liquidity strategy and a responsible CEX/DEX launch sequence.' },
];

const feeSplit = [
  { label: 'Player rewards', description: 'Prize pools and competitive incentives', value: 4, color: '#d7b96e' },
  { label: 'Treasury & liquidity', description: 'Long-term ecosystem stability', value: 3, color: '#9b8fd9' },
  { label: 'Product & infrastructure', description: 'Servers, security and game updates', value: 2, color: '#65a9a1' },
  { label: 'Community growth', description: 'Campaigns and partnerships', value: 1, color: '#b87861' },
];

export default function ProjectAchievementsCard() {
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const [expandedStep, setExpandedStep] = useState(0);
  const liveGames = useMemo(() => gamesCatalog.filter((game) => !game.comingSoon).length, []);
  const roadmapProgress = Math.round(roadmap.reduce((sum, item) => sum + item.progress, 0) / roadmap.length);
  const visibleAchievements = showAllAchievements ? achievements : achievements.slice(0, 3);

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-[#d7b96e]/25 bg-[#0b1018] text-[#f5f1e8] shadow-2xl shadow-black/25 wide-card">
      <header className="relative overflow-hidden border-b border-white/10 px-5 pb-5 pt-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#d7b96e]/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d7b96e]">
            <CircleDot size={12} /> Platform progress
          </div>
          <h2 className="mt-2 font-serif text-[1.65rem] leading-tight text-white">Built with purpose.<br />Growing with clarity.</h2>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-400">A transparent view of what is live today, what comes next, and how platform fees support the ecosystem.</p>
          <div className="mt-5 grid grid-cols-3 divide-x divide-white/10 rounded-xl border border-white/10 bg-white/[0.035] py-3 text-center">
            <Stat value={liveGames || gamesCatalog.length} label="Games live" />
            <Stat value={`${achievements.length}`} label="Core systems" />
            <Stat value={`${roadmapProgress}%`} label="Roadmap" />
          </div>
        </div>
      </header>

      <div className="space-y-8 px-4 py-6">
        <div>
          <SectionHeading index="01" title="Delivered achievements" subtitle="The foundation already in players’ hands." />
          <div className="mt-4 space-y-2">
            {visibleAchievements.map(({ title, detail, icon: Icon }) => (
              <article key={title} className="flex gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"><Icon size={17} /></div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5"><h3 className="text-sm font-semibold text-white">{title}</h3><Check size={13} className="text-emerald-400" /></div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{detail}</p>
                </div>
              </article>
            ))}
          </div>
          <button type="button" onClick={() => setShowAllAchievements((value) => !value)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#d7b96e]/20 !bg-transparent py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d7b96e]">
            {showAllAchievements ? 'Show less' : `View all ${achievements.length} systems`}
            <ChevronDown size={14} className={showAllAchievements ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
        </div>

        <div>
          <SectionHeading index="02" title="Delivery roadmap" subtitle="Prioritized milestones, reported without hype." />
          <div className="mt-5">
            {roadmap.map((step, index) => {
              const isExpanded = expandedStep === index;
              return (
                <div key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < roadmap.length - 1 && <div className="absolute bottom-0 left-[13px] top-7 w-px bg-white/10" />}
                  <div className={`relative z-[1] mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${step.progress >= 70 ? 'border-[#d7b96e]/50 bg-[#d7b96e]/15 text-[#e4cc91]' : 'border-white/15 bg-[#111824] text-slate-400'}`}>{String(index + 1).padStart(2, '0')}</div>
                  <button type="button" onClick={() => setExpandedStep(isExpanded ? -1 : index)} className="min-w-0 flex-1 !bg-transparent p-0 text-left shadow-none">
                    <div className="flex items-start justify-between gap-2">
                      <div><p className="text-sm font-semibold text-white">{step.title}</p><p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-[#d7b96e]">{step.status}</p></div>
                      <span className="font-mono text-xs text-slate-300">{step.progress}%</span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-gradient-to-r from-[#9d844c] to-[#e3c878]" style={{ width: `${step.progress}%` }} /></div>
                    {isExpanded && <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{step.description}</p>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <SectionHeading index="03" title="Tokenomics" subtitle="A simple, published fee allocation." />
          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#0e1520] p-4">
            <div className="flex items-center gap-5">
              <div className="relative h-28 w-28 shrink-0 rounded-full" style={{ background: 'conic-gradient(#d7b96e 0 40%, #9b8fd9 40% 70%, #65a9a1 70% 90%, #b87861 90% 100%)' }}>
                <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full bg-[#0e1520]"><strong className="font-serif text-2xl text-white">10%</strong><span className="text-[9px] uppercase tracking-[0.16em] text-slate-500">platform fee</span></div>
              </div>
              <div><div className="flex items-center gap-2 text-[#d7b96e]"><Landmark size={17} /><span className="text-xs font-semibold uppercase tracking-[0.16em]">Sustainable by design</span></div><p className="mt-2 text-[11px] leading-relaxed text-slate-400">Applied to paid matches and premium purchases. The other 90% is not a platform fee.</p></div>
            </div>
            <div className="mt-5 space-y-3 border-t border-white/[0.08] pt-4">
              {feeSplit.map((item) => <div key={item.label} className="flex items-center gap-3"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><div className="min-w-0 flex-1"><p className="text-xs font-medium text-slate-200">{item.label}</p><p className="text-[10px] text-slate-500">{item.description}</p></div><strong className="font-mono text-sm text-white">{item.value}%</strong></div>)}
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#d7b96e]/15 bg-[#d7b96e]/[0.06] p-3 text-[10px] leading-relaxed text-slate-400"><Rocket size={15} className="mt-0.5 shrink-0 text-[#d7b96e]" /><p>Token launch and exchange milestones remain roadmap items. Percentages describe platform fee allocation—not investment returns or price promises.</p></div>
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }) {
  return <div className="px-1"><div className="font-serif text-xl text-white">{value}</div><div className="mt-0.5 text-[9px] uppercase tracking-[0.13em] text-slate-500">{label}</div></div>;
}

function SectionHeading({ index, title, subtitle }) {
  return <div className="flex items-start gap-3"><span className="pt-1 font-mono text-[10px] text-[#d7b96e]">{index}</span><div><h3 className="font-serif text-lg text-white">{title}</h3><p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p></div></div>;
}
