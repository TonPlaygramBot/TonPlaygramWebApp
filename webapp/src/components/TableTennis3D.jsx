import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { World, Body, Sphere, Box, Vec3, Material, ContactMaterial } from "cannon-es";

const TABLE = {
  width: 2.74,
  depth: 1.525,
  thickness: 0.04,
  netHeight: 0.1525,
  netWidth: 0.02,
  height: 0.76,
};

const ARENA = {
  floorSize: 10,
  wallHeight: 3,
};

const CAMERA = {
  fov: 55,
  near: 0.1,
  far: 100,
  distance: 3.6,
  minDistance: 2.8,
  maxDistance: 5,
  pitch: 0.35,
  yaw: 0.22,
};

const LIGHTS = {
  key: { color: 0xffffff, intensity: 1.2, position: new THREE.Vector3(-4, 6, 3) },
  fill: { color: 0x8fb8ff, intensity: 0.7, position: new THREE.Vector3(5, 4.5, -2) },
  rim: { color: 0xffc38f, intensity: 0.9, position: new THREE.Vector3(0, 5.5, -6) },
};

const COLORS = {
  table: 0x1e3a8a,
  lines: 0xffffff,
  apron: 0x0f1d46,
  metal: 0x9aa4b2,
  wheel: 0x0c0f18,
  net: 0xffffff,
  arenaFloor: 0x0d101c,
  arenaWall: 0x151c2c,
  paddlePlayer: 0xff4d6d,
  paddleOpponent: 0x4adcb1,
  ball: 0xfff3d0,
};

const GRAVITY = -9.81;

function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.85;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);
  return renderer;
}

function createCamera(container) {
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, container.clientWidth / container.clientHeight, CAMERA.near, CAMERA.far);
  const target = new THREE.Vector3(0, TABLE.height, 0);
  const pos = new THREE.Vector3();
  pos.setFromSphericalCoords(CAMERA.distance, Math.PI / 2 - CAMERA.pitch, CAMERA.yaw);
  camera.position.copy(pos.add(target));
  camera.lookAt(target);
  return camera;
}

function addLights(scene) {
  const key = new THREE.DirectionalLight(LIGHTS.key.color, LIGHTS.key.intensity);
  key.position.copy(LIGHTS.key.position);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  scene.add(key);

  const fill = new THREE.DirectionalLight(LIGHTS.fill.color, LIGHTS.fill.intensity);
  fill.position.copy(LIGHTS.fill.position);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(LIGHTS.rim.color, LIGHTS.rim.intensity);
  rim.position.copy(LIGHTS.rim.position);
  scene.add(rim);

  const ambient = new THREE.HemisphereLight(0xffffff, 0x0a0b12, 0.25);
  scene.add(ambient);
}

function buildArena(scene) {
  const floorGeo = new THREE.PlaneGeometry(ARENA.floorSize, ARENA.floorSize);
  const floorMat = new THREE.MeshStandardMaterial({ color: COLORS.arenaFloor, roughness: 0.9, metalness: 0.05 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: COLORS.arenaWall, roughness: 0.9, metalness: 0.02 });
  const wallGeo = new THREE.BoxGeometry(ARENA.floorSize, ARENA.wallHeight, 0.2);
  const half = ARENA.floorSize / 2;
  const walls = [
    new THREE.Mesh(wallGeo, wallMat),
    new THREE.Mesh(wallGeo, wallMat),
    new THREE.Mesh(wallGeo, wallMat),
    new THREE.Mesh(wallGeo, wallMat),
  ];

  walls[0].position.set(0, ARENA.wallHeight / 2, -half);
  walls[1].position.set(0, ARENA.wallHeight / 2, half);
  walls[1].rotation.y = Math.PI;
  walls[2].position.set(-half, ARENA.wallHeight / 2, 0);
  walls[2].rotation.y = Math.PI / 2;
  walls[3].position.set(half, ARENA.wallHeight / 2, 0);
  walls[3].rotation.y = -Math.PI / 2;
  walls.forEach((w) => scene.add(w));
}

