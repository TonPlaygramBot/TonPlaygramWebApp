import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const HUMAN_URL = 'https://threejs.org/examples/models/gltf/readyplayer.me.glb';
const WORLD_SCALE = 3.5;
const UP = new THREE.Vector3(0, 1, 0);
const Y_AXIS = UP;
const BASIS_MAT = new THREE.Matrix4();

const CFG = {
  scale: WORLD_SCALE,
  humanScale: 1.18 * WORLD_SCALE,
  humanVisualYawFix: Math.PI,
  poseLambda: 9,
  moveLambda: 5.6,
  rotLambda: 8.5,
  strikeTime: 0.12,
  holdTime: 0.05,
  cueLength: 1.78 * WORLD_SCALE,
  visualAimPoint: new THREE.Vector3(0, 0.86 * WORLD_SCALE, -1.6 * WORLD_SCALE),
  bridgeCueLift: 0.018 * WORLD_SCALE,
  bridgeHandBackFromBall: 0.235 * WORLD_SCALE,
  bridgeHandSide: -0.012 * WORLD_SCALE,
  idleGap: 0.16 * WORLD_SCALE,
  contactGap: 0.025 * WORLD_SCALE,
  pullRange: 0.42 * WORLD_SCALE,
  idleRightHandY: 0.8 * WORLD_SCALE,
  idleRightHandX: 0.31 * WORLD_SCALE,
  idleRightHandZ: -0.015 * WORLD_SCALE,
  idleCueGripFromBack: 0.24 * WORLD_SCALE,
  idleCueDir: new THREE.Vector3(0.055, 0.965, -0.13),
  desiredPlayerDistance: 1.25 * WORLD_SCALE
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

function dampScalar(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function dampVector(current, target, lambda, dt) {
  return current.lerp(target, 1 - Math.exp(-lambda * dt));
}

function yawFromForward(forward) {
  return Math.atan2(-forward.x, -forward.z);
}

function cleanName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function makeBasisQuaternion(side, up, forward) {
  BASIS_MAT.makeBasis(side.clone().normalize(), up.clone().normalize(), forward.clone().normalize());
  return new THREE.Quaternion().setFromRotationMatrix(BASIS_MAT);
}

function material(color, roughness = 0.72, metalness = 0.03) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function enableShadow(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;
  });
  return object;
}

function createLoader() {
  const manager = new THREE.LoadingManager();
  const loader = new GLTFLoader(manager);
  loader.setCrossOrigin('anonymous');

  const draco = new DRACOLoader(manager);
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  draco.setDecoderConfig({ type: 'js' });
  draco.preload();

  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);

  return {
    loader,
    dispose: () => draco.dispose()
  };
}

function patchLoadedMaterials(model, renderer) {
  const maxAnisotropy = Math.min(12, renderer.capabilities.getMaxAnisotropy());

  model.traverse((child) => {
    if (!child.isMesh) return;

    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;

    const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    materials.forEach((mat) => {
      mat.side = THREE.DoubleSide;
      mat.depthTest = true;
      mat.depthWrite = !mat.transparent;

      [
        mat.map,
        mat.emissiveMap,
        mat.aoMap,
        mat.normalMap,
        mat.roughnessMap,
        mat.metalnessMap,
        mat.lightMap,
        mat.bumpMap,
        mat.alphaMap
      ].forEach((texture) => {
        if (!texture) return;
        if (texture === mat.map || texture === mat.emissiveMap || texture === mat.lightMap) {
          texture.colorSpace = THREE.SRGBColorSpace;
        }
        texture.flipY = false;
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = maxAnisotropy;
        texture.needsUpdate = true;
      });

      mat.needsUpdate = true;
    });
  });
}

function createCue() {
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 18), material(0xd9b88d, 0.7, 0.03));
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 18), material(0xf8fafc, 0.55, 0.02));
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 18), material(0x2563eb, 0.6, 0.02));

  group.add(enableShadow(shaft), enableShadow(ferrule), enableShadow(tip));
  return { group, shaft, ferrule, tip };
}

function setSegment(mesh, a, b, radius) {
  const dir = b.clone().sub(a);
  const len = Math.max(0.0001, dir.length());
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.scale.set(radius, len, radius);
}

function setCuePose(cue, back, tip) {
  const dir = tip.clone().sub(back).normalize();
  const tipBack = tip.clone().addScaledVector(dir, -0.02 * CFG.scale);
  const ferruleBack = tipBack.clone().addScaledVector(dir, -0.03 * CFG.scale);
  setSegment(cue.shaft, back, ferruleBack, 0.012 * CFG.scale);
  setSegment(cue.ferrule, ferruleBack, tipBack, 0.0105 * CFG.scale);
  setSegment(cue.tip, tipBack, tip, 0.009 * CFG.scale);
}

