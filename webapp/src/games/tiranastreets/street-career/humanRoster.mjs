import {nearestActors} from '../shared/frameBudget.mjs';
/** Same bundled GLBs used by Table Tennis/Chess/Tirana. No copied model binaries. */
export const HUMAN_ROSTER = Object.freeze([
  {id:'chess-human', label:'Chess veteran', sourceId:'rpm-current', url:'/assets/table-tennis/chess-human.glb', roles:['civilian','dealer','gang'], licence:'Existing Ready Player Me permission; not CC0'},
  {id:'athlete-male', label:'Adrian', sourceId:'athlete-male', url:'/assets/table-tennis/athlete-male.glb', roles:['civilian','dealer','gang','police'], licence:'Quaternius CC0'},
  {id:'athlete-female', label:'Maya', sourceId:'athlete-female', url:'/assets/table-tennis/athlete-female.glb', roles:['civilian','dealer','gang','police'], licence:'Quaternius CC0'},
  {id:'athlete-male-gold', label:'Luca', sourceId:'athlete-male-gold', url:'/assets/table-tennis/athlete-male.glb', roles:['civilian','gang'], licence:'Quaternius CC0'},
  {id:'athlete-female-violet', label:'Nadia', sourceId:'athlete-female-violet', url:'/assets/table-tennis/athlete-female.glb', roles:['civilian','gang'], licence:'Quaternius CC0'},
  {id:'mixamo-soldier', label:'Soldier', sourceId:'mixamo-soldier', url:'/assets/tirana-streets/living/human.glb', roles:['soldier'], licence:'Existing Adobe/Mixamo game-use terms; not CC0'}
].map(a => Object.freeze({...a,roles:Object.freeze(a.roles)})));
export function stableActorHash(id) {
  let h = 2166136261;
  for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function actorRole(kind) { return kind === 'military' ? 'soldier' : ['police','soldier','dealer','gang'].includes(kind) ? kind : 'civilian'; }
export function humanFor(entity) {
  const role = actorRole(entity.kind), choices = HUMAN_ROSTER.filter(h => h.roles.includes(role));
  return choices[stableActorHash(entity.id) % choices.length];
}
export function nearbyHumans(entities, viewer, battery=false) {
  if (!viewer || !Number.isFinite(viewer.x) || !Number.isFinite(viewer.z)) return [];
  const range = battery ? 110 : 230, cap = battery ? 28 : 72;
  return nearestActors(entities, viewer, range, cap, n => n.motion !== 'drive');
}
/** Screen-coordinate joystick: right is right; upward displacement is forward. */
export function screenStick(dx, dy, radius=44, deadzone=0) {
  if (![dx,dy,radius].every(Number.isFinite) || radius <= 0) return {x:0,y:0};
  const length=Math.hypot(dx,dy),zone=Number.isFinite(deadzone)?Math.max(0,Math.min(.3,deadzone)):0;
  const amount=Math.min(1,length/radius);
  if(amount<=zone)return {x:0,y:0};
  const scaled=(amount-zone)/(1-zone);
  return {x:dx/length*scaled,y:-dy/length*scaled};
}