function buildTable(scene) {
  const group = new THREE.Group();
  const topGeo = new THREE.BoxGeometry(TABLE.width, TABLE.thickness, TABLE.depth);
  const topMat = new THREE.MeshStandardMaterial({ color: COLORS.table, roughness: 0.58, metalness: 0.08 });
  const top = new THREE.Mesh(topGeo, topMat);
  top.position.y = TABLE.height;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  const lineMat = new THREE.MeshStandardMaterial({ color: COLORS.lines, roughness: 0.3 });
  const lineGeo = new THREE.BoxGeometry(TABLE.width + 0.002, 0.002, 0.02);
  const centerLine = new THREE.Mesh(lineGeo, lineMat);
  centerLine.position.set(0, TABLE.height + TABLE.thickness / 2 + 0.001, 0);
  group.add(centerLine);

  const sideLineGeo = new THREE.BoxGeometry(TABLE.width + 0.004, 0.002, 0.006);
  const endLineGeo = new THREE.BoxGeometry(0.006, 0.002, TABLE.depth + 0.004);
  const topLine = new THREE.Mesh(sideLineGeo, lineMat);
  const bottomLine = new THREE.Mesh(sideLineGeo, lineMat);
  const leftLine = new THREE.Mesh(endLineGeo, lineMat);
  const rightLine = new THREE.Mesh(endLineGeo, lineMat);
  topLine.position.set(0, TABLE.height + TABLE.thickness / 2 + 0.001, -TABLE.depth / 2 - 0.002);
  bottomLine.position.set(0, TABLE.height + TABLE.thickness / 2 + 0.001, TABLE.depth / 2 + 0.002);
  leftLine.position.set(-TABLE.width / 2 - 0.003, TABLE.height + TABLE.thickness / 2 + 0.001, 0);
  rightLine.position.set(TABLE.width / 2 + 0.003, TABLE.height + TABLE.thickness / 2 + 0.001, 0);
  group.add(topLine, bottomLine, leftLine, rightLine);

  const apronGeo = new THREE.BoxGeometry(TABLE.width + 0.02, 0.05, TABLE.depth + 0.02);
  const apronMat = new THREE.MeshStandardMaterial({ color: COLORS.apron, roughness: 0.7 });
  const apron = new THREE.Mesh(apronGeo, apronMat);
  apron.position.y = TABLE.height - 0.04;
  apron.castShadow = true;
  apron.receiveShadow = true;
  group.add(apron);

  const legMat = new THREE.MeshStandardMaterial({ color: COLORS.metal, roughness: 0.4, metalness: 0.6 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: COLORS.wheel, roughness: 0.8 });
  const legGeo = new THREE.CylinderGeometry(0.03, 0.03, TABLE.height, 12);
  const wheelGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 14);
  const legPositions = [
    [-TABLE.width / 2 + 0.1, TABLE.height / 2, -TABLE.depth / 2 + 0.1],
    [TABLE.width / 2 - 0.1, TABLE.height / 2, -TABLE.depth / 2 + 0.1],
    [-TABLE.width / 2 + 0.1, TABLE.height / 2, TABLE.depth / 2 - 0.1],
    [TABLE.width / 2 - 0.1, TABLE.height / 2, TABLE.depth / 2 - 0.1],
  ];
  legPositions.forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, y, z);
    leg.castShadow = true;
    group.add(leg);
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.05, z + 0.05 * Math.sign(z));
    wheel.castShadow = true;
    group.add(wheel);
  });

  const netGeo = new THREE.BoxGeometry(TABLE.width, TABLE.netHeight, TABLE.netWidth);
  const netMat = new THREE.MeshStandardMaterial({ color: COLORS.net, transparent: true, opacity: 0.85 });
  const net = new THREE.Mesh(netGeo, netMat);
  net.position.set(0, TABLE.height + TABLE.netHeight / 2, 0);
  net.castShadow = true;
  group.add(net);

  scene.add(group);
  return { group, net };
}

function createPaddle(color) {
  const group = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 28), new THREE.MeshStandardMaterial({ color }));
  blade.rotation.x = Math.PI / 2;
  blade.castShadow = true;
  blade.receiveShadow = true;
  group.add(blade);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.08), new THREE.MeshStandardMaterial({ color: 0x2f2f2f }));
  handle.position.set(0, -0.14, 0);
  handle.castShadow = true;
  group.add(handle);
  return group;
}

