/** Wire contract for a free, non-combat shared Tirana instance. */
export const EXPLORE_VERSION = 1;
export const EXPLORE_LIMITS = Object.freeze({players:4, rooms:128, message:280, history:60, idleMs:60000, payloadBytes:40000});
export const APPEARANCES = Object.freeze(['rpm-current','rpm-67d411-domino','rpm-67f433-domino','rpm-67e1b5-domino','athlete-male','athlete-female']);
export const cleanText = (value, limit=280) => typeof value === 'string' ? value.normalize('NFC').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').trim().slice(0,limit).trim() : '';
export function avatarURL(value) {
  if(typeof value!=='string'||value.length>2048)return '';
  try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}
}
export function exploreInput(raw={}) {
  const n=(key,lo,hi)=>Number.isFinite(raw[key])?Math.max(lo,Math.min(hi,raw[key])):0;
  return {x:n('x',-1,1),y:n('y',-1,1),yaw:n('yaw',-Math.PI,Math.PI),fast:raw.fast===true,brake:raw.brake===true,fire:false,seq:Number.isSafeInteger(raw.seq)&&raw.seq>=0?raw.seq:0};
}
export function gameModeURL(game,mode) {
  if(!['streets','racing'].includes(game))throw Error('Unknown game');
  const path=game==='streets'?'/games/tiranastreets':'/games/kartroyale';
  if(mode==='explore')return `${path}?mode=ai&activity=explore`;
  if(mode==='career')return `${path}?mode=ai&activity=${game==='streets'?'street-career':'racing-career'}`;
  if(mode==='battlefield'&&game==='streets')return `${path}?mode=ai`;
  if(mode==='multiplayer'&&game==='racing')return `${path}?mode=online`;
  throw Error('Unsupported game mode');
}
export function mediaFlags(raw) {return {camera:raw?.camera===true,microphone:raw?.microphone===true};}
export const isLive=m=>!!(m?.camera||m?.microphone);
export function validSignal(data) {
  if(!data||typeof data!=='object')return false;
  if(data.type==='offer'||data.type==='answer')return data.sdp?.type===data.type&&typeof data.sdp.sdp==='string'&&data.sdp.sdp.length<=24000;
  return data.type==='ice'&&data.candidate&&typeof data.candidate.candidate==='string'&&data.candidate.candidate.length<=2048;
}
