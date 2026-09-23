import {SAVE_KEY,CHAPTERS,normalizeCareer} from '../career/careerCore.mjs';
/** Read-only history: old contact chapters have different IDs and objectives.
 * Their completions and rewards must never be credited as current city jobs. */
export function loadLegacyStoryHistory(storage){
  try{
    const saved=storage?.getItem(SAVE_KEY);
    if(!saved)return null;
    const raw=JSON.parse(saved);
    if(!raw||raw.version!==1||!Array.isArray(raw.completed))return null;
    const profile=normalizeCareer(raw);
    const current=CHAPTERS.find(c=>c.id===profile.active?.id);
    return {
      completed:profile.completed.map(id=>CHAPTERS.find(c=>c.id===id).title),
      total:CHAPTERS.length,
      active:current?{title:current.title,step:profile.active.step+1,total:current.steps.length}:null
    };
  }catch{return null;}
}
