// Standalone fictional scene; no canonical career progression, payout or account state.
export const STORY_RETURN_ID = 'ch01-return';
const SAVE = 'tpg:story-preview:ch01-return:v1';
const WORLD_PREFIX = SAVE + ':world:';
export const RETURN_RADIUS = 12;
const stages = new Set(['call','drive','choice','complete']);
const choices = new Set(['call-back','read-note']);
const initial = () => ({stage:'call',stop:0,outcome:null});
export function storyReturnEnabled(search) {
 return new URLSearchParams(search).get('storyPreview') === STORY_RETURN_ID;
}
export function returnWorldStorage(storage) {
 if (!storage) return undefined;
 return {
   getItem:(key)=>storage.getItem(WORLD_PREFIX+key),
   setItem:(key,value)=>storage.setItem(WORLD_PREFIX+key,value)
 };
}
export function readReturnPreview(storage) {
 try {
  const s=JSON.parse(storage?.getItem(SAVE) ?? 'null');
  if(!s||!stages.has(s.stage)||!Number.isInteger(s.stop)||s.stop<0||s.stop>1)return initial();
  if(s.stage==='complete'?!choices.has(s.outcome):s.outcome!==null)return initial();
  if((s.stage==='call'&&s.stop!==0)||((s.stage==='choice'||s.stage==='complete')&&s.stop!==1))return initial();
  return {stage:s.stage,stop:s.stop,outcome:s.outcome};
 } catch { return initial(); }
}
export function saveReturnPreview(storage,state) {
 try { if(!storage)return false; storage.setItem(SAVE,JSON.stringify(state)); return true; }
 catch { return false; }
}
export function stepReturnPreview(state,event,stops) {
 if(state.stage==='call'&&event.type==='listen'&&stops.length===2)return {...state,stage:'drive'};
 if(state.stage==='drive'&&event.type==='position'&&event.driving){
  const target=stops[state.stop];
  if(target&&Math.hypot(event.x-target.x,event.z-target.z)<=RETURN_RADIUS)
   return state.stop===0?{...state,stop:1}:{...state,stage:'choice'};
 }
 if(state.stage==='choice'&&event.type==='choose'&&choices.has(event.outcome))
  return {...state,stage:'complete',outcome:event.outcome};
 return state;
}
