import * as THREE from 'three';

export function signedRingArea(ring) {
  let area = 0;
  if (!Array.isArray(ring)) return area;
  for (let i = 0; i < ring.length - 1; i++) {
    const current = ring[i];
    const next = ring[i + 1];
    if (!Array.isArray(current) || !Array.isArray(next)) continue;
    const [x1, y1] = current;
    const [x2, y2] = next;
    area += x1 * y2 - x2 * y1;
  }
  return area * 0.5;
}

export function multiPolygonToShapes(mp) {
  const shapes = [];
  if (!Array.isArray(mp)) return shapes;
  mp.forEach((poly) => {
    if (!Array.isArray(poly) || !poly.length) return;
    const outerRing = poly[0];
    if (!Array.isArray(outerRing) || outerRing.length < 4) return;
    const outerPts = outerRing.slice(0, -1);
    if (!outerPts.length) return;
    const outerClockwise = signedRingArea(outerRing) < 0;
    const orderedOuter = outerClockwise ? outerPts.slice().reverse() : outerPts;
    const shape = new THREE.Shape();
    shape.moveTo(orderedOuter[0][0], orderedOuter[0][1]);
    for (let i = 1; i < orderedOuter.length; i++) {
      shape.lineTo(orderedOuter[i][0], orderedOuter[i][1]);
    }
    shape.closePath();

    for (let ringIndex = 1; ringIndex < poly.length; ringIndex++) {
      const holeRing = poly[ringIndex];
      if (!Array.isArray(holeRing) || holeRing.length < 4) continue;
      const holePts = holeRing.slice(0, -1);
      if (!holePts.length) continue;
      const holeClockwise = signedRingArea(holeRing) < 0;
      const orderedHole = holeClockwise ? holePts : holePts.slice().reverse();
      const hole = new THREE.Path();
      hole.moveTo(orderedHole[0][0], orderedHole[0][1]);
      for (let i = 1; i < orderedHole.length; i++) {
        hole.lineTo(orderedHole[i][0], orderedHole[i][1]);
      }
      hole.closePath();
      shape.holes.push(hole);
    }

    shapes.push(shape);
  });
  return shapes;
}

export function centroidFromRing(ring) {
  if (!Array.isArray(ring) || !ring.length) {
    return { x: 0, y: 0 };
  }
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let i = 0; i < ring.length; i++) {
    const pt = ring[i];
    if (!Array.isArray(pt) || pt.length < 2) continue;
    sumX += pt[0];
    sumY += pt[1];
    count++;
  }
  if (!count) {
    return { x: 0, y: 0 };
  }
  return { x: sumX / count, y: sumY / count };
}

export function scaleMultiPolygon(mp, scale) {
  if (!Array.isArray(mp) || typeof scale !== 'number') {
    return [];
  }
  const clampedScale = Math.max(0, scale);
  return mp
    .map((poly) => {
      if (!Array.isArray(poly) || !poly.length) return null;
      const outerRing = poly[0];
      const centroid = centroidFromRing(outerRing);
      const scaledPoly = poly
        .map((ring) => {
          if (!Array.isArray(ring) || !ring.length) return null;
          return ring
            .map((pt) => {
              if (!Array.isArray(pt) || pt.length < 2) return null;
              const dx = pt[0] - centroid.x;
              const dy = pt[1] - centroid.y;
              return [centroid.x + dx * clampedScale, centroid.y + dy * clampedScale];
            })
            .filter(Boolean);
        })
        .filter((ring) => Array.isArray(ring) && ring.length > 0);
      if (!scaledPoly.length) return null;
      return scaledPoly;
    })
    .filter((poly) => Array.isArray(poly) && poly.length > 0);
}

export function scaleMultiPolygonBy(mp, scale) {
  if (!Array.isArray(mp)) {
    return [];
  }
  if (!Number.isFinite(scale) || Math.abs(scale - 1) < 1e-6) {
    return mp;
  }
  return scaleMultiPolygon(mp, scale);
}

export function adjustCornerNotchDepth(mp, centerZ, sz, centerScale = 1) {
  if (!Array.isArray(mp) || !Number.isFinite(centerZ) || !Number.isFinite(sz)) {
    return Array.isArray(mp) ? mp : [];
  }
  const scale = Number.isFinite(centerScale) ? centerScale : 1;
  return mp.map((poly) =>
    Array.isArray(poly)
      ? poly.map((ring) =>
          Array.isArray(ring)
            ? ring.map((pt) => {
                if (!Array.isArray(pt) || pt.length < 2) return pt;
                const [x, z] = pt;
                const deltaZ = z - centerZ;
                const towardCenter = -sz * deltaZ;
                if (towardCenter <= 0) return [x, z];
                return [x, centerZ + deltaZ * scale];
              })
            : ring
        )
      : poly
  );
}

export function adjustSideNotchDepth(mp, depthScale = 1) {
  if (!Array.isArray(mp)) return Array.isArray(mp) ? mp : [];
  const scale = Number.isFinite(depthScale) ? depthScale : 1;
  return mp.map((poly) =>
    Array.isArray(poly)
      ? poly.map((ring) =>
          Array.isArray(ring)
            ? ring.map((pt) => {
                if (!Array.isArray(pt) || pt.length < 2) return pt;
                const [x, z] = pt;
                return [x, z * scale];
              })
            : ring
        )
      : poly
  );
}
