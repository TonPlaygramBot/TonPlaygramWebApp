const near=(a,b,r)=>Math.hypot(a.x-b.x,a.z-b.z)<r;
/** Objective transitions shared by runtime tests and the real game loop. */
export function advanceBattleObjective(state,frame,dt){
  const next={...state,status:'playing',intelSecured:false,extractionOpened:false};
  if(frame.health<=0){next.status='lost';return next;}
  const alive=frame.enemies.filter(e=>e.hp>0),cleared=frame.enemies.length>0&&!alive.length;
  if(frame.mode==='last-stand'){if(cleared)next.status='won';return next;}
  if(frame.mode==='hold'){
    const contested=alive.some(e=>near(e,frame.center,10));
    if(!contested&&near(frame.player,frame.center,10)&&!frame.driving)next.progress=Math.min(45,next.progress+dt);
    next.status=frame.elapsed>300?'lost':next.progress>=45?'won':cleared&&frame.elapsed<240?'reinforce':'playing';
    return next;
  }
  if(frame.mode==='extraction'&&!next.intel){
    next.progress=near(frame.player,frame.intelPoint,5)&&!frame.driving?Math.min(3,next.progress+dt):0;
    if(next.progress>=3){next.intel=true;next.intelSecured=true;next.extracting=true;}
  }
  if(cleared&&!next.extracting){
    if(frame.mode==='sweep'||frame.mode==='waves'&&frame.wave>=3)next.extracting=true;
    else if(frame.mode==='waves')next.status='upgrade';
  }
  next.extractionOpened=next.extracting&&!state.extracting;
  if(next.extracting){
    const safe=near(frame.player,frame.extractionPoint,2.6)&&!frame.driving&&frame.elapsed-frame.lastDamage>.75&&!alive.some(e=>near(e,frame.extractionPoint,4));
    next.extraction=safe?Math.min(5,next.extraction+dt):0;
    if(next.extraction>=5)next.status='won';
  }
  return next;
}
