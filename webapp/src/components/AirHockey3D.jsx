import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { getGameVolume } from '../utils/sound.js';
import { getAvatarUrl } from '../utils/avatarUtils.js';

const CUSTOMIZATION = {
  field: [
    { name: 'Aurora Ice', surface: '#3b83c3', lines: '#ffffff', rings: '#d8f3ff' },
    { name: 'Neon Night', surface: '#152238', lines: '#4de1ff', rings: '#9bf1ff' },
    { name: 'Sunset Clash', surface: '#c93f4b', lines: '#ffe8d0', rings: '#ffd1a1' },
    { name: 'Midnight Steel', surface: '#0f172a', lines: '#a1a1aa', rings: '#d4d4d8' },
    { name: 'Mint Rush', surface: '#0f766e', lines: '#d1fae5', rings: '#34d399' }
  ],
  table: [
    { name: 'Walnut', wood: '#5d3725', trim: '#2c1a11' },
    { name: 'Ash Grey', wood: '#6b7280', trim: '#111827' },
    { name: 'Ivory Edge', wood: '#f8fafc', trim: '#cbd5e1' },
    { name: 'Obsidian', wood: '#0b0f1a', trim: '#1f2937' },
    { name: 'Sapphire', wood: '#1d4ed8', trim: '#0f172a' }
  ],
  puck: [
    { name: 'Carbon', color: '#111111', emissive: '#1f2937' },
    { name: 'Volt', color: '#eab308', emissive: '#854d0e' },
    { name: 'Magenta', color: '#be185d', emissive: '#9f1239' },
    { name: 'Frost', color: '#e0f2fe', emissive: '#0ea5e9' },
    { name: 'Jade', color: '#064e3b', emissive: '#10b981' }
  ],
  mallet: [
    { name: 'Crimson', color: '#ff5577', knob: '#1f2937' },
    { name: 'Cyan', color: '#22d3ee', knob: '#0f172a' },
    { name: 'Amber', color: '#f59e0b', knob: '#451a03' },
    { name: 'Violet', color: '#a855f7', knob: '#312e81' },
    { name: 'Lime', color: '#84cc16', knob: '#1a2e05' }
  ],
  rails: [
    { name: 'Glass', color: '#dbe9ff', opacity: 0.32 },
    { name: 'Shadow', color: '#0b1224', opacity: 0.6 },
    { name: 'Coral', color: '#f97316', opacity: 0.4 },
    { name: 'Mint', color: '#10b981', opacity: 0.35 },
    { name: 'Frosted', color: '#e5e7eb', opacity: 0.28 }
  ],
  goals: [
    { name: 'Mint Net', color: '#99ffd6', emissive: '#1aaf80' },
    { name: 'Crimson Net', color: '#ef4444', emissive: '#7f1d1d' },
    { name: 'Cobalt Net', color: '#60a5fa', emissive: '#1d4ed8' },
    { name: 'Amber Net', color: '#f59e0b', emissive: '#92400e' },
    { name: 'Ghost Net', color: '#e5e7eb', emissive: '#6b7280' }
  ]
};

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

