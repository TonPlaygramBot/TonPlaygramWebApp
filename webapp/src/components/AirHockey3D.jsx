import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { getGameVolume } from '../utils/sound.js';
import { getAvatarUrl } from '../utils/avatarUtils.js';

const POOL_ENVIRONMENT = (() => {
  const TABLE_SCALE = 1.17;
  const TABLE_FIELD_EXPANSION = 1.2;
  const SIZE_REDUCTION = 0.7;
  const GLOBAL_SIZE_FACTOR = 0.85 * SIZE_REDUCTION;
  const WORLD_SCALE = 0.85 * GLOBAL_SIZE_FACTOR * 0.7;

  const TABLE_WIDTH_RAW = 66 * TABLE_SCALE * TABLE_FIELD_EXPANSION;
  const TABLE_LENGTH_RAW = 132 * TABLE_SCALE * TABLE_FIELD_EXPANSION;
  const TABLE_THICKNESS_RAW = 1.8 * TABLE_SCALE;
  const FRAME_TOP_Y = -TABLE_THICKNESS_RAW + 0.01 - TABLE_THICKNESS_RAW * 0.012;

  const LEG_SCALE = 6.2;
  const LEG_HEIGHT_FACTOR = 4;
  const LEG_HEIGHT_MULTIPLIER = 4.5;
  const TABLE_HEIGHT_REDUCTION = 0.8;
  const TABLE_DROP = 0.4;
  const BASE_TABLE_LIFT = 3.6;
  const TABLE_H_RAW = 0.75 * LEG_SCALE * TABLE_HEIGHT_REDUCTION;
  const TABLE_LIFT_RAW = BASE_TABLE_LIFT + TABLE_H_RAW * (LEG_HEIGHT_FACTOR - 1);
  const BASE_LEG_HEIGHT_RAW =
    TABLE_THICKNESS_RAW * 2 * 3 * 1.15 * LEG_HEIGHT_MULTIPLIER;
  const BASE_LEG_LENGTH_SCALE = 0.72;
  const LEG_ELEVATION_SCALE = 0.96;
  const LEG_LENGTH_SCALE = BASE_LEG_LENGTH_SCALE * LEG_ELEVATION_SCALE;
  const LEG_HEIGHT_OFFSET = FRAME_TOP_Y - 0.3;
  const LEG_ROOM_HEIGHT_RAW = BASE_LEG_HEIGHT_RAW + TABLE_LIFT_RAW;
  const BASE_LEG_ROOM_HEIGHT_RAW =
    (LEG_ROOM_HEIGHT_RAW + LEG_HEIGHT_OFFSET) * BASE_LEG_LENGTH_SCALE -
    LEG_HEIGHT_OFFSET;
  const LEG_ROOM_HEIGHT =
    (LEG_ROOM_HEIGHT_RAW + LEG_HEIGHT_OFFSET) * LEG_LENGTH_SCALE -
    LEG_HEIGHT_OFFSET;
  const LEG_ELEVATION_DELTA = LEG_ROOM_HEIGHT - BASE_LEG_ROOM_HEIGHT_RAW;

  const BASE_TABLE_Y =
    -2 + (TABLE_H_RAW - 0.75) + TABLE_H_RAW + TABLE_LIFT_RAW - TABLE_DROP;
  const TABLE_Y_RAW = BASE_TABLE_Y + LEG_ELEVATION_DELTA;
  const TABLE_SURFACE_RAW = TABLE_Y_RAW - TABLE_THICKNESS_RAW + 0.01;
  const FLOOR_Y_RAW = TABLE_Y_RAW - TABLE_THICKNESS_RAW - LEG_ROOM_HEIGHT + 0.3;

  const ROOM_DEPTH_RAW = TABLE_LENGTH_RAW * 3.6;
  const SIDE_CLEARANCE_RAW = ROOM_DEPTH_RAW / 2 - TABLE_LENGTH_RAW / 2;
  const ROOM_WIDTH_RAW = TABLE_WIDTH_RAW + SIDE_CLEARANCE_RAW * 2;
  const WALL_THICKNESS_RAW = 1.2;
  const WALL_HEIGHT_BASE_RAW = LEG_ROOM_HEIGHT + TABLE_THICKNESS_RAW + 40;
  const WALL_HEIGHT_RAW = WALL_HEIGHT_BASE_RAW * 1.3 * 1.3;
  const CARPET_THICKNESS_RAW = 1.2;
  const CARPET_INSET_RAW = WALL_THICKNESS_RAW * 0.02;
  const CARPET_WIDTH_RAW = ROOM_WIDTH_RAW - WALL_THICKNESS_RAW + CARPET_INSET_RAW;
  const CARPET_DEPTH_RAW = ROOM_DEPTH_RAW - WALL_THICKNESS_RAW + CARPET_INSET_RAW;

  return Object.freeze({
    WORLD_SCALE,
    tableWidth: TABLE_WIDTH_RAW * WORLD_SCALE,
    tableLength: TABLE_LENGTH_RAW * WORLD_SCALE,
    tableThickness: TABLE_THICKNESS_RAW * WORLD_SCALE,
    tableSurfaceY: TABLE_SURFACE_RAW * WORLD_SCALE,
    floorY: FLOOR_Y_RAW * WORLD_SCALE,
    roomWidth: ROOM_WIDTH_RAW * WORLD_SCALE,
    roomDepth: ROOM_DEPTH_RAW * WORLD_SCALE,
    wallThickness: WALL_THICKNESS_RAW * WORLD_SCALE,
    wallHeight: WALL_HEIGHT_RAW * WORLD_SCALE,
    carpetThickness: CARPET_THICKNESS_RAW * WORLD_SCALE,
    carpetWidth: CARPET_WIDTH_RAW * WORLD_SCALE,
    carpetDepth: CARPET_DEPTH_RAW * WORLD_SCALE
  });
})();

