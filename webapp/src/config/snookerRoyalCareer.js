export const SNOOKER_CAREER_STAGES = [
  { id: 'academy-1', phase: 'Academy', icon: '🎓', title: 'Know the table', objective: 'Learn baulk, the D, spots and the red–colour sequence.', task: 'Pot one red, then one nominated colour.', reward: 75, gift: 'Aim guide', level: 1 },
  { id: 'academy-2', phase: 'Academy', icon: '🎯', title: 'Straight red', objective: 'Build a repeatable centre-ball stroke.', task: 'Pot 3 straight reds in 6 attempts.', reward: 100, gift: 'Chalk pack', level: 2 },
  { id: 'academy-3', phase: 'Academy', icon: '🧠', title: 'Colour values', objective: 'Learn why position and colour selection matter.', task: 'Score a legal 12-point visit.', reward: 140, gift: 'Table markers', level: 3 },
  { id: 'club-1', phase: 'Club Tour', icon: '🛡️', title: 'Safety first', objective: 'Control pace and leave distance after contact.', task: 'Complete 2 legal safeties versus Rookie AI.', reward: 190, gift: 'Blue cloth', level: 4 },
  { id: 'club-2', phase: 'Club Tour', icon: '🔥', title: 'Mini break', objective: 'Connect pots while preserving cue-ball angle.', task: 'Make a break of 20 with full rules.', reward: 250, gift: 'Maple cue', level: 5 },
  { id: 'club-3', phase: 'Club Tour', icon: '🤖', title: 'Club rival', objective: 'Apply scoring, safety and recovery in a frame.', task: 'Beat Club AI in a short frame.', reward: 350, gift: 'Club badge', level: 6 },
  { id: 'pro-1', phase: 'Pro Circuit', icon: '📐', title: 'Long-pot exam', objective: 'Balance accuracy with cue-ball recovery.', task: 'Pot 4 of 6 long reds.', reward: 450, gift: 'Pro sights', level: 7 },
  { id: 'pro-2', phase: 'Pro Circuit', icon: '⚡', title: 'Break builder', objective: 'Plan three shots ahead around black and pink.', task: 'Make a break of 40 versus Pro AI.', reward: 600, gift: 'Royal cue', level: 8 },
  { id: 'royal-final', phase: 'Royal Masters', icon: '👑', title: 'Royal final', objective: 'Win under championship rules and pressure.', task: 'Win a full frame versus Master AI.', reward: 1000, gift: 'Royal trophy', level: 9 }
]

const KEY = 'snookerRoyalCareerProgress'
export function loadSnookerCareerProgress () {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(window.localStorage.getItem(KEY) || '[]').filter(Boolean) } catch { return [] }
}
