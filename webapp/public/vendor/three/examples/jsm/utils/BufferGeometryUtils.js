import {
  BufferAttribute,
  BufferGeometry,
  TriangleFanDrawMode,
  TriangleStripDrawMode,
  TrianglesDrawMode,
} from '/vendor/three/build/three.module.js';

export function toTrianglesDrawMode(geometry, drawMode) {
  if (drawMode === TrianglesDrawMode) return geometry;
  if (!(geometry instanceof BufferGeometry)) {
    throw new Error('THREE.BufferGeometryUtils.toTrianglesDrawMode(): geometry is not a BufferGeometry instance.');
  }

  const index = geometry.getIndex();
  if (index === null) {
    console.warn('THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry has no index.');
    return geometry;
  }

  const numberOfTriangles = index.count - 2;
  const newIndices = [];

  if (drawMode === TriangleFanDrawMode) {
    for (let i = 1; i <= numberOfTriangles; i++) {
      newIndices.push(index.getX(0));
      newIndices.push(index.getX(i));
      newIndices.push(index.getX(i + 1));
    }
  } else if (drawMode === TriangleStripDrawMode) {
    for (let i = 0; i < numberOfTriangles; i++) {
      if (i % 2 === 0) {
        newIndices.push(index.getX(i));
        newIndices.push(index.getX(i + 1));
        newIndices.push(index.getX(i + 2));
      } else {
        newIndices.push(index.getX(i + 2));
        newIndices.push(index.getX(i + 1));
        newIndices.push(index.getX(i));
      }
    }
  } else {
    console.error('THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:', drawMode);
    return geometry;
  }

  if ((newIndices.length / 3) !== numberOfTriangles) {
    console.error('THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.');
  }

  const newGeometry = geometry.clone();
  newGeometry.setIndex(newIndices);
  newGeometry.clearGroups();
  return newGeometry;
}

export { BufferAttribute };
