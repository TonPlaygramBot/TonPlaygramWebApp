import * as T from 'three';

const HEAD_MATERIAL = 'Turi multi-view head';
const keyFor = (p, i) => `${Math.round(p.getX(i) * 1e5)},${Math.round(p.getY(i) * 1e5)},${Math.round(p.getZ(i) * 1e5)}`;

/** Find the two authored UV edges representing one physical edge. A UV island
 * is not a new surface: its duplicated vertices must light and filter together.
 * Keep opposing surfaces (mouth/eyelids) and genuine creases separate. */
export function turiSurfaceSeams(geometry) {
  const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv'),
    normal = geometry.getAttribute('normal'), index = geometry.getIndex();
  if (!position || !uv || !normal) return {edges: [], groups: []};
  const keys = [], vertices = new Map(), edges = new Map();
  for (let i = 0; i < position.count; i++) {
    const key = keyFor(position, i); keys.push(key);
    if (!vertices.has(key)) vertices.set(key, []);
    vertices.get(key).push(i);
  }
  const at = i => index ? index.getX(i) : i;
  const count = index?.count || position.count;
  for (let triangle = 0; triangle < count; triangle += 3) {
    const ids = [at(triangle), at(triangle + 1), at(triangle + 2)];
    for (let j = 0; j < 3; j++) {
      let a = ids[j], b = ids[(j + 1) % 3];
      if (keys[a] === keys[b]) continue;
      if (keys[a] > keys[b]) [a, b] = [b, a];
      const key = `${keys[a]}|${keys[b]}`;
      const edge = {a, b, inner: ids[(j + 2) % 3]};
      if (!edges.has(key)) edges.set(key, []);
      edges.get(key).push(edge);
    }
  }
  const dot = (a, b) => normal.getX(a) * normal.getX(b) + normal.getY(a) * normal.getY(b) + normal.getZ(a) * normal.getZ(b);
  const uvDistance = (a, b) => Math.hypot(uv.getX(a) - uv.getX(b), uv.getY(a) - uv.getY(b));
  const result = [];
  for (const pair of edges.values()) {
    if (pair.length !== 2) continue;
    const [a, b] = pair;
    if (uvDistance(a.a, b.a) + uvDistance(a.b, b.b) < 1e-4) continue;
    if (dot(a.a, b.a) < .8 || dot(a.b, b.b) < .8) continue;
    result.push(pair);
  }
  return {edges: result, groups: [...vertices.values()].filter(group => group.length > 1 && group.every(i => dot(i, group[0]) > .8))};
}

/** Narrow, symmetric exposure correction at verified atlas seams. Samples come
 * from INSIDE each triangle, never from the black atlas background. A matching
 * gutter outside each edge protects mipmaps without blurring facial features.
 * The original pixels are read-only; only a 4-texel seam band is changed. */
