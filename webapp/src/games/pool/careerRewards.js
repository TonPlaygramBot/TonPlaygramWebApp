import { CAREER_STAGES } from '../../utils/poolRoyaleCareerProgress.js';

const GIFTS = [
  ['cueStyle', 'redwood-ember', 'Redwood Ember cue'],
  ['tableFinish', 'oakVeneer01', 'Oak Veneer table'],
  ['railMarkerColor', 'pearl', 'Pearl rail markers'],
  ['cueStyle', 'wenge-nightfall', 'Wenge Nightfall cue'],
  ['tableFinish', 'woodTable001', 'Wood Table finish'],
  ['chromeColor', 'gold', 'Gold trim'],
  ['cueStyle', 'mahogany-heritage', 'Mahogany Heritage cue'],
  ['tableFinish', 'darkWood', 'Dark Wood table'],
  ['railMarkerColor', 'gold', 'Gold rail markers'],
  ['cueStyle', 'walnut-satin', 'Walnut Satin cue'],
  ['tableFinish', 'rosewoodVeneer01', 'Rosewood Veneer table'],
  ['chromeColor', 'black', 'Black trim'],
  ['cueStyle', 'carbon-matrix', 'Carbon Matrix cue'],
  ['chromePlateStyle', 'showood-rounded', 'Showood rounded plates'],
  ['cueStyle', 'maple-horizon', 'Maple Horizon cue'],
  ['cueStyle', 'graphite-aurora', 'Graphite Aurora cue']
];
const TITLES = ['Circuit Star', 'Master of the Baize', 'Royal Champion', 'Pool Legend'];
export const CAREER_GIFTS = Array.from({ length: 20 }, (_, index) => {
  const [type, optionId, label] = GIFTS[index] || ['title', `legend-${index}`, TITLES[index - GIFTS.length]];
  return { id: `gift-${(index + 1) * 5}`, level: (index + 1) * 5, type, optionId, label,
    xp: 150 + index * 50 };
});
export function careerStageXp(stage) {
  return 100 + stage.level * 10 + ({ tournament: 300, showdown: 200, league: 100 }[stage.type] || 0);
}
export function careerRewardSummary(progress) {
  const completedIds = new Set(progress.completedStageIds || []);
  const completed = CAREER_STAGES.filter(stage => completedIds.has(stage.id));
  const count = type => completed.filter(stage => stage.type === type).length;
  const goals = [
    { id: 'academy', label: 'Academy graduate', value: count('training'), target: 5, xp: 250 },
    { id: 'allround', label: 'All-round player', value: new Set(completed.map(stage => stage.type)).size, target: 5, xp: 500 },
    { id: 'rival', label: 'Rival hunter', value: count('showdown'), target: 3, xp: 750 },
    { id: 'titles', label: 'Trophy cabinet', value: count('tournament'), target: 5, xp: 1000 }
  ].map(goal => ({ ...goal, done: goal.value >= goal.target }));
  const claimed = new Set(progress.claimedGiftIds || []);
  const gifts = CAREER_GIFTS.map(gift => ({ ...gift,
    // All preceding stages are required, including migrated saves with gaps.
    unlocked: CAREER_STAGES.slice(0, gift.level).every(stage => completedIds.has(stage.id)),
    claimed: claimed.has(gift.id) }));
  const xp = completed.reduce((total, stage) => total + careerStageXp(stage), 0)
    + goals.filter(goal => goal.done).reduce((total, goal) => total + goal.xp, 0)
    + gifts.filter(gift => gift.unlocked && gift.claimed).reduce((total, gift) => total + gift.xp, 0);
  return { xp, goals, gifts, rank: Math.floor(xp / 1000) + 1,
    titles: gifts.filter(gift => gift.type === 'title' && gift.unlocked && gift.claimed).map(gift => gift.label) };
}
