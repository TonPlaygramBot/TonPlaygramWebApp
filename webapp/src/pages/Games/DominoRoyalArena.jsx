import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';

const ARENA_RADIUS = 6;
const DOMINO_SIZE = new THREE.Vector3(0.32, 0.68, 0.1);
const WALL_HEIGHT = 1.4;
const DOMINO_COUNT = 28;
const GRAVITY = -9.81;

const toneColor = (hex, intensity = 1) => {
  const color = new THREE.Color(hex);
  color.multiplyScalar(intensity);
  return color;
};

const createDominoMaterial = (() => {
  const palette = ['#f6e8d5', '#fbe0d9', '#dbeafe', '#dcfce7', '#fee2e2'];
  let index = 0;
  return () => {
    const color = new THREE.Color(palette[index % palette.length]);
    index += 1;
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.42,
      metalness: 0.05
    });
  };
})();

function createDomino({ angle, radius, heightOffset }) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(DOMINO_SIZE.x, DOMINO_SIZE.y, DOMINO_SIZE.z),
    createDominoMaterial()
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const body = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(
      Math.cos(angle) * radius,
      DOMINO_SIZE.y / 2 + heightOffset,
      Math.sin(angle) * radius
    ),
    shape: new CANNON.Box(new CANNON.Vec3(DOMINO_SIZE.x / 2, DOMINO_SIZE.y / 2, DOMINO_SIZE.z / 2)),
    sleepSpeedLimit: 0.2,
    sleepTimeLimit: 0.8,
    material: new CANNON.Material('domino')
  });

  const tilt = (Math.random() - 0.5) * 0.08;
  body.quaternion.setFromEuler(0, angle + Math.PI / 2, tilt);
  mesh.rotation.set(0, angle + Math.PI / 2, tilt);

  return { mesh, body };
}

function createWall({ width, height, depth, position }) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color: '#0b1529',
    roughness: 0.38,
    metalness: 0.08
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.position.copy(position);

  const body = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(position.x, position.y, position.z),
    shape: new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)),
    material: new CANNON.Material('wall')
  });

  return { mesh, body };
}

