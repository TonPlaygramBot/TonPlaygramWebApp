const STRIDES = {'crouch-walk':.56,walk:.72,run:1.12,sprint:1.32};

/** Distance-based contact cadence. This only observes the resolved player pose. */
export function createCityFootsteps() {
  let last=null, remaining=0, foot=0, quiet=0;
  return {
    reset(){last=null;remaining=0;foot=0;quiet=0;},
    advance({x,z}, dt, gait) {
      if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(dt) || dt<=0) {
        this.reset();return null;
      }
      const travelled=last ? Math.hypot(x-last.x,z-last.z) : 0;
      last={x,z};
      const stride=STRIDES[gait];
      if (!stride || travelled>2 || dt>.25) { remaining=0;quiet=0;return null; }
      if(travelled<.004){quiet+=dt;if(quiet>.25)remaining=0;return null;}
      quiet=0;
      remaining+=travelled;
      if (remaining<stride) return null;
      remaining%=stride;
      foot=1-foot;
      return {foot, strength:gait==='crouch-walk'?.46:gait==='walk'?.76:1};
    }
  };
}
