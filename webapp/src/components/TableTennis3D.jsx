import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';
import { createArenaCarpetMaterial, createArenaWallMaterial } from '../utils/arenaDecor.js';
import { applyRendererSRGB, applySRGBColorSpace } from '../utils/colorSpace.js';

const TABLE_SIZE = { length: 2.74, width: 1.525, height: 0.76 };
const BALL_RADIUS = 0.02;
const PADDLE_RADIUS = 0.12;
const NET_HEIGHT = 0.16;

function buildTableTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 12);
  ctx.lineTo(canvas.width / 2, canvas.height - 12);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  applySRGBColorSpace(tex);
  return tex;
}

function createPaddleMesh(color) {
  const group = new THREE.Group();
  const faceGeom = new THREE.CylinderGeometry(PADDLE_RADIUS, PADDLE_RADIUS, 0.02, 48);
  const faceMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.08 });
  const face = new THREE.Mesh(faceGeom, faceMat);
  face.rotation.x = Math.PI / 2;
  group.add(face);

  const handleGeom = new THREE.BoxGeometry(0.05, 0.14, 0.18);
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x3b2f2f, roughness: 0.8 });
  const handle = new THREE.Mesh(handleGeom, handleMat);
  handle.position.set(0, -0.1, -0.04);
  group.add(handle);
  return group;
}

function addThreePointLighting(scene) {
  const key = new THREE.DirectionalLight(0xffffff, 1.25);
  key.position.set(4.5, 6.5, 4.2);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xb8c7ff, 0.8);
  fill.position.set(-5.5, 4, -3.5);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0x7fc8ff, 0.7);
  rim.position.set(0, 5.4, -6.2);
  scene.add(rim);

  const hemi = new THREE.HemisphereLight(0xdde8ff, 0x0b0d14, 0.55);
  scene.add(hemi);
}

