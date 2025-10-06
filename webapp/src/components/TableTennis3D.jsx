import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const SNOOKER_TABLE_LENGTH = 3.569; // meters (12 ft table)
const SNOOKER_TABLE_WIDTH = 1.778;
const BASE_PING_PONG_LENGTH = 2.74;
const BASE_PING_PONG_WIDTH = 1.525;
const BASE_PING_PONG_HEIGHT = 0.76;
const BASE_TOP_THICKNESS = 0.03;
const BASE_BALL_RADIUS = 0.02;

// Uniform scale that preserves the original paddle/ball proportions while
// matching the snooker table footprint.
const LENGTH_SCALE = SNOOKER_TABLE_LENGTH / BASE_PING_PONG_LENGTH;
const WIDTH_SCALE = SNOOKER_TABLE_WIDTH / BASE_PING_PONG_WIDTH;
const UNIFORM_SCALE = (LENGTH_SCALE + WIDTH_SCALE) / 2;

const TABLE_DIMENSIONS = {
  length: SNOOKER_TABLE_LENGTH,
  width: SNOOKER_TABLE_WIDTH,
  height: BASE_PING_PONG_HEIGHT * UNIFORM_SCALE,
  topThickness: BASE_TOP_THICKNESS * UNIFORM_SCALE,
  ballRadius: BASE_BALL_RADIUS * UNIFORM_SCALE,
  netHeight: 0.1525 * UNIFORM_SCALE,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function TableTennis3D({ player, ai }) {
  const mountRef = useRef(null);
  const [scores, setScores] = useState({ player: 0, ai: 0 });
  const [message, setMessage] = useState("Tap and drag to play");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(3, window.devicePixelRatio || 1));

    const resizeRenderer = () => {
      const { clientWidth, clientHeight } = mount;
      renderer.setSize(clientWidth, clientHeight, false);
    };
    resizeRenderer();
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050b18);

    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / mount.clientHeight,
      0.05,
      200
    );
    const standingOffset = new THREE.Vector3(5.4, 2.9, 6.6);
    const standingLookTarget = new THREE.Vector3(0, TABLE_DIMENSIONS.height + 0.2, 0);
    camera.position.copy(standingOffset);
    camera.lookAt(standingLookTarget);

    const hemi = new THREE.HemisphereLight(0xf5f5ff, 0x0a0f20, 1.05);
    scene.add(hemi);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    keyLight.position.set(-6, 8, 6);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x8fb7ff, 0.4);
    rimLight.position.set(5, 4, -4);
    scene.add(rimLight);

    const overheadPositions = [
      [-2.5, 6.6, -3.2],
      [2.5, 6.6, -3.2],
      [-2.5, 6.6, 3.2],
      [2.5, 6.6, 3.2],
    ];
    overheadPositions.forEach(([x, y, z]) => {
      const spot = new THREE.SpotLight(0xffffff, 0.55, 20, Math.PI / 5, 0.35);
      spot.position.set(x, y, z);
      spot.target.position.set(0, TABLE_DIMENSIONS.height, 0);
      scene.add(spot);
      scene.add(spot.target);
    });

    const arena = new THREE.Group();
    scene.add(arena);

    const disposeArenaAssets = buildArena(arena, renderer);

    const { playerPaddle, aiPaddle, ball, disposeTableAssets } = buildTable(scene);

    const paddleY = TABLE_DIMENSIONS.height + TABLE_DIMENSIONS.topThickness + 0.02 * UNIFORM_SCALE;
    playerPaddle.position.set(0, paddleY, TABLE_DIMENSIONS.width * 0.33);
    aiPaddle.position.set(0, paddleY, -TABLE_DIMENSIONS.width * 0.33);

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -paddleY);
    let ctrlMode = "none";
    const targetPos = playerPaddle.position.clone();
    const prevPos = playerPaddle.position.clone();
    const playerVelocity = new THREE.Vector3();

    const ballState = {
      served: false,
      serveDir: 1,
    };

    const clock = new THREE.Clock();
    let disposed = false;

    const resizeObserver = new ResizeObserver(() => {
      resizeRenderer();
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(mount);

    const worldFromEvent = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const out = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, out);
      return out;
    };

    const onPointerDown = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const lowerHalf = event.clientY - rect.top > rect.height * 0.35;
      if (lowerHalf) {
        ctrlMode = "paddle";
        const world = worldFromEvent(event);
        clampTarget(world);
        targetPos.copy(world);
        serveIfNeeded();
      } else {
        ctrlMode = "none";
      }
    };

    const onPointerMove = (event) => {
      if (ctrlMode !== "paddle") return;
      const world = worldFromEvent(event);
      clampTarget(world);
      targetPos.copy(world);
    };

    const onPointerUp = () => {
      ctrlMode = "none";
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    const clampTarget = (vector) => {
      const marginX = 0.1 * UNIFORM_SCALE;
      const marginZ = 0.12 * UNIFORM_SCALE;
      vector.x = clamp(vector.x, -TABLE_DIMENSIONS.length / 2 + marginX, TABLE_DIMENSIONS.length / 2 - marginX);
      vector.y = paddleY;
      vector.z = clamp(vector.z, marginZ, TABLE_DIMENSIONS.width / 2 - marginZ);
    };

    const enemyTarget = new THREE.Vector3();
    const aiVelocity = new THREE.Vector3();
    const prevAiPos = aiPaddle.position.clone();

    const resetBall = (direction) => {
      ball.position.set(0, TABLE_DIMENSIONS.height + 0.18 * UNIFORM_SCALE, direction > 0 ? TABLE_DIMENSIONS.width * 0.18 : -TABLE_DIMENSIONS.width * 0.18);
      ball.userData.vel = new THREE.Vector3(0, 0, direction > 0 ? -1.2 : 1.2).multiplyScalar(UNIFORM_SCALE);
      if (!ballState.served) {
        ball.userData.vel.set(0, 0, 0);
      }
    };

    const handlePoint = (side) => {
      if (disposed) return;
      setScores((prev) => {
        const next = { ...prev };
        next[side] += 1;
        return next;
      });
      ballState.served = false;
      ballState.serveDir = side === "player" ? -1 : 1;
      setMessage(side === "player" ? "You scored! Tap to serve." : "AI scored. Tap to return serve.");
    };

    const paddleHit = (paddle, paddleVel, boost) => {
      const center = paddle.position;
      const offset = new THREE.Vector3().subVectors(ball.position, center);
      const effectiveRadius = 0.1 * UNIFORM_SCALE;
      const distance = offset.length();
      if (distance < effectiveRadius + TABLE_DIMENSIONS.ballRadius) {
        offset.normalize();
        const velocity = ball.userData.vel || new THREE.Vector3();
        const vn = offset.clone().multiplyScalar(velocity.dot(offset));
        const vt = velocity.clone().sub(vn);
        velocity.copy(vt.add(offset.clone().multiplyScalar(-vn.length())));
        velocity.addScaledVector(paddleVel, 0.25 * boost);
        velocity.y = Math.max(velocity.y, 1.2 * boost);
        if (center.z > 0) {
          velocity.z = -Math.abs(velocity.z);
        }
        ball.position.copy(center).add(offset.multiplyScalar(effectiveRadius + TABLE_DIMENSIONS.ballRadius + 0.002 * UNIFORM_SCALE));
        ball.userData.vel = velocity;
      }
    };

    const stepBall = (dt) => {
      if (!ballState.served) {
        return;
      }
      const velocity = ball.userData.vel || new THREE.Vector3();
      velocity.y += -9.81 * dt;

      ball.position.addScaledVector(velocity, dt);

      const yTop = TABLE_DIMENSIONS.height + TABLE_DIMENSIONS.topThickness + TABLE_DIMENSIONS.ballRadius;
      if (ball.position.y < yTop && velocity.y < 0) {
        ball.position.y = yTop;
        velocity.y *= -0.78;
        velocity.x *= 0.985;
        velocity.z *= 0.985;
      }

      const xBound = TABLE_DIMENSIONS.length / 2 - 0.035 * UNIFORM_SCALE;
      const zBound = TABLE_DIMENSIONS.width / 2 - 0.035 * UNIFORM_SCALE;
      if (Math.abs(ball.position.x) > xBound) {
        ball.position.x = clamp(ball.position.x, -xBound, xBound);
        velocity.x *= -0.78;
      }
      if (Math.abs(ball.position.z) > zBound) {
        ball.position.z = clamp(ball.position.z, -zBound, zBound);
        velocity.z *= -0.78;
      }

      const netHalfThickness = 0.004 * UNIFORM_SCALE;
      if (Math.abs(ball.position.x) < netHalfThickness && ball.position.y <= TABLE_DIMENSIONS.height + TABLE_DIMENSIONS.netHeight && Math.abs(ball.position.z) <= TABLE_DIMENSIONS.width / 2) {
        velocity.x = -velocity.x * 0.7;
        ball.position.x = velocity.x > 0 ? netHalfThickness : -netHalfThickness;
      }

      paddleHit(playerPaddle, playerVelocity, 1.15);
      paddleHit(aiPaddle, aiVelocity, 0.95);

      if (ball.position.y < -0.25) {
        const playerSide = ball.position.z < 0;
        handlePoint(playerSide ? "player" : "ai");
        resetBall(ballState.serveDir);
      }

      ball.userData.vel = velocity;
    };

    const serveIfNeeded = () => {
      if (!ballState.served) {
        ballState.served = true;
        resetBall(ballState.serveDir);
        if (!disposed) {
          setMessage("");
        }
      }
    };

    resetBall(ballState.serveDir);

    const animationLoop = () => {
      const dt = Math.min(0.033, clock.getDelta());

      prevPos.copy(playerPaddle.position);
      playerPaddle.position.lerp(targetPos, 0.22);
      playerVelocity.copy(playerPaddle.position).sub(prevPos).multiplyScalar(1 / Math.max(dt, 1e-5));

      const followX = clamp(
        ball.position.x,
        -TABLE_DIMENSIONS.length / 2 + 0.12 * UNIFORM_SCALE,
        TABLE_DIMENSIONS.length / 2 - 0.12 * UNIFORM_SCALE
      );
      const baseZ = -TABLE_DIMENSIONS.width * 0.33;
      enemyTarget.set(followX, paddleY, baseZ + clamp((ball.position.z + TABLE_DIMENSIONS.width * 0.33) * 0.45, -0.18, 0.18));
      prevAiPos.copy(aiPaddle.position);
      aiPaddle.position.lerp(enemyTarget, 0.055);
      aiVelocity.copy(aiPaddle.position).sub(prevAiPos).multiplyScalar(1 / Math.max(dt, 1e-5));

      stepBall(dt);

      renderer.render(scene, camera);
    };

    renderer.setAnimationLoop(animationLoop);

    const cleanup = () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose?.();
          const mat = obj.material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => m?.dispose?.());
          } else {
            mat?.dispose?.();
          }
        }
        if (obj.isLight && obj.shadow?.map) {
          obj.shadow.map.dispose();
        }
      });
      disposeTableAssets();
      disposeArenaAssets();
    };

    return cleanup;
  }, []);

  return (
    <div ref={mountRef} style={{ position: "fixed", inset: 0, background: "#050b18", touchAction: "none" }}>
      <div
        style={{
          position: "absolute",
          top: "env(safe-area-inset-top, 16px)",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: "24px",
          fontFamily: "'Inter', sans-serif",
          color: "#e5ecff",
          textShadow: "0 2px 6px rgba(0,0,0,0.55)",
          pointerEvents: "none",
        }}
      >
        <ScoreColumn label={player?.name ?? "You"} score={scores.player} align="flex-end" />
        <div style={{ fontSize: "0.8rem", alignSelf: "center", opacity: 0.7 }}>{message}</div>
        <ScoreColumn label={ai?.name ?? "AI"} score={scores.ai} align="flex-start" />
      </div>
    </div>
  );
}