function createBall() {
  const geo = new THREE.SphereGeometry(0.02, 24, 24);
  const mat = new THREE.MeshStandardMaterial({ color: COLORS.ball, emissive: 0xffddaa, emissiveIntensity: 0.35, roughness: 0.4 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export default function TableTennis3D({ player, ai }) {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0e14);
    const renderer = createRenderer(container);
    const camera = createCamera(container);
    addLights(scene);
    buildArena(scene);
    const table = buildTable(scene);
    const ballMesh = createBall();
    scene.add(ballMesh);
    const playerPaddle = createPaddle(COLORS.paddlePlayer);
    const aiPaddle = createPaddle(COLORS.paddleOpponent);
    scene.add(playerPaddle, aiPaddle);

    const world = new World({ gravity: new Vec3(0, GRAVITY, 0) });

    const tableMat = new Material("table");
    const ballMat = new Material("ball");
    const paddleMat = new Material("paddle");
    const wallMat = new Material("wall");
    world.addContactMaterial(new ContactMaterial(ballMat, tableMat, { restitution: 0.88, friction: 0.28 }));
    world.addContactMaterial(new ContactMaterial(ballMat, paddleMat, { restitution: 1.05, friction: 0.16 }));
    world.addContactMaterial(new ContactMaterial(ballMat, wallMat, { restitution: 0.94, friction: 0.2 }));

    const tableBody = new Body({ mass: 0, shape: new Box(new Vec3(TABLE.width / 2, TABLE.thickness / 2, TABLE.depth / 2)), position: new Vec3(0, TABLE.height, 0), material: tableMat });
    world.addBody(tableBody);

    const netBody = new Body({ mass: 0, shape: new Box(new Vec3(TABLE.width / 2, TABLE.netHeight / 2, TABLE.netWidth / 2)), position: new Vec3(0, TABLE.height + TABLE.netHeight / 2, 0), material: wallMat });
    world.addBody(netBody);

    const wallX = ARENA.floorSize / 2 - 0.5;
    const wallZ = ARENA.floorSize / 2 - 0.5;
    const wallSize = new Vec3(ARENA.floorSize / 2, ARENA.wallHeight / 2, 0.2);
    const sideSize = new Vec3(0.2, ARENA.wallHeight / 2, ARENA.floorSize / 2);
    const walls = [
      new Body({ mass: 0, shape: new Box(wallSize), position: new Vec3(0, ARENA.wallHeight / 2, -wallZ), material: wallMat }),
      new Body({ mass: 0, shape: new Box(wallSize), position: new Vec3(0, ARENA.wallHeight / 2, wallZ), material: wallMat }),
      new Body({ mass: 0, shape: new Box(sideSize), position: new Vec3(-wallX, ARENA.wallHeight / 2, 0), material: wallMat }),
      new Body({ mass: 0, shape: new Box(sideSize), position: new Vec3(wallX, ARENA.wallHeight / 2, 0), material: wallMat }),
    ];
    walls.forEach((w) => world.addBody(w));

    const ballBody = new Body({ mass: 0.0027 * 50, shape: new Sphere(0.02), position: new Vec3(0, TABLE.height + 0.2, TABLE.depth / 2 - 0.2), material: ballMat, linearDamping: 0.01, angularDamping: 0.02 });
    world.addBody(ballBody);

    const paddleShape = new Box(new Vec3(0.14, 0.04, 0.14));
    const playerBody = new Body({ mass: 1.2, shape: paddleShape, position: new Vec3(0, TABLE.height + 0.12, TABLE.depth / 2 - 0.18), material: paddleMat, angularDamping: 0.8 });
    playerBody.type = Body.KINEMATIC;
    world.addBody(playerBody);

    const aiBody = new Body({ mass: 1.2, shape: paddleShape, position: new Vec3(0, TABLE.height + 0.12, -TABLE.depth / 2 + 0.18), material: paddleMat, angularDamping: 0.8 });
    aiBody.type = Body.KINEMATIC;
    world.addBody(aiBody);

    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TABLE.height - 0.08);
    const pointer = new THREE.Vector2();
    const playerTarget = new THREE.Vector3(0, TABLE.height + 0.12, TABLE.depth / 2 - 0.2);
    const aiTarget = new THREE.Vector3(0, TABLE.height + 0.12, -TABLE.depth / 2 + 0.2);

    let dragging = false;
    let lastTouches = [];
    let yaw = CAMERA.yaw;
    let pitch = CAMERA.pitch;
    let distance = CAMERA.distance;

    function updateCamera() {
      const target = new THREE.Vector3(0, TABLE.height, 0);
      const pos = new THREE.Vector3();
      pos.setFromSphericalCoords(distance, Math.PI / 2 - pitch, yaw).add(target);
      camera.position.copy(pos);
      camera.lookAt(target);
    }

    function screenToWorld(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, hit);
      return hit;
    }

    function handlePointerDown(e) {
      dragging = true;
      if (e.touches && e.touches.length > 1) {
        lastTouches = [...e.touches];
      } else {
        const hit = screenToWorld(e.clientX || e.touches?.[0].clientX, e.clientY || e.touches?.[0].clientY);
        playerTarget.set(hit.x, TABLE.height + 0.12, Math.min(TABLE.depth / 2 - 0.12, Math.max(0.08, hit.z)));
      }
    }

    function handlePointerMove(e) {
      if (!dragging) return;
      if (e.touches && e.touches.length === 2) {
        const [a, b] = e.touches;
        if (lastTouches.length === 2) {
          const prevA = lastTouches[0];
          const prevB = lastTouches[1];
          const prevDist = Math.hypot(prevA.clientX - prevB.clientX, prevA.clientY - prevB.clientY);
          const nextDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          const delta = nextDist - prevDist;
          distance = Math.min(CAMERA.maxDistance, Math.max(CAMERA.minDistance, distance - delta * 0.003));
          yaw += (a.clientX - prevA.clientX + b.clientX - prevB.clientX) * 0.0006;
          pitch = Math.min(0.7, Math.max(0.2, pitch + (a.clientY - prevA.clientY + b.clientY - prevB.clientY) * 0.0004));
          updateCamera();
        }
        lastTouches = [...e.touches];
        return;
      }
      const hit = screenToWorld(e.clientX || e.touches?.[0].clientX, e.clientY || e.touches?.[0].clientY);
      playerTarget.set(hit.x, TABLE.height + 0.12, Math.min(TABLE.depth / 2 - 0.12, Math.max(0.08, hit.z)));
    }

    function handlePointerUp() {
      dragging = false;
      lastTouches = [];
    }

    renderer.domElement.addEventListener("pointerdown", handlePointerDown, { passive: true });
    renderer.domElement.addEventListener("pointermove", handlePointerMove, { passive: true });
    renderer.domElement.addEventListener("pointerup", handlePointerUp, { passive: true });
    renderer.domElement.addEventListener("pointerleave", handlePointerUp, { passive: true });
    renderer.domElement.addEventListener("touchstart", handlePointerDown, { passive: true });
    renderer.domElement.addEventListener("touchmove", handlePointerMove, { passive: true });
    renderer.domElement.addEventListener("touchend", handlePointerUp, { passive: true });

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    function launchBall() {
      ballBody.position.set(0, TABLE.height + 0.2, TABLE.depth / 2 - 0.18);
      ballBody.velocity.set(0.6 * (Math.random() - 0.5), 2.6, -4.5);
      ballBody.angularVelocity.set(2 * (Math.random() - 0.5), 3 * (Math.random() - 0.5), 0);
    }

    function steerPaddle(body, target, dt) {
      const current = body.position;
      const nextX = THREE.MathUtils.lerp(current.x, target.x, 10 * dt);
      const nextZ = THREE.MathUtils.lerp(current.z, target.z, 10 * dt);
      body.velocity.x = (nextX - current.x) / dt;
      body.velocity.z = (nextZ - current.z) / dt;
      body.velocity.y = 0;
      body.position.y = TABLE.height + 0.12;
    }

    const clock = new THREE.Clock();

    function animate(time) {
      const delta = clock.getDelta();
      const step = Math.min(1 / 60, delta);
      world.step(1 / 90, step);

      steerPaddle(playerBody, playerTarget, step);

      const anticipate = ballBody.position.z < 0 ? Math.abs(ballBody.position.z) / 4 : 0.05;
      const chaseX = THREE.MathUtils.clamp(ballBody.position.x, -TABLE.width / 2 + 0.16, TABLE.width / 2 - 0.16);
      aiTarget.set(chaseX, TABLE.height + 0.12, -TABLE.depth / 2 + 0.18 + anticipate);
      steerPaddle(aiBody, aiTarget, step * 1.2);

      if (ballBody.position.y < TABLE.height - 0.2 || Math.abs(ballBody.position.z) > 4) {
        launchBall();
      }

      ballMesh.position.copy(ballBody.position);
      playerPaddle.position.copy(playerBody.position);
      aiPaddle.position.copy(aiBody.position);

      playerPaddle.lookAt(ballMesh.position.clone().setY(TABLE.height + 0.12));
      aiPaddle.lookAt(ballMesh.position.clone().setY(TABLE.height + 0.12));

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    launchBall();
    setReady(true);
    requestAnimationFrame(animate);

    return () => {
      renderer.dispose();
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointerleave", handlePointerUp);
      renderer.domElement.removeEventListener("touchstart", handlePointerDown);
      renderer.domElement.removeEventListener("touchmove", handlePointerMove);
      renderer.domElement.removeEventListener("touchend", handlePointerUp);
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[640px] bg-slate-950 overflow-hidden rounded-xl border border-slate-800 shadow-2xl">
      <div ref={containerRef} className="w-full h-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-200 text-sm tracking-wide">
          Loading table tennis arena...
        </div>
      )}
    </div>
  );
}