export default function TableTennis3D({ player, ai }) {
  const hostRef = useRef(null);
  const frameRef = useRef(0);
  const [status, setStatus] = useState('Shërbim i ri');
  const [score, setScore] = useState({ player: 0, opponent: 0 });
  const [server, setServer] = useState(Math.random() < 0.5 ? 'P' : 'O');
  const [gameOver, setGameOver] = useState(false);
  const initialServerRef = useRef(server);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    setGameOver(false);
    initialServerRef.current = server;
    const container = hostRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0e14);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.85;
    applyRendererSRGB(renderer);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      40
    );
    camera.position.set(0.2, 2.15, 4.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.target.set(0, TABLE_SIZE.height, 0);
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minDistance = 2.8;
    controls.maxDistance = 4.5;
    controls.zoomSpeed = 0.6;

    addThreePointLighting(scene);

    const floorMat = createArenaCarpetMaterial();
    floorMat.color.set(0xb01224);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const wallMat = createArenaWallMaterial();
    const wallBack = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), wallMat);
    wallBack.position.set(0, 1.5, -4);
    scene.add(wallBack);
    const wallFront = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), wallMat);
    wallFront.position.set(0, 1.5, 4);
    wallFront.rotation.y = Math.PI;
    scene.add(wallFront);

    const tableGroup = new THREE.Group();
    const tableTexture = buildTableTexture();
    const tableMaterial = new THREE.MeshStandardMaterial({
      map: tableTexture,
      roughness: 0.64,
      metalness: 0.05,
    });
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE_SIZE.width, 0.05, TABLE_SIZE.length),
      tableMaterial
    );
    table.position.y = TABLE_SIZE.height;
    table.castShadow = false;
    table.receiveShadow = true;
    tableGroup.add(table);

    const netMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      transparent: true,
      opacity: 0.86,
    });
    const net = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE_SIZE.width, NET_HEIGHT, 0.01),
      netMaterial
    );
    net.position.set(0, TABLE_SIZE.height + NET_HEIGHT / 2, 0);
    tableGroup.add(net);

    const postMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, roughness: 0.5 });
    const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, NET_HEIGHT + 0.1, 16), postMat);
    leftPost.position.set(-TABLE_SIZE.width / 2, TABLE_SIZE.height + (NET_HEIGHT + 0.1) / 2, 0);
    tableGroup.add(leftPost);
    const rightPost = leftPost.clone();
    rightPost.position.x = TABLE_SIZE.width / 2;
    tableGroup.add(rightPost);

    scene.add(tableGroup);

    const playerPaddle = createPaddleMesh(0xff4d6d);
    const aiPaddle = createPaddleMesh(0x49dcb1);
    scene.add(playerPaddle);
    scene.add(aiPaddle);

    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 32, 32),
      new THREE.MeshStandardMaterial({
        color: 0xfff1cc,
        emissive: 0xffd7a1,
        emissiveIntensity: 0.45,
        roughness: 0.5,
      })
    );
    scene.add(ballMesh);

    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.allowSleep = true;

    const ballMat = new CANNON.Material('ball');
    const tableMat = new CANNON.Material('table');
    const paddleMat = new CANNON.Material('paddle');
    const netMat = new CANNON.Material('net');

    world.addContactMaterial(new CANNON.ContactMaterial(ballMat, tableMat, {
      restitution: 0.9,
      friction: 0.12,
      contactEquationRelaxation: 3,
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(ballMat, paddleMat, {
      restitution: 1.05,
      friction: 0.08,
      contactEquationRelaxation: 4,
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(ballMat, netMat, {
      restitution: 0.2,
      friction: 0.28,
    }));

    const tableBody = new CANNON.Body({ mass: 0, material: tableMat });
    tableBody.addShape(new CANNON.Box(new CANNON.Vec3(TABLE_SIZE.width / 2, 0.025, TABLE_SIZE.length / 2)));
    tableBody.position.set(0, TABLE_SIZE.height, 0);
    world.addBody(tableBody);

    const netBody = new CANNON.Body({ mass: 0, material: netMat });
    netBody.addShape(new CANNON.Box(new CANNON.Vec3(TABLE_SIZE.width / 2, NET_HEIGHT / 2, 0.005)));
    netBody.position.set(0, TABLE_SIZE.height + NET_HEIGHT / 2, 0);
    world.addBody(netBody);

    const ballBody = new CANNON.Body({
      mass: 0.0027,
      shape: new CANNON.Sphere(BALL_RADIUS),
      material: ballMat,
      linearDamping: 0.01,
      angularDamping: 0.01,
      position: new CANNON.Vec3(0, TABLE_SIZE.height + 0.1, TABLE_SIZE.length * 0.2),
    });
    world.addBody(ballBody);

    const playerBody = new CANNON.Body({ mass: 0, material: paddleMat, type: CANNON.Body.KINEMATIC });
    playerBody.addShape(new CANNON.Cylinder(PADDLE_RADIUS, PADDLE_RADIUS, 0.02, 16));
    playerBody.position.set(0, TABLE_SIZE.height + 0.05, TABLE_SIZE.length / 2 - 0.3);
    world.addBody(playerBody);

    const aiBody = new CANNON.Body({ mass: 0, material: paddleMat, type: CANNON.Body.KINEMATIC });
    aiBody.addShape(new CANNON.Cylinder(PADDLE_RADIUS, PADDLE_RADIUS, 0.02, 16));
    aiBody.position.set(0, TABLE_SIZE.height + 0.05, -TABLE_SIZE.length / 2 + 0.3);
    world.addBody(aiBody);

    const paddleTargets = {
      player: new THREE.Vector3(playerBody.position.x, playerBody.position.y, playerBody.position.z),
      ai: new THREE.Vector3(aiBody.position.x, aiBody.position.y, aiBody.position.z),
    };

    const paddleVelocity = {
      player: new THREE.Vector3(),
      ai: new THREE.Vector3(),
    };
    const previousPaddle = {
      player: playerBody.position.clone(),
      ai: aiBody.position.clone(),
    };

    let lastPlayerHit = 0;
    let lastAiHit = 0;
    let lastTouch = initialServerRef.current;
    let waitingServe = true;
    let localGameOver = false;
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TABLE_SIZE.height);
    let paddleDrag = false;
    let pointerCount = 0;

    const serveBall = (by) => {
      waitingServe = false;
      lastTouch = by;
      ballBody.velocity.set(0, 0, 0);
      ballBody.angularVelocity.set(0, 0, 0);
      const side = by === 'P' ? 1 : -1;
      ballBody.position.set(
        0,
        TABLE_SIZE.height + 0.12,
        (TABLE_SIZE.length / 2 - 0.35) * side
      );
      const lateral = (Math.random() - 0.5) * 1.2;
      ballBody.velocity.set(lateral, 2.4, -side * 5.2);
      setStatus(`${by === 'P' ? (player?.name || 'Player') : (ai?.name || 'AI')} shërben`);
    };

    const requestServe = (by) => {
      waitingServe = true;
      setStatus('Shërbim i ri');
      ballBody.velocity.set(0, 0, 0);
      ballBody.angularVelocity.set(0, 0, 0);
      ballBody.position.set(0, TABLE_SIZE.height + 0.2, (TABLE_SIZE.length / 2 - 0.35) * (by === 'P' ? 1 : -1));
      setTimeout(() => {
        if (!localGameOver) serveBall(by);
      }, 650);
    };

    requestServe(server);

    const mapToTable = (clientX, clientY) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hitPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(tablePlane, hitPoint);
      const clampedX = THREE.MathUtils.clamp(hitPoint.x, -TABLE_SIZE.width / 2 + 0.1, TABLE_SIZE.width / 2 - 0.1);
      const minZ = 0.1;
      const maxZ = TABLE_SIZE.length / 2 - 0.12;
      const clampedZ = THREE.MathUtils.clamp(hitPoint.z, minZ, maxZ);
      return new THREE.Vector3(clampedX, TABLE_SIZE.height + 0.05, clampedZ);
    };

    const onPointerDown = (e) => {
      pointerCount += 1;
      if (pointerCount > 1) {
        paddleDrag = false;
        controls.enableRotate = true;
        controls.enableZoom = true;
        return;
      }
      paddleDrag = true;
      controls.enableRotate = false;
      controls.enableZoom = false;
      const point = mapToTable(e.clientX, e.clientY);
      paddleTargets.player.copy(point);
    };

    const onPointerMove = (e) => {
      if (!paddleDrag) return;
      const point = mapToTable(e.clientX, e.clientY);
      paddleTargets.player.lerp(point, 0.4);
    };

    const onPointerUp = () => {
      pointerCount = Math.max(0, pointerCount - 1);
      paddleDrag = false;
      controls.enableRotate = true;
      controls.enableZoom = true;
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const resolvePoint = (winner) => {
      if (localGameOver) return;
      setScore((prev) => {
        const next = { ...prev };
        if (winner === 'P') next.player += 1; else next.opponent += 1;
        const totalPoints = next.player + next.opponent;
        const serverSwap = Math.floor(totalPoints / 2) % 2 === 0
          ? initialServerRef.current
          : initialServerRef.current === 'P'
            ? 'O'
            : 'P';
        setServer(serverSwap);
        if ((next.player >= 11 || next.opponent >= 11) && Math.abs(next.player - next.opponent) >= 2) {
          localGameOver = true;
          setGameOver(true);
          setStatus(winner === 'P' ? 'Fitore!' : 'Humbi ndeshjen');
        } else {
          lastTouch = serverSwap;
          requestServe(serverSwap);
        }
        return next;
      });
    };

    const clock = new THREE.Clock();

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.02);
      const dt = Math.max(delta, 0.001);
      world.step(1 / 120, delta, 3);

      const prevPlayer = previousPaddle.player.clone();
      const prevAi = previousPaddle.ai.clone();

      playerBody.position.x = THREE.MathUtils.lerp(playerBody.position.x, paddleTargets.player.x, 0.35);
      playerBody.position.y = paddleTargets.player.y;
      playerBody.position.z = THREE.MathUtils.lerp(playerBody.position.z, paddleTargets.player.z, 0.35);

      const aiFollow = ballBody.position.z < 0 ? ballBody.position.x : 0;
      paddleTargets.ai.set(
        THREE.MathUtils.clamp(aiFollow, -TABLE_SIZE.width / 2 + 0.1, TABLE_SIZE.width / 2 - 0.1),
        TABLE_SIZE.height + 0.05,
        -TABLE_SIZE.length / 2 + 0.22
      );
      aiBody.position.x = THREE.MathUtils.lerp(aiBody.position.x, paddleTargets.ai.x, 0.12);
      aiBody.position.y = paddleTargets.ai.y;
      aiBody.position.z = THREE.MathUtils.lerp(aiBody.position.z, paddleTargets.ai.z, 0.18);

      paddleVelocity.player.copy(playerBody.position).sub(prevPlayer).divideScalar(dt);
      paddleVelocity.ai.copy(aiBody.position).sub(prevAi).divideScalar(dt);
      previousPaddle.player.copy(playerBody.position);
      previousPaddle.ai.copy(aiBody.position);

      playerPaddle.position.copy(playerBody.position);
      aiPaddle.position.copy(aiBody.position);
      ballMesh.position.copy(ballBody.position);

      controls.target.lerp(ballMesh.position.clone().setY(TABLE_SIZE.height), 0.08);
      controls.update();

      renderer.render(scene, camera);

      const applyHit = (body, isPlayer) => {
        const now = performance.now();
        if (isPlayer && now - lastPlayerHit < 250) return;
        if (!isPlayer && now - lastAiHit < 250) return;
        const dirZ = isPlayer ? -1 : 1;
        const toBall = new THREE.Vector3(
          ballBody.position.x - body.position.x,
          ballBody.position.y - body.position.y,
          ballBody.position.z - body.position.z
        );
        const distance = toBall.length();
        if (distance > PADDLE_RADIUS + BALL_RADIUS + 0.02) return;
        const speedBoost = isPlayer ? 6.2 : 5.8;
        const lateral = THREE.MathUtils.clamp(toBall.x * 4, -3.4, 3.4);
        const lift = THREE.MathUtils.clamp(2 + paddleVelocity[isPlayer ? 'player' : 'ai'].y * 15, 1.2, 4.6);
        ballBody.velocity.set(lateral, lift, dirZ * speedBoost);
        ballBody.angularVelocity.set(
          -dirZ * 25,
          lateral * 6,
          (Math.random() - 0.5) * 12
        );
        lastTouch = isPlayer ? 'P' : 'O';
        if (isPlayer) lastPlayerHit = now; else lastAiHit = now;
      };

      applyHit(playerBody, true);
      applyHit(aiBody, false);

      if (!waitingServe && ballBody.position.y < 0.2) {
        resolvePoint(lastTouch === 'P' ? 'O' : 'P');
      }
      if (
        !waitingServe &&
        (Math.abs(ballBody.position.x) > TABLE_SIZE.width || Math.abs(ballBody.position.z) > TABLE_SIZE.length)
      ) {
        resolvePoint(lastTouch === 'P' ? 'O' : 'P');
      }
    };

    animate();

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.dispose();
      floorMat.dispose?.();
      tableTexture.dispose();
    };
  }, [player, ai]);

  return (
    <div className="relative w-full min-h-screen bg-black overflow-hidden">
      <div ref={hostRef} className="w-full h-[100dvh]" />
      <div className="pointer-events-none absolute top-4 left-4 right-4 flex items-center justify-between text-white drop-shadow-lg">
        <div className="flex items-center gap-3 bg-black/50 px-3 py-2 rounded-xl">
          {player?.avatar && <span className="text-xl">{player.avatar}</span>}
          <div>
            <p className="text-xs uppercase opacity-70">Ti</p>
            <p className="text-lg font-semibold">{player?.name || 'Player'}</p>
          </div>
          <span className="text-2xl font-bold ml-3">{score.player}</span>
        </div>
        <div className="flex items-center gap-3 bg-black/50 px-3 py-2 rounded-xl">
          <span className="text-2xl font-bold mr-3">{score.opponent}</span>
          <div className="text-right">
            <p className="text-xs uppercase opacity-70">AI</p>
            <p className="text-lg font-semibold">{ai?.name || 'AI'}</p>
          </div>
          {ai?.avatar && <span className="text-xl">{ai.avatar}</span>}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-6 inset-x-0 flex justify-center">
        <div className="bg-black/60 text-white px-4 py-2 rounded-full text-sm font-semibold">{gameOver ? 'Ndeshja përfundoi' : status}</div>
      </div>
    </div>
  );
}
