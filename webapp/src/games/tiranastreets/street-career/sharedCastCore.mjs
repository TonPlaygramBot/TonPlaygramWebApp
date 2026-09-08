import {HUMAN_ROSTER, actorRole, stableActorHash} from './humanRoster.mjs';
const CHESS_IDS = new Set(['rpm-current','rpm-67d411-domino','rpm-67f433-domino','rpm-67e1b5-domino']);
const permittedURL = value => {
  try { const u=new URL(value); return u.protocol==='https:' && !u.username && !u.password && /\.glb$/.test(u.pathname) && ['models.readyplayer.me','api.readyplayer.me','avatars.readyplayer.me','threejs.org'].includes(u.hostname); } catch { return false; }
};
/** Consume the real Chess catalog, not a second hard-coded copy of model URLs.
 * Unknown/portrait/robot/non-commercial entries are never opted in implicitly. */
export function buildSharedGameCast(chess) {
  const defaults=HUMAN_ROSTER.filter(a=>['chess-human','athlete-male','athlete-female','mixamo-soldier'].includes(a.id));
  const out=[];
  for(const entry of chess||[]) {
    if(!CHESS_IDS.has(entry.id)||entry.nonCommercialOnly||/BY-NC|non-commercial/i.test(entry.license||''))continue;
    const urls=entry.id==='rpm-current'?['/assets/table-tennis/chess-human.glb']:[...new Set((entry.modelUrls||[]).filter(permittedURL))];
    if(!urls.length)continue;
    out.push(Object.freeze({id:entry.id,sourceId:entry.id,label:entry.label||entry.id,url:urls[0],urls:Object.freeze(urls),roles:Object.freeze(['civilian','dealer','gang','police']),licence:'Existing Chess/Ready Player Me terms retained; not CC0',sourceGame:'Chess Battle Royal'}));
  }
  if(!out.some(a=>a.id==='rpm-current'))out.unshift(Object.freeze({...defaults.find(a=>a.id==='chess-human'),roles:Object.freeze(['civilian','dealer','gang','police'])}));
  return Object.freeze([...out,...defaults.filter(a=>a.id!=='chess-human')]);
}
export function chooseSharedHuman(entity, cast) {
  const role=actorRole(entity.kind);
  const selected=cast.find(a=>a.id===entity.characterId&&a.roles.includes(role));
  if(selected)return selected;
  // Police and ordinary street contacts primarily use the same Chess avatars.
  const chess=cast.filter(a=>a.roles.includes(role)&&(a.id.startsWith('rpm-')||a.id==='chess-human'));
  const all=cast.filter(a=>a.roles.includes(role));
  const choices=role==='soldier'?all:(role==='police'||stableActorHash(entity.id)%4!==0)&&chess.length?chess:all;
  return choices[stableActorHash(entity.id)%choices.length] || HUMAN_ROSTER.find(a=>a.roles.includes(role)) || HUMAN_ROSTER[0];
}
