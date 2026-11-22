const STOPS = Object.freeze([
  Object.freeze({id:'square', label:'Sheshi Skënderbej', action:'Gjej pikën e informacionit'}),
  Object.freeze({id:'clock', label:'Kulla e Sahatit', action:'Kontrollo tabelën e orientimit'}),
  Object.freeze({id:'pyramid', label:'Piramida', action:'Mbërrij te pika e takimit'})
]);
const RADIUS_METRES = 14;

export function createPublicTrail(landmarks) {
  return Object.freeze(STOPS.map(stop => {
    const matches = landmarks.filter(x => x.id === stop.id);
    if (matches.length !== 1 || !Number.isFinite(matches[0].x) || !Number.isFinite(matches[0].z)) {
      throw new Error('Public landmark unavailable: ' + stop.id);
    }
    const {x,z} = matches[0];
    return Object.freeze({...stop,x,z});
  }));
}

export function advancePublicTrail(trail, index, position, actionPressed) {
  if (!Number.isInteger(index) || index < 0 || index > trail.length) throw new Error('Invalid trail state');
  const stop = trail[index];
  if (!stop) return {index, complete:true};
  if (!Number.isFinite(position?.x) || !Number.isFinite(position?.z)) return {index, complete:false};
  const near = Math.hypot(stop.x-position.x,stop.z-position.z) <= RADIUS_METRES;
  const next = near && actionPressed === true ? index + 1 : index;
  return {index:next, complete:next === trail.length};
}

// Feed current action state each frame; proximity never turns a held button
// into a new interaction. A host must reset input on navigation/blur.
export function createPublicTrailSession(landmarks) {
  const trail = createPublicTrail(landmarks);
  let index = 0;
  let wasPressed = false;
  return Object.freeze({
    trail,
    update(position, pressed) {
      const edge = pressed === true && !wasPressed;
      wasPressed = pressed === true;
      const result = advancePublicTrail(trail,index,position,edge);
      index = result.index;
      return result;
    }
  });
}
