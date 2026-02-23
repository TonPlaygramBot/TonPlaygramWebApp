import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  CAREER_LEVEL_COUNT,
  getCareerRoadmap,
  getNextCareerStage,
  loadCareerProgress
} from '../../utils/poolRoyaleCareerProgress.js';
import { loadTrainingProgress } from '../../utils/poolRoyaleTrainingProgress.js';

const TPC_ICON_SRC = '/assets/icons/ezgif-54c96d8a9b9236.webp';

const stageTypeLabel = (type) => {
  if (type === 'training') return '🎯 Task drill';
  if (type === 'friendly') return '🤝 Match';
  if (type === 'league') return '🗓️ League';
  if (type === 'showdown') return '⚡ Showdown';
  return '🏆 Tournament';
};

const fallbackThumb = (type) => {
  if (type === 'training') return 'https://placehold.co/160x96/0f172a/f8fafc?text=TASK';
  if (type === 'tournament') return 'https://placehold.co/160x96/1f2937/fbbf24?text=CUP';
  if (type === 'showdown') return 'https://placehold.co/160x96/111827/f87171?text=DUEL';
  if (type === 'league') return 'https://placehold.co/160x96/1e293b/67e8f9?text=LEAGUE';
  return 'https://placehold.co/160x96/0f172a/86efac?text=MATCH';
};

