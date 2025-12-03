import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { createArenaCarpetMaterial, createArenaWallMaterial } from "../utils/arenaDecor.js";
import { applyRendererSRGB } from "../utils/colorSpace.js";

const THEMES = [
  {
    id: "pro",
    name: "Pro Arena Broadcast",
    renderer: { exposure: 1.85 },
    scene: { background: 0x0b0e14 },
    table: { color: 0x1e3a8a, line: 0xffffff, metal: 0x9aa4b2, wheel: 0x111111 },
    floor: { color: 0x0f1222 },
    carpet: { color: 0xb01224, emissive: 0x2d020a, emissiveIntensity: 0.18, bumpScale: 0.24 },
    walls: { color: 0xeeeeee },
    lights: {
      hemisphere: { sky: 0xffffff, ground: 0x1b2233, intensity: 0.95 },
      key: { color: 0xffffff, intensity: 0.95, position: [-16, 28, 18] },
      fill: { color: 0xffffff, intensity: 0.6, position: [12, 14, -6] },
      rim: { color: 0x99ccff, intensity: 0.35, position: [20, 14, -12] },
      spots: [
        { position: [-8, 6, -8], color: 0xffffff, intensity: 0.7, angle: Math.PI / 5, penumbra: 0.3 },
        { position: [8, 6, -8], color: 0xffffff, intensity: 0.7, angle: Math.PI / 5, penumbra: 0.3 },
        { position: [-8, 6, 8], color: 0xffffff, intensity: 0.7, angle: Math.PI / 5, penumbra: 0.3 },
        { position: [8, 6, 8], color: 0xffffff, intensity: 0.7, angle: Math.PI / 5, penumbra: 0.3 },
      ],
    },
    ball: {
      color: 0xfff1cc,
      emissive: 0xffd7a1,
      emissiveIntensity: 0.55,
    },
    paddles: { player: 0xff4d6d, opponent: 0x49dcb1 },
  },
  {
    id: "neon",
    name: "Neon Synthwave Run",
    renderer: { exposure: 2.1 },
    scene: { background: 0x040018 },
    table: { color: 0x1b1540, line: 0x7fffd4, metal: 0x293460, wheel: 0x070b1a },
    floor: { color: 0x05030d },
    carpet: { color: 0x1a0835, emissive: 0x531575, emissiveIntensity: 0.35, bumpScale: 0.28 },
    walls: { color: 0x1b1d45 },
    lights: {
      hemisphere: { sky: 0x7a9dff, ground: 0x12041f, intensity: 1.05 },
      key: { color: 0xff5fb7, intensity: 0.95, position: [-12, 24, 16] },
      fill: { color: 0x55f7ff, intensity: 0.75, position: [12, 12, -10] },
      rim: { color: 0x4bf9ff, intensity: 0.65, position: [18, 12, -14] },
      spots: [
        { position: [-8, 6.5, -7], color: 0xff63d1, intensity: 0.92, angle: Math.PI / 4.4, penumbra: 0.55 },
        { position: [8, 6.5, -7], color: 0x55f7ff, intensity: 0.92, angle: Math.PI / 4.6, penumbra: 0.55 },
        { position: [-8, 6.5, 7], color: 0xff63d1, intensity: 0.88, angle: Math.PI / 4.3, penumbra: 0.5 },
        { position: [8, 6.5, 7], color: 0x55f7ff, intensity: 0.88, angle: Math.PI / 4.3, penumbra: 0.5 },
      ],
    },
    ball: {
      color: 0xfff8f0,
      emissive: 0xff78f3,
      emissiveIntensity: 0.9,
    },
    paddles: { player: 0xff5c8a, opponent: 0x4df3ff },
  },
];

const TABLE = {
  W: 1.525,
  L: 2.74,
  H: 0.76,
  NET_H: 0.1525,
};

const targetScore = 11;

