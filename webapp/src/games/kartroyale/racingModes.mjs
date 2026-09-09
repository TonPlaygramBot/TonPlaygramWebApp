/** Explicit entry selection; existing paid seats always take precedence. */
export function racingEntry(search=''){
  const p=new URLSearchParams(search);
  if(p.get('mode')==='online'||p.has('tableId'))return 'online';
  if(p.get('activity')==='explore')return 'explore';
  if(p.get('activity')==='racing-career'||p.get('mode')==='career')return 'career';
  if(p.get('mode')==='ai')return 'ai';
  return 'modes';
}