function ScoreColumn({ label, score, align }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align }}>
      <span style={{ fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: "1.75rem", fontWeight: 600 }}>{score}</span>
    </div>
  );
}

function buildArena(group, renderer) {
  const stageMat = new THREE.MeshStandardMaterial({ color: 0x0f1c34, roughness: 0.9 });
  const stage = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 14), stageMat);
  stage.position.set(0, -0.25, 0);
  group.add(stage);

  const carpetCanvas = document.createElement("canvas");
  carpetCanvas.width = carpetCanvas.height = 256;
  const carpetCtx = carpetCanvas.getContext("2d");
  carpetCtx.fillStyle = "#14264c";
  carpetCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i += 1) {
    carpetCtx.fillStyle = `rgba(${80 + Math.random() * 40}, ${110 + Math.random() * 40}, 180, ${0.2 + Math.random() * 0.4})`;
    carpetCtx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  const carpetTex = new THREE.CanvasTexture(carpetCanvas);
  carpetTex.wrapS = carpetTex.wrapT = THREE.RepeatWrapping;
  carpetTex.repeat.set(6, 8);

  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(8.4, 13.2),
    new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 0.95 })
  );
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.y = 0.001;
  group.add(carpet);

  const railMat = new THREE.MeshStandardMaterial({ color: 0x101521, roughness: 0.75, metalness: 0.3 });
  const railPositions = [
    [0, 0.45, -6.6, 8.2, 0.9, 0.15],
    [0, 0.45, 6.6, 8.2, 0.9, 0.15],
    [-4.1, 0.45, 0, 0.15, 0.9, 12.8],
    [4.1, 0.45, 0, 0.15, 0.9, 12.8],
  ];
  railPositions.forEach(([x, y, z, w, h, d]) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), railMat);
    rail.position.set(x, y, z);
    group.add(rail);
  });

  const stepMat = new THREE.MeshStandardMaterial({ color: 0x151b2a, roughness: 0.85 });
  for (let i = 0; i < 3; i += 1) {
    const depth = 14 + i * 1.2;
    const width = 9 + i * 1.2;
    const step = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, depth), stepMat);
    step.position.set(0, -0.34 - i * 0.18, 0);
    group.add(step);
  }

  const seatMat = new THREE.MeshStandardMaterial({ color: 0x192134, roughness: 0.6 });
  for (let row = 0; row < 4; row += 1) {
    for (let col = -6; col <= 6; col += 2) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.45), seatMat);
      seat.position.set(col * 0.55, -0.05 + row * 0.45, -5.5 + row * 1.6);
      group.add(seat);
      const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.08), seatMat);
      seatBack.position.set(col * 0.55, 0.2 + row * 0.45, -5.7 + row * 1.6);
      group.add(seatBack);
    }
  }

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0c1324, roughness: 0.9 });
  const wallGeo = new THREE.PlaneGeometry(18, 6);
  const backWall = new THREE.Mesh(wallGeo, wallMat);
  backWall.position.set(0, 2.8, -8.5);
  group.add(backWall);
  const frontWall = new THREE.Mesh(wallGeo, wallMat);
  frontWall.rotation.y = Math.PI;
  frontWall.position.set(0, 2.8, 8.5);
  group.add(frontWall);
  const leftWall = new THREE.Mesh(wallGeo, wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-9, 2.8, 0);
  group.add(leftWall);
  const rightWall = new THREE.Mesh(wallGeo, wallMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(9, 2.8, 0);
  group.add(rightWall);

  const panelMat = new THREE.MeshStandardMaterial({ color: 0x1a2c4c, roughness: 0.65 });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.4, 0.1), panelMat);
  panel.position.set(0, 3.5, -8.4);
  group.add(panel);

  const logoCanvas = document.createElement("canvas");
  logoCanvas.width = 512;
  logoCanvas.height = 160;
  const logoCtx = logoCanvas.getContext("2d");
  logoCtx.fillStyle = "rgba(0,0,0,0)";
  logoCtx.fillRect(0, 0, 512, 160);
  logoCtx.fillStyle = "#1b84ff";
  logoCtx.font = "bold 72px 'Arial'";
  logoCtx.textAlign = "center";
  logoCtx.fillText("TONPLAY", 256, 110);
  const logoTex = new THREE.CanvasTexture(logoCanvas);
  logoTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 1.7),
    new THREE.MeshBasicMaterial({ map: logoTex, transparent: true })
  );
  logo.position.set(0, 3.4, -8.39);
  group.add(logo);

  const lightStripMat = new THREE.MeshStandardMaterial({ color: 0x23385e, emissive: 0x11203c, emissiveIntensity: 1.4, roughness: 0.3 });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(7, 0.12, 0.2), lightStripMat);
  strip.position.set(0, 5.8, 0);
  group.add(strip);

  return () => {
    carpetTex.dispose();
    logoTex.dispose();
  };
}

