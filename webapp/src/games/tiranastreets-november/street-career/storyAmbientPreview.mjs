// Fictional local preview: no spawns, persistence, rewards, calls or mission/economy mutations.
const content = Object.freeze({
  roadside:Object.freeze({phase:'day',title:'Ndihmë në rrugë',
    text:'Një shofer ka ndaluar në anë të rrugës. Afrohu në këmbë për të pyetur nëse i duhet ndihmë.',
    resolved:'Shoferi është mirë. Ndihma rrugore është njoftuar në historinë e lojës.'}),
  safeReturn:Object.freeze({phase:'night',title:'Kthim i sigurt',
    text:'Një kalimtar po pret në një vend të ndriçuar. Afrohu në këmbë për t’i treguar rrugën drejt sheshit.',
    resolved:'Kalimtari mori udhëzimet dhe vijoi rrugën.'})
});

export const STORY_AMBIENT_LIMITS=Object.freeze({
  firstOffer:12,cooldown:90,offerLife:26,acceptedLife:44,
  offerMinDistance:16,offerMaxDistance:72,retainDistance:108,interactDistance:3.25
});
const finite=Number.isFinite;
const point=p=>finite(p?.x)&&finite(p?.z);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const eligible=c=>c?.enabled===true&&c.ready===true&&c.solo===true&&c.freeRoam===true&&
  c.missionActive===false&&c.restricted===false&&point(c.player)&&finite(c.player.health)&&c.player.health>0;
const phaseMatches=(entry,phase)=>entry.phase===phase;
const compareId=(a,b)=>a<b?-1:a>b?1:0;

/** Per-solo-session controller. Host must supply a read-only guard for public,
 * loaded, walkable exterior locations. Without it offers fail closed. */
export function createStoryAmbientPreview({isAccessible=()=>false}={}) {
  const L=STORY_AMBIENT_LIMITS;
  let clock=0,nextAt=L.firstOffer,nextScan=0,serial=0,active=null;
  function end() {active=null;nextAt=clock+L.cooldown;}
  function accessible(anchor) {
    try {return isAccessible(anchor)===true;}
    catch {return false;}
  }
  function valid(c,incident) {
    return phaseMatches(content[incident.kind],c.phase)&&distance(c.player,incident)<=L.retainDistance&&
      accessible({id:incident.anchorId,kind:incident.kind,x:incident.x,z:incident.z});
  }
  function view() {
    if(!active)return null;
    const hint=content[active.kind];
    return Object.freeze({id:active.id,kind:active.kind,status:active.status,title:hint.title,
      text:hint.text,x:active.x,z:active.z,expiresIn:Math.max(0,Math.ceil(active.expires-clock))});
  }
  function choose(c) {
    let best=null,nearest=Infinity;
    // A bounded authored list, not all NPCs or map objects.
    for(const anchor of (Array.isArray(c.anchors)?c.anchors:[]).slice(0,64)) {
      if(!point(anchor)||typeof anchor.id!=='string'||!anchor.id||
        !Object.hasOwn(content,anchor.kind)||!phaseMatches(content[anchor.kind],c.phase))continue;
      const gap=distance(c.player,anchor);
      if(gap<L.offerMinDistance||gap>L.offerMaxDistance||gap>nearest||
        (gap===nearest&&compareId(anchor.id,best.id)>=0)||!accessible(anchor))continue;
      best=anchor;nearest=gap;
    }
    return best;
  }
  return {
    step(c,dt) {
      if(!eligible(c)){if(active)end();return null;}
      if(c.paused!==false)return null;
      if(finite(dt)&&dt>0)clock+=Math.min(dt,.1);
      if(active){if(clock>=active.expires||!valid(c,active))end();return view();}
      if(clock<nextAt||clock<nextScan)return null;
      nextScan=clock+.25;
      const anchor=choose(c);
      if(!anchor)return null;
      active={id:'preview-'+(++serial),anchorId:anchor.id,kind:anchor.kind,x:anchor.x,z:anchor.z,
        status:'offer',expires:clock+L.offerLife};
      return view();
    },
    act(c,{id,action}={}) {
      if(!eligible(c)||c.paused!==false||!active||active.id!==id||clock>=active.expires||!valid(c,active))return null;
      if(action==='ignore'){end();return Object.freeze({status:'dismissed',id});}
      if(action==='accept'&&active.status==='offer'){
        active.status='accepted';active.expires=clock+L.acceptedLife;return view();
      }
      if(action==='resolve'&&active.status==='accepted'&&c.player.onFoot===true&&distance(c.player,active)<=L.interactDistance){
        const text=content[active.kind].resolved;end();return Object.freeze({status:'resolved',id,text});
      }
      return null;
    }
  };
}