export function repairTuriAtlasPixels(geometry, pixels, width, height, seams = turiSurfaceSeams(geometry)) {
  const uv = geometry.getAttribute('uv'), result = new Uint8ClampedArray(pixels);
  // One small weight buffer avoids three full floating-point image copies on
  // phones. Accumulate into the result; always sample the immutable source.
  const weights = new Uint16Array(width * height);
  const point = i => [uv.getX(i) * (width - 1), uv.getY(i) * (height - 1)];
  const edgeFrame = edge => {
    const a = point(edge.a), b = point(edge.b), inside = point(edge.inner);
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    let nx = -dy / length, ny = dx / length;
    if ((inside[0] - a[0]) * nx + (inside[1] - a[1]) * ny < 0) {nx = -nx; ny = -ny;}
    return {a, b, nx, ny, length};
  };
  const pixelAt = (x, y) => (Math.max(0, Math.min(height - 1, Math.round(y))) * width + Math.max(0, Math.min(width - 1, Math.round(x))));
  for (const pair of seams.edges) {
    const frames = pair.map(edgeFrame);
    if (frames.some(frame => !Number.isFinite(frame.length) || frame.length < .2)) continue;
    const steps = Math.min(128, Math.max(2, Math.ceil(Math.max(...frames.map(f => f.length)))));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps, samples = frames.map(f => {
        const x = f.a[0] + (f.b[0] - f.a[0]) * t, y = f.a[1] + (f.b[1] - f.a[1]) * t;
        return {x, y, pixel: pixelAt(x + f.nx * 1.5, y + f.ny * 1.5)};
      });
      const a = samples[0].pixel * 4, b = samples[1].pixel * 4;
      // Discard a badly undersized UV sliver instead of dragging atlas black
      // across the face. Dark hair remains untouched by exposure correction.
      const valid = Math.min(pixels[a] + pixels[a + 1] + pixels[a + 2], pixels[b] + pixels[b + 1] + pixels[b + 2]) > 48;
      for (let side = 0; side < 2; side++) {
        const f = frames[side], sample = samples[side], source = sample.pixel * 4;
        for (let band = -3; band <= 4; band++) {
          const pixel = pixelAt(sample.x + f.nx * band, sample.y + f.ny * band), offset = pixel * 4;
          // Existing texels can belong to a tightly packed neighbouring island.
          // Extend into empty black padding only, never paint across that island.
          if (band < 0 && pixels[offset] + pixels[offset + 1] + pixels[offset + 2] > 24) continue;
          const blend = band <= 0 ? 1 : Math.max(0, 1 - band / 4);
          if (!blend) continue;
          const weight = band < 0 ? 1 : 5, previous = weights[pixel];
          for (let c = 0; c < 3; c++) {
            const average = valid ? (pixels[a + c] + pixels[b + c]) * .5 : pixels[source + c];
            const original = band < 0 ? pixels[source + c] : pixels[offset + c];
            // Limit exposure changes; retain moles, beard and original likeness.
            const correction = Math.max(-32, Math.min(32, average - pixels[source + c]));
            const value = band < 0 ? average : original + correction * blend;
            result[offset + c] = (result[offset + c] * previous + value * weight) / (previous + weight);
          }
          weights[pixel] += weight;
        }
      }
    }
  }
  return result;
}

/** Turi-only preparation, called once before skeleton cloning. Shared source
 * geometry and source images remain immutable; disposal restores live clones. */
export function prepareTuriSurfaceContinuity(root) {
  const owned = [], canvasFactory = typeof document === 'undefined' ? null : () => document.createElement('canvas');
  root.traverse(mesh => {
    if (!mesh.isMesh || Array.isArray(mesh.material) || mesh.material?.name !== HEAD_MATERIAL) return;
    const source = mesh.geometry, seams = turiSurfaceSeams(source);
    if (!seams.groups.length) return;
    const geometry = source.clone(), normal = geometry.getAttribute('normal');
    for (const group of seams.groups) {
      let x = 0, y = 0, z = 0;
      for (const i of group) {x += normal.getX(i); y += normal.getY(i); z += normal.getZ(i);}
      const length = Math.hypot(x, y, z); if (!length) continue;
      for (const i of group) normal.setXYZ(i, x / length, y / length, z / length);
    }
    normal.needsUpdate = true; mesh.geometry = geometry; owned.push({mesh, source, geometry});
    mesh.userData.turiSurfaceSeams = seams.edges.length;
    const texture = mesh.material.map, image = texture?.image;
    if (!canvasFactory || !image || !image.width || !image.height) return;
    try {
      const canvas = canvasFactory(); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d', {willReadFrequently: true}); if (!context) return;
      context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height);
      data.data.set(repairTuriAtlasPixels(geometry, data.data, canvas.width, canvas.height, seams));
      context.putImageData(data, 0, 0);
      // The material/texture are already owned clones from prepareHumanMaterials.
      texture.source = new T.Source(canvas); texture.needsUpdate = true;
      texture.userData.turiSeamsRepaired = true;
    } catch {
      // A non-readable external image retains its authored atlas; do not break
      // character loading. The shipped embedded GLB images are same-origin.
    }
  });
  return instances => {
    const originals = new Map(owned.map(item => [item.geometry, item.source]));
    for (const {mesh, source, geometry} of owned) if (mesh.geometry === geometry) mesh.geometry = source;
    instances?.traverse(mesh => {if (originals.has(mesh.geometry)) mesh.geometry = originals.get(mesh.geometry);});
    for (const {geometry} of owned) geometry.dispose();
    owned.length = 0;
  };
}