function buildTable(scene) {
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.6 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, roughness: 0.45, metalness: 0.6 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5e3b, roughness: 0.85 });
  const redRubber = new THREE.MeshStandardMaterial({ color: 0xb00020, roughness: 0.55 });
  const blackRubber = new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.55 });
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xfff1cc, roughness: 0.6 });

  const tableGroup = new THREE.Group();
  scene.add(tableGroup);

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(TABLE_DIMENSIONS.length, TABLE_DIMENSIONS.topThickness, TABLE_DIMENSIONS.width),
    blueMat
  );
  top.position.set(0, TABLE_DIMENSIONS.height + TABLE_DIMENSIONS.topThickness / 2, 0);
  tableGroup.add(top);

  const borderThickness = 0.02 * UNIFORM_SCALE;
  const lineHeight = 0.002 * UNIFORM_SCALE;
  const yLine = top.position.y + TABLE_DIMENSIONS.topThickness / 2 + lineHeight / 2;

  const bLong = new THREE.Mesh(
    new THREE.BoxGeometry(TABLE_DIMENSIONS.length, lineHeight, borderThickness),
    whiteMat
  );
  const bLong2 = bLong.clone();
  bLong.position.set(0, yLine, TABLE_DIMENSIONS.width / 2 - borderThickness / 2);
  bLong2.position.set(0, yLine, -TABLE_DIMENSIONS.width / 2 + borderThickness / 2);

  const bShort = new THREE.Mesh(
    new THREE.BoxGeometry(borderThickness, lineHeight, TABLE_DIMENSIONS.width),
    whiteMat
  );
  const bShort2 = bShort.clone();
  bShort.position.set(TABLE_DIMENSIONS.length / 2 - borderThickness / 2, yLine, 0);
  bShort2.position.set(-TABLE_DIMENSIONS.length / 2 + borderThickness / 2, yLine, 0);

  const center = new THREE.Mesh(
    new THREE.BoxGeometry(TABLE_DIMENSIONS.length - 2 * borderThickness, lineHeight * 1.1, 0.003 * UNIFORM_SCALE),
    whiteMat
  );
  center.position.set(0, yLine, 0);

  tableGroup.add(bLong, bLong2, bShort, bShort2, center);

  const netAlpha = makeHexNetAlpha(512, 256, 9);
  const netWeave = makeWeaveTex(256, 256);
  const netMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    alphaMap: netAlpha,
    map: netWeave,
    roughness: 0.92,
    side: THREE.DoubleSide,
  });
  const netWidth = TABLE_DIMENSIONS.width + 0.1 * UNIFORM_SCALE;
  const net = new THREE.Mesh(new THREE.PlaneGeometry(netWidth, TABLE_DIMENSIONS.netHeight), netMat);
  net.position.set(0, TABLE_DIMENSIONS.height + TABLE_DIMENSIONS.netHeight / 2, 0);
  net.rotateY(Math.PI / 2);
  tableGroup.add(net);

  const bandThickness = 0.014 * UNIFORM_SCALE;
  const bandTop = new THREE.Mesh(new THREE.BoxGeometry(netWidth, bandThickness, 0.002 * UNIFORM_SCALE), whiteMat);
  const bandBottom = bandTop.clone();
  bandTop.position.set(0, TABLE_DIMENSIONS.height + TABLE_DIMENSIONS.netHeight - bandThickness / 2, 0);
  bandBottom.position.set(0, TABLE_DIMENSIONS.height + bandThickness / 2, 0);
  bandTop.rotateY(Math.PI / 2);
  bandBottom.rotateY(Math.PI / 2);
  tableGroup.add(bandTop, bandBottom);

  const postRadius = 0.012 * UNIFORM_SCALE;
  const postHeight = TABLE_DIMENSIONS.netHeight + 0.08 * UNIFORM_SCALE;
  const postGeo = new THREE.CylinderGeometry(postRadius, postRadius, postHeight, 28);
  const postNear = new THREE.Mesh(postGeo, steelMat);
  const postFar = postNear.clone();
  postNear.position.set(0, TABLE_DIMENSIONS.height + postHeight / 2, TABLE_DIMENSIONS.width / 2 + postRadius * 0.6);
  postFar.position.set(0, TABLE_DIMENSIONS.height + postHeight / 2, -TABLE_DIMENSIONS.width / 2 - postRadius * 0.6);
  tableGroup.add(postNear, postFar);

  const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.05 * UNIFORM_SCALE, 0.025 * UNIFORM_SCALE, 0.06 * UNIFORM_SCALE), steelMat);
  const clamp2 = clamp.clone();
  clamp.position.set(0, TABLE_DIMENSIONS.height + 0.03 * UNIFORM_SCALE, TABLE_DIMENSIONS.width / 2 + 0.03 * UNIFORM_SCALE);
  clamp2.position.set(0, TABLE_DIMENSIONS.height + 0.03 * UNIFORM_SCALE, -TABLE_DIMENSIONS.width / 2 - 0.03 * UNIFORM_SCALE);
  tableGroup.add(clamp, clamp2);

  addTableLegs(tableGroup, steelMat, wheelMat);

  const makePaddle = (redUp = true) => {
    const group = new THREE.Group();
    const blade = makeBladeGeometry(0.148 * UNIFORM_SCALE, 0.158 * UNIFORM_SCALE, 0.013 * UNIFORM_SCALE, 0.065 * UNIFORM_SCALE, 72);
    const front = new THREE.Mesh(blade, redUp ? redRubber : blackRubber);
    const back = new THREE.Mesh(blade, redUp ? blackRubber : redRubber);
    front.position.y = 0.0065 * UNIFORM_SCALE;
    back.position.y = -0.0065 * UNIFORM_SCALE;
    group.add(front, back);

    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.004 * UNIFORM_SCALE, 0.055 * UNIFORM_SCALE),
      new THREE.Vector3(0, -0.02 * UNIFORM_SCALE, 0.09 * UNIFORM_SCALE),
      new THREE.Vector3(0, -0.04 * UNIFORM_SCALE, 0.12 * UNIFORM_SCALE),
    ]);
    const neck = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 26, 0.012 * UNIFORM_SCALE, 18, false), woodMat);
    group.add(neck);

    const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * UNIFORM_SCALE, 0.022 * UNIFORM_SCALE, 0.06 * UNIFORM_SCALE, 28), woodMat);
    const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * UNIFORM_SCALE, 0.018 * UNIFORM_SCALE, 0.05 * UNIFORM_SCALE, 28), woodMat);
    seg1.position.set(0, -0.07 * UNIFORM_SCALE, 0.14 * UNIFORM_SCALE);
    seg2.position.set(0, -0.115 * UNIFORM_SCALE, 0.14 * UNIFORM_SCALE);
    group.add(seg1, seg2);
    return group;
  };

  const playerPaddle = makePaddle(true);
  const aiPaddle = makePaddle(false);
  scene.add(playerPaddle, aiPaddle);

  const ball = new THREE.Mesh(new THREE.SphereGeometry(TABLE_DIMENSIONS.ballRadius, 42, 32), ballMat);
  scene.add(ball);

  const disposeTableAssets = () => {
    netAlpha?.dispose?.();
    netWeave?.dispose?.();
  };

  return { tableGroup, playerPaddle, aiPaddle, ball, disposeTableAssets };
}