function cuePoseFromGrip(grip, dir, gripFromBack, length = CFG.cueLength) {
  const n = dir.clone().normalize();
  return {
    back: grip.clone().addScaledVector(n, -gripFromBack),
    tip: grip.clone().addScaledVector(n, length - gripFromBack)
  };
}

function createLine(color, opacity = 0.9) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

function setLinePoints(line, a, b) {
  const pos = line.geometry.getAttribute('position');
  pos.setXYZ(0, a.x, a.y, a.z);
  pos.setXYZ(1, b.x, b.y, b.z);
  pos.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

function findHumanPart(root, aliases) {
  let found = null;
  root.traverse((object) => {
    if (found) return;
    const n = cleanName(object.name);
    if (aliases.some((alias) => n.includes(cleanName(alias)))) found = object;
  });
  return found;
}

function normalizeHuman(model) {
  model.scale.setScalar(CFG.humanScale);
  model.rotation.set(0, CFG.humanVisualYawFix, 0);
  model.position.set(0, 0, 0);
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);
}

function addHuman(scene, renderer, setStatus) {
  const human = {
    root: new THREE.Group(),
    modelRoot: new THREE.Group(),
    model: null,
    activeGlb: false,
    poseT: 0,
    walkT: 0,
    yaw: 0,
    breathT: 0,
    strikeClock: 0,
    rightArm: null,
    rightForeArm: null,
    rightHand: null,
    leftArm: null,
    leftForeArm: null,
    leftHand: null,
    spine: null,
    head: null,
    rest: new Map()
  };

  human.root.visible = false;
  human.modelRoot.visible = false;
  scene.add(human.root, human.modelRoot);

  const { loader, dispose } = createLoader();
  setStatus('Loading ReadyPlayer human…');

  loader.load(
    HUMAN_URL,
    (gltf) => {
      const model = gltf.scene;
      normalizeHuman(model);
      patchLoadedMaterials(model, renderer);

      human.rightArm = findHumanPart(model, ['rightarm', 'rightupperarm']);
      human.rightForeArm = findHumanPart(model, ['rightforearm', 'rightlowerarm']);
      human.rightHand = findHumanPart(model, ['righthand']);
      human.leftArm = findHumanPart(model, ['leftarm', 'leftupperarm']);
      human.leftForeArm = findHumanPart(model, ['leftforearm', 'leftlowerarm']);
      human.leftHand = findHumanPart(model, ['lefthand']);
      human.spine = findHumanPart(model, ['spine', 'chest']);
      human.head = findHumanPart(model, ['head']);

      [
        human.rightArm,
        human.rightForeArm,
        human.rightHand,
        human.leftArm,
        human.leftForeArm,
        human.leftHand,
        human.spine,
        human.head
      ].forEach((part) => {
        if (part) human.rest.set(part, part.quaternion.clone());
      });

      human.model = model;
      human.modelRoot.add(model);
      human.activeGlb = true;
      human.modelRoot.visible = true;
      setStatus('ReadyPlayer human active');
      dispose();
    },
    undefined,
    (error) => {
      console.warn('[PoolRoyale] ReadyPlayer human failed', error);
      setStatus('ReadyPlayer human failed');
      dispose();
    }
  );

  return human;
}

function updateHumanPose(human, dt, state, rootTarget, aimForward, power) {
  if (!human.activeGlb || !human.model) return;

  human.poseT = dampScalar(human.poseT, state === 'idle' ? 0 : 1, CFG.poseLambda, dt);
  human.breathT += dt * (state === 'idle' ? 1.05 : 0.5);
  human.strikeClock = state === 'striking' ? human.strikeClock + dt : 0;

  dampVector(human.root.position, rootTarget, state === 'striking' ? 12 : CFG.moveLambda, dt);
  human.yaw = dampScalar(human.yaw, yawFromForward(aimForward), CFG.rotLambda, dt);

  human.modelRoot.position.copy(human.root.position);
  human.modelRoot.rotation.y = human.yaw;
  human.modelRoot.updateMatrixWorld(true);

  human.rest.forEach((q, part) => part.quaternion.copy(q));

  const t = easeInOut(human.poseT);
  const strokeBack = state === 'dragging' ? easeOutCubic(power) : 0;
  const strikePush = state === 'striking' ? Math.sin(clamp01(human.strikeClock / (CFG.strikeTime + CFG.holdTime)) * Math.PI) : 0;
  const breath = Math.sin(human.breathT * Math.PI * 2) * 0.015;

  if (human.spine) {
    human.spine.rotation.x += -0.22 * t + breath;
    human.spine.rotation.z += 0.035 * t;
  }
  if (human.head) human.head.rotation.x += -0.1 * t;

  if (human.rightArm) {
    human.rightArm.rotation.x += -0.58 * t;
    human.rightArm.rotation.z += -0.42 * t;
  }
  if (human.rightForeArm) {
    human.rightForeArm.rotation.x += (-0.42 - 0.56 * strokeBack + 0.46 * strikePush) * t;
    human.rightForeArm.rotation.y += 0.18 * t;
  }
  if (human.rightHand) {
    human.rightHand.rotation.x += -0.18 * t;
    human.rightHand.rotation.z += -0.18 * t;
  }

  if (human.leftArm) {
    human.leftArm.rotation.x += -0.72 * t;
    human.leftArm.rotation.z += 0.48 * t;
  }
  if (human.leftForeArm) human.leftForeArm.rotation.x += -0.38 * t;

  human.modelRoot.updateMatrixWorld(true);
}

