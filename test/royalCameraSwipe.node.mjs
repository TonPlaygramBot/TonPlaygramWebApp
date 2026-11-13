import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { royalCameraBlendFromDrag, captureRoyalPlayerView } from '../webapp/src/pages/Games/shared/royalCameraControls.ts';
import { PoolRoyalShotCamera } from '../webapp/src/pages/Games/shared/poolRoyalShotCamera.ts';
import { SnookerRoyalShotCamera } from '../webapp/src/pages/Games/snookerRoyalShotCamera.ts';

const ref = current => ({ current });
for (const game of ['PoolRoyale', 'SnookerRoyal']) {
  const source = await readFile(new URL(`../webapp/src/pages/Games/${game}.jsx`, import.meta.url), 'utf8');
  const variables = new Map();
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && node.id.name) variables.set(node.id.name, node.init);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value?.type) visit(value);
    }
  };
  visit(parse(source, { sourceType: 'module', plugins: ['jsx'] }));
  const callback = (name, context) => {
    const node = variables.get(name);
    assert.ok(node, `production ${name} exists`);
    return vm.runInNewContext(`(${source.slice(node.start, node.end)})`, context);
  };
  const makeController = () => game === 'PoolRoyale' ? new PoolRoyalShotCamera() : new SnookerRoyalShotCamera();
  const rig = (height = 844) => {
    const context = {
      THREE, royalCameraBlendFromDrag,
      drag: { on: false, moved: false, x: 0, y: 0 }, galleryDrag: {},
      replayPlaybackRef: ref(null), cueGalleryStateRef: ref(null), cueLiftRef: ref({ active: false }),
      topViewRef: ref(false), topViewLockedRef: ref(false),
      hudRef: ref({ turn: 0, inHand: false }), inHandPlacementModeRef: ref(false), shooting: false,
      ENABLE_CUE_GALLERY: false, attemptChalkPress: () => false, attemptCueLiftPress: () => false,
      registerInteraction() {}, updateCamera() {},
      autoAimRequestRef: ref(false), suggestionAimKeyRef: ref(null),
      cameraBlendRef: ref(1), sph: { theta: Math.PI },
      chalkAssistEnabledRef: ref(false), chalkAssistTargetRef: ref(null),
      CHALK_PRECISION_SLOW_MULTIPLIER: 0.2, CUE_VIEW_AIM_SLOW_FACTOR: 0.4,
      dom: { getBoundingClientRect: () => ({ height }) },
      focusPicks: 0, pickOrbitFocus: () => context.focusPicks++,
      applyCameraBlend: blend => { context.cameraBlendRef.current = blend; },
      world: new THREE.Group(), humanShotCamera: makeController(),
      activeHumanCueViewRef: ref({ position: new THREE.Vector3(0, 5, 12), target: new THREE.Vector3(0, 2, 0), blend: 1 }),
      frameRef: ref({ activePlayer: 'A' }), localSeatRef: ref('A'),
      characterShotShooterRef: ref('A'), characterShotShooter: 'A',
      cueStrokeStateRef: ref(null), cueAnimating: false, shotImpactPending: false,
      shootingRef: ref(false), lookModeRef: ref(false), performance: { now: () => 0 }
    };
    context.cancelCameraDrag = callback('cancelCameraDrag', context);
    return { context, down: callback('down', context), move: callback('move', context),
      up: callback('up', context), resolve: callback('resolveActiveHumanEyePose', context) };
  };
  const touch = (x, y) => ({ touches: [{ clientX: x, clientY: y }] });

  test(`${game}: real touch handlers lower toward cue and raise toward standing at portrait sizes`, () => {
    for (const height of [568, 640, 844, 932]) {
      const { context: c, down, move, up, resolve } = rig(height);
      const travel = Math.min(height * 0.4, 360);
      const start = 100;
      down(touch(180, start));
      let previousY = 40;
      for (let step = 1; step <= 20; step++) {
        move(touch(180, start + travel * step / 20));
        const pose = resolve();
        // Exercise the final JSX render handoff, not an independent blend formula.
        const body = source.slice(source.indexOf('          if (humanEyePose) {'),
          source.indexOf('          if (lookTarget) {', source.indexOf('          if (humanEyePose) {')));
        const sourceCamera = new THREE.PerspectiveCamera(66, 390 / height);
        sourceCamera.position.set(0, 40, 50);
        const final = vm.runInNewContext(`(() => { ${body} return renderCamera; })()`, {
          humanEyePose: pose, humanEyeCamera: new THREE.PerspectiveCamera(),
          renderCamera: sourceCamera,
          lookTarget: new THREE.Vector3(), THREE, STANDING_VIEW_FOV: 66,
          replayPlaybackActive: false, activeHumanPlayersRef: ref(null), localSeatRef: ref('A')
        });
        const renderedY = final.position.y;
        assert.ok(renderedY <= previousY + 1e-9, 'down never raises the viewpoint');
        previousY = renderedY;
      }
      assert.ok(c.cameraBlendRef.current < 1e-10);
      assert.equal(resolve().blend, 1, 'cue endpoint is at the eyes');
      assert.equal(c.sph.theta, Math.PI, 'vertical swipe leaves aiming direction alone');
      up({});
      assert.ok(c.cameraBlendRef.current < 1e-10, 'release retains the selected view');
      assert.equal(c.focusPicks, 0, 'swipe is not a focus tap');
      down(touch(180, start + travel));
      for (let step = 1; step <= 20; step++) move(touch(180, start + travel * (1 - step / 20)));
      up({});
      assert.equal(c.cameraBlendRef.current, 1);
      assert.equal(resolve(), null, 'standing endpoint releases the eye override');
    }
  });

  test(`${game}: cushion safety cannot overwrite the user's requested view height`, () => {
    const { context: c } = rig();
    Object.assign(c, {
      cameraBoundsRef: ref({ standing: { phi: .92, radius: 30 }, cueShot: { phi: 1.2, radius: 2 } }),
      clamp: THREE.MathUtils.clamp, clampOrbitRadius: (value, min = 1) => THREE.MathUtils.clamp(value, min, 100),
      TABLE: { THICK: 2 }, CAMERA: { minR: 1, minPhi: .38, maxPhi: 1.21 },
      lowViewSlideRef: ref(0), cushionHeightRef: ref(3), orbitFocusRef: ref({ target: { y: 0 } }),
      CUE_VIEW_FORWARD_SLIDE_MAX: 0, CUE_VIEW_FORWARD_SLIDE_RESET_BLEND: .95,
      CUE_VIEW_MIN_RADIUS: 1, CAMERA_DOWNWARD_PULL: 0, ORBIT_FOCUS_BASE_Y: 0,
      CUE_Y: 4, CAMERA_CUE_SURFACE_MARGIN: 1, CAMERA_CUSHION_CLEARANCE: 1,
      AIM_LINE_MIN_Y: 4, CAMERA_AIM_LINE_MARGIN: .1, CAMERA_RAIL_SAFETY: .01,
      CAMERA_RAIL_APPROACH_PHI: 1, CAMERA_MIN_HORIZONTAL: 1, CAMERA_DYNAMIC_PULL_RANGE: 0,
      CAMERA_LOW_VIEW_PULL_RANGE: 0, STANDING_TO_CUE_FORWARD_PUSH: 0, CAMERA_TILT_ZOOM: 0
    });
    c.syncBlendToSpherical = callback('syncBlendToSpherical', c);
    const apply = callback('applyCameraBlend', c);
    for (const blend of [1, .5, 0, .5, 1]) {
      apply(blend);
      assert.equal(c.cameraBlendRef.current, blend, 'safety affects geometry, never swipe intent');
      assert.ok(c.sph.phi >= c.CAMERA.minPhi && c.sph.phi <= c.CAMERA.maxPhi);
      if (blend === 0) assert.ok(c.sph.phi < c.cameraBoundsRef.current.cueShot.phi, 'exercise a real safety clamp');
    }
  });

  test(`${game}: edge coordinates, assisted aim, cancellation, and placement preserve camera control`, () => {
    const { context: c, down, move, up } = rig();
    c.cameraBlendRef.current = 0;
    c.chalkAssistEnabledRef.current = true; c.chalkAssistTargetRef.current = {};
    down(touch(180, 350)); move(touch(180, 0));
    assert.equal(c.cameraBlendRef.current, 1, 'screen y=0 is valid; chalk does not slow standing up');
    c.cameraBlendRef.current = 0.5;
    down(touch(180, 200)); c.cancelCameraDrag(); move(touch(180, 400)); up({});
    assert.equal(c.cameraBlendRef.current, 0.5);
    assert.equal(c.focusPicks, 0, 'cancelled swipe does not select a focus');
    down(touch(180, 200)); move({ touches: [{ clientX: 180, clientY: 250 }, { clientX: 240, clientY: 250 }] });
    move(touch(180, 450)); up({});
    assert.equal(c.cameraBlendRef.current, 0.5, 'second finger ends the one-finger camera drag');
    c.hudRef.current.inHand = true; c.inHandPlacementModeRef.current = true;
    down(touch(180, 200)); assert.equal(c.drag.on, false, 'placement owns the touch while placing');
    c.inHandPlacementModeRef.current = false;
    down(touch(180, 200)); move(touch(180, 400));
    assert.ok(c.cameraBlendRef.current < 0.5, 'confirmed placement restores swiping even with ball-in-hand rights');
    c.shooting = true; const before = c.cameraBlendRef.current;
    move(touch(180, 0)); assert.equal(c.cameraBlendRef.current, before, 'a shot cancels an in-progress drag');
  });

  test(`${game}: standing and intermediate shots preserve position, direction, FOV and zoom through impact`, () => {
    for (const height of [5, 15, 40]) {
      const world = new THREE.Group(); world.scale.setScalar(.23); world.rotation.y = .7; world.position.set(11, -4, 5);
      const camera = new THREE.PerspectiveCamera(58, 390 / 844); camera.zoom = 1.25;
      camera.position.set(10, height, 45);
      const target = new THREE.Vector3(2, 1, 3);
      const snapshot = captureRoyalPlayerView(camera, target, world, null);
      const controller = makeController(); controller.beginShot(snapshot, snapshot);
      camera.position.set(100, 100, 100); target.set(100, 100, 100);
      for (const now of [0, 250, 750, 1000]) {
        if (now === 250) controller.markImpact(now);
        const pose = controller.resolve({ eye: null, stroke: now < 500, shooting: true,
          impactPending: now < 250, cueBlend: 1, now });
        assert.ok(world.localToWorld(pose.position.clone()).distanceTo(new THREE.Vector3(10, height, 45)) < 1e-8);
        assert.ok(world.localToWorld(pose.target.clone()).distanceTo(new THREE.Vector3(2, 1, 3)) < 1e-8);
        assert.equal(pose.fov, 58); assert.equal(pose.zoom, 1.25); assert.equal(pose.blend, 1);
      }
      assert.equal(controller.resolve({ eye: null, stroke: false, shooting: true, impactPending: false, cueBlend: 1, now: 1150 }), null);
    }
  });
}