function addTableLegs(tableGroup, steelMat, wheelMat) {
  const legHeight = TABLE_DIMENSIONS.height - 0.02 * UNIFORM_SCALE;
  const spanX = TABLE_DIMENSIONS.length * 0.38;
  const spanZ = TABLE_DIMENSIONS.width * 0.42;
  const tubeRadius = 0.02 * UNIFORM_SCALE;
  const wheelRadius = 0.035 * UNIFORM_SCALE;

  const createULeg = (xSign) => {
    const group = new THREE.Group();
    const upright1 = new THREE.Mesh(new THREE.CylinderGeometry(tubeRadius, tubeRadius, legHeight, 26), steelMat);
    const upright2 = upright1.clone();
    const cross = new THREE.Mesh(new THREE.CylinderGeometry(tubeRadius, tubeRadius, spanZ * 2, 26), steelMat);
    upright1.position.set(xSign * spanX, legHeight / 2, spanZ);
    upright2.position.set(xSign * spanX, legHeight / 2, -spanZ);
    cross.rotation.x = Math.PI / 2;
    cross.position.set(xSign * spanX, 0.12 * UNIFORM_SCALE, 0);
    group.add(upright1, upright2, cross);

    const wheelGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.02 * UNIFORM_SCALE, 24);
    const wheel1 = new THREE.Mesh(wheelGeom, wheelMat);
    const wheel2 = new THREE.Mesh(wheelGeom, wheelMat);
    wheel1.rotation.z = Math.PI / 2;
    wheel2.rotation.z = Math.PI / 2;
    wheel1.position.set(xSign * spanX, 0.01 * UNIFORM_SCALE, spanZ);
    wheel2.position.set(xSign * spanX, 0.01 * UNIFORM_SCALE, -spanZ);
    group.add(wheel1, wheel2);
    return group;
  };

  tableGroup.add(createULeg(-1), createULeg(1));
}

