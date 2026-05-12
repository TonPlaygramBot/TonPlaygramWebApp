import assert from 'node:assert/strict';
import {
  applySnookerTableModelParam,
  resolveSnookerCushionBoundaryPolyline,
  resolveSnookerGlbFitTransform,
  resolveSnookerTableModel,
  usesProceduralSnookerTableRailDecor,
  TABLE_MODEL_CLASSIC,
  TABLE_MODEL_OPENSOURCE,
  TABLE_MODEL_OPENSOURCE_GLB_URL
} from '../webapp/src/pages/Games/snookerTableModel.js';

describe('snooker table model selection', () => {
  test('resolveSnookerTableModel defaults to the open-source GLB table', () => {
    assert.equal(resolveSnookerTableModel(null), TABLE_MODEL_OPENSOURCE);
    assert.equal(resolveSnookerTableModel(''), TABLE_MODEL_OPENSOURCE);
    assert.equal(resolveSnookerTableModel('invalid'), TABLE_MODEL_OPENSOURCE);
  });

  test('resolveSnookerTableModel accepts opensource value case-insensitively', () => {
    assert.equal(resolveSnookerTableModel('opensource'), TABLE_MODEL_OPENSOURCE);
    assert.equal(resolveSnookerTableModel('OpenSource'), TABLE_MODEL_OPENSOURCE);
  });

  test('applySnookerTableModelParam always writes a safe tableModel param', () => {
    const params = new URLSearchParams();
    applySnookerTableModelParam(params, 'opensource');
    assert.equal(params.get('tableModel'), TABLE_MODEL_OPENSOURCE);

    applySnookerTableModelParam(params, 'unknown');
    assert.equal(params.get('tableModel'), TABLE_MODEL_OPENSOURCE);
  });

  test('resolveSnookerGlbFitTransform maps GLB bounds exactly onto the procedural table', () => {
    const transform = resolveSnookerGlbFitTransform(
      { x: 2, y: 0.5, z: 4 },
      { x: 10, y: 1, z: 20 }
    );
    assert.deepEqual(transform.scale, { x: 5, y: 2, z: 5 });
  });

  test('resolveSnookerGlbFitTransform keeps width and depth independently exact', () => {
    const transform = resolveSnookerGlbFitTransform(
      { x: 2, y: 1, z: 5 },
      { x: 12, y: 1, z: 20 }
    );
    assert.deepEqual(transform.scale, { x: 6, y: 1, z: 4 });
  });

  test('uses procedural rail decor only for the classic table model', () => {
    assert.equal(usesProceduralSnookerTableRailDecor('classic'), true);
    assert.equal(usesProceduralSnookerTableRailDecor('opensource'), false);
    assert.equal(usesProceduralSnookerTableRailDecor('unknown'), false);
  });

  test('uses the Pooltool snooker_generic GLB source', () => {
    assert.match(
      TABLE_MODEL_OPENSOURCE_GLB_URL,
      /pooltool\/models\/table\/snooker_generic\/snooker_generic\.glb$/
    );
  });

  test('resolveSnookerCushionBoundaryPolyline follows angled jaw vertices instead of a flat bounding box', () => {
    const points = [
      { x: -4, z: 2.4 },
      { x: -3, z: 2.2 },
      { x: -2, z: 2 },
      { x: 0, z: 2 },
      { x: 2, z: 2 },
      { x: 3, z: 2.2 },
      { x: 4, z: 2.4 },
      { x: -4, z: 2.9 },
      { x: -3, z: 2.9 },
      { x: -2, z: 2.9 },
      { x: 0, z: 2.9 },
      { x: 2, z: 2.9 },
      { x: 3, z: 2.9 },
      { x: 4, z: 2.9 }
    ];

    const polyline = resolveSnookerCushionBoundaryPolyline(points, {
      horizontal: true,
      side: 1,
      binSize: 1,
      minPoints: 4
    });

    assert.ok(polyline.length >= 7);
    assert.deepEqual(polyline[0], { x: -4, z: 2.4 });
    assert.deepEqual(polyline[3], { x: 0, z: 2 });
    assert.deepEqual(polyline[polyline.length - 1], { x: 4, z: 2.4 });
  });

  test('resolveSnookerCushionBoundaryPolyline mirrors the lower cushion inward edge', () => {
    const points = [
      { x: -2, z: -2.8 },
      { x: -1, z: -2 },
      { x: 0, z: -2 },
      { x: 1, z: -2 },
      { x: 2, z: -2.8 },
      { x: -2, z: -3.1 },
      { x: -1, z: -3.1 },
      { x: 0, z: -3.1 },
      { x: 1, z: -3.1 },
      { x: 2, z: -3.1 }
    ];

    const polyline = resolveSnookerCushionBoundaryPolyline(points, {
      horizontal: true,
      side: -1,
      binSize: 1,
      minPoints: 4
    });

    assert.equal(polyline[0].z, -2.8);
    assert.equal(polyline[2].z, -2);
    assert.equal(polyline[polyline.length - 1].z, -2.8);
  });

});
