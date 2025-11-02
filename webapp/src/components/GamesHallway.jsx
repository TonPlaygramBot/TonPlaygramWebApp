import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';

const lobbyRadius = 11;
const doorRingRadius = lobbyRadius - 0.9;
const ceilingHeight = 6;
function drawMonitorScreen(canvas, game) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const bezelGradient = ctx.createLinearGradient(0, 0, width, height);
  bezelGradient.addColorStop(0, '#080808');
  bezelGradient.addColorStop(1, '#0f0f0f');
  ctx.fillStyle = bezelGradient;
  ctx.fillRect(0, 0, width, height);

  const glowGradient = ctx.createLinearGradient(0, 0, width, height);
  glowGradient.addColorStop(0, 'rgba(30, 30, 30, 0.85)');
  glowGradient.addColorStop(1, 'rgba(6, 6, 6, 0.95)');
  ctx.fillStyle = glowGradient;
  ctx.fillRect(32, 24, width - 64, height - 48);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 60px "Inter", Arial';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#111111';
  ctx.strokeText(game.name, width / 2, height / 2 - 18);
  ctx.fillStyle = '#ededed';
  ctx.fillText(game.name, width / 2, height / 2 - 18);

  ctx.font = '34px "Inter", Arial';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#141414';
  ctx.strokeText('Tap to preview the lobby', width / 2, height / 2 + 68);
  ctx.fillStyle = '#d7d7d7';
  ctx.fillText('Tap to preview the lobby', width / 2, height / 2 + 68);
}

function useBodyScrollLock(isLocked) {
  useEffect(() => {
    if (isLocked) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
    return undefined;
  }, [isLocked]);
}

