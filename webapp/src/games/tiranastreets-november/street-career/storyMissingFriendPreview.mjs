// Only the opt-in story uses this namespace; the original return save is never rewritten here.
export const MISSING_FRIEND_ID = 'ch01-missing-friend';
const SAVE = 'tpg:story-preview:ch01-missing-friend:v2';
const stages = new Set(['briefing','drive','arrival','complete']);
const branches = new Set(['call-back','read-note']);
const clues = Object.freeze({'call-back':'recording','read-note':'postcard'});

function eligible(prior) {
 return prior?.stage === 'complete' && branches.has(prior.outcome);
}
export function readMissingFriendPreview(storage, prior) {
 if(!eligible(prior)) return null;
 try {
  const row=JSON.parse(storage?.getItem(SAVE) ?? 'null');
  if(!row || !stages.has(row.stage) || row.branch!==prior.outcome ||
     row.clue!==(row.stage==='complete'?clues[row.branch]:null)) return null;
  return {stage:row.stage,branch:row.branch,clue:row.clue};
 } catch {return null;}
}
export function saveMissingFriendPreview(storage,state) {
 try {
  if(!storage || !state || !stages.has(state.stage) || !branches.has(state.branch) ||
      state.clue!==(state.stage==='complete'?clues[state.branch]:null))return false;
  storage.setItem(SAVE,JSON.stringify(state));
  return true;
 } catch {return false;}
}
export function stepMissingFriendPreview(state,event,prior,target) {
 if(!eligible(prior))return null;
 if(!state) return event.type==='continue' ? {stage:'briefing',branch:prior.outcome,clue:null} : null;
 if(state.branch!==prior.outcome)return null;
 if(state.stage==='briefing'&&event.type==='accept'&&target) return {...state,stage:'drive'};
 if(state.stage==='drive'&&event.type==='position'&&target&&event.driving &&
    Math.hypot(event.x-target.x,event.z-target.z)<=12)return {...state,stage:'arrival'};
 if(state.stage==='arrival'&&event.type==='inspect') return {...state,stage:'complete',clue:clues[state.branch]};
 return state;
}