function makeBladeGeometry(width, height, thickness, radius, segments) {
  const shape = new THREE.Shape();
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  shape.moveTo(-halfWidth + radius, -halfHeight);
  shape.lineTo(halfWidth - radius, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + radius);
  shape.lineTo(halfWidth, halfHeight - radius);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - radius, halfHeight);
  shape.lineTo(-halfWidth + radius, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - radius);
  shape.lineTo(-halfWidth, -halfHeight + radius);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + radius, -halfHeight);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: segments,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, -thickness / 2);
  return geometry;
}

function makeHexNetAlpha(width, height, hexRadius) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  const dx = hexRadius * 1.732;
  const dy = hexRadius * 1.5;
  for (let y = 0; y < height + dy; y += dy) {
    for (let x = 0; x < width + dx; x += dx) {
      const ox = Math.floor(y / dy) % 2 ? dx / 2 : 0;
      drawHex(x + ox, y, hexRadius);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 2);
  texture.anisotropy = 8;
  return texture;

  function drawHex(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.lineWidth = 2.0;
    ctx.stroke();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
}

function makeWeaveTex(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f7f7f7";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
  for (let y = 0; y < height; y += 2) ctx.fillRect(0, y, width, 1);
  for (let x = 0; x < width; x += 2) ctx.fillRect(x, 0, 1, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.anisotropy = 8;
  return texture;
}