/**
 * AIR HOCKEY 3D — Mobile Portrait
 * -------------------------------
 * • Full Pool Royale arena replica (walls, carpet, lighting, table footprint)
 * • Player-edge camera for an at-table perspective suited to portrait play
 * • Controls: drag bottom half to move mallet
 * • AI opponent on top half with simple tracking logic
 * • Scoreboard with avatars
 */

export default function AirHockey3D({ player, ai, target = 3, playType = 'regular' }) {
  const targetValue = Number(target) || 3;
  const hostRef = useRef(null);
  const raf = useRef(0);
  const [ui, setUi] = useState({ left: 0, right: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState('');
  const targetRef = useRef(Number(target) || 3);
  const gameOverRef = useRef(false);
  const audioRef = useRef({ hit: null, goal: null, whistle: null, post: null });
  const scoreRef = useRef({ left: 0, right: 0 });

  useEffect(() => {
    targetRef.current = Number(target) || 3;
  }, [target]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    audioRef.current.hit = new Audio('/assets/sounds/football-game-sound-effects-359284.mp3');
    audioRef.current.goal = new Audio('/assets/sounds/a-football-hits-the-net-goal-313216.mp3');
    audioRef.current.whistle = new Audio('/assets/sounds/metal-whistle-6121.mp3');
    audioRef.current.post = new Audio('/assets/sounds/frying-pan-over-the-head-89303.mp3');

    const playWhistle = () => {
      const whistle = audioRef.current.whistle;
      if (!whistle) return;
      whistle.volume = getGameVolume();
      whistle.currentTime = 0;
      whistle.play().catch(() => {});
      setTimeout(() => {
        whistle.pause();
        whistle.currentTime = 0;
      }, 2000);
    };

    const playHit = () => {
      const hit = audioRef.current.hit;
      if (!hit) return;
      hit.volume = getGameVolume();
      hit.currentTime = 0;
      hit.play().catch(() => {});
      setTimeout(() => {
        hit.pause();
      }, 700);
    };

    const playPost = () => {
      const post = audioRef.current.post;
      if (!post) return;
      post.volume = Math.min(1, getGameVolume() * 0.7);
      post.currentTime = 0.15;
      post.play().catch(() => {});
      setTimeout(() => {
        post.pause();
        post.currentTime = 0.15;
      }, 1000);
    };

    const playGoal = () => {
      const goal = audioRef.current.goal;
      if (!goal) return;
      goal.volume = getGameVolume();
      goal.currentTime = 0;
      goal.play().catch(() => {});
      setTimeout(() => {
        goal.pause();
        goal.currentTime = 0;
      }, 2000);
      playWhistle();
    };

    const recordGoal = (playerScored) => {
      scoreRef.current = {
        left: scoreRef.current.left + (playerScored ? 1 : 0),
        right: scoreRef.current.right + (playerScored ? 0 : 1)
      };
      setUi({ ...scoreRef.current });
      const targetScore = targetRef.current;
      if (
        targetScore &&
        (scoreRef.current.left >= targetScore || scoreRef.current.right >= targetScore)
      ) {
        gameOverRef.current = true;
        setGameOver(true);
        setWinner(playerScored ? player.name : ai.name);
        return true;
      }
      return false;
    };

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);

    const TABLE_SCALE = 1.2;
    const BASE_TABLE_LENGTH = POOL_ENVIRONMENT.tableLength * TABLE_SCALE;
    const TOP_EXTENSION_FACTOR = 0.3;
    const TABLE = {
      w: POOL_ENVIRONMENT.tableWidth * TABLE_SCALE,
      h:
        BASE_TABLE_LENGTH / 2 + (BASE_TABLE_LENGTH / 2) * (1 + TOP_EXTENSION_FACTOR),
      thickness: POOL_ENVIRONMENT.tableThickness,
      goalW: POOL_ENVIRONMENT.tableWidth * TABLE_SCALE * 0.45454545454545453,
      topExtension: (BASE_TABLE_LENGTH / 2) * TOP_EXTENSION_FACTOR
    };
    const SCALE_WIDTH = TABLE.w / 2.2;
    const SCALE_LENGTH = TABLE.h / (4.8 * 1.2);
    const SPEED_SCALE = (SCALE_WIDTH + SCALE_LENGTH) / 2;
    const MALLET_RADIUS = TABLE.w * 0.054545454545454536;
    const MALLET_HEIGHT = MALLET_RADIUS * (0.05 / 0.12);
    const MALLET_KNOB_RADIUS = MALLET_RADIUS * (0.06 / 0.12);
    const MALLET_KNOB_HEIGHT = MALLET_RADIUS * (0.08 / 0.12);
    const PUCK_RADIUS = TABLE.w * 0.027272727272727268;
    const PUCK_HEIGHT = PUCK_RADIUS * (0.06 / 0.06);

    const camera = new THREE.PerspectiveCamera(
      56,
      host.clientWidth / host.clientHeight,
      0.1,
      1200
    );

    const world = new THREE.Group();
    scene.add(world);

    const TABLE_ELEVATION_FACTOR = 2;
    const tableFloorGap =
      POOL_ENVIRONMENT.tableSurfaceY - POOL_ENVIRONMENT.floorY;
    const tableLift = tableFloorGap * (TABLE_ELEVATION_FACTOR - 1);
    const elevatedTableSurfaceY = POOL_ENVIRONMENT.tableSurfaceY + tableLift;

    const tableGroup = new THREE.Group();
    tableGroup.position.y = elevatedTableSurfaceY;
    tableGroup.position.z = -TABLE.topExtension / 2;
    const tableCenterZ = tableGroup.position.z;
    world.add(tableGroup);

    const carpet = new THREE.Mesh(
      new THREE.BoxGeometry(
        POOL_ENVIRONMENT.carpetWidth,
        POOL_ENVIRONMENT.carpetThickness,
        POOL_ENVIRONMENT.carpetDepth
      ),
      new THREE.MeshStandardMaterial({
        color: 0x8c2a2e,
        roughness: 0.9,
        metalness: 0.025
      })
    );
    carpet.castShadow = false;
    carpet.receiveShadow = true;
    carpet.position.set(
      0,
      POOL_ENVIRONMENT.floorY - POOL_ENVIRONMENT.carpetThickness / 2,
      0
    );
    world.add(carpet);

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xb9ddff,
      roughness: 0.88,
      metalness: 0.06
    });
    const makeArenaWall = (width, height, depth) => {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        wallMaterial
      );
      wall.castShadow = false;
      wall.receiveShadow = true;
      wall.position.y = POOL_ENVIRONMENT.floorY + height / 2;
      world.add(wall);
      return wall;
    };

    const halfRoomDepth = POOL_ENVIRONMENT.roomDepth / 2;
    const halfRoomWidth = POOL_ENVIRONMENT.roomWidth / 2;
    const arenaWallThickness = POOL_ENVIRONMENT.wallThickness;
    makeArenaWall(
      POOL_ENVIRONMENT.roomWidth,
      POOL_ENVIRONMENT.wallHeight,
      arenaWallThickness
    ).position.z = -halfRoomDepth;
    makeArenaWall(
      POOL_ENVIRONMENT.roomWidth,
      POOL_ENVIRONMENT.wallHeight,
      arenaWallThickness
    ).position.z = halfRoomDepth;
    makeArenaWall(
      arenaWallThickness,
      POOL_ENVIRONMENT.wallHeight,
      POOL_ENVIRONMENT.roomDepth
    ).position.x = -halfRoomWidth;
    makeArenaWall(
      arenaWallThickness,
      POOL_ENVIRONMENT.wallHeight,
      POOL_ENVIRONMENT.roomDepth
    ).position.x = halfRoomWidth;

    const tableSurface = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE.w, TABLE.thickness, TABLE.h),
      new THREE.MeshStandardMaterial({
        color: 0x3b83c3,
        roughness: 0.85,
        metalness: 0.1
      })
    );
    tableSurface.position.y = -TABLE.thickness / 2;
    tableGroup.add(tableSurface);

    const floorLocalY = POOL_ENVIRONMENT.floorY - elevatedTableSurfaceY;
    const woodMaterial = new THREE.MeshStandardMaterial({
      color: 0x5d3725,
      roughness: 0.55,
      metalness: 0.18
    });
    const darkWoodMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c1a11,
      roughness: 0.7,
      metalness: 0.12
    });

    const SKIRT_OVERHANG = Math.max(TABLE.w, TABLE.h) * 0.08;
    const SKIRT_TOP_GAP = TABLE.thickness * 0.05;
    const SKIRT_HEIGHT = TABLE.thickness * 3.6;
    const skirtTopLocal = -TABLE.thickness - SKIRT_TOP_GAP;
    const outerHalfW = TABLE.w / 2 + SKIRT_OVERHANG / 2;
    const outerHalfH = TABLE.h / 2 + SKIRT_OVERHANG / 2;
    const panelThickness = TABLE.thickness * 0.7;
    const panelHeight = SKIRT_HEIGHT;
    const panelY = skirtTopLocal - panelHeight / 2;
    const createSkirtPanel = (width, depth) => {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(width, panelHeight, depth),
        woodMaterial
      );
      panel.castShadow = true;
      panel.receiveShadow = true;
      panel.position.y = panelY;
      return panel;
    };
    const skirtGroup = new THREE.Group();
    const frontPanel = createSkirtPanel(
      outerHalfW * 2,
      panelThickness
    );
    frontPanel.position.z = -outerHalfH + panelThickness / 2;
    const backPanel = createSkirtPanel(
      outerHalfW * 2,
      panelThickness
    );
    backPanel.position.z = outerHalfH - panelThickness / 2;
    const leftPanel = createSkirtPanel(
      panelThickness,
      outerHalfH * 2
    );
    leftPanel.position.x = -outerHalfW + panelThickness / 2;
    const rightPanel = createSkirtPanel(
      panelThickness,
      outerHalfH * 2
    );
    rightPanel.position.x = outerHalfW - panelThickness / 2;
    skirtGroup.add(frontPanel, backPanel, leftPanel, rightPanel);
    tableGroup.add(skirtGroup);

    const baseClearance = TABLE.thickness * 0.18;
    const cabinetHeight = TABLE.thickness * 1.8;
    const cabinet = new THREE.Mesh(
      new THREE.BoxGeometry(
        outerHalfW * 2 - panelThickness * 0.6,
        cabinetHeight,
        outerHalfH * 2 - panelThickness * 0.35
      ),
      darkWoodMaterial
    );
    cabinet.castShadow = true;
    cabinet.receiveShadow = true;
    const cabinetTopLocal = -TABLE.thickness - baseClearance;
    cabinet.position.y = cabinetTopLocal - cabinetHeight / 2;
    tableGroup.add(cabinet);
    const cabinetBottomLocal = cabinet.position.y - cabinetHeight / 2;

    const legMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a2918,
      roughness: 0.5,
      metalness: 0.16
    });
    const legRadius = Math.min(TABLE.w, TABLE.h) * 0.055;
    const legTopLocal = cabinetBottomLocal - TABLE.thickness * 0.08;
    const legHeightGap = legTopLocal - floorLocalY;
    const legHeight = Math.max(0.1, legHeightGap);
    const legGeometry = new THREE.CylinderGeometry(
      legRadius * 0.92,
      legRadius,
      legHeight,
      32
    );
    const legCenterY = (legTopLocal + floorLocalY) / 2;
    const legInset = Math.max(SKIRT_OVERHANG * 0.3, legRadius * 1.6);
    const legPositions = [
      [-outerHalfW + legInset, -outerHalfH + legInset],
      [outerHalfW - legInset, -outerHalfH + legInset],
      [-outerHalfW + legInset, 0],
      [outerHalfW - legInset, 0],
      [-outerHalfW + legInset, outerHalfH - legInset],
      [outerHalfW - legInset, outerHalfH - legInset]
    ];
    const footHeight = legRadius * 0.4;
    const footGeometry = new THREE.CylinderGeometry(
      legRadius * 1.08,
      legRadius * 1.2,
      footHeight,
      32
    );
    const footY = floorLocalY + footHeight / 2;
    legPositions.forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeometry, legMaterial);
      leg.position.set(lx, legCenterY, lz);
      leg.castShadow = true;
      leg.receiveShadow = true;
      tableGroup.add(leg);

      const foot = new THREE.Mesh(footGeometry, darkWoodMaterial);
      foot.position.set(lx, footY, lz);
      foot.castShadow = true;
      foot.receiveShadow = true;
      tableGroup.add(foot);
    });

    const railMat = new THREE.MeshStandardMaterial({
      color: 0xdbe9ff,
      transparent: true,
      opacity: 0.32,
      roughness: 0.18,
      metalness: 0.1
    });
    const railHeight = 0.25 * SCALE_WIDTH;
    const railThickness = 0.04 * SCALE_WIDTH;
    const buildRail = (w, h, d) =>
      new THREE.Mesh(new THREE.BoxGeometry(w, h, d), railMat);

    const northRail = buildRail(TABLE.w, railHeight, railThickness);
    northRail.position.set(0, railHeight / 2, -TABLE.h / 2 - railThickness / 2);
    tableGroup.add(northRail);
    const southRail = buildRail(TABLE.w, railHeight, railThickness);
    southRail.position.set(0, railHeight / 2, TABLE.h / 2 + railThickness / 2);
    tableGroup.add(southRail);
    const westRail = buildRail(railThickness, railHeight, TABLE.h);
    westRail.position.set(-TABLE.w / 2 - railThickness / 2, railHeight / 2, 0);
    tableGroup.add(westRail);
    const eastRail = buildRail(railThickness, railHeight, TABLE.h);
    eastRail.position.set(TABLE.w / 2 + railThickness / 2, railHeight / 2, 0);
    tableGroup.add(eastRail);

    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6
    });
    const lineThickness = 0.02 * SCALE_WIDTH;
    const midLine = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE.w, lineThickness * 0.5, lineThickness),
      lineMat
    );
    midLine.position.y = lineThickness * 0.25;
    tableGroup.add(midLine);

    const ring = (radius, tubeRadius, z) => {
      const torus = new THREE.TorusGeometry(radius, tubeRadius, 16, 60);
      const mesh = new THREE.Mesh(
        torus,
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
      );
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(0, lineThickness * 0.5, z);
      tableGroup.add(mesh);
    };
    const ringRadius = 0.18 * SCALE_WIDTH;
    const ringTube = 0.008 * SCALE_WIDTH;
    ring(ringRadius, ringTube, -TABLE.h * 0.33);
    ring(ringRadius, ringTube, TABLE.h * 0.33);

    const goalGeometry = new THREE.BoxGeometry(
      TABLE.goalW,
      0.11 * SCALE_WIDTH,
      railThickness * 0.6
    );
    const goalMaterial = new THREE.MeshStandardMaterial({
      color: 0x99ffd6,
      emissive: 0x003322,
      emissiveIntensity: 0.6
    });
    const northGoal = new THREE.Mesh(goalGeometry, goalMaterial);
    northGoal.position.set(0, 0.055 * SCALE_WIDTH, -TABLE.h / 2 - railThickness * 0.7);
    tableGroup.add(northGoal);
    const southGoal = new THREE.Mesh(goalGeometry, goalMaterial);
    southGoal.position.set(0, 0.055 * SCALE_WIDTH, TABLE.h / 2 + railThickness * 0.7);
    tableGroup.add(southGoal);

    const makeMallet = (color) => {
      const mallet = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(MALLET_RADIUS, MALLET_RADIUS, MALLET_HEIGHT, 32),
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.4,
          metalness: 0.2
        })
      );
      base.position.y = MALLET_HEIGHT / 2;
      const knob = new THREE.Mesh(
        new THREE.CylinderGeometry(
          MALLET_KNOB_RADIUS,
          MALLET_KNOB_RADIUS,
          MALLET_KNOB_HEIGHT,
          32
        ),
        new THREE.MeshStandardMaterial({ color: 0x222222 })
      );
      knob.position.y = MALLET_HEIGHT + MALLET_KNOB_HEIGHT / 2;
      mallet.add(base, knob);
      return mallet;
    };

    const you = makeMallet(0xff5577);
    you.position.set(0, 0, TABLE.h * 0.42);
    tableGroup.add(you);

    const aiMallet = makeMallet(0x66ddff);
    aiMallet.position.set(0, 0, -TABLE.h * 0.36);
    tableGroup.add(aiMallet);

    const puck = new THREE.Mesh(
      new THREE.CylinderGeometry(PUCK_RADIUS, PUCK_RADIUS, PUCK_HEIGHT, 32),
      new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    puck.position.y = PUCK_HEIGHT / 2;
    tableGroup.add(puck);

    const hemisphereKey = new THREE.HemisphereLight(0xdde7ff, 0x0b1020, 0.758625);
    const lightLift = TABLE.h * 0.32;
    hemisphereKey.position.set(0, elevatedTableSurfaceY + lightLift, -TABLE.h * 0.18);
    scene.add(hemisphereKey);

    const hemisphereFill = new THREE.HemisphereLight(0xdde7ff, 0x0b1020, 0.4284);
    hemisphereFill.position.set(0, elevatedTableSurfaceY + lightLift, 0);
    scene.add(hemisphereFill);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.176);
    dirLight.position.set(-TABLE.w * 0.28, elevatedTableSurfaceY + lightLift, TABLE.h * 0.18);
    dirLight.target.position.set(0, elevatedTableSurfaceY + TABLE.thickness * 0.1, 0);
    scene.add(dirLight);
    scene.add(dirLight.target);

    const spotLight = new THREE.SpotLight(
      0xffffff,
      12.7449,
      0,
      Math.PI * 0.36,
      0.42,
      1
    );
    spotLight.position.set(
      TABLE.w * 0.32,
      elevatedTableSurfaceY + lightLift * 1.3,
      TABLE.h * 0.26
    );
    spotLight.target.position.set(0, elevatedTableSurfaceY + TABLE.thickness * 0.4, 0);
    spotLight.decay = 1.0;
    scene.add(spotLight);
    scene.add(spotLight.target);

    const playerRailZ = TABLE.h / 2 + railThickness / 2;
    const cameraFocus = new THREE.Vector3(
      0,
      elevatedTableSurfaceY + TABLE.thickness * 0.06,
      tableCenterZ
    );
    const cameraAnchor = new THREE.Vector3(
      0,
      elevatedTableSurfaceY + TABLE.h * 0.36,
      tableCenterZ + playerRailZ + railThickness * 0.35
    );
    const cameraDirection = new THREE.Vector3()
      .subVectors(cameraAnchor, cameraFocus)
      .normalize();

    const tableCorners = [
      new THREE.Vector3(-TABLE.w / 2, elevatedTableSurfaceY, -TABLE.h / 2 + tableCenterZ),
      new THREE.Vector3(TABLE.w / 2, elevatedTableSurfaceY, -TABLE.h / 2 + tableCenterZ),
      new THREE.Vector3(-TABLE.w / 2, elevatedTableSurfaceY, TABLE.h / 2 + tableCenterZ),
      new THREE.Vector3(TABLE.w / 2, elevatedTableSurfaceY, TABLE.h / 2 + tableCenterZ)
    ];

    const fitCameraToTable = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.position.copy(cameraAnchor);
      camera.lookAt(cameraFocus);
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
      for (let i = 0; i < 20; i++) {
        const needsRetreat = tableCorners.some((corner) => {
          const sample = corner.clone();
          const ndc = sample.project(camera);
          return Math.abs(ndc.x) > 0.95 || ndc.y < -1.05 || ndc.y > 1.05;
        });
        if (!needsRetreat) break;
        camera.position.addScaledVector(cameraDirection, 2.4);
        camera.lookAt(cameraFocus);
        camera.updateProjectionMatrix();
      }
    };

    const S = {
      vel: new THREE.Vector3(0, 0, 0),
      friction: 0.996
    };

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(
      new THREE.Vector3(0, 1, 0),
      -elevatedTableSurfaceY
    );
    const hit = new THREE.Vector3();

    const touchToXZ = (clientX, clientY) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(plane, hit)) {
        return { x: you.position.x, z: you.position.z };
      }
      return {
        x: clamp(hit.x, -TABLE.w / 2 + MALLET_RADIUS, TABLE.w / 2 - MALLET_RADIUS),
        z: clamp(hit.z, 0, TABLE.h / 2 - MALLET_RADIUS)
      };
    };

    const onMove = (e) => {
      const t = e.touches ? e.touches[0] : e;
      const { x, z } = touchToXZ(t.clientX, t.clientY);
      you.position.set(x, 0, z);
    };

    renderer.domElement.addEventListener('touchstart', onMove, {
      passive: true
    });
    renderer.domElement.addEventListener('touchmove', onMove, {
      passive: true
    });
    renderer.domElement.addEventListener('mousemove', onMove);

    const SPEED_BOOST = 1.25;
    const HIT_FORCE = 0.5 * SPEED_SCALE * SPEED_BOOST;
    const MAX_SPEED = 0.095 * SPEED_SCALE * SPEED_BOOST;
    const SERVE_SPEED = 0.055 * SPEED_SCALE * SPEED_BOOST;

    const handleCollision = (mallet, isPlayer = false) => {
      const dx = puck.position.x - mallet.position.x;
      const dz = puck.position.z - mallet.position.z;
      const d2 = dx * dx + dz * dz;
      const collideRadius = MALLET_RADIUS + PUCK_RADIUS * 0.8;
      if (d2 < collideRadius * collideRadius) {
        const distance = Math.max(Math.sqrt(d2), 1e-6);
        const overlap = collideRadius - distance;
        const normal = new THREE.Vector3(dx / distance, 0, dz / distance);

        puck.position.x += normal.x * overlap;
        puck.position.z += normal.z * overlap;

        const directionalForce = HIT_FORCE * (isPlayer ? 1.2 : 1);
        S.vel.addScaledVector(normal, directionalForce);

        if (isPlayer) {
          const guardOffset = MALLET_RADIUS + PUCK_RADIUS * 0.2;
          puck.position.z = Math.min(puck.position.z, mallet.position.z - guardOffset);
          if (S.vel.z > 0) {
            S.vel.z = -Math.abs(S.vel.z);
          }
        }

        const alongNormal = S.vel.dot(normal);
        if (alongNormal < SERVE_SPEED * 0.4) {
          S.vel.addScaledVector(normal, SERVE_SPEED * 0.4 - alongNormal);
        }

        playHit();
      }
    };

    const aiUpdate = (dt) => {
      const guardLine = -MALLET_RADIUS;
      const defensiveZ = -TABLE.h * 0.36;
      const targetZ =
        puck.position.z < guardLine
          ? clamp(
              puck.position.z + MALLET_RADIUS * 0.8,
              -TABLE.h / 2 + MALLET_RADIUS,
              guardLine - MALLET_RADIUS
            )
          : defensiveZ;
      const targetX = clamp(
        puck.position.x,
        -TABLE.w / 2 + MALLET_RADIUS,
        TABLE.w / 2 - MALLET_RADIUS
      );
      const chaseSpeed = 3.4;
      aiMallet.position.x += (targetX - aiMallet.position.x) * chaseSpeed * dt;
      aiMallet.position.z += (targetZ - aiMallet.position.z) * chaseSpeed * dt;
    };

    const reset = (towardTop = false) => {
      puck.position.set(0, PUCK_HEIGHT / 2, 0);
      S.vel.set(0, 0, towardTop ? -SERVE_SPEED : SERVE_SPEED);
      you.position.set(0, 0, TABLE.h * 0.42);
      aiMallet.position.set(0, 0, -TABLE.h * 0.36);
    };

    // loop
    const clock = new THREE.Clock();
    reset();
    fitCameraToTable();

    const tick = () => {
      const dt = Math.min(0.033, clock.getDelta());

      puck.position.x += S.vel.x;
      puck.position.z += S.vel.z;
      S.vel.multiplyScalar(Math.pow(S.friction, dt * 60));
      // keep puck speed manageable
      S.vel.clampLength(0, MAX_SPEED);

      if (Math.abs(puck.position.x) > TABLE.w / 2 - PUCK_RADIUS) {
        puck.position.x = clamp(
          puck.position.x,
          -TABLE.w / 2 + PUCK_RADIUS,
          TABLE.w / 2 - PUCK_RADIUS
        );
        S.vel.x = -S.vel.x;
        playHit();
      }

      const goalHalf = TABLE.goalW / 2;
      const atTop = puck.position.z < -TABLE.h / 2 + PUCK_RADIUS;
      const atBot = puck.position.z > TABLE.h / 2 - PUCK_RADIUS;
      if (atTop || atBot) {
        if (Math.abs(puck.position.x) <= goalHalf) {
          const playerScored = atBot;
          const ended = recordGoal(playerScored);
          playGoal();
          if (!ended) reset(!atBot);
        } else {
          S.vel.z = -S.vel.z;
          puck.position.z = clamp(
            puck.position.z,
            -TABLE.h / 2 + PUCK_RADIUS,
            TABLE.h / 2 - PUCK_RADIUS
          );
          playPost();
        }
      }

      aiUpdate(dt);
      handleCollision(you, true);
      handleCollision(aiMallet);
      renderer.render(scene, camera);
      if (!gameOverRef.current) {
        raf.current = requestAnimationFrame(tick);
      }
    };

    tick();

    const onResize = () => {
      fitCameraToTable();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('touchstart', onMove);
      renderer.domElement.removeEventListener('touchmove', onMove);
      renderer.domElement.removeEventListener('mousemove', onMove);
      Object.keys(audioRef.current).forEach((key) => {
        const audio = audioRef.current[key];
        if (audio) {
          audio.pause();
          audioRef.current[key] = null;
        }
      });
      try {
        host.removeChild(renderer.domElement);
      } catch {}
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="w-full h-[100dvh] bg-black relative overflow-hidden select-none"
    >
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-white text-[10px] bg-white/10 rounded px-3 py-1 backdrop-blur">
        <span className="uppercase tracking-wide">{playType}</span>
        <span className="mx-2">•</span>
        <span>Target: {targetValue}</span>
      </div>
      <div className="absolute top-1 left-2 flex items-center space-x-2 text-white text-xs bg-white/10 rounded px-2 py-1">
        <img
          src={getAvatarUrl(player.avatar)}
          alt=""
          className="w-5 h-5 rounded-full object-cover"
        />
        <span>
          {player.name}: {ui.left}
        </span>
      </div>
      <div className="absolute top-1 right-2 flex items-center space-x-2 text-white text-xs bg-white/10 rounded px-2 py-1">
        <span>
          {ui.right}: {ai.name}
        </span>
        <img
          src={getAvatarUrl(ai.avatar)}
          alt=""
          className="w-5 h-5 rounded-full object-cover"
        />
      </div>
      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 text-white text-center rounded-lg px-4 py-3 space-y-1 mx-4">
            <div className="text-sm font-semibold">Game Over</div>
            <div className="text-xs">{winner} wins to {targetValue}.</div>
            <div className="text-[11px] text-white/80">Tap Reset to play again.</div>
          </div>
        </div>
      )}
      <button
        onClick={() => window.location.reload()}
        className="absolute left-2 bottom-2 text-white text-xs bg-white/10 hover:bg-white/20 rounded px-2 py-1"
      >
        Reset
      </button>
    </div>
  );
}