export default function AirHockey3D({ player, ai, target = 11, playType = 'regular' }) {
  const targetValue = Number(target) || 11;
  const hostRef = useRef(null);
  const raf = useRef(0);
  const [ui, setUi] = useState({ left: 0, right: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState('');
  const [goalPopup, setGoalPopup] = useState(null);
  const [postPopup, setPostPopup] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [anchorsReady, setAnchorsReady] = useState(0);
  const [selections, setSelections] = useState({
    field: 0,
    table: 0,
    puck: 0,
    mallet: 0,
    rails: 0,
    goals: 0
  });
  const [showCustomizer, setShowCustomizer] = useState(false);
  const targetRef = useRef(Number(target) || 3);
  const gameOverRef = useRef(false);
  const audioRef = useRef({
    hit: null,
    goal: null,
    whistle: null,
    post: null,
    crowd: null
  });
  const audioStartedRef = useRef(false);
  const scoreRef = useRef({ left: 0, right: 0 });
  const goalTimeoutRef = useRef(null);
  const postTimeoutRef = useRef(null);
  const restartTimeoutRef = useRef(null);
  const redirectTimeoutRef = useRef(null);
  const materialsRef = useRef({
    tableSurface: null,
    wood: null,
    darkWood: null,
    rail: null,
    line: null,
    rings: [],
    goal: null,
    playerMallet: null,
    aiMallet: null,
    playerKnob: null,
    aiKnob: null,
    puck: null
  });
  const tableGroupRef = useRef(null);
  const avatarSpritesRef = useRef({ player: null, ai: null });
  const fieldAnchorsRef = useRef(null);

  useEffect(() => {
    if (!gameOver) return undefined;

    setRedirecting(true);
    redirectTimeoutRef.current = setTimeout(() => {
      window.location.href = '/games/airhockey/lobby';
    }, 2000);

    return () => {
      clearTimeout(redirectTimeoutRef.current);
    };
  }, [gameOver]);

  useEffect(() => () => {
    clearTimeout(goalTimeoutRef.current);
    clearTimeout(postTimeoutRef.current);
    clearTimeout(restartTimeoutRef.current);
    clearTimeout(redirectTimeoutRef.current);
  }, []);

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
    audioRef.current.crowd = new Audio('/assets/sounds/football-crowd-3-69245.mp3');

    const primeAudio = () => {
      const audios = Object.values(audioRef.current).filter(Boolean);
      if (!audios.length || audioStartedRef.current) return;

      let unlocked = false;
      let pending = audios.length;

      audios.forEach((audio) => {
        const originalVolume = audio.volume;
        audio.volume = Math.max(0.0001, originalVolume * 0.0001);
        audio.currentTime = 0;

        const finalize = (wasUnlocked) => {
          unlocked = unlocked || wasUnlocked;
          audio.volume = originalVolume;
          pending -= 1;
          if (pending === 0) {
            audioStartedRef.current = unlocked;
          }
        };

        const playPromise = audio.play();
        if (playPromise && playPromise.then) {
          playPromise
            .then(() => {
              audio.pause();
              audio.currentTime = 0;
              finalize(true);
            })
            .catch(() => finalize(false));
        } else {
          audio.pause();
          audio.currentTime = 0;
          finalize(true);
        }
      });
    };

    const playWhistle = () => {
      const whistle = audioRef.current.whistle;
      if (!whistle || !audioStartedRef.current) return;
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
      if (!hit || !audioStartedRef.current) return;
      hit.volume = getGameVolume();
      hit.currentTime = 0;
      hit.play().catch(() => {});
      setTimeout(() => {
        hit.pause();
      }, 700);
    };

    const playPost = () => {
      const post = audioRef.current.post;
      if (!post || !audioStartedRef.current) return;
      post.volume = Math.min(1, getGameVolume() * 0.7);
      post.currentTime = 0.15;
      post.play().catch(() => {});
      setTimeout(() => {
        post.pause();
        post.currentTime = 0.15;
      }, 1000);
      setPostPopup(true);
      clearTimeout(postTimeoutRef.current);
      postTimeoutRef.current = setTimeout(() => setPostPopup(false), 900);
    };

    const playGoal = () => {
      const goal = audioRef.current.goal;
      const crowd = audioRef.current.crowd;
      if (!goal || !audioStartedRef.current) return;
      goal.volume = getGameVolume();
      goal.currentTime = 0;
      goal.play().catch(() => {});
      setTimeout(() => {
        goal.pause();
        goal.currentTime = 0;
      }, 2000);
      if (crowd) {
        crowd.volume = Math.min(1, getGameVolume() * 0.8);
        crowd.currentTime = 0;
        crowd.play().catch(() => {});
        setTimeout(() => {
          crowd.pause();
          crowd.currentTime = 0;
        }, 2500);
      }
    };

    const recordGoal = (playerScored) => {
      scoreRef.current = {
        left: scoreRef.current.left + (playerScored ? 1 : 0),
        right: scoreRef.current.right + (playerScored ? 0 : 1)
      };
      setUi({ ...scoreRef.current });
      setGoalPopup({
        scorer: playerScored ? player.name : ai.name,
        scoreLine: `${scoreRef.current.left} - ${scoreRef.current.right}`,
        isPlayer: playerScored
      });
      clearTimeout(goalTimeoutRef.current);
      goalTimeoutRef.current = setTimeout(() => setGoalPopup(null), 1500);
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.85;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const createPuckTexture = () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const cx = size / 2;
      const cy = size / 2;

      ctx.fillStyle = '#0b0c0f';
      ctx.fillRect(0, 0, size, size);

      const outerRim = ctx.createRadialGradient(cx, cy, size * 0.1, cx, cy, size * 0.48);
      outerRim.addColorStop(0, '#1b1f23');
      outerRim.addColorStop(0.55, '#0f1114');
      outerRim.addColorStop(1, '#040506');
      ctx.fillStyle = outerRim;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2);
      ctx.fill();

      const rimCut = ctx.createRadialGradient(cx, cy, size * 0.14, cx, cy, size * 0.42);
      rimCut.addColorStop(0, 'rgba(255,255,255,0.08)');
      rimCut.addColorStop(0.42, 'rgba(60,60,60,0.2)');
      rimCut.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.strokeStyle = rimCut;
      ctx.lineWidth = size * 0.05;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.36, 0, Math.PI * 2);
      ctx.stroke();

      const top = ctx.createRadialGradient(cx, cy * 0.98, size * 0.06, cx, cy, size * 0.33);
      top.addColorStop(0, 'rgba(240,240,240,0.28)');
      top.addColorStop(0.6, 'rgba(80,85,90,0.18)');
      top.addColorStop(1, 'rgba(10,10,10,0.55)');
      ctx.fillStyle = top;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.34, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.4);
      const sheen = ctx.createLinearGradient(-size * 0.2, -size * 0.18, size * 0.12, size * 0.26);
      sheen.addColorStop(0, 'rgba(255,255,255,0.12)');
      sheen.addColorStop(0.55, 'rgba(255,255,255,0.25)');
      sheen.addColorStop(1, 'rgba(255,255,255,0.06)');
      ctx.fillStyle = sheen;
      ctx.beginPath();
      ctx.ellipse(0, size * 0.02, size * 0.32, size * 0.21, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2;
        const radius = size * 0.36;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.01, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.needsUpdate = true;
      return texture;
    };

    const createMalletTexture = (color) => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const cx = size / 2;
      const cy = size / 2;

      const base = ctx.createRadialGradient(cx, cy, size * 0.08, cx, cy, size * 0.5);
      base.addColorStop(0, '#fafafc');
      base.addColorStop(0.08, '#ffffff');
      base.addColorStop(0.26, color);
      base.addColorStop(1, '#0a0a0c');
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2);
      ctx.fill();

      const gloss = ctx.createLinearGradient(cx - size * 0.18, cy - size * 0.25, cx + size * 0.22, cy + size * 0.26);
      gloss.addColorStop(0, 'rgba(255,255,255,0.18)');
      gloss.addColorStop(0.55, 'rgba(255,255,255,0.34)');
      gloss.addColorStop(1, 'rgba(255,255,255,0.08)');
      ctx.fillStyle = gloss;
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.06, cy, size * 0.32, size * 0.18, -0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = size * 0.018;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.34, 0, Math.PI * 2);
      ctx.stroke();

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.needsUpdate = true;
      return texture;
    };

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
    const MALLET_RADIUS = TABLE.w * 0.072;
    const MALLET_HEIGHT = MALLET_RADIUS * (0.05 / 0.12);
    const MALLET_KNOB_RADIUS = MALLET_RADIUS * (0.065 / 0.12);
    const MALLET_KNOB_HEIGHT = MALLET_RADIUS * (0.1 / 0.12);
    const PUCK_RADIUS = TABLE.w * 0.0295;
    const PUCK_HEIGHT = PUCK_RADIUS * 1.05;

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
    tableGroupRef.current = tableGroup;

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
    materialsRef.current.tableSurface = tableSurface.material;

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
    materialsRef.current.wood = woodMaterial;
    materialsRef.current.darkWood = darkWoodMaterial;

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
    materialsRef.current.rail = railMat;
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
    materialsRef.current.line = lineMat;
    const lineThickness = 0.02 * SCALE_WIDTH;
    const midLine = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE.w, lineThickness * 0.5, lineThickness),
      lineMat
    );
    midLine.position.y = lineThickness * 0.25;
    tableGroup.add(midLine);

    const anchorLift = lineThickness * 1.4 + TABLE.thickness * 0.015;
    const avatarSize = TABLE.w * 0.36;
    const ringOffset = TABLE.h * 0.33;
    fieldAnchorsRef.current = {
      ai: { x: 0, y: anchorLift, z: -ringOffset },
      player: { x: 0, y: anchorLift, z: ringOffset },
      size: avatarSize
    };
    setAnchorsReady((v) => v + 1);

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
    materialsRef.current.goal = goalMaterial;
    const northGoal = new THREE.Mesh(goalGeometry, goalMaterial);
    northGoal.position.set(0, 0.055 * SCALE_WIDTH, -TABLE.h / 2 - railThickness * 0.7);
    tableGroup.add(northGoal);
    const southGoal = new THREE.Mesh(goalGeometry, goalMaterial);
    southGoal.position.set(0, 0.055 * SCALE_WIDTH, TABLE.h / 2 + railThickness * 0.7);
    tableGroup.add(southGoal);

    const makeMallet = (color) => {
      const mallet = new THREE.Group();
      const baseTexture = createMalletTexture(new THREE.Color(color).getStyle());
      const baseMaterial = new THREE.MeshStandardMaterial({
        color,
        map: baseTexture,
        roughness: 0.32,
        metalness: 0.28
      });
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(MALLET_RADIUS, MALLET_RADIUS, MALLET_HEIGHT, 32),
        baseMaterial
      );
      base.position.y = MALLET_HEIGHT / 2;
      const knobMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.26,
        metalness: 0.22
      });
      const knob = new THREE.Mesh(
        new THREE.CylinderGeometry(
          MALLET_KNOB_RADIUS,
          MALLET_KNOB_RADIUS,
          MALLET_KNOB_HEIGHT,
          32
        ),
        knobMaterial
      );
      knob.position.y = MALLET_HEIGHT + MALLET_KNOB_HEIGHT / 2;
      mallet.add(base, knob);
      return { mallet, baseMaterial, knobMaterial };
    };

    const youData = makeMallet(0xff5577);
    const you = youData.mallet;
    you.position.set(0, 0, TABLE.h * 0.42);
    tableGroup.add(you);
    materialsRef.current.playerMallet = youData.baseMaterial;
    materialsRef.current.playerKnob = youData.knobMaterial;

    const aiData = makeMallet(0x66ddff);
    const aiMallet = aiData.mallet;
    aiMallet.position.set(0, 0, -TABLE.h * 0.36);
    tableGroup.add(aiMallet);
    materialsRef.current.aiMallet = aiData.baseMaterial;
    materialsRef.current.aiKnob = aiData.knobMaterial;

    const puckTexture = createPuckTexture();
    const puck = new THREE.Mesh(
      new THREE.CylinderGeometry(PUCK_RADIUS, PUCK_RADIUS, PUCK_HEIGHT, 32),
      new THREE.MeshStandardMaterial({
        color: 0x111111,
        map: puckTexture,
        roughness: 0.34,
        metalness: 0.22,
        clearcoat: 0.35,
        clearcoatRoughness: 0.28
      })
    );
    puck.position.y = PUCK_HEIGHT / 2;
    tableGroup.add(puck);
    materialsRef.current.puck = puck.material;

    const lightLift = TABLE.h * 0.32;
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
    keyLight.position.set(-TABLE.w * 0.25, elevatedTableSurfaceY + lightLift, TABLE.h * 0.2);
    keyLight.target.position.set(0, elevatedTableSurfaceY, 0);
    scene.add(keyLight);
    scene.add(keyLight.target);

    const fillLight = new THREE.DirectionalLight(0xcdd9ff, 0.58);
    fillLight.position.set(TABLE.w * 0.36, elevatedTableSurfaceY + lightLift * 1.1, -TABLE.h * 0.12);
    fillLight.target.position.set(0, elevatedTableSurfaceY, 0);
    scene.add(fillLight);
    scene.add(fillLight.target);

    const rimLight = new THREE.DirectionalLight(0xaadfff, 0.9);
    rimLight.position.set(0, elevatedTableSurfaceY + lightLift * 1.2, -TABLE.h * 0.48);
    rimLight.target.position.set(0, elevatedTableSurfaceY, TABLE.h * 0.1);
    scene.add(rimLight);
    scene.add(rimLight.target);

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
      primeAudio();
      const t = e.touches ? e.touches[0] : e;
      const { x, z } = touchToXZ(t.clientX, t.clientY);
      you.position.set(x, 0, z);
    };

    renderer.domElement.addEventListener('pointerdown', primeAudio, {
      passive: true
    });
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
    const GOAL_RESET_DELAY = 1500;

    const servePuck = (towardTop = false) => {
      S.vel.set(0, 0, towardTop ? -SERVE_SPEED : SERVE_SPEED);
      playWhistle();
    };

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

    const reset = (towardTop = false, shouldServe = true) => {
      puck.position.set(0, PUCK_HEIGHT / 2, 0);
      S.vel.set(0, 0, 0);
      you.position.set(0, 0, TABLE.h * 0.42);
      aiMallet.position.set(0, 0, -TABLE.h * 0.36);
      if (shouldServe) {
        servePuck(towardTop);
      }
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
          const playerScored = atTop;
          const ended = recordGoal(playerScored);
          playGoal();
          S.vel.set(0, 0, 0);
          clearTimeout(restartTimeoutRef.current);
          if (!ended) {
            reset(!atBot, false);
            restartTimeoutRef.current = setTimeout(() => {
              servePuck(!atBot);
            }, GOAL_RESET_DELAY);
          }
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
      renderer.domElement.removeEventListener('pointerdown', primeAudio);
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

  useEffect(() => {
    const tableGroup = tableGroupRef.current;
    const anchors = fieldAnchorsRef.current;
    if (!tableGroup || !anchors) return undefined;

    const createCircleTexture = (image, fallbackLabel = '?') => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      const maskRadius = size / 2 - 6;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, maskRadius, 0, Math.PI * 2);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, 0, 0, size);
      gradient.addColorStop(0, '#0b1224');
      gradient.addColorStop(1, '#111827');
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.clip();
      if (image && image.width && image.height) {
        const cropSize = Math.min(image.width, image.height);
        const sx = (image.width - cropSize) / 2;
        const sy = (image.height - cropSize) / 2;
        ctx.drawImage(image, sx, sy, cropSize, cropSize, 0, 0, size, size);
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#e5e7eb';
        ctx.font = 'bold 220px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fallbackLabel, size / 2, size / 2 + 20);
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, maskRadius - 4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 10;
      ctx.stroke();
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      return texture;
    };

    const loadAvatarImage = (key, avatar, onReady) => {
      const url = getAvatarUrl(avatar) || '/assets/icons/profile.svg';
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => onReady(img, url);
      img.onerror = () => {
        if (url !== '/assets/icons/profile.svg') {
          loadAvatarImage(key, '/assets/icons/profile.svg', onReady);
          return;
        }
        onReady(null, url);
      };
      img.src = url;
    };

    const setAvatar = (key, avatar) => {
      const existing = avatarSpritesRef.current[key];
      if (existing) {
        tableGroup.remove(existing);
        existing.material.map?.dispose();
        existing.material.dispose();
        existing.geometry?.dispose();
      }
      loadAvatarImage(key, avatar, (image, url) => {
        const label = typeof avatar === 'string' ? avatar.slice(0, 2) : '?';
        const texture = createCircleTexture(image, label);
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: true,
          depthTest: true,
          side: THREE.DoubleSide
        });
        const geometry = new THREE.PlaneGeometry(anchors.size, anchors.size);
        const badge = new THREE.Mesh(geometry, material);
        const target = anchors[key];
        badge.position.set(target.x, target.y, target.z);
        badge.rotation.x = -Math.PI / 2;
        badge.renderOrder = -5;
        tableGroup.add(badge);
        avatarSpritesRef.current[key] = badge;
      });
    };

    setAvatar('player', player.avatar);
    setAvatar('ai', ai.avatar);

    return () => {
      ['player', 'ai'].forEach((key) => {
        const sprite = avatarSpritesRef.current[key];
        if (sprite) {
          tableGroup.remove(sprite);
          sprite.material.map?.dispose();
          sprite.material.dispose();
          sprite.geometry?.dispose();
          avatarSpritesRef.current[key] = null;
        }
      });
    };
  }, [player.avatar, ai.avatar, anchorsReady]);

  useEffect(() => {
    const mats = materialsRef.current;
    if (!mats.tableSurface) return;

    const fieldTheme = CUSTOMIZATION.field[selections.field] || CUSTOMIZATION.field[0];
    const tableTheme = CUSTOMIZATION.table[selections.table] || CUSTOMIZATION.table[0];
    const puckTheme = CUSTOMIZATION.puck[selections.puck] || CUSTOMIZATION.puck[0];
    const malletTheme = CUSTOMIZATION.mallet[selections.mallet] || CUSTOMIZATION.mallet[0];
    const railTheme = CUSTOMIZATION.rails[selections.rails] || CUSTOMIZATION.rails[0];
    const goalTheme = CUSTOMIZATION.goals[selections.goals] || CUSTOMIZATION.goals[0];

    mats.tableSurface.color.set(fieldTheme.surface);
    if (mats.line) mats.line.color.set(fieldTheme.lines);
    mats.rings.forEach((material) => material.color.set(fieldTheme.rings || fieldTheme.lines));
    if (mats.wood) mats.wood.color.set(tableTheme.wood);
    if (mats.darkWood) mats.darkWood.color.set(tableTheme.trim);
    if (mats.rail) {
      mats.rail.color.set(railTheme.color);
      mats.rail.opacity = railTheme.opacity;
    }
    if (mats.puck) {
      mats.puck.color.set(puckTheme.color);
      mats.puck.emissive.set(puckTheme.emissive);
      mats.puck.needsUpdate = true;
    }
    if (mats.playerMallet) mats.playerMallet.color.set(malletTheme.color);
    if (mats.aiMallet) mats.aiMallet.color.set(malletTheme.color);
    if (mats.playerKnob) mats.playerKnob.color.set(malletTheme.knob);
    if (mats.aiKnob) mats.aiKnob.color.set(malletTheme.knob);
    if (mats.goal) {
      mats.goal.color.set(goalTheme.color);
      mats.goal.emissive.set(goalTheme.emissive);
    }
  }, [selections]);

  const renderOptionRow = (label, key) => {
    const options = CUSTOMIZATION[key];
    return (
      <div className="space-y-1">
        <div className="text-[11px] uppercase tracking-wide text-white/70">{label}</div>
        <div className="grid grid-cols-2 gap-2">
          {options.map((option, idx) => {
            const swatch = option.surface || option.wood || option.color;
            const active = selections[key] === idx;
            return (
              <button
                key={`${key}-${option.name}`}
                onClick={() =>
                  setSelections((prev) => ({
                    ...prev,
                    [key]: idx
                  }))
                }
                className={`flex items-center justify-between rounded px-2 py-1 text-left text-[11px] font-semibold transition ${
                  active ? 'bg-white/20 text-white' : 'bg-white/5 text-white/80 hover:bg-white/10'
                }`}
              >
                <span className="truncate">{option.name}</span>
                <span
                  className="ml-2 w-5 h-5 rounded-full border border-white/30"
                  style={{ background: swatch }}
                />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

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
      <div className="absolute bottom-2 right-2 flex flex-col items-end space-y-2 z-20">
        <button
          onClick={() => setShowCustomizer((v) => !v)}
          className="rounded px-3 py-2 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 backdrop-blur"
        >
          <span className="inline-flex items-center gap-1">
            <span aria-hidden>⚙️</span>
            {showCustomizer ? 'Close customizer' : 'Customize table'}
          </span>
        </button>
        {showCustomizer && (
          <div className="w-72 max-h-[70vh] overflow-y-auto bg-black/70 border border-white/15 rounded-lg p-3 space-y-3 backdrop-blur">
            {renderOptionRow('Field', 'field')}
            {renderOptionRow('Table', 'table')}
            {renderOptionRow('Puck', 'puck')}
            {renderOptionRow('Mallets', 'mallet')}
            {renderOptionRow('Rails', 'rails')}
            {renderOptionRow('Goals', 'goals')}
          </div>
        )}
      </div>
      {goalPopup && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`text-center drop-shadow-[0_0_12px_rgba(0,0,0,0.9)] px-4 py-3 rounded-lg bg-black/50 border border-white/10 ${goalPopup.isPlayer ? 'text-emerald-200' : 'text-amber-200'}`}
          >
            <div className="text-4xl font-extrabold tracking-[0.2em] uppercase">Goal!</div>
            <div className="text-lg font-semibold mt-1">{goalPopup.scorer}</div>
            <div className="text-sm font-semibold mt-1">Score: {goalPopup.scoreLine}</div>
          </div>
        </div>
      )}
      {postPopup && !goalPopup && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-amber-200 text-3xl font-extrabold uppercase tracking-[0.15em] drop-shadow-[0_0_12px_rgba(0,0,0,0.9)] bg-black/50 border border-white/10 rounded-lg px-4 py-2">
            Post!
          </div>
        </div>
      )}
      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-center px-4">
          <div className="rounded-lg border border-white/10 bg-white/5 px-5 py-4 space-y-2 max-w-sm w-full">
            <div className="text-lg font-semibold">Game Over</div>
            <div className="text-sm font-medium">Winner: {winner}</div>
            <div className="text-xs text-white/80">Final Score: {scoreRef.current.left} - {scoreRef.current.right}</div>
            <div className="text-[11px] text-white/70">
              {redirecting ? 'Redirecting to the Air Hockey lobby...' : 'Preparing lobby return...'}
            </div>
            <div className="pt-2">
              <button
                onClick={() => (window.location.href = '/games/airhockey/lobby')}
                className="w-full rounded bg-emerald-500/90 hover:bg-emerald-500 text-black font-semibold py-2 text-sm"
              >
                Go to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
      {!gameOver && (
        <button
          onClick={() => (window.location.href = '/games/airhockey/lobby')}
          className="absolute left-2 bottom-2 text-white text-xs bg-white/10 hover:bg-white/20 rounded px-2 py-1"
        >
          Exit to Lobby
        </button>
      )}
    </div>
  );
}

