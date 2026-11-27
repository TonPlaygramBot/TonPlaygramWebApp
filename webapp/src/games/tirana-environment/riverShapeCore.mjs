export const BANK_WIDTH = 6.8;

/** Bounded miter joins maintain a constant channel width through river bends. */
export function offsetRiver(line, offset) {
  return line.map((p, i) => {
    const normal = (a, b) => {
      const dx = b[0]-a[0], dz = b[1]-a[1], length = Math.hypot(dx,dz) || 1;
      return [dz/length, -dx/length];
    };
    const a = normal(line[Math.max(0,i-1)], i ? p : line[1]);
    const b = normal(i < line.length-1 ? p : line[i-1], line[Math.min(line.length-1,i+1)]);
    const nx = a[0]+b[0], nz = a[1]+b[1], length = Math.hypot(nx,nz);
    if (length < .01) return [p[0]+b[0]*offset,p[1]+b[1]*offset];
    const scale = offset / Math.max(.5,(nx*b[0]+nz*b[1])/length);
    return [p[0]+nx/length*scale,p[1]+nz/length*scale];
  });
}
export function riverRing(path, margin = BANK_WIDTH) {
  return [...offsetRiver(path.line,path.width/2+margin),...offsetRiver(path.line,-path.width/2-margin).reverse()];
}

// Concrete slope run between the mapped bed edge and the planted upper bank.
export const CHANNEL_LINER_RUN = 2.6;
const WATER_SEAM_OVERLAP = .035;
export function channelWaterMargin(level, bed, shoulder) {
  if (!(shoulder > bed) || level <= bed) return 0;
  return Math.min(CHANNEL_LINER_RUN, CHANNEL_LINER_RUN*(level-bed)/(shoulder-bed)+WATER_SEAM_OVERLAP);
}

export function riverFlowOrigins(paths) {
  const key = (v) => v.join(',');
  const length = (p) => p.line.slice(1).reduce((sum,a,i)=>sum+Math.hypot(a[0]-p.line[i][0],a[1]-p.line[i][1]),0);
  const out = new Map(), predecessors = new Map(paths.map(p=>[key(p.line.at(-1)),p]));
  const visit = (path, checking) => {
    if (out.has(path.id)) return out.get(path.id);
    const previous = predecessors.get(key(path.line[0]));
    // Use an east-west phase as a seed at disconnected source reaches.
    let phase = -path.line[0][0];
    if (previous !== undefined && !checking.has(previous)) {
      checking.add(path);
      phase = visit(previous,checking)+length(previous);
      checking.delete(path);
    }
    out.set(path.id,phase);
    return phase;
  };
  for (const p of paths) visit(p,new Set([p]));
  return out;
}
