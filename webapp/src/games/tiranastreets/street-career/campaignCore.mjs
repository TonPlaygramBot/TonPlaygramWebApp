import {normalizeCheckpoint} from './checkpointCore.mjs';
import {ensureStarterWeapons} from '../shared/weapons.mjs';
/** Local, fictional street economy. No account, TPG or room APIs belong here. */
export const STREET_SAVE_KEY = 'tirana-streets:street-career:v1';
export const CHAPTER_IDS = Object.freeze([
  'first-shift', 'lana-run', 'after-hours', 'express', 'capital-circuit',
  'city-lights', 'rinia-rescue', 'boulevard-defense', 'five-star-escape',
  'air-rescue', 'sky-patrol'
]);
// Contacts unlock independent story strands. Existing completed chapters remain valid.
export const MISSION_REQUIREMENTS = Object.freeze({
  'first-shift': [], 'lana-run': ['first-shift'], 'express': ['first-shift'],
  'rinia-rescue': ['first-shift'], 'air-rescue': ['first-shift'],
  'after-hours': ['lana-run'], 'capital-circuit': ['lana-run', 'express'],
  'city-lights': ['after-hours'], 'boulevard-defense': ['rinia-rescue'],
  'five-star-escape': ['city-lights', 'boulevard-defense'], 'sky-patrol': ['air-rescue']
});
const number = (n, fallback, max) => Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : fallback;
const plain = o => !!o && typeof o === 'object' && !Array.isArray(o);
const difficulties = new Set(['easy', 'normal', 'hard']);
const rewardScale = { easy: .8, normal: 1, hard: 1.25 };
export function createCampaign(missions, weapons, starter) {
  const byId = new Map(missions.map(m => [m.id, m]));
  const arsenal = new Map(weapons.map(w => [w.id, w]));
  if (!arsenal.has(starter) || CHAPTER_IDS.some(id => !byId.has(id))) throw Error('Incomplete street-career catalog');
  const chapters = Object.freeze(CHAPTER_IDS.map(id => byId.get(id)));
  const available = (p, id) => byId.has(id) && CHAPTER_IDS.includes(id) &&
    (p.completed.includes(id) || (MISSION_REQUIREMENTS[id] || []).every(key => p.completed.includes(key)));
  function loadout(raw) {
    const inventory = Object.create(null);
    if (plain(raw?.inventory)) for (const [id, w] of arsenal) {
      const own = raw.inventory[id];
      if (!Object.hasOwn(raw.inventory, id) || !plain(own)) continue;
      inventory[id] = {ammo: Math.floor(number(own.ammo, 0, w.magazine)), reserve: Math.floor(number(own.reserve, 0, w.magazine * 8))};
    }
    if (!Object.keys(inventory).length) {
      const w = arsenal.get(starter);
      inventory[starter] = {ammo: w.magazine, reserve: w.magazine * 3};
    }
    if(arsenal.has('glockSidearmAttack')&&arsenal.has('combatKnife'))ensureStarterWeapons({inventory});
    return {cash: Math.floor(number(raw?.cash, 750, 10000000)), inventory,
      weapon: raw?.weapon === '' ? '' : Object.hasOwn(inventory, raw?.weapon) ? raw.weapon : Object.keys(inventory)[0]};
  }
  function fresh() { return {version: 1, completed: [], best: {}, loadout: loadout(null), active: null}; }
  function normalize(raw) {
    const p = fresh();
    if (!plain(raw) || raw.version !== 1) return p;
    // v1 saves migrate without losing completed missions when branches unlock out of order.
    for (const id of CHAPTER_IDS) {
      if (!Array.isArray(raw.completed) || !raw.completed.includes(id) || !available(p,id)) continue;
      p.completed.push(id);
      if (Number.isFinite(raw.best?.[id]) && raw.best[id] >= 0) p.best[id] = Math.min(86400, raw.best[id]);
    }
    p.loadout = loadout(raw.loadout);
    const a = raw.active;
    if (plain(a) && available(p, a.id)) {
      p.active = {id: a.id, difficulty: difficulties.has(a.difficulty) ? a.difficulty : 'normal', checkpoint: loadout(a.checkpoint)};
      const phase=normalizeCheckpoint(a.phase,loadout,byId.get(a.id)?.stops?.length||0);if(phase)p.active.phase=phase;
    }
    return p;
  }
  function begin(raw, id, difficulty = 'normal') {
    const p = normalize(raw);
    if (!available(p, id) || !difficulties.has(difficulty)) return null;
    // Mission starts are the durable retry checkpoint; damage/ammo are reset by the engine.
    p.active = {id, difficulty, checkpoint: loadout(p.loadout)};
    return p;
  }
  function resolve(raw, state, playerId) {
    const p = normalize(raw), a = p.active, player = state?.players?.[playerId];
    if (!a || state?.missionId !== a.id || state.mode !== 'solo' || state.phase !== 'finished' || !player || !player.finished || player.failed || player.health <= 0 || !Number.isFinite(player.finishTime) || player.finishTime < 0 || state.difficulty !== a.difficulty) return null;
    const first = !p.completed.includes(a.id);
    if (first) p.completed.push(a.id);
    p.best[a.id] = Math.min(p.best[a.id] ?? Infinity, player.finishTime);
    p.loadout = loadout(player);
    if (first) p.loadout.cash = Math.min(10000000, p.loadout.cash + Math.round(byId.get(a.id).reward * rewardScale[a.difficulty]));
    p.active = null;
    return p;
  }
  function abandon(raw) {
    const p = normalize(raw);
    if (p.active) p.loadout = loadout(p.active.checkpoint);
    p.active = null;
    return p;
  }
  function saveExplore(raw, player) {
    const p = normalize(raw);
    if (p.active) return p;
    p.loadout = loadout(player);
    return p;
  }
  function apply(player, raw) {
    const l = loadout(raw);
    player.cash = l.cash; player.weapon = l.weapon; player.inventory = l.inventory;
    player.reloadAt = 0; player.nextShot = 0;
  }
  function load(storage) {
    try { return normalize(JSON.parse(storage?.getItem(STREET_SAVE_KEY) || 'null')); }
    catch { return fresh(); }
  }
  function save(storage, p) {
    try { if (!storage) return false; storage.setItem(STREET_SAVE_KEY, JSON.stringify(normalize(p))); return true; }
    catch { return false; }
  }
  return {chapters, available, fresh, normalize, begin, resolve, abandon, saveExplore, apply, load, save};
}
