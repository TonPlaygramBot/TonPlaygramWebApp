import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';

const lobbyRadius = 11;
const doorRingRadius = lobbyRadius - 1.6;
const ceilingHeight = 6;

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
    scene.background = new THREE.Color('#0c0d18');

    const loader = new THREE.TextureLoader();

    const camera = new THREE.PerspectiveCamera(
      65,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );
    camera.position.set(0, 1.6, 0);
    camera.lookAt(new THREE.Vector3(0, 1.6, -1));

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';

    const ambient = new THREE.AmbientLight(0xfff4d6, 0.45);
    scene.add(ambient);

    const centerGlow = new THREE.PointLight(0xffd27a, 3.4, 60, 2);
    centerGlow.position.set(0, ceilingHeight - 0.4, 0);
    scene.add(centerGlow);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.55);
    dirLight.position.set(6, 12, 4);
    scene.add(dirLight);

    const floorTex = loader.load('https://threejsfundamentals.org/threejs/resources/images/checker.png');
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(8, 8);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      color: '#20223f',
      roughness: 0.85,
      metalness: 0.08
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(lobbyRadius, 72), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const wallTex = loader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/brick_diffuse.jpg');
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(12, 3);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.75, side: THREE.BackSide });
    const walls = new THREE.Mesh(new THREE.CylinderGeometry(lobbyRadius, lobbyRadius, ceilingHeight, 96, 1, true), wallMat);
    walls.position.y = ceilingHeight / 2;
    walls.receiveShadow = true;
    scene.add(walls);

    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xfff4d6, roughness: 0.45 });
    const ceiling = new THREE.Mesh(new THREE.CircleGeometry(lobbyRadius, 72), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = ceilingHeight;
    scene.add(ceiling);

    const centerRing = new THREE.Mesh(
      new THREE.TorusGeometry(lobbyRadius - 2, 0.12, 16, 128),
      new THREE.MeshStandardMaterial({ color: '#ffd45e', emissive: '#c48a16', emissiveIntensity: 0.35, roughness: 0.4 })
    );
    centerRing.rotation.x = Math.PI / 2;
    centerRing.position.y = 0.02;
    scene.add(centerRing);

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

    const doorTex = loader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/wood/oak_planks_diff_1k.jpg');
    const goldHandleMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1, roughness: 0.2 });
    const doorMat = new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.4, metalness: 0.2 });
    const doorGeo = new THREE.BoxGeometry(2.8, 3.4, 0.12);

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

      const door = new THREE.Mesh(doorGeo, doorMat.clone());
      door.position.set(0, 1.7, 0.06);
      door.castShadow = true;
      door.receiveShadow = true;
      door.userData = { type: 'door', route: game.route };
      doorGroup.add(door);
      interactable.push(door);

      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 16), goldHandleMat);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(1.05, 1.3, 0);
      door.add(handle);

      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 1024;
      labelCanvas.height = 256;
      const ctx = labelCanvas.getContext('2d');
      ctx.fillStyle = '#ffe55a';
      ctx.fillRect(0, 0, 1024, 256);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 32;
      ctx.strokeRect(16, 16, 1024 - 32, 256 - 32);
      ctx.font = 'bold 140px "Inter", Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 22;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(game.name, 512, 128);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillText(game.name, 512, 128);

      const signTex = new THREE.CanvasTexture(labelCanvas);
      const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide, transparent: true });

      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.1), signMat);
      sign.position.set(0, 3.3, 0.08);
      doorGroup.add(sign);

      const screenCanvas = document.createElement('canvas');
      screenCanvas.width = 512;
      screenCanvas.height = 256;
      const sctx = screenCanvas.getContext('2d');
      sctx.fillStyle = '#021024';
      sctx.fillRect(0, 0, 512, 256);
      sctx.strokeStyle = '#000000';
      sctx.lineWidth = 12;
      sctx.strokeRect(6, 6, 512 - 12, 256 - 12);
      sctx.textAlign = 'center';
      sctx.textBaseline = 'middle';
      sctx.font = 'bold 56px "Inter", Arial';
      sctx.lineJoin = 'round';
      sctx.strokeStyle = '#000000';
      sctx.lineWidth = 10;
      sctx.strokeText(game.name, 256, 96);
      sctx.fillStyle = '#0affff';
      sctx.fillText(game.name, 256, 96);
      sctx.font = '32px "Inter", Arial';
      sctx.lineWidth = 6;
      sctx.strokeText('Tap to enter the game', 256, 178);
      sctx.fillStyle = '#9fffe8';
      sctx.fillText('Tap to enter the game', 256, 178);
      const screenTex = new THREE.CanvasTexture(screenCanvas);
      const screenMat = new THREE.MeshStandardMaterial({
        map: screenTex,
        emissive: '#00ffaa',
        emissiveIntensity: 1.1
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
      const intersects = raycaster.intersectObjects(interactable, false);
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
    let targetPitch = camera.rotation.x;
    const minFov = 38;
    const maxFov = 80;
    let targetFov = THREE.MathUtils.clamp(camera.fov, minFov, maxFov);
    const dragThreshold = 6;
    const yawSensitivity = 0.003;
    const pitchSensitivity = 0.0025;
    const pitchLimit = Math.PI / 4;
    const zoomStep = 3;

    const clampFov = (value) => THREE.MathUtils.clamp(value, minFov, maxFov);
    const adjustZoom = (delta) => {
      targetFov = clampFov(targetFov + delta);
    };

    const clampPitch = (value) => THREE.MathUtils.clamp(value, -pitchLimit, pitchLimit);
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
      targetPitch = clampPitch(camera.rotation.x);
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
      const dy = event.clientY - lastPointer.y;

      if (!isDragging) {
        const totalDx = event.clientX - pointerDown.x;
        const totalDy = event.clientY - pointerDown.y;
        if (Math.hypot(totalDx, totalDy) > dragThreshold) {
          isDragging = true;
        }
      }

      if (isDragging) {
        targetYaw = wrapYaw(targetYaw - dx * yawSensitivity);
        targetPitch = clampPitch(targetPitch - dy * pitchSensitivity);
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