function DominoRoyalArena() {
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  const hazardSpeedRef = useRef(1.3);
  const pulseReadyRef = useRef(true);
  const [aliveCount, setAliveCount] = useState(DOMINO_COUNT);
  const [pulseReady, setPulseReady] = useState(true);

  const rimColor = useMemo(() => new THREE.Color('#0f172a'), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030712');

    const camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );
    camera.position.set(10, 7, 10);
    camera.lookAt(0, 0.5, 0);

    const keyLight = new THREE.DirectionalLight(toneColor('#fef3c7', 1.1), 1.25);
    keyLight.position.set(6, 10, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 40;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(toneColor('#a5d8ff', 0.7), 0.9);
    fillLight.position.set(-6, 5, -4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(toneColor('#7dd3fc', 1.5), 0.9);
    rimLight.position.set(0, 6, -8);
    scene.add(rimLight);

    scene.add(new THREE.AmbientLight('#cbd5e1', 0.12));

    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0) });
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.defaultContactMaterial.friction = 0.38;
    world.defaultContactMaterial.restitution = 0.12;

    const groundMaterial = new CANNON.Material('ground');
    const dominoMaterial = new CANNON.Material('domino');
    const wallMaterial = new CANNON.Material('wall');
    world.addContactMaterial(
      new CANNON.ContactMaterial(groundMaterial, dominoMaterial, {
        friction: 0.36,
        restitution: 0.06
      })
    );
    world.addContactMaterial(
      new CANNON.ContactMaterial(dominoMaterial, dominoMaterial, {
        friction: 0.32,
        restitution: 0.04
      })
    );
    world.addContactMaterial(
      new CANNON.ContactMaterial(wallMaterial, dominoMaterial, {
        friction: 0.45,
        restitution: 0.05
      })
    );

    const groundGeo = new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS, 0.2, 48);
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#0c172a',
      roughness: 0.55,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    ground.castShadow = false;
    ground.position.set(0, -0.1, 0);
    scene.add(ground);

    const floorBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Cylinder(ARENA_RADIUS, ARENA_RADIUS, 0.2, 24),
      material: groundMaterial
    });
    floorBody.position.set(0, -0.1, 0);
    world.addBody(floorBody);

    const wallThickness = 0.4;
    const wallSegments = 18;
    for (let i = 0; i < wallSegments; i += 1) {
      const theta = (i / wallSegments) * Math.PI * 2;
      const x = Math.cos(theta) * ARENA_RADIUS;
      const z = Math.sin(theta) * ARENA_RADIUS;
      const segment = createWall({
        width: wallThickness,
        height: WALL_HEIGHT,
        depth: (Math.PI * 2 * ARENA_RADIUS) / wallSegments,
        position: new THREE.Vector3(x, WALL_HEIGHT / 2 - 0.1, z)
      });
      segment.mesh.rotation.y = theta + Math.PI / 2;
      segment.body.quaternion.setFromEuler(0, theta + Math.PI / 2, 0);
      scene.add(segment.mesh);
      world.addBody(segment.body);
    }

    const hazardArmLength = ARENA_RADIUS * 1.12;
    const hazardThickness = 0.25;
    const spinnerGeometry = new THREE.BoxGeometry(hazardArmLength, hazardThickness, hazardThickness);
    const spinnerMaterial = new THREE.MeshStandardMaterial({
      color: '#22d3ee',
      emissive: '#0ea5e9',
      emissiveIntensity: 0.4,
      metalness: 0.35,
      roughness: 0.22
    });
    const spinnerMesh = new THREE.Mesh(spinnerGeometry, spinnerMaterial);
    spinnerMesh.castShadow = true;
    spinnerMesh.receiveShadow = true;
    spinnerMesh.position.y = DOMINO_SIZE.y * 0.5;
    scene.add(spinnerMesh);

    const spinnerBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      shape: new CANNON.Box(
        new CANNON.Vec3(hazardArmLength / 2, hazardThickness / 2, hazardThickness / 2)
      ),
      position: new CANNON.Vec3(0, DOMINO_SIZE.y * 0.5, 0),
      material: new CANNON.Material('hazard')
    });
    world.addBody(spinnerBody);

    const rimGeo = new THREE.TorusGeometry(ARENA_RADIUS - 0.25, 0.06, 12, 96);
    const rimMat = new THREE.MeshStandardMaterial({
      color: rimColor,
      emissive: '#0f172a',
      roughness: 0.32,
      metalness: 0.2
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.receiveShadow = true;
    rim.position.y = -0.02;
    scene.add(rim);

    const dominoes = [];
    for (let i = 0; i < DOMINO_COUNT; i += 1) {
      const angle = (i / DOMINO_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.06;
      const radius = ARENA_RADIUS * 0.65 + (Math.random() - 0.5) * 0.5;
      const domino = createDomino({ angle, radius, heightOffset: Math.random() * 0.05 });
      domino.mesh.userData.body = domino.body;
      scene.add(domino.mesh);
      world.addBody(domino.body);
      dominoes.push(domino);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI * 0.5;
    controls.minDistance = 5;
    controls.maxDistance = 16;
    controls.target.set(0, 0.6, 0);

    let lastTime;
    let hazardAngle = 0;
    const eliminated = new Set();

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    };
    window.addEventListener('resize', resize);

    const stepWorld = (time) => {
      const delta = lastTime ? Math.min(0.033, (time - lastTime) / 1000) : 0;
      lastTime = time;

      world.step(1 / 60, delta, 3);
      hazardAngle += delta * hazardSpeedRef.current;
      spinnerBody.quaternion.setFromEuler(0, hazardAngle, 0);
      spinnerMesh.quaternion.copy(spinnerBody.quaternion);

      dominoes.forEach(({ body, mesh }, index) => {
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
        if (body.position.y < -2 && !eliminated.has(index)) {
          eliminated.add(index);
          setAliveCount(DOMINO_COUNT - eliminated.size);
        }
      });

      controls.update();
      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(stepWorld);
    };

    animationRef.current = requestAnimationFrame(stepWorld);

    const pulseTimer = setInterval(() => {
      if (!pulseReadyRef.current) return;
      const picks = dominoes.filter((_, i) => !eliminated.has(i));
      if (!picks.length) return;
      const pick = picks[Math.floor(Math.random() * picks.length)];
      const blast = new CANNON.Vec3(
        (Math.random() - 0.5) * 18,
        10 + Math.random() * 6,
        (Math.random() - 0.5) * 18
      );
      pick.body.applyImpulse(blast, pick.body.position);
    }, 3200);

    return () => {
      clearInterval(pulseTimer);
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
      controls.dispose();
      scene.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose?.();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose?.());
          } else {
            child.material?.dispose?.();
          }
        }
      });
      world.bodies.forEach((body) => world.removeBody(body));
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [rimColor]);

  const triggerPulse = useCallback(() => {
    if (!pulseReadyRef.current) return;
    pulseReadyRef.current = false;
    setPulseReady(false);
    hazardSpeedRef.current = 3.3;
    setTimeout(() => {
      hazardSpeedRef.current = 1.3;
    }, 1400);
    setTimeout(() => {
      pulseReadyRef.current = true;
      setPulseReady(true);
    }, 2600);
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 flex-wrap items-center justify-center gap-3 text-xs font-semibold uppercase tracking-widest text-slate-100">
        <div className="rounded-full bg-slate-900/70 px-3 py-2 shadow-lg shadow-cyan-500/20 backdrop-blur">
          Alive Tiles: {aliveCount}
        </div>
        <div className="rounded-full bg-cyan-500/80 px-3 py-2 text-slate-900 shadow-lg shadow-cyan-500/40 backdrop-blur">
          Gravity: {Math.abs(GRAVITY).toFixed(2)} m/s²
        </div>
      </div>
      <button
        type="button"
        onClick={triggerPulse}
        className="absolute right-4 bottom-4 z-20 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 px-4 py-3 text-xs font-black uppercase tracking-wide text-amber-950 shadow-[0_12px_30px_rgba(251,191,36,0.45)] transition-transform active:scale-95"
        disabled={!pulseReady}
      >
        {pulseReady ? 'Shockwave Boost' : 'Recharging...'}
      </button>
    </div>
  );
}

export default DominoRoyalArena;
