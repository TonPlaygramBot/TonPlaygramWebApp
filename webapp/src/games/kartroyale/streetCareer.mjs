// Device-only practice progression. Never a source of wallet balances or online entitlement.
export const STREET_CAREER_KEY = 'tonplaygram.racing-streets.career.v1'
export const DRIVER_STYLES = ['turi', 'helmet']
export const CAREER_PAINTS = ['#b9ff48', '#49b7ff', '#f97393', '#b99cff']
const plain = x => x && typeof x === 'object' && !Array.isArray(x) ? x : {}
export function careerStages (tracks) { return tracks.map((track, i) => ({ id: track.id, name: track.name, number: i + 1, target: i < 5 ? 3 : i < 12 ? 2 : 1, difficulty: i < 5 ? 'rookie' : i < 12 ? 'street' : 'pro', reward: 100 + i * 15 })) }
export function normalizeStreetCareer (value, tracks, karts) {
  const d = plain(value); const completed = {}; const best = {}; const tasks = {}
  for (const t of tracks) { if (d.completed?.[t.id] === true)completed[t.id] = true; const time = d.best?.[t.id]; if (Number.isFinite(time) && time > 0)best[t.id] = time; tasks[t.id] = ['finish', 'podium', 'clean', 'winner'].filter(id => Array.isArray(d.tasks?.[t.id]) && d.tasks[t.id].includes(id)) }
  const xp = careerStages(tracks).reduce((sum, s) => sum + (completed[s.id] ? s.reward : 0) + (tasks[s.id]?.length || 0) * 25, 0)
  const load = plain(d.loadout)
  return { version: 1, completed, best, tasks, xp, loadout: { kart: karts.some(k => k.id === load.kart) ? load.kart : (karts[0]?.id || 'apex'), driver: DRIVER_STYLES.includes(load.driver) ? load.driver : 'turi', paint: CAREER_PAINTS.includes(load.paint) ? load.paint : CAREER_PAINTS[0], ammo: load.ammo === 'double' && xp >= 300 ? 'double' : 'single', shield: load.shield === 'double' && xp >= 600 ? 'double' : 'single' } }
}
export function loadStreetCareer (storage, tracks, karts) { try { return normalizeStreetCareer(JSON.parse(storage?.getItem(STREET_CAREER_KEY) || '{}'), tracks, karts) } catch { return normalizeStreetCareer({}, tracks, karts) } }
export function saveStreetCareer (storage, profile) { try { if (!storage) return false; storage.setItem(STREET_CAREER_KEY, JSON.stringify(profile)); return true } catch { return false } }
export function stageUnlocked (profile, stages, id) { const i = stages.findIndex(s => s.id === id); return i >= 0 && (i === 0 || profile.completed[stages[i - 1].id] === true) }
export function finishStreetStage (profile, tracks, karts, id, result) {
  const p = normalizeStreetCareer(profile, tracks, karts); const stages = careerStages(tracks); const stage = stages.find(s => s.id === id)
  const previousXP = p.xp
  const me = result?.racers?.find(r => r.id === result.playerId); const place = result?.racers?.indexOf(me) + 1
  if (!stage || !stageUnlocked(p, stages, id) || result.trackId !== id || result.online || !me?.finished || !Number.isFinite(me.finishTime) || me.finishTime <= 0 || place < 1) return { profile: p, bonus: 0, completed: false }
  const earned = ['finish', ...(place <= 3 ? ['podium'] : []), ...(me.health >= 90 ? ['clean'] : []), ...(place === 1 ? ['winner'] : [])]
  p.tasks[id] = [...new Set([...p.tasks[id], ...earned])]; p.best[id] = Math.min(p.best[id] || Infinity, me.finishTime)
  if (place <= stage.target)p.completed[id] = true
  const next = normalizeStreetCareer(p, tracks, karts); return { profile: next, bonus: next.xp - previousXP, completed: !!next.completed[id] }
}
export function careerSupplies (loadout) { return { rocket: loadout?.ammo === 'double' ? 2 : 1, shield: loadout?.shield === 'double' ? 2 : 1 } }
export function equipCareerSupply (supplies, racer, kind) {
  if (!supplies || !racer || racer.finished || racer.retired || racer.raceItem || !['rocket', 'shield'].includes(kind) || !(supplies[kind] > 0)) return false
  supplies[kind]--; racer.raceItem = kind; return true
}
