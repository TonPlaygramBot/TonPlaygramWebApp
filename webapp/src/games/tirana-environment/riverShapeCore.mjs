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
