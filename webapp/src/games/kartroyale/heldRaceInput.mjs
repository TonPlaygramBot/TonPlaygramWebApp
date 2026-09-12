/** Independent owners preserve multi-touch chords and keyboard + touch input. */
export function createHeldRaceInput() {
  const owners = new Map();
  const allowed = ['steer','brake','boost','drift','reverse','recover'];
  return {
    hold(id, key, value) {
      if(typeof id!=='string'||!id||id.length>64||!allowed.includes(key))return;
      if(!owners.has(id)&&owners.size>=32)return;
      if(key==='steer'&&!Number.isFinite(value))return;
      owners.set(id,{key,value:key==='steer'?Math.max(-1,Math.min(1,value)):value===true});
    },
    release(id){owners.delete(id);},
    clear(){owners.clear();},
    read(){
      const input={steer:0,brake:false,boost:false,drift:false,reverse:false,recover:false,shield:false,fire:false};
      for(const item of owners.values()){
        if(item.key==='steer')input.steer+=item.value;
        else input[item.key] ||= item.value;
      }
      input.steer=Math.max(-1,Math.min(1,input.steer));return input;
    }
  };
}