function buildTable(scene, theme) {
  const group = new THREE.Group();
  const tableMat = new THREE.MeshStandardMaterial({
    color: theme.table.color,
    roughness: 0.6,
    metalness: 0.05,
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(TABLE.W, 0.03, TABLE.L), tableMat);
  top.position.y = TABLE.H;
  top.receiveShadow = true;
  group.add(top);

  const lineMat = new THREE.MeshStandardMaterial({ color: theme.table.line, roughness: 0.3 });
  const borderT = 0.018;
  const lineH = 0.0025;
  const lineY = TABLE.H + lineH / 2;
  const mkLine = (w, d, x, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, lineH, d), lineMat);
    mesh.position.set(x, lineY, z);
    group.add(mesh);
  };
  mkLine(borderT, TABLE.L, -TABLE.W / 2 + borderT / 2, 0);
  mkLine(borderT, TABLE.L, TABLE.W / 2 - borderT / 2, 0);
  mkLine(TABLE.W, borderT, 0, TABLE.L / 2 - borderT / 2);
  mkLine(TABLE.W, borderT, 0, -TABLE.L / 2 + borderT / 2);
  mkLine(borderT, TABLE.L - borderT * 2, 0, 0);

  const steelMat = new THREE.MeshStandardMaterial({ color: theme.table.metal, roughness: 0.45, metalness: 0.6 });
  const legGeo = new THREE.BoxGeometry(0.05, TABLE.H, 0.05);
  const wheelMat = new THREE.MeshStandardMaterial({ color: theme.table.wheel, roughness: 0.8 });
  const wheelGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 24);
  const legPositions = [
    [-TABLE.W / 2 + 0.1, TABLE.H / 2, -TABLE.L / 2 + 0.14],
    [TABLE.W / 2 - 0.1, TABLE.H / 2, -TABLE.L / 2 + 0.14],
    [-TABLE.W / 2 + 0.1, TABLE.H / 2, TABLE.L / 2 - 0.14],
    [TABLE.W / 2 - 0.1, TABLE.H / 2, TABLE.L / 2 - 0.14],
  ];
  legPositions.forEach((p) => {
    const leg = new THREE.Mesh(legGeo, steelMat);
    leg.position.set(p[0], p[1], p[2]);
    leg.castShadow = true;
    leg.receiveShadow = true;
    group.add(leg);
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(p[0], 0.08, p[2]);
    wheel.castShadow = true;
    group.add(wheel);
  });

  const netGroup = new THREE.Group();
  const netMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.88 });
  const netWidth = TABLE.W + 0.05;
  const netPlane = new THREE.Mesh(new THREE.PlaneGeometry(netWidth, TABLE.NET_H), netMat);
  netPlane.position.set(0, TABLE.H + TABLE.NET_H / 2, 0);
  netPlane.rotation.y = Math.PI;
  netGroup.add(netPlane);
  const band = new THREE.Mesh(new THREE.BoxGeometry(netWidth, 0.014, 0.008), lineMat);
  band.position.set(0, TABLE.H + TABLE.NET_H, 0);
  netGroup.add(band);
  const postGeo = new THREE.CylinderGeometry(0.012, 0.012, TABLE.NET_H + 0.08, 16);
  const postRight = new THREE.Mesh(postGeo, steelMat);
  postRight.position.set(TABLE.W / 2 + 0.02, TABLE.H + (TABLE.NET_H + 0.08) / 2, 0);
  const postLeft = postRight.clone();
  postLeft.position.x = -TABLE.W / 2 - 0.02;
  netGroup.add(postRight, postLeft);
  group.add(netGroup);

  scene.add(group);
  return { tableGroup: group, netGroup };
}

function buildPaddle(color) {
  const group = new THREE.Group();
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.095, 0.016, 48),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.08 })
  );
  head.position.y = 0.1;
  head.rotation.x = Math.PI / 2;
  group.add(head);

  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.14, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.6 })
  );
  handle.position.set(0, 0.03, -0.02);
  group.add(handle);
  group.castShadow = true;
  return group;
}

function useScoreState(playerLabel, aiLabel) {
  const [state, setState] = useState({
    p: 0,
    o: 0,
    serving: Math.random() < 0.5 ? "P" : "O",
    message: "Tap to serve",
    winner: null,
    rally: 0,
  });

  const point = useCallback((who) => {
    setState((prev) => {
      const totalPoints = prev.p + prev.o + 1;
      const nextServe = totalPoints % 4 === 1 ? (prev.serving === "P" ? "O" : "P") : prev.serving;
      const next = {
        ...prev,
        p: prev.p + (who === "P" ? 1 : 0),
        o: prev.o + (who === "O" ? 1 : 0),
        serving: nextServe,
        message: `${nextServe === "P" ? playerLabel : aiLabel} to serve`,
        rally: 0,
      };
      const diff = Math.abs(next.p - next.o);
      if ((next.p >= targetScore || next.o >= targetScore) && diff >= 2) {
        next.winner = next.p > next.o ? playerLabel : aiLabel;
        next.message = `${next.winner} wins`;
      }
      return next;
    });
  }, [aiLabel, playerLabel]);

  const reset = useCallback(() => {
    setState({
      p: 0,
      o: 0,
      serving: Math.random() < 0.5 ? "P" : "O",
      message: "Tap to serve",
      winner: null,
      rally: 0,
    });
  }, []);

  return { state, point, reset };
}