export default function PoolRoyaleCareer() {
  useTelegramBackButton('/games/poolroyale/lobby?type=career');
  const navigate = useNavigate();

  const trainingProgress = useMemo(() => loadTrainingProgress(), []);
  const careerProgress = useMemo(() => loadCareerProgress(), []);
  const roadmap = useMemo(
    () => getCareerRoadmap(trainingProgress, careerProgress),
    [trainingProgress, careerProgress]
  );
  const nextStage = useMemo(
    () => getNextCareerStage(trainingProgress, careerProgress),
    [trainingProgress, careerProgress]
  );

  const completedCount = roadmap.filter((stage) => stage.completed).length;
  const giftStages = roadmap.filter((stage) => stage.hasGift && stage.giftThumbnail);

  const sections = useMemo(
    () => [
      {
        key: 'task',
        title: 'Tasks',
        subtitle: 'Skill drills and guided objectives',
        icon: '🎯',
        items: roadmap.filter((stage) => stage.eventType === 'task')
      },
      {
        key: 'cup',
        title: 'Cups',
        subtitle: 'Knockout cup brackets',
        icon: '🏅',
        items: roadmap.filter((stage) => stage.eventType === 'cup')
      },
      {
        key: 'tournament',
        title: 'Tournaments',
        subtitle: 'Full-field competitive brackets',
        icon: '🏆',
        items: roadmap.filter((stage) => stage.eventType === 'tournament')
      },
      {
        key: 'league',
        title: 'Leagues',
        subtitle: 'Season rounds and ranking control',
        icon: '🗓️',
        items: roadmap.filter((stage) => stage.eventType === 'league')
      },
      {
        key: 'match',
        title: 'Matches',
        subtitle: 'Friendlies and showdown battles',
        icon: '🤝',
        items: roadmap.filter((stage) => stage.eventType === 'match')
      }
    ],
    [roadmap]
  );

  const launchStage = (stage = nextStage) => {
    if (!stage) return;
    const params = new URLSearchParams();
    params.set('type', stage.type);
    params.set('mode', 'ai');
    params.set('careerMode', '1');
    params.set('careerStageId', stage.id);
    if (stage.title) params.set('careerStageTitle', stage.title);
    if (stage.type === 'training' && stage.trainingLevel) {
      params.set('trainingLevel', String(stage.trainingLevel));
    }
    if (stage.type === 'tournament' && stage.players) {
      params.set('players', String(stage.players));
    }
    navigate(`/games/poolroyale?${params.toString()}`);
  };

  return (
    <section className="mx-auto w-full max-w-4xl space-y-4 px-3 pb-24 pt-3 text-white sm:px-4">
      <div className="overflow-hidden rounded-3xl border border-amber-200/40 bg-gradient-to-br from-[#32204a] via-[#121632] to-[#0d2f35] p-4 shadow-[0_24px_65px_rgba(0,0,0,0.52)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-amber-200">Pool Royale Career</p>
            <h1 className="bg-gradient-to-r from-amber-100 via-white to-cyan-100 bg-clip-text text-xl font-bold text-transparent">
              Roadmap Command Center
            </h1>
            <p className="mt-1 text-xs text-white/70">
              Stylish full-career view with mixed tasks, matches, tournaments, and gift milestones.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/games/poolroyale/lobby?type=career')}
            className="rounded-xl border border-white/20 bg-black/35 px-3 py-1.5 text-xs font-semibold text-white/90"
          >
            Lobby
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] sm:text-xs">
          <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
            <p className="text-white/60">Progress</p>
            <p className="mt-0.5 text-sm font-semibold">{completedCount}/{CAREER_LEVEL_COUNT}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
            <p className="text-white/60">Next phase</p>
            <p className="mt-0.5 text-sm font-semibold">{nextStage?.phaseTitle || 'Legend complete'}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
            <p className="text-white/60">Gift milestones</p>
            <p className="mt-0.5 text-sm font-semibold">{giftStages.length}</p>
          </div>
        </div>

        {nextStage ? (
          <div className="mt-3 rounded-2xl border border-amber-200/50 bg-black/35 p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-100">Next up</p>
            <div className="mt-1 flex items-start gap-3">
              <img
                src={nextStage.giftThumbnail || fallbackThumb(nextStage.type)}
                alt={nextStage.title}
                className="h-14 w-20 rounded-lg border border-white/20 object-cover"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{nextStage.icon} {nextStage.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-white/70">{nextStage.objective}</p>
                <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-emerald-200/40 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                  <img src={TPC_ICON_SRC} alt="TPC" className="h-3.5 w-3.5" />
                  {Number(nextStage.rewardTpc || 0).toLocaleString('en-US')} TPC
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => launchStage(nextStage)}
              className="mt-2.5 w-full rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-black"
            >
              Launch {nextStage.title}
            </button>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-black/35 via-[#131b2f]/85 to-black/20 p-4">
        <h2 className="text-sm font-semibold text-white">Gift thumbnails on roadmap</h2>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {giftStages.slice(0, 12).map((stage) => (
            <div key={stage.id} className="rounded-xl border border-amber-200/40 bg-amber-100/5 p-1.5">
              <img src={stage.giftThumbnail} alt={stage.title} className="h-16 w-full rounded object-cover" loading="lazy" />
              <p className="mt-1 truncate text-[10px] text-amber-100">Stage {stage.level}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <h2 className="text-sm font-semibold text-white">Career sections</h2>
        <p className="mt-1 text-[11px] text-white/65">
          Each round gives 3 ❤️ attempts one time only. When attempts reach 0, buy heart bundles to continue.
        </p>
        <div className="mt-2 space-y-2">
          {sections.map((section) => {
            const playable = section.items.find((item) => item.playable) || null;
            return (
              <div key={section.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-white">{section.icon} {section.title}</p>
                    <p className="text-[10px] text-white/60">{section.subtitle}</p>
                  </div>
                  <span className="rounded-full border border-white/15 bg-black/30 px-2 py-0.5 text-[10px] text-white/80">
                    {section.items.filter((s) => s.completed).length}/{section.items.length}
                  </span>
                </div>
                {playable ? (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-amber-200/35 bg-amber-200/10 p-2">
                    <p className="min-w-0 truncate text-[11px] text-amber-50">Next: {playable.title} · Rounds {playable.roundTarget || 1}</p>
                    <button
                      type="button"
                      onClick={() => launchStage(playable)}
                      className="shrink-0 rounded-md bg-amber-300 px-2 py-1 text-[10px] font-semibold text-black"
                    >
                      Play
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-[10px] text-white/45">No unlocked stage in this section yet.</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2.5">
        {roadmap.map((stage) => (
          <article
            key={stage.id}
            className={`rounded-2xl border p-3 shadow-[0_12px_30px_rgba(0,0,0,0.28)] ${stage.playable ? 'border-amber-300/55 bg-gradient-to-br from-amber-300/18 to-orange-300/8' : stage.completed ? 'border-emerald-300/50 bg-gradient-to-br from-emerald-300/16 to-emerald-500/8' : 'border-white/10 bg-white/[0.03]'}`}
          >
            <div className="flex items-start gap-3">
              <img
                src={stage.hasGift && stage.giftThumbnail ? stage.giftThumbnail : fallbackThumb(stage.type)}
                alt={stage.title}
                className="h-16 w-24 shrink-0 rounded-xl border border-white/20 object-cover"
                loading="lazy"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white">
                      Stage {String(stage.level).padStart(3, '0')} · {stage.icon} {stage.title}
                    </p>
                    <p className="text-[10px] text-white/60">
                      {stage.phaseTitle} · {stage.competitionLabel || stage.type} · Rounds {stage.roundTarget || 1} · {stage.difficulty}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/20 bg-black/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white/75">
                    {stage.statusLabel}
                  </span>
                </div>

                <p className="mt-1 line-clamp-2 text-[11px] text-white/80">{stage.objective}</p>
                <p className="mt-1 line-clamp-2 text-[10px] text-white/65">{stage.detailBrief}</p>

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5">{stageTypeLabel(stage.type)}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/40 bg-emerald-300/10 px-2 py-0.5 font-semibold text-emerald-100">
                    <img src={TPC_ICON_SRC} alt="TPC" className="h-3.5 w-3.5" />
                    {Number(stage.rewardTpc || 0).toLocaleString('en-US')} TPC
                  </span>
                  {stage.hasGift && stage.giftThumbnail ? (
                    <span className="rounded-full border border-amber-200/45 bg-amber-300/15 px-2 py-0.5 text-amber-100">
                      🎁 Gift unlocked
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <p className="mt-2 text-[10px] text-cyan-100/80">Win condition: {stage.winCondition}</p>
            {stage.playable ? (
              <button
                type="button"
                onClick={() => launchStage(stage)}
                className="mt-2.5 w-full rounded-lg bg-amber-300 px-3 py-2 text-xs font-semibold text-black"
              >
                Play this stage
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
