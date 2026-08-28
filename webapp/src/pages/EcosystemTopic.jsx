import { useEffect } from 'react';
import { ArrowLeft, BarChart3, Check, Coins, Flag, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { achievements, roadmap, tokenomics } from '../config/ecosystemContent.js';

const meta = {
  achievements: { eyebrow: 'What we have built', title: 'Achievements', intro: 'A detailed record of the connected systems already represented in the TonPlaygram prototype.', icon: Trophy },
  roadmap: { eyebrow: 'Where we are going', title: 'Delivery roadmap', intro: 'A transparent view of priorities, intended outcomes and the work required to reach them.', icon: Flag },
  tokenomics: { eyebrow: 'How value moves', title: 'Tokenomics', intro: 'A plain-language explanation of TPG utility and the proposed platform-fee allocation.', icon: Coins }
};

export default function EcosystemTopic({ topic }) {
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); }, [topic]);
  const page = meta[topic]; const Icon = page.icon;
  return <article className="space-y-4 pb-8 text-slate-200">
    <header className="rounded-[1.6rem] border border-[#d7b96e]/25 bg-[#0b111b] p-5">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-slate-400 no-underline"><ArrowLeft size={14} /> Home</Link>
      <Icon className="mt-8 text-[#d7b96e]" size={26} /><p className="mt-3 text-[9px] font-bold uppercase tracking-[0.25em] text-[#d7b96e]">{page.eyebrow}</p><h1 className="mt-2 font-serif text-3xl text-white">{page.title}</h1><p className="mt-3 text-xs leading-6 text-slate-400">{page.intro}</p>
    </header>
    {topic === 'achievements' && achievements.map((item, i) => <Card key={item.title} index={i} title={item.title} intro={item.summary} items={item.details} />)}
    {topic === 'roadmap' && roadmap.map((item, i) => <Card key={item.title} index={i} badge={`${item.phase} · ${item.progress}%`} title={item.title} intro={item.goal} items={item.deliverables} progress={item.progress} />)}
    {topic === 'tokenomics' && <><section className="rounded-2xl border border-[#d7b96e]/20 bg-[#d7b96e]/[0.06] p-5 text-xs leading-6 text-slate-300"><BarChart3 className="mb-3 text-[#d7b96e]" /><strong className="text-white">TPG is designed for utility, not a promise of profit.</strong><p className="mt-2 text-slate-400">Potential uses include eligible game entry, rewards, transfers and selected marketplace items. Launch details depend on compliance, security and economic review.</p></section>{tokenomics.map((item, i) => <Card key={item.title} index={i} badge={item.value} title={item.title} intro={item.text} />)}<section className="rounded-2xl border border-white/10 bg-[#0b111b] p-5 text-xs leading-6 text-slate-400"><strong className="text-white">Read the percentages correctly</strong><p className="mt-2">The 10% platform fee is allocated as 4% rewards, 3% treasury and liquidity, 2% product and infrastructure, and 1% community growth. These figures are not token-supply allocations, investment returns or price guarantees.</p></section></>}
    <Link to="/ecosystem" className="block rounded-xl bg-[#d7b96e] px-4 py-3 text-center text-sm font-bold text-[#10141b] no-underline">Read the complete ecosystem guide</Link>
  </article>;
}

function Card({ index, badge, title, intro, items = [], progress }) { return <section className="rounded-2xl border border-white/10 bg-[#0b111b] p-5"><div className="flex items-start gap-3"><span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#d7b96e]/10 px-2 font-mono text-[10px] text-[#d7b96e]">{badge || String(index + 1).padStart(2, '0')}</span><div><h2 className="font-serif text-xl text-white">{title}</h2><p className="mt-2 text-xs leading-6 text-slate-400">{intro}</p></div></div>{progress !== undefined && <div className="mt-4 h-1 rounded-full bg-white/10"><div className="h-full rounded-full bg-[#d7b96e]" style={{ width: `${progress}%` }} /></div>}{items.length > 0 && <ul className="mt-4 space-y-2 border-t border-white/10 pt-4">{items.map((item) => <li key={item} className="flex gap-2 text-[11px] leading-5 text-slate-400"><Check size={14} className="mt-0.5 shrink-0 text-emerald-400" />{item}</li>)}</ul>}</section>; }
