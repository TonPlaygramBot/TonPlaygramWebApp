import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { SNOOKER_CAREER_STAGES, loadSnookerCareerProgress } from '../../config/snookerRoyalCareer.js';

export default function SnookerRoyalCareer() {
  const navigate = useNavigate();
  useTelegramBackButton('/games/snookerroyale/lobby');
  const completed = useMemo(() => new Set(loadSnookerCareerProgress()), []);
  const firstOpen = SNOOKER_CAREER_STAGES.findIndex((stage) => !completed.has(stage.id));
  const launch = (stage) => {
    const params = new URLSearchParams({ type: 'training', mode: 'ai', career: '1', careerStageId: stage.id, trainingLevel: String(stage.level), trainingMode: stage.level < 4 ? 'solo' : 'ai', rules: stage.level === 1 ? 'off' : 'on' });
    navigate(`/games/snookerroyale?${params}`);
  };
  return <main className="min-h-screen bg-[#07120f] px-3 pb-24 pt-4 text-white">
    <header className="rounded-3xl border border-amber-300/30 bg-gradient-to-br from-emerald-950 via-slate-950 to-amber-950 p-4 shadow-2xl">
      <p className="text-[10px] font-bold uppercase tracking-[.3em] text-amber-300">Snooker Royal Career</p>
      <h1 className="mt-1 text-2xl font-black">From Academy to Royal Master</h1>
      <p className="mt-2 text-xs leading-5 text-white/70">Learn table craft step by step, then prove it against increasingly competitive AI. Every milestone includes a TPG reward and gift.</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/40"><div className="h-full bg-gradient-to-r from-emerald-400 to-amber-300" style={{ width: `${completed.size / SNOOKER_CAREER_STAGES.length * 100}%` }} /></div>
      <p className="mt-1 text-right text-[10px] text-white/60">{completed.size}/{SNOOKER_CAREER_STAGES.length} completed</p>
    </header>
    <section className="mt-4 space-y-3">
      {SNOOKER_CAREER_STAGES.map((stage, index) => {
        const done = completed.has(stage.id); const unlocked = done || index <= Math.max(0, firstOpen);
        return <article key={stage.id} className={`rounded-2xl border p-3 ${unlocked ? 'border-emerald-300/25 bg-white/[.06]' : 'border-white/10 bg-black/30 opacity-55'}`}>
          <div className="flex gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-xl">{unlocked ? stage.icon : '🔒'}</div><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-[.2em] text-amber-300">{stage.phase} · Lesson {stage.level}</p><h2 className="font-bold">{stage.title}</h2><p className="mt-1 text-[11px] text-white/65">{stage.objective}</p></div></div>
          <div className="mt-2 rounded-xl bg-black/25 p-2 text-xs"><b>Task:</b> {stage.task}</div>
          <div className="mt-2 flex items-center justify-between text-[11px]"><span>🎁 {stage.gift} · 🪙 {stage.reward} TPG</span><button disabled={!unlocked} onClick={() => launch(stage)} className="rounded-lg bg-amber-300 px-3 py-1.5 font-bold text-black disabled:bg-white/20 disabled:text-white/40">{done ? 'Replay' : 'Start'}</button></div>
        </article>;
      })}
    </section>
  </main>;
}