function addReferenceFloor(scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(18 * CFG.scale, 18 * CFG.scale),
    new THREE.MeshStandardMaterial({ color: 0x121820, roughness: 0.9, metalness: 0.02 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  return floor;
}

export default function PoolRoyale() {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const [power, setPower] = useState(0);
  const [shotState, setShotState] = useState('idle');
  const [humanStatus, setHumanStatus] = useState('Preparing ReadyPlayer human…');

  const powerRef = useRef(0);
  const shotPowerRef = useRef(0);
  const shotStateRef = useRef('idle');
  const draggingSliderRef = useRef(false);
  const aimYawRef = useRef(0);

  useEffect(() => { powerRef.current = power; }, [power]);
  useEffect(() => { shotStateRef.current = shotState; }, [shotState]);

  const animatePowerToZero = (from, ms = 220) => {
    const start = performance.now();
    const tick = () => {
      const t = clamp01((performance.now() - start) / ms);
      setPower(lerp(from, 0, easeOutCubic(t)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const setSliderPower = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const p = clamp01((event.clientY - rect.top) / rect.height);
    setPower(p);
    shotPowerRef.current = p;
  };

  const onSliderDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingSliderRef.current = true;
    setShotState('dragging');
    setSliderPower(event);
  };

  const onSliderMove = (event) => {
    if (draggingSliderRef.current) setSliderPower(event);
  };

  const onSliderUp = (event) => {
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    draggingSliderRef.current = false;
    setShotState(shotPowerRef.current > 0.02 ? 'striking' : 'idle');
    animatePowerToZero(powerRef.current, 180);
  };

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setClearColor(0x0b0b0b, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05 * CFG.scale, 80 * CFG.scale);
    camera.position.set(1.85 * CFG.scale, 2.45 * CFG.scale, 7.85 * CFG.scale);
    camera.lookAt(0, 1.05 * CFG.scale, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.86));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 0.55));

    const sun = new THREE.DirectionalLight(0xffffff, 1.35);
    sun.position.set(3.5 * CFG.scale, 7 * CFG.scale, 5 * CFG.scale);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    scene.add(sun);

    const floor = addReferenceFloor(scene);
    const cue = createCue();
    scene.add(cue.group);

    const human = addHuman(scene, renderer, setHumanStatus);
    const cueLine = createLine(0xffd166, 0.95);
    const aimLine = createLine(0xff6b4a, 0.85);
    scene.add(cueLine, aimLine);

    const tmpA = new THREE.Vector3();
    const tmpB = new THREE.Vector3();
    let strikeT = 0;
    let frameId = 0;
    let last = performance.now();
    let isAiming = false;
    let lastAimX = 0;

    const resize = () => {
      const w = Math.max(1, host.clientWidth || window.innerWidth);
      const h = Math.max(1, host.clientHeight || window.innerHeight);
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const onCanvasDown = (event) => {
      if (!draggingSliderRef.current) {
        isAiming = true;
        lastAimX = event.clientX;
      }
    };

    const onCanvasMove = (event) => {
      if (!isAiming || draggingSliderRef.current) return;
      aimYawRef.current -= (event.clientX - lastAimX) * 0.006;
      lastAimX = event.clientX;
    };

    const onCanvasUp = () => {
      isAiming = false;
    };

    canvas.addEventListener('pointerdown', onCanvasDown);
    canvas.addEventListener('pointermove', onCanvasMove);
    canvas.addEventListener('pointerup', onCanvasUp);
    canvas.addEventListener('pointercancel', onCanvasUp);
    window.addEventListener('resize', resize);
    resize();

    function animate() {
      frameId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      const state = shotStateRef.current;
      const activePower = state === 'dragging' ? powerRef.current : shotPowerRef.current;
      const aimForward = tmpA.set(0, 0, -1).applyAxisAngle(Y_AXIS, aimYawRef.current).normalize().clone();
      const aimSide = tmpB.set(aimForward.z, 0, -aimForward.x).normalize().clone();
      const rootTarget = new THREE.Vector3(0, 0, 1.25 * CFG.scale).applyAxisAngle(Y_AXIS, aimYawRef.current);

      const visualAimPoint = CFG.visualAimPoint.clone().applyAxisAngle(Y_AXIS, aimYawRef.current);
      const bridgeCuePoint = visualAimPoint
        .clone()
        .addScaledVector(aimForward, -CFG.bridgeHandBackFromBall)
        .addScaledVector(aimSide, CFG.bridgeHandSide)
        .add(new THREE.Vector3(0, CFG.bridgeCueLift, 0));

      const pull = CFG.pullRange * easeOutCubic(activePower);
      const practiceStroke = state === 'dragging' ? Math.sin(now * 0.012) * 0.035 * CFG.scale * (0.25 + activePower * 0.75) : 0;
      const strikeNorm = clamp01(strikeT / CFG.strikeTime);

      let gap = CFG.idleGap;
      if (state === 'dragging') gap += pull + practiceStroke;
      if (state === 'striking') gap = lerp(CFG.idleGap + pull, CFG.contactGap, easeOutCubic(strikeNorm));

      const cueTipShoot = visualAimPoint.clone().addScaledVector(aimForward, -gap);
      const cueBackShoot = bridgeCuePoint.clone().addScaledVector(aimForward, -(CFG.cueLength - gap)).add(new THREE.Vector3(0, 0.024 * CFG.scale, 0));

      const standingYaw = yawFromForward(aimForward);
      const idleRightHandTarget = rootTarget.clone().add(new THREE.Vector3(CFG.idleRightHandX, CFG.idleRightHandY, CFG.idleRightHandZ).applyAxisAngle(Y_AXIS, standingYaw));
      const idleDir = CFG.idleCueDir.clone().applyAxisAngle(Y_AXIS, standingYaw).normalize();
      const idleCue = cuePoseFromGrip(idleRightHandTarget, idleDir, CFG.idleCueGripFromBack, CFG.cueLength);

      if (state === 'idle') strikeT = 0;
      else if (state === 'dragging') strikeT = 0;
      else {
        strikeT += dt;
        if (strikeT >= CFG.strikeTime + CFG.holdTime) {
          strikeT = 0;
          setShotState('idle');
        }
      }

      const activeCueBack = state === 'idle' ? idleCue.back : cueBackShoot;
      const activeCueTip = state === 'idle' ? idleCue.tip : cueTipShoot;

      setCuePose(cue, activeCueBack, activeCueTip);
      updateHumanPose(human, dt, state, rootTarget, aimForward, activePower);
      setLinePoints(cueLine, activeCueBack, visualAimPoint);
      setLinePoints(aimLine, visualAimPoint, visualAimPoint.clone().add(aimForward.clone().multiplyScalar(2.1 * CFG.scale)));

      renderer.render(scene, camera);
    }

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onCanvasDown);
      canvas.removeEventListener('pointermove', onCanvasMove);
      canvas.removeEventListener('pointerup', onCanvasUp);
      canvas.removeEventListener('pointercancel', onCanvasUp);
      floor.geometry.dispose();
      if (Array.isArray(floor.material)) floor.material.forEach((m) => m.dispose());
      else floor.material.dispose();
      renderer.dispose();
    };
  }, []);

  const sliderH = 320;
  const sliderW = 58;
  const knob = 30;
  const knobTop = clamp(power * sliderH - knob / 2, -2, sliderH - knob + 2);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b0b0b' }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />
      </div>

      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ position: 'absolute', left: 10, top: 10, color: 'white', background: 'rgba(0,0,0,0.62)', padding: '8px 10px', borderRadius: 10, fontSize: 12, lineHeight: 1.35, maxWidth: '76vw' }}>
          Human character logic only<br />Cue stick active<br />Power slider active<br />No table · no balls · no game rules<br />{humanStatus}
        </div>

        <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, pointerEvents: 'auto', touchAction: 'none', userSelect: 'none' }}>
          <div onPointerDown={onSliderDown} onPointerMove={onSliderMove} onPointerUp={onSliderUp} style={{ position: 'relative', height: sliderH, width: sliderW, borderRadius: 18, background: 'rgba(255,255,255,0.92)', boxShadow: '0 12px 28px rgba(0,0,0,0.2)', padding: 9 }}>
            <div style={{ position: 'absolute', left: 14, right: 14, top: 14, bottom: 14, borderRadius: 999, background: 'rgba(0,0,0,0.12)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${power * 100}%`, background: 'rgba(17,17,17,0.58)' }} />
            </div>
            <div style={{ position: 'absolute', left: (sliderW - knob) / 2, top: 14 + knobTop, width: knob, height: knob, borderRadius: 999, background: 'rgba(255,255,255,0.98)', border: '1px solid rgba(0,0,0,0.18)', boxShadow: '0 10px 18px rgba(0,0,0,0.18)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
