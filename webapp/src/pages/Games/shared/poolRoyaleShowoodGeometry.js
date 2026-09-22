import { POOL_ROYALE_SHOWOOD_PROFILE as SOURCE } from '../../../config/poolRoyaleShowoodProfile.js';

const EPSILON = 1e-10;
const length = (x, y) => Math.hypot(x, y);

/** One transform for the visible GLB, rail contacts, pocket drops and aiming. */
export function createShowoodTableGeometry({ playWidth, playLength, ballRadius, clothHeight = 0 }) {
  if (![playWidth, playLength, ballRadius].every((n) => Number.isFinite(n) && n > 0)) {
    throw new RangeError('Positive finite playfield dimensions and ball radius are required');
  }
  const bounds = SOURCE.noseBounds;
  const scaleX = playWidth / (bounds.maxX - bounds.minX);
  const scaleZ = playLength / (bounds.maxZ - bounds.minZ);
  const scaleY = Math.sqrt(scaleX * scaleZ);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const map = (x, z) => ({ x: (x - centerX) * scaleX, y: (z - centerZ) * scaleZ });
  const cushionPolygons = SOURCE.cushions.map(({ id, points }) => ({
    id, points: points.map(([x, z]) => map(x, z))
  }));
  const segments = cushionPolygons.flatMap(({ id, points }) => points.map((start, index) => {
    const end = points[(index + 1) % points.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = length(dx, dy);
    // Source contours have counterclockwise winding; the ball is outside the solid.
    const normal = { x: dy / distance, y: -dx / distance };
    const middleX = (start.x + end.x) / 2;
    const middleY = (start.y + end.y) / 2;
    const nose = (Math.abs(Math.abs(middleX) - playWidth / 2) < playWidth * 1e-6 && Math.abs(dx) < 1e-6) ||
      (Math.abs(Math.abs(middleY) - playLength / 2) < playLength * 1e-6 && Math.abs(dy) < 1e-6);
    return { start, end, normal, type: nose ? 'rail' : 'jaw', polygonId: id, mapped: true };
  }).filter((segment) => length(segment.end.x - segment.start.x, segment.end.y - segment.start.y) > EPSILON));
  const pockets = SOURCE.pockets.map((pocket, index) => ({
    ...map(pocket.x, pocket.y), radius: pocket.radius * Math.min(scaleX, scaleZ),
    type: index >= 4 ? 'side' : 'corner'
  }));
  return {
    segments, cushionPolygons, pockets,
    footprint: {
      width: (SOURCE.frameBounds.maxX - SOURCE.frameBounds.minX) * scaleX,
      length: (SOURCE.frameBounds.maxZ - SOURCE.frameBounds.minZ) * scaleZ
    },
    railLimits: { x: playWidth / 2 - ballRadius, y: playLength / 2 - ballRadius },
    fit: {
      scale: { x: scaleX, y: scaleY, z: scaleZ },
      position: { x: -centerX * scaleX, y: clothHeight - SOURCE.clothY * scaleY, z: -centerZ * scaleZ }
    },
    sourceSha256: SOURCE.sha256
  };
}

export function closestPointOnPoolCushion(position, segment) {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const denominator = dx * dx + dy * dy;
  const t = denominator > EPSILON
    ? Math.max(0, Math.min(1, ((position.x - segment.start.x) * dx + (position.y - segment.start.y) * dy) / denominator))
    : 0;
  return { x: segment.start.x + t * dx, y: segment.start.y + t * dy };
}

/** Position-only contact constraint; does not add energy, rail events or fouls. */
export function projectPoolBallFromCushions(position, radius, segments, { iterations = 4 } = {}) {
  if (!position || !(radius > 0) || !Array.isArray(segments)) return false;
  let changed = false;
  // Resolve only the closest solid contact per pass. Resolving every tessellated
  // jaw edge as a plane would push balls across the open pocket throat.
  for (let pass = 0; pass < iterations; pass += 1) {
    let best = null;
    for (const segment of segments) {
      const nearest = closestPointOnPoolCushion(position, segment);
      const dx = position.x - nearest.x;
      const dy = position.y - nearest.y;
      const distance = length(dx, dy);
      if (distance >= radius || (best && distance >= best.distance)) continue;
      const signed = dx * segment.normal.x + dy * segment.normal.y;
      const normal = distance > EPSILON && signed >= 0
        ? { x: dx / distance, y: dy / distance }
        : segment.normal;
      best = { distance, normal, penetration: signed >= 0 ? radius - distance : radius + distance };
    }
    if (!best || best.penetration <= EPSILON) break;
    position.x += best.normal.x * best.penetration;
    position.y += best.normal.y * best.penetration;
    changed = true;
  }
  return changed;
}

/** Ray versus finite cushion capsules, retaining the actual open pocket mouths. */
export function raycastPoolCushions(origin, direction, radius, segments, maxDistance = Infinity) {
  const magnitude = length(direction.x, direction.y);
  if (magnitude <= EPSILON) return null;
  const ux = direction.x / magnitude;
  const uy = direction.y / magnitude;
  let nearest = null;
  const register = (distance, segment, normal) => {
    if (distance < -EPSILON || distance > maxDistance || (nearest && distance >= nearest.distance)) return;
    if (ux * normal.x + uy * normal.y >= -EPSILON) return;
    nearest = { distance: Math.max(0, distance), point: { x: origin.x + ux * distance, y: origin.y + uy * distance }, normal, segment };
  };
  for (const segment of segments || []) {
    const { start, end, normal } = segment;
    const approach = ux * normal.x + uy * normal.y;
    if (approach < -EPSILON) {
      const signed = (origin.x - start.x) * normal.x + (origin.y - start.y) * normal.y;
      const t = (radius - signed) / approach;
      const x = origin.x + ux * t;
      const y = origin.y + uy * t;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const along = ((x - start.x) * dx + (y - start.y) * dy) / (dx * dx + dy * dy);
      if (along >= 0 && along <= 1) register(t, segment, normal);
    }
    for (const endpoint of [start, end]) {
      const ox = origin.x - endpoint.x;
      const oy = origin.y - endpoint.y;
      const b = ox * ux + oy * uy;
      const c = ox * ox + oy * oy - radius * radius;
      const discriminant = b * b - c;
      if (discriminant < 0) continue;
      const t = -b - Math.sqrt(discriminant);
      const nx = ox + ux * t;
      const ny = oy + uy * t;
      const norm = length(nx, ny);
      if (norm > EPSILON && nx * normal.x + ny * normal.y >= -EPSILON) {
        register(t, segment, { x: nx / norm, y: ny / norm });
      }
    }
  }
  return nearest;
}

/** Ground only the GLB's lower supports; keep every playing-surface vertex fixed. */
export function groundShowoodTableLegs(model, floorY) {
  if (!model || !Number.isFinite(floorY) || model.userData?.showoodLegsGrounded) return false;
  model.updateMatrixWorld(true);
  const supports = [];
  const point = model.position.clone();
  model.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.geometry?.attributes?.position) return;
    let owner = mesh;
    let isLeg = false;
    while (owner && owner !== model) {
      if (/^legs?(?:_\d+)?$/i.test(owner.name || '')) isLeg = true;
      owner = owner.parent;
    }
    if (!isLeg) return;
    const positions = mesh.geometry.attributes.position;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let index = 0; index < positions.count; index += 1) {
      point.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    supports.push({ mesh, minY, maxY });
  });
  if (!supports.length) return false;
  const bottom = Math.min(...supports.map(part => part.minY));
  const top = Math.max(...supports.map(part => part.maxY));
  const delta = floorY - bottom;
  if (Math.abs(delta) <= 1e-8) return false;
  for (const { mesh, minY, maxY } of supports) {
    const parent = mesh.parent;
    const height = maxY - minY;
    const isFoot = height < (top - bottom) * 0.15;
    if (isFoot) {
      // Keep the rubber feet's original height; translate them down with the leg.
      const localBefore = parent.worldToLocal(point.set(0, minY, 0)).y;
      const localAfter = parent.worldToLocal(point.set(0, minY + delta, 0)).y;
      mesh.position.y += localAfter - localBefore;
    } else if (height > 1e-8 && height - delta > 0) {
      // Anchor at the apron and extend the wooden support to the translated foot.
      const anchor = parent.worldToLocal(point.set(0, maxY, 0)).y;
      const oldScale = mesh.scale.y;
      mesh.scale.y *= (height - delta) / height;
      mesh.position.y = anchor + (mesh.position.y - anchor) * (mesh.scale.y / oldScale);
    }
    mesh.updateMatrixWorld(true);
  }
  model.userData.showoodLegsGrounded = true;
  model.updateMatrixWorld(true);
  return true;
}