export default function TableTennis3D({ player, ai }) {
  const hostRef = useRef(null);
  const rafRef = useRef(0);
  const [themeIndex, setThemeIndex] = useState(0);
  const theme = THEMES[themeIndex] || THEMES[0];
  const playerLabel = player?.name || "You";
  const aiLabel = ai?.name || "AI";
  const { state, point, reset } = useScoreState(playerLabel, aiLabel);
  const [touchHint, setTouchHint] = useState("Drag to move. Flick to hit.");

  const difficulty = useMemo(() => {
    const tag = (ai?.difficulty || ai?.level || "pro").toString().toLowerCase();
    const presets = {
      easy: { react: 0.28, speed: 2.2 },
      medium: { react: 0.22, speed: 2.6 },
      pro: { react: 0.16, speed: 3.1 },
      legend: { react: 0.12, speed: 3.6 },
    };
    return presets[tag] || presets.pro;
  }, [ai?.difficulty, ai?.level]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return () => {};

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme.scene.background);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    applyRendererSRGB(renderer);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = theme.renderer.exposure ?? 1.85;
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.innerHTML = "";
    host.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(55, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(0, 2, 3.5);
    const cameraTarget = new THREE.Vector3(0, TABLE.H * 0.6, TABLE.L * 0.15);

    const hemi = theme.lights.hemisphere;
    const hemiLight = new THREE.HemisphereLight(hemi.sky, hemi.ground, hemi.intensity);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(theme.lights.key.color, theme.lights.key.intensity);
    keyLight.position.set(...theme.lights.key.position);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(theme.lights.fill.color, theme.lights.fill.intensity);
    fillLight.position.set(...theme.lights.fill.position);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(theme.lights.rim.color, theme.lights.rim.intensity);
    rimLight.position.set(...theme.lights.rim.position);
    scene.add(rimLight);

    theme.lights.spots.forEach((s) => {
      const l = new THREE.SpotLight(s.color, s.intensity);
      l.position.set(...s.position);
      l.angle = s.angle;
      l.penumbra = s.penumbra;
      l.castShadow = true;
      scene.add(l);
    });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: theme.floor.color, roughness: 0.95 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const carpetMat = createArenaCarpetMaterial();
    carpetMat.color.setHex(theme.carpet.color);
    carpetMat.emissive.setHex(theme.carpet.emissive);
    carpetMat.emissiveIntensity = theme.carpet.emissiveIntensity;
    carpetMat.bumpScale = theme.carpet.bumpScale;
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), carpetMat);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = 0.01;
    carpet.receiveShadow = true;
    scene.add(carpet);

    const wallMat = createArenaWallMaterial();
    wallMat.color.setHex(theme.walls.color);
    const wallGeoH = new THREE.BoxGeometry(30, 6, 0.2);
    const wallGeoV = new THREE.BoxGeometry(0.2, 6, 30);
    const wallBack = new THREE.Mesh(wallGeoH, wallMat);
    wallBack.position.set(0, 3, -15);
    const wallFront = wallBack.clone();
    wallFront.position.z = 15;
    const wallLeft = new THREE.Mesh(wallGeoV, wallMat);
    wallLeft.position.set(-15, 3, 0);
    const wallRight = wallLeft.clone();
    wallRight.position.x = 15;
    scene.add(wallBack, wallFront, wallLeft, wallRight);

    const { tableGroup } = buildTable(scene, theme);

    const ballMat = new THREE.MeshPhysicalMaterial({
      color: theme.ball.color,
      emissive: theme.ball.emissive,
      emissiveIntensity: theme.ball.emissiveIntensity,
      roughness: 0.5,
      clearcoat: 0.35,
    });
    const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.02, 28, 28), ballMat);
    ballMesh.castShadow = true;
    scene.add(ballMesh);

    const playerPaddle = buildPaddle(theme.paddles.player);
    const aiPaddle = buildPaddle(theme.paddles.opponent);
    playerPaddle.position.set(0, TABLE.H + 0.05, TABLE.L / 2 - 0.18);
    aiPaddle.position.set(0, TABLE.H + 0.05, -TABLE.L / 2 + 0.18);
    scene.add(playerPaddle, aiPaddle);

    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });
    world.broadphase = new CANNON.SAPBroadphase(world);

    const ballMatC = new CANNON.Material("ball");
    const tableMatC = new CANNON.Material("table");
    const paddleMatC = new CANNON.Material("paddle");
    world.addContactMaterial(new CANNON.ContactMaterial(ballMatC, tableMatC, { restitution: 0.88, friction: 0.18 }));
    world.addContactMaterial(new CANNON.ContactMaterial(ballMatC, paddleMatC, { restitution: 1.1, friction: 0.0 }));

    const ground = new CANNON.Body({ type: CANNON.Body.STATIC, material: tableMatC });
    ground.addShape(new CANNON.Plane());
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(ground);

    const tableBox = new CANNON.Body({ type: CANNON.Body.STATIC, material: tableMatC });
    tableBox.addShape(new CANNON.Box(new CANNON.Vec3(TABLE.W / 2, 0.015, TABLE.L / 2)), new CANNON.Vec3(0, TABLE.H, 0));
    world.addBody(tableBox);

    const netBody = new CANNON.Body({ type: CANNON.Body.STATIC, material: tableMatC });
    netBody.addShape(new CANNON.Box(new CANNON.Vec3(TABLE.W / 2 + 0.02, TABLE.NET_H / 2, 0.01)), new CANNON.Vec3(0, TABLE.H + TABLE.NET_H / 2, 0));
    world.addBody(netBody);

    const bounds = new CANNON.Body({ type: CANNON.Body.STATIC, material: tableMatC });
    const margin = 0.25;
    bounds.addShape(new CANNON.Box(new CANNON.Vec3(TABLE.W / 2 + margin, TABLE.H, 0.02)), new CANNON.Vec3(0, TABLE.H, TABLE.L / 2 + 0.02));
    bounds.addShape(new CANNON.Box(new CANNON.Vec3(TABLE.W / 2 + margin, TABLE.H, 0.02)), new CANNON.Vec3(0, TABLE.H, -TABLE.L / 2 - 0.02));
    bounds.addShape(new CANNON.Box(new CANNON.Vec3(0.02, TABLE.H, TABLE.L / 2 + margin)), new CANNON.Vec3(TABLE.W / 2 + 0.02, TABLE.H, 0));
    bounds.addShape(new CANNON.Box(new CANNON.Vec3(0.02, TABLE.H, TABLE.L / 2 + margin)), new CANNON.Vec3(-TABLE.W / 2 - 0.02, TABLE.H, 0));
    world.addBody(bounds);

    const ballBody = new CANNON.Body({
      mass: 0.0027,
      position: new CANNON.Vec3(0, TABLE.H + 0.12, TABLE.L / 4),
      shape: new CANNON.Sphere(0.02),
      material: ballMatC,
      linearDamping: 0.01,
      angularDamping: 0.01,
    });
    world.addBody(ballBody);

    const paddleShape = new CANNON.Cylinder(0.09, 0.09, 0.02, 16);
    const playerBody = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: paddleMatC });
    playerBody.addShape(paddleShape);
    playerBody.position.set(0, TABLE.H + 0.08, TABLE.L / 2 - 0.12);
    world.addBody(playerBody);

    const aiBody = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: paddleMatC });
    aiBody.addShape(paddleShape);
    aiBody.position.set(0, TABLE.H + 0.08, -TABLE.L / 2 + 0.12);
    world.addBody(aiBody);

    let lastHit = null;
    let serving = state.serving;
    let awaitingServe = true;
    let serveTimer = 0;
    let swipeStart = { x: 0, y: 0, t: 0 };
    let pointerId = null;
    let pinchStart = null;
    const paddleTarget = new THREE.Vector3(playerBody.position.x, playerBody.position.y, playerBody.position.z);

    const aiTarget = new THREE.Vector3(aiBody.position.x, aiBody.position.y, aiBody.position.z);
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TABLE.H);

    const serveBall = () => {
      awaitingServe = true;
      serveTimer = 0;
      ballBody.velocity.setZero();
      ballBody.angularVelocity.setZero();
      const side = serving === "P" ? 1 : -1;
      ballBody.position.set(side === 1 ? 0 : 0, TABLE.H + 0.12, side === 1 ? TABLE.L / 2 - 0.18 : -TABLE.L / 2 + 0.18);
      lastHit = null;
    };

    serveBall();

    const getHitDirection = (delta, towardsOpponent) => {
      const dir = new CANNON.Vec3(delta.x, Math.abs(delta.y) + 0.6, towardsOpponent ? -1.9 : 1.6);
      return dir;
    };

    const clampPaddle = (pos, isPlayer) => {
      const maxX = TABLE.W / 2 - 0.08;
      const maxZ = TABLE.L / 2 - 0.08;
      pos.x = THREE.MathUtils.clamp(pos.x, -maxX, maxX);
      pos.z = THREE.MathUtils.clamp(pos.z, isPlayer ? 0 : -maxZ, isPlayer ? maxZ : 0);
      pos.y = TABLE.H + 0.08;
    };

    const addImpulseFromSwipe = (body, paddlePos, towardsOpponent, swipeVec, hitter) => {
      const dir = getHitDirection(swipeVec, towardsOpponent);
      const impulse = dir.scale(0.12);
      body.applyImpulse(impulse, paddlePos);
      body.angularVelocity.set(swipeVec.y * 6, swipeVec.x * 3, towardsOpponent ? -20 : 20);
      awaitingServe = false;
      lastHit = hitter || null;
      setTouchHint("Rally on!");
    };

    const onPointerDown = (ev) => {
      if (pointerId !== null) return;
      pointerId = ev.pointerId;
      swipeStart = { x: ev.clientX, y: ev.clientY, t: performance.now() };
    };

    const onPointerMove = (ev) => {
      if (ev.pointerId !== pointerId) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const target = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, target);
      paddleTarget.copy(target);
      clampPaddle(paddleTarget, true);
    };

    const onPointerUp = (ev) => {
      if (ev.pointerId !== pointerId) return;
      const dt = Math.max(0.05, (performance.now() - swipeStart.t) / 1000);
      const swipeVec = new CANNON.Vec3((ev.clientX - swipeStart.x) / rectSize(renderer), (swipeStart.y - ev.clientY) / rectSize(renderer), 0);
      if (dt < 0.4) {
        addImpulseFromSwipe(ballBody, playerBody.position, true, swipeVec, "P");
      }
      pointerId = null;
    };

    const rectSize = (r) => Math.max(r.domElement.clientWidth, r.domElement.clientHeight);

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);

    renderer.domElement.addEventListener("touchstart", (ev) => {
      if (ev.touches.length === 2) {
        pinchStart = {
          dist: Math.hypot(
            ev.touches[0].clientX - ev.touches[1].clientX,
            ev.touches[0].clientY - ev.touches[1].clientY
          ),
          yaw: Math.atan2(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY),
          camPos: camera.position.clone(),
        };
      }
    }, { passive: true });

    renderer.domElement.addEventListener("touchmove", (ev) => {
      if (pinchStart && ev.touches.length === 2) {
        const dist = Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY);
        const yaw = Math.atan2(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY);
        const zoomDelta = THREE.MathUtils.clamp((pinchStart.dist - dist) * 0.005, -1.2, 1.2);
        const yawDelta = yaw - pinchStart.yaw;
        const radius = camera.position.distanceTo(cameraTarget) + zoomDelta;
        const angle = Math.atan2(pinchStart.camPos.z - cameraTarget.z, pinchStart.camPos.x - cameraTarget.x) + yawDelta;
        const height = THREE.MathUtils.clamp(camera.position.y + zoomDelta * 0.4, 1.2, 3.2);
        camera.position.set(
          cameraTarget.x + Math.cos(angle) * radius,
          height,
          cameraTarget.z + Math.sin(angle) * radius
        );
        camera.lookAt(cameraTarget);
      }
    }, { passive: true });

    renderer.domElement.addEventListener("touchend", () => { pinchStart = null; }, { passive: true });

    const stepAI = (dt) => {
      const targetZ = -TABLE.L / 2 + 0.2;
      let aimX = ballBody.position.x;
      if (ballBody.velocity.z > 0 || awaitingServe) {
        aimX = 0;
      }
      aiTarget.set(aimX, TABLE.H + 0.08, targetZ);
      clampPaddle(aiTarget, false);
      aiBody.position.x = THREE.MathUtils.damp(aiBody.position.x, aiTarget.x, difficulty.react / dt, dt);
      aiBody.position.z = THREE.MathUtils.damp(aiBody.position.z, aiTarget.z, difficulty.react / dt, dt);
      aiPaddle.position.copy(aiBody.position);
      if (!awaitingServe && ballBody.position.z < 0 && Math.abs(ballBody.position.z - aiBody.position.z) < 0.2) {
        const swipeVec = new CANNON.Vec3((ballBody.position.x - aiBody.position.x) * 8, 0.2, 0);
        addImpulseFromSwipe(ballBody, aiBody.position, false, swipeVec.scale(difficulty.speed), "O");
      }
    };

    const stepServe = (dt) => {
      if (!awaitingServe) return;
      serveTimer += dt;
      const side = serving === "P" ? 1 : -1;
      const wobble = Math.sin(serveTimer * 5) * 0.01;
      ballBody.position.set(side === 1 ? playerBody.position.x + wobble : aiBody.position.x + wobble, TABLE.H + 0.12, side === 1 ? TABLE.L / 2 - 0.18 : -TABLE.L / 2 + 0.18);
      ballBody.velocity.setZero();
      ballBody.angularVelocity.setZero();
      if (side === -1 && serveTimer > 0.6) {
        const swipeVec = new CANNON.Vec3((Math.random() - 0.5) * 0.6, 0.8, 0);
        addImpulseFromSwipe(ballBody, aiBody.position, true, swipeVec, "O");
      }
    };

    const checkScore = () => {
      if (ballBody.position.y < 0 || Math.abs(ballBody.position.z) > TABLE.L / 2 + 0.3 || Math.abs(ballBody.position.x) > TABLE.W / 2 + 0.3) {
        const scorer = lastHit === "P" ? "P" : "O";
        point(scorer);
        serving = scorer === "P" ? "P" : "O";
        serveBall();
        return true;
      }
      return false;
    };

    const fixedDt = 1 / 120;
    let accum = 0;
    let lastTime = performance.now();

    const loop = () => {
      const now = performance.now();
      const frameDt = Math.min(0.03, (now - lastTime) / 1000);
      lastTime = now;
      accum += frameDt;

      while (accum >= fixedDt) {
        stepServe(fixedDt);
        stepAI(fixedDt);
        clampPaddle(paddleTarget, true);
        playerBody.position.copy(paddleTarget);
        playerPaddle.position.copy(paddleTarget);
        world.step(fixedDt);
        accum -= fixedDt;
      }

      ballMesh.position.copy(ballBody.position);
      if (checkScore()) {
        lastTime = performance.now();
      }
      camera.lookAt(cameraTarget);
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(loop);
    };

    loop();

    const onResize = () => {
      renderer.setSize(host.clientWidth, host.clientHeight);
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.dispose();
    };
  }, [theme, aiLabel, playerLabel, point, state.serving]);

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between p-3 text-xs font-semibold uppercase tracking-wide">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-red-600" />
          <div>
            <div className="text-[11px] text-gray-300">{playerLabel}</div>
            <div className="text-base">{state.p}</div>
          </div>
        </div>
        <div className="text-center">
          <div className="text-[11px] text-gray-400">First to {targetScore}</div>
          <div className="text-sm text-gray-200">{state.message}</div>
        </div>
        <div className="flex items-center gap-2">
          <div>
            <div className="text-[11px] text-gray-300 text-right">{aiLabel}</div>
            <div className="text-base text-right">{state.o}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500" />
        </div>
      </div>
      <div ref={hostRef} className="flex-1 w-full" />
      <div className="flex items-center justify-between p-3 text-[11px] bg-[#0b0e14] border-t border-white/10">
        <div className="flex gap-2">
          {THEMES.map((t, idx) => (
            <button
              key={t.id}
              onClick={() => setThemeIndex(idx)}
              className={`px-3 py-2 rounded-md border ${idx === themeIndex ? "border-white bg-white/10" : "border-white/20 bg-white/5"}`}
            >
              {t.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded-md border border-white/30 bg-white/10"
            onClick={() => reset()}
          >
            Reset
          </button>
          <span className="text-gray-300">{touchHint}</span>
        </div>
      </div>
    </div>
  );
}
