/** Independent touch/keyboard owners: releasing boost cannot release a held
 * steering button. Values remain in the existing screen-relative input frame. */
export function createHeldRaceInput() {
  const owners = new Map();
  return {
    hold(id, key, value) {
      if (typeof id !== 'string' || !id || id.length > 64 || !['steer','brake','boost'].includes(key)) return;
      if (!owners.has(id) && owners.size >= 32) return;
      if (key === 'steer' && !Number.isFinite(value)) return;
      owners.set(id, {key,value:key === 'steer' ? Math.max(-1,Math.min(1,value)) : value === true});
    },
    release(id) { owners.delete(id); },
    clear() { owners.clear(); },
    read() {
      let steer=0,brake=false,boost=false;
      for (const item of owners.values()) {
        if (item.key === 'steer') steer += item.value;
        else if (item.key === 'brake') brake ||= item.value;
        else boost ||= item.value;
      }
      return {steer:Math.max(-1,Math.min(1,steer)),brake,boost,drift:false};
    }
  };
}