export default function GamesHallway({ games, onClose }) {
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const [selectedGame, setSelectedGame] = useState(null);
  const overlayRootRef = useRef(null);
  const controlsRef = useRef({
    moveForward: () => {},
    moveBackward: () => {},
    zoomIn: () => {},
    zoomOut: () => {}
  });
  const holdIntervalRef = useRef(null);

  useEffect(() => {
    if (!overlayRootRef.current) {
      let root = document.getElementById('hallway-overlay-root');
      if (!root) {
        root = document.createElement('div');
        root.id = 'hallway-overlay-root';
        document.body.appendChild(root);
      }
      overlayRootRef.current = root;
    }
  }, []);

  useBodyScrollLock(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#05060f');

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    const camera = new THREE.PerspectiveCamera(
      65,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );
    camera.position.set(0, 1.6, 0);
    const defaultLookAt = new THREE.Vector3(0, 1.6, -1.2);
    camera.lookAt(defaultLookAt);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.physicallyCorrectLights = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';

    const ambient = new THREE.AmbientLight(0xfff4d6, 0.6);
    scene.add(ambient);

    const hemiLight = new THREE.HemisphereLight(0xfff8e7, 0x0a0d21, 0.45);
    scene.add(hemiLight);

    const centerGlow = new THREE.PointLight(0xffd27a, 3.8, 65, 1.6);
    centerGlow.position.set(0, ceilingHeight - 0.3, 0);
    scene.add(centerGlow);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.65);
    dirLight.position.set(6, 12, 4);
    scene.add(dirLight);

    const floorTex = loader.load(
      'https://images.unsplash.com/photo-1591083832398-8829a66b8125?auto=format&fit=crop&w=1600&q=80'
    );
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(6, 6);
    floorTex.colorSpace = THREE.SRGBColorSpace;
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.3,
      metalness: 0.25
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(lobbyRadius, 72), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({
      color: '#bcdfff',
      roughness: 0.32,
      metalness: 0.12,
      emissive: '#a3d1ff',
      emissiveIntensity: 0.08,
      side: THREE.BackSide
    });
    const walls = new THREE.Mesh(new THREE.CylinderGeometry(lobbyRadius, lobbyRadius, ceilingHeight, 96, 1, true), wallMat);
    walls.position.y = ceilingHeight / 2;
    walls.receiveShadow = true;
    scene.add(walls);

    const ceilingMat = new THREE.MeshStandardMaterial({
      color: '#10131f',
      roughness: 0.28,
      metalness: 0.55,
      emissive: '#0f1526',
      emissiveIntensity: 0.18
    });
    const ceiling = new THREE.Mesh(new THREE.CircleGeometry(lobbyRadius, 72), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = ceilingHeight;
    scene.add(ceiling);

    const ceilingLights = new THREE.Group();
    const trackMaterial = new THREE.MeshStandardMaterial({
      color: '#1a2132',
      roughness: 0.48,
      metalness: 0.76
    });
    const lightMaterial = new THREE.MeshStandardMaterial({
      color: '#f1f6ff',
      emissive: '#f6fbff',
      emissiveIntensity: 1.65,
      roughness: 0.18
    });
    const lightBarGeometry = new THREE.PlaneGeometry(3.8, 0.58);
    const trackRing = new THREE.Mesh(
      new THREE.TorusGeometry(lobbyRadius - 1.1, 0.06, 24, 128),
      trackMaterial
    );
    trackRing.rotation.x = Math.PI / 2;
    trackRing.position.y = ceilingHeight - 0.18;
    ceilingLights.add(trackRing);

    const lightSegments = 8;
    for (let i = 0; i < lightSegments; i += 1) {
      const angle = (i / lightSegments) * Math.PI * 2;
      const radius = lobbyRadius - 1.4;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const lightPanel = new THREE.Mesh(lightBarGeometry, lightMaterial);
      lightPanel.position.set(x, ceilingHeight - 0.1, z);
      lightPanel.rotation.x = Math.PI / 2;
      lightPanel.lookAt(0, ceilingHeight - 0.1, 0);
      ceilingLights.add(lightPanel);

      const downLight = new THREE.SpotLight(0xf5f8ff, 1.35, 22, Math.PI / 4, 0.4, 1.8);
      downLight.castShadow = true;
      downLight.position.set(x, ceilingHeight - 0.05, z);
      downLight.target.position.set(x * 0.6, 0.4, z * 0.6);
      scene.add(downLight.target);
      ceilingLights.add(downLight);
    }
    scene.add(ceilingLights);

    const centerRing = new THREE.Mesh(
      new THREE.TorusGeometry(lobbyRadius - 2, 0.12, 16, 128),
      new THREE.MeshStandardMaterial({ color: '#ffd45e', emissive: '#f5c86b', emissiveIntensity: 0.42, roughness: 0.35 })
    );
    centerRing.rotation.x = Math.PI / 2;
    centerRing.position.y = 0.02;
    scene.add(centerRing);

    const carpet = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 72),
      new THREE.MeshStandardMaterial({
        color: '#a30e2d',
        emissive: '#320207',
        emissiveIntensity: 0.08,
        roughness: 0.58,
        metalness: 0.12
      })
    );
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = 0.021;
    scene.add(carpet);

    const baseboard = new THREE.Mesh(
      new THREE.CylinderGeometry(lobbyRadius - 0.15, lobbyRadius - 0.15, 0.35, 128, 1, true),
      new THREE.MeshStandardMaterial({ color: '#1a1a2d', metalness: 0.4, roughness: 0.45, side: THREE.DoubleSide })
    );
    baseboard.position.y = 0.17;
    scene.add(baseboard);

    const coveLight = new THREE.Mesh(
      new THREE.TorusGeometry(lobbyRadius - 1.2, 0.06, 16, 128),
      new THREE.MeshBasicMaterial({ color: '#ffe7a3' })
    );
    coveLight.rotation.x = Math.PI / 2;
    coveLight.position.y = ceilingHeight - 0.25;
    scene.add(coveLight);

    const playerPad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 0.2, 48),
      new THREE.MeshStandardMaterial({ color: '#0f111f', metalness: 0.25, roughness: 0.6 })
    );
    playerPad.position.y = 0.1;
    scene.add(playerPad);

    const playerGlow = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 48),
      new THREE.MeshBasicMaterial({ color: '#ffd45e', transparent: true, opacity: 0.22 })
    );
    playerGlow.rotation.x = -Math.PI / 2;
    playerGlow.position.y = 0.01;
    scene.add(playerGlow);

    const doorDimensions = { width: 2.8, height: 3.35, depth: 0.16 };
    const frameThickness = 0.22;
    const railThickness = 0.16;
    const doorFrameMaterial = new THREE.MeshStandardMaterial({
      color: '#1f2b3a',
      metalness: 0.92,
      roughness: 0.24
    });
    const doorAccentMaterial = new THREE.MeshStandardMaterial({
      color: '#31435a',
      metalness: 0.78,
      roughness: 0.18
    });
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: '#d8ecff',
      metalness: 0.05,
      roughness: 0.08,
      transmission: 0.92,
      thickness: 0.18,
      envMapIntensity: 0.85,
      clearcoat: 0.5,
      clearcoatRoughness: 0.08
    });
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: '#f0d284',
      metalness: 1,
      roughness: 0.22,
      emissive: '#fce79c',
      emissiveIntensity: 0.18
    });

    const interactable = [];
    const rotationStep = THREE.MathUtils.degToRad(18);
    const doorCount = Math.max(games.length, 1);

    games.forEach((game, index) => {
      const angle = (index / doorCount) * Math.PI * 2;
      const x = Math.cos(angle) * doorRingRadius;
      const z = Math.sin(angle) * doorRingRadius;

      const doorGroup = new THREE.Group();
      doorGroup.position.set(x, 0, z);
      doorGroup.lookAt(0, 1.7, 0);
      doorGroup.rotateY(Math.PI);

      const door = new THREE.Group();
      door.position.set(0, 1.7, 0.02);
      door.userData = { type: 'door', route: game.route };

      const frameGroup = new THREE.Group();
      const verticalGeo = new THREE.BoxGeometry(frameThickness, doorDimensions.height, doorDimensions.depth);
      const horizontalGeo = new THREE.BoxGeometry(doorDimensions.width, frameThickness, doorDimensions.depth);

      const leftFrame = new THREE.Mesh(verticalGeo, doorFrameMaterial);
      leftFrame.position.set(-doorDimensions.width / 2 + frameThickness / 2, 0, 0);
      leftFrame.castShadow = true;
      leftFrame.receiveShadow = true;
      frameGroup.add(leftFrame);

      const rightFrame = leftFrame.clone();
      rightFrame.position.x = doorDimensions.width / 2 - frameThickness / 2;
      frameGroup.add(rightFrame);

      const topFrame = new THREE.Mesh(horizontalGeo, doorFrameMaterial);
      topFrame.position.set(0, doorDimensions.height / 2 - frameThickness / 2, 0);
      topFrame.castShadow = true;
      topFrame.receiveShadow = true;
      frameGroup.add(topFrame);

      const bottomFrame = new THREE.Mesh(horizontalGeo, doorFrameMaterial);
      bottomFrame.position.set(0, -doorDimensions.height / 2 + frameThickness / 2, 0);
      bottomFrame.castShadow = true;
      bottomFrame.receiveShadow = true;
      frameGroup.add(bottomFrame);

      const midRail = new THREE.Mesh(
        new THREE.BoxGeometry(doorDimensions.width - frameThickness * 1.6, railThickness, doorDimensions.depth * 0.9),
        doorAccentMaterial
      );
      midRail.position.set(0, -0.2, 0);
      midRail.castShadow = true;
      midRail.receiveShadow = true;
      frameGroup.add(midRail);

      const upperRail = midRail.clone();
      upperRail.scale.y = 0.6;
      upperRail.position.y = 0.85;
      frameGroup.add(upperRail);

      door.add(frameGroup);

      const glassPanel = new THREE.Mesh(
        new THREE.BoxGeometry(
          doorDimensions.width - frameThickness * 2.2,
          doorDimensions.height - frameThickness * 2.4,
          doorDimensions.depth * 0.3
        ),
        glassMaterial
      );
      glassPanel.position.set(0, 0.1, 0.01);
      glassPanel.castShadow = false;
      glassPanel.receiveShadow = false;
      door.add(glassPanel);

      const handlePlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.48, 0.05),
        doorAccentMaterial
      );
      handlePlate.position.set(doorDimensions.width / 2 - frameThickness * 1.1, 0.05, doorDimensions.depth / 2 + 0.005);
      door.add(handlePlate);

      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.36, 28), handleMaterial);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(doorDimensions.width / 2 - frameThickness * 1.1, 0.05, doorDimensions.depth / 2 + 0.08);
      handle.castShadow = true;
      door.add(handle);

      doorGroup.add(door);
      interactable.push(door);

      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 2048;
      labelCanvas.height = 512;
      const ctx = labelCanvas.getContext('2d');
      ctx.fillStyle = '#111525';
      ctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
      const frameGradient = ctx.createLinearGradient(0, 0, labelCanvas.width, 0);
      frameGradient.addColorStop(0, '#4b6ea3');
      frameGradient.addColorStop(0.5, '#8fb5ff');
      frameGradient.addColorStop(1, '#4b6ea3');
      ctx.strokeStyle = frameGradient;
      ctx.lineWidth = 48;
      ctx.lineJoin = 'round';
      ctx.strokeRect(36, 36, labelCanvas.width - 72, labelCanvas.height - 72);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let fontSize = 340;
      const maxWidth = labelCanvas.width - 460;
      do {
        ctx.font = `bold ${fontSize}px "Inter", Arial`;
        fontSize -= 6;
      } while (fontSize > 96 && ctx.measureText(game.name).width > maxWidth);
      ctx.lineWidth = 40;
      ctx.strokeStyle = '#03040a';
      ctx.strokeText(game.name, labelCanvas.width / 2, labelCanvas.height / 2 + 12);
      ctx.fillStyle = '#f7fbff';
      ctx.fillText(game.name, labelCanvas.width / 2, labelCanvas.height / 2 + 12);

      const signTex = new THREE.CanvasTexture(labelCanvas);
      signTex.colorSpace = THREE.SRGBColorSpace;
      const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide });

      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.45), signMat);
      sign.position.set(0, 2.28, doorDimensions.depth / 2 + 0.08);
      sign.rotation.y = Math.PI;
      door.add(sign);

      const screenCanvas = document.createElement('canvas');
      screenCanvas.width = 512;
      screenCanvas.height = 256;
      drawMonitorScreen(screenCanvas, game);
      const screenTex = new THREE.CanvasTexture(screenCanvas);
      screenTex.colorSpace = THREE.SRGBColorSpace;
      const screenMat = new THREE.MeshStandardMaterial({
        map: screenTex,
        emissive: '#0a0a0a',
        emissiveIntensity: 0.18
      });

      const infoRadius = doorRingRadius - 2.4;
      const infoGroup = new THREE.Group();
      infoGroup.position.set(Math.cos(angle) * infoRadius, 0, Math.sin(angle) * infoRadius);
      infoGroup.lookAt(0, 1.4, 0);

      const tableBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 0.95, 0.22, 36),
        new THREE.MeshStandardMaterial({ color: '#0b0b0f', roughness: 0.7, metalness: 0.25 })
      );
      tableBase.position.y = 0.11;
      infoGroup.add(tableBase);

      const tableSurface = new THREE.Mesh(
        new THREE.CylinderGeometry(0.82, 0.82, 0.08, 36),
        new THREE.MeshStandardMaterial({ color: '#ffe55a', roughness: 0.6, metalness: 0.18 })
      );
      tableSurface.position.y = 0.25;
      infoGroup.add(tableSurface);

      const tableRim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.84, 0.84, 0.1, 36, 1, true),
        new THREE.MeshStandardMaterial({ color: '#000000', metalness: 0.35, roughness: 0.5, side: THREE.DoubleSide })
      );
      tableRim.position.y = 0.25;
      infoGroup.add(tableRim);

      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), screenMat);
      screen.position.set(0, 1.55, 0);
      infoGroup.add(screen);
      screen.userData = { type: 'monitor', game };
      interactable.push(screen);

      const doorLight = new THREE.PointLight(0xffe49a, 1.6, 14, 2.2);
      doorLight.position.set(Math.cos(angle) * (doorRingRadius - 0.2), 3.4, Math.sin(angle) * (doorRingRadius - 0.2));
      scene.add(doorLight);

      scene.add(doorGroup);
      scene.add(infoGroup);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handleInteraction = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(interactable, true);
      if (intersects.length > 0) {
        const { type, route, game } = intersects[0].object.userData;
        if (type === 'door' && route) {
          navigate(route);
        } else if (type === 'monitor' && game) {
          setSelectedGame(game);
        }
      }
    };

    const pointerDown = { x: 0, y: 0 };
    const lastPointer = { x: 0, y: 0 };
    let isPointerDown = false;
    let isDragging = false;
    let targetYaw = camera.rotation.y;
    const defaultPitch = camera.rotation.x;
    let targetPitch = defaultPitch;
    const minFov = 38;
    const maxFov = 80;
    let targetFov = THREE.MathUtils.clamp(camera.fov, minFov, maxFov);
    const dragThreshold = 6;
    const yawSensitivity = 0.003;
    const zoomStep = 3;

    const clampFov = (value) => THREE.MathUtils.clamp(value, minFov, maxFov);
    const adjustZoom = (delta) => {
      targetFov = clampFov(targetFov + delta);
    };

    const wrapYaw = (value) => {
      const fullRotation = Math.PI * 2;
      let next = value % fullRotation;
      if (next > Math.PI) {
        next -= fullRotation;
      } else if (next < -Math.PI) {
        next += fullRotation;
      }
      return next;
    };

    const activePointers = new Map();
    let isTouchZoom = false;
    let lastPinchDistance = null;

    const updateTouchPointer = (event) => {
      if (event.pointerType !== 'touch') return;
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activePointers.size === 2) {
        const [first, second] = [...activePointers.values()];
        const dx = first.x - second.x;
        const dy = first.y - second.y;
        lastPinchDistance = Math.hypot(dx, dy);
        isTouchZoom = true;
        isDragging = false;
      }
    };

    const handlePointerDown = (event) => {
      updateTouchPointer(event);
      isPointerDown = true;
      isDragging = false;
      targetYaw = wrapYaw(camera.rotation.y);
      targetPitch = defaultPitch;
      pointerDown.x = event.clientX;
      pointerDown.y = event.clientY;
      lastPointer.x = event.clientX;
      lastPointer.y = event.clientY;
      renderer.domElement.setPointerCapture?.(event.pointerId);
    };

    const handlePointerMove = (event) => {
      if (event.pointerType === 'touch') {
        updateTouchPointer(event);
        if (isTouchZoom && activePointers.size >= 2) {
          const [first, second] = [...activePointers.values()];
          const dx = first.x - second.x;
          const dy = first.y - second.y;
          const distance = Math.hypot(dx, dy);
          if (lastPinchDistance) {
            const pinchDelta = (lastPinchDistance - distance) * 0.05;
            adjustZoom(pinchDelta);
          }
          lastPinchDistance = distance;
          return;
        }
      }

      if (!isPointerDown) return;

      const dx = event.clientX - lastPointer.x;

      if (!isDragging) {
        const totalDx = event.clientX - pointerDown.x;
        const totalDy = event.clientY - pointerDown.y;
        if (Math.hypot(totalDx, totalDy) > dragThreshold) {
          isDragging = true;
        }
      }

      if (isDragging) {
        targetYaw = wrapYaw(targetYaw - dx * yawSensitivity);
        targetPitch = defaultPitch;
      }

      lastPointer.x = event.clientX;
      lastPointer.y = event.clientY;
    };

    const handlePointerUp = (event) => {
      if (event.pointerType === 'touch') {
        activePointers.delete(event.pointerId);
        if (activePointers.size < 2) {
          isTouchZoom = false;
          lastPinchDistance = null;
        }
      }
      if (!isPointerDown) return;
      renderer.domElement.releasePointerCapture?.(event.pointerId);
      isPointerDown = false;
      if (!isDragging) {
        handleInteraction(event);
      }
    };

    const handlePointerLeave = (event) => {
      if (event.pointerType === 'touch') {
        activePointers.delete(event.pointerId);
        if (activePointers.size < 2) {
          isTouchZoom = false;
          lastPinchDistance = null;
        }
      }
      if (!isPointerDown) return;
      renderer.domElement.releasePointerCapture?.(event.pointerId);
      isPointerDown = false;
    };

    const handlePointerCancel = (event) => {
      renderer.domElement.releasePointerCapture?.(event.pointerId);
      activePointers.delete(event.pointerId);
      if (activePointers.size < 2) {
        isTouchZoom = false;
        lastPinchDistance = null;
      }
      isPointerDown = false;
    };

    const handleWheel = (event) => {
      event.preventDefault();
      const delta = event.deltaY * 0.015;
      adjustZoom(delta);
    };

    const handleLostPointerCapture = (event) => {
      activePointers.delete(event.pointerId);
      if (activePointers.size < 2) {
        isTouchZoom = false;
        lastPinchDistance = null;
      }
      isPointerDown = false;
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
    renderer.domElement.addEventListener('pointercancel', handlePointerCancel);
    renderer.domElement.addEventListener('lostpointercapture', handleLostPointerCapture);
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });

    let animationId;
    const clock = new THREE.Clock();
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      camera.rotation.y = THREE.MathUtils.damp(camera.rotation.y, targetYaw, 6, delta);
      camera.rotation.x = THREE.MathUtils.damp(camera.rotation.x, targetPitch, 6, delta);
      const nextFov = THREE.MathUtils.damp(camera.fov, targetFov, 8, delta);
      if (Math.abs(nextFov - camera.fov) > 0.001) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
    };
    animate();

    controlsRef.current = {
      moveForward: () => {
        targetYaw = wrapYaw(targetYaw + rotationStep);
      },
      moveBackward: () => {
        targetYaw = wrapYaw(targetYaw - rotationStep);
      },
      zoomIn: () => {
        adjustZoom(-zoomStep);
      },
      zoomOut: () => {
        adjustZoom(zoomStep);
      }
    };

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      controlsRef.current = {
        moveForward: () => {},
        moveBackward: () => {},
        zoomIn: () => {},
        zoomOut: () => {}
      };
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      renderer.domElement.removeEventListener('pointercancel', handlePointerCancel);
      renderer.domElement.removeEventListener('lostpointercapture', handleLostPointerCapture);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
      scene.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose?.();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose?.());
            } else {
              child.material.dispose?.();
            }
          }
        }
        if (child.material?.map) {
          child.material.map.dispose?.();
        }
      });
    };
  }, [games, navigate]);

  const handlePointerHoldStart = (direction) => (event) => {
    event.preventDefault();
    const action = direction === 'clockwise' ? 'moveForward' : 'moveBackward';
    controlsRef.current[action]?.();
    if (holdIntervalRef.current) return;
    holdIntervalRef.current = setInterval(() => {
      controlsRef.current[action]?.();
    }, 180);
  };

  const handleZoomPress = (direction) => {
    const action = direction === 'in' ? 'zoomIn' : 'zoomOut';
    controlsRef.current[action]?.();
  };

  const handlePointerHoldEnd = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) {
        clearInterval(holdIntervalRef.current);
        holdIntervalRef.current = null;
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3 text-text">
        <div>
          <h3 className="text-lg font-semibold">TonPlaygram Circular Lobby</h3>
          <p className="text-xs text-subtext">Doors surround you in the lobby. Tap a door to enter the game or a monitor to preview its lobby options.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
        >
          Close
        </button>
      </div>
      <div className="relative flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end">
          <div className="pointer-events-auto mx-auto mb-8 flex w-full max-w-[320px] flex-wrap items-center justify-center gap-5 px-6">
            <button
              type="button"
              onPointerDown={handlePointerHoldStart('counterclockwise')}
              onPointerUp={handlePointerHoldEnd}
              onPointerLeave={handlePointerHoldEnd}
              onPointerCancel={handlePointerHoldEnd}
              onClick={(event) => {
                if (event.detail === 0) {
                  controlsRef.current.moveBackward();
                }
              }}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-black/70 text-white shadow-xl backdrop-blur transition active:scale-95"
              aria-label="Rotate left"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-6 w-6"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <button
              type="button"
              onPointerDown={handlePointerHoldStart('clockwise')}
              onPointerUp={handlePointerHoldEnd}
              onPointerLeave={handlePointerHoldEnd}
              onPointerCancel={handlePointerHoldEnd}
              onClick={(event) => {
                if (event.detail === 0) {
                  controlsRef.current.moveForward();
                }
              }}
              className="flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(255,215,0,0.35)] bg-gradient-to-br from-[#ffe27a] via-[#ffd141] to-[#ffb347] text-black shadow-[0_12px_30px_rgba(255,174,0,0.35)] transition active:scale-95"
              aria-label="Rotate right"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-7 w-7"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
              </svg>
            </button>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => handleZoomPress('out')}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/70 text-white shadow-lg backdrop-blur transition active:scale-95"
                aria-label="Zoom out"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" d="M5 12h14" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => handleZoomPress('in')}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(255,215,0,0.4)] bg-gradient-to-br from-[#ffe27a] via-[#ffd141] to-[#ffb347] text-black shadow-[0_10px_24px_rgba(255,174,0,0.35)] transition active:scale-95"
                aria-label="Zoom in"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" d="M12 5v14" />
                  <path strokeLinecap="round" d="M5 12h14" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      {selectedGame && overlayRootRef.current &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-black/95 px-6 text-center text-text">
            <div className="space-y-6">
              <h4 className="text-2xl font-bold">{selectedGame.name}</h4>
              <p className="text-sm text-subtext">
                Ready to enter the lobby? Choose how you want to continue below.
              </p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    navigate(selectedGame.route);
                    setSelectedGame(null);
                  }}
                  className="w-full rounded-full bg-primary px-6 py-3 text-base font-semibold text-black"
                >
                  Enter Lobby
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedGame(null)}
                  className="w-full rounded-full border border-border px-6 py-3 text-base font-semibold"
                >
                  Back to Hallway
                </button>
              </div>
            </div>
          </div>,
          overlayRootRef.current
        )}
    </div>
  );
}
