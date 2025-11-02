import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';

const doorSpacing = 9;
const hallwayHalfWidth = 6;
const ceilingHeight = hallwayHalfWidth;

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
    scene.background = new THREE.Color('#101015');

    const loader = new THREE.TextureLoader();

    const camera = new THREE.PerspectiveCamera(
      65,
      container.clientWidth / container.clientHeight,
      0.1,
      400
    );
    camera.position.set(0, 1.6, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';

    const ambient = new THREE.AmbientLight(0xfff4d6, 0.4);
    scene.add(ambient);

    const centerGlow = new THREE.PointLight(0xffd27a, 2.5, 40, 2);
    const corridorLength = Math.max(doorSpacing * (games.length + 2), 80);
    centerGlow.position.set(0, ceilingHeight - 0.2, -corridorLength / 2);
    scene.add(centerGlow);

    for (let i = 0; i < 12; i++) {
      const p = new THREE.PointLight(0xffb84d, 0.4, 18, 2);
      p.position.set(0, ceilingHeight - 0.3, -i * 8);
      scene.add(p);
    }

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 10, 2);
    scene.add(dirLight);

    const floorTex = loader.load('https://threejsfundamentals.org/threejs/resources/images/checker.png');
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(20, 40);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      color: '#aa0000',
      roughness: 0.8,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(hallwayHalfWidth * 2, corridorLength), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -corridorLength / 2);
    scene.add(floor);

    const wallTex = loader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/brick_diffuse.jpg');
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(20, 10);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.8 });

    const tunnelMat = wallMat.clone();
    tunnelMat.side = THREE.BackSide;
    const tunnelGeo = new THREE.CylinderGeometry(
      hallwayHalfWidth,
      hallwayHalfWidth,
      corridorLength,
      64,
      1,
      true,
      Math.PI,
      Math.PI
    );
    const tunnel = new THREE.Mesh(tunnelGeo, tunnelMat);
    tunnel.rotation.x = Math.PI / 2;
    tunnel.position.set(0, 0, -corridorLength / 2);
    scene.add(tunnel);

    const panelMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#ffffff',
      emissiveIntensity: 2,
      roughness: 0.4
    });
    for (let i = 0; i < 12; i++) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(2, 3), panelMat);
      panel.rotation.x = Math.PI / 2;
      panel.position.set(0, ceilingHeight - 0.05, -i * 8);
      scene.add(panel);
    }

    const doorTex = loader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/wood/oak_planks_diff_1k.jpg');
    const goldHandleMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1, roughness: 0.2 });
    const doorMat = new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.4, metalness: 0.2 });
    const doorGeo = new THREE.BoxGeometry(2.8, 3.4, 0.12);

    const interactable = [];
    let zPos = -5;

    games.forEach((game, index) => {
      const door = new THREE.Mesh(doorGeo, doorMat.clone());
      const sideX = index % 2 === 0 ? -hallwayHalfWidth + 0.1 : hallwayHalfWidth - 0.1;
      const openAngle = index % 2 === 0 ? Math.PI / 2 - 0.05 : -Math.PI / 2 + 0.05;
      door.position.set(sideX, 1.7, zPos);
      door.rotation.y = openAngle;
      door.userData = { type: 'door', route: game.route };
      scene.add(door);
      interactable.push(door);

      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 16), goldHandleMat);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(index % 2 === 0 ? 1.1 : -1.1, 1.3, 0.06);
      door.add(handle);

      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 1024;
      labelCanvas.height = 256;
      const ctx = labelCanvas.getContext('2d');
      ctx.fillStyle = '#FFEB3B';
      ctx.fillRect(0, 0, 1024, 256);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 16;
      ctx.strokeRect(8, 8, 1024 - 16, 256 - 16);
      ctx.font = 'bold 140px "Inter", Arial';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 20;
      ctx.strokeStyle = '#000000';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(game.name, 512, 128);
      ctx.fillText(game.name, 512, 128);

      const signTex = new THREE.CanvasTexture(labelCanvas);
      const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide, transparent: true });

      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.9), signMat);
      const signX = index % 2 === 0 ? -hallwayHalfWidth + 1.4 : hallwayHalfWidth - 1.4;
      sign.position.set(signX, 2.85, zPos);
      sign.rotation.y = index % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(sign);

      const screenCanvas = document.createElement('canvas');
      screenCanvas.width = 512;
      screenCanvas.height = 256;
      const sctx = screenCanvas.getContext('2d');
      sctx.fillStyle = '#021024';
      sctx.fillRect(0, 0, 512, 256);
      sctx.textAlign = 'center';
      sctx.textBaseline = 'middle';
      sctx.fillStyle = '#0affff';
      sctx.shadowColor = 'rgba(10, 255, 255, 0.75)';
      sctx.shadowBlur = 18;
      sctx.lineJoin = 'round';
      sctx.lineWidth = 6;
      sctx.strokeStyle = '#000000';
      sctx.font = 'bold 56px "Inter", Arial';
      sctx.strokeText(game.name, 256, 96);
      sctx.fillText(game.name, 256, 96);
      sctx.font = '32px "Inter", Arial';
      sctx.shadowBlur = 10;
      sctx.lineWidth = 4;
      sctx.strokeText('Tap to enter the game', 256, 178);
      sctx.fillStyle = '#9fffe8';
      sctx.fillText('Tap to enter the game', 256, 178);
      sctx.shadowBlur = 0;
      sctx.lineWidth = 8;
      sctx.strokeRect(6, 6, 512 - 12, 256 - 12);
      const screenTex = new THREE.CanvasTexture(screenCanvas);
      const screenMat = new THREE.MeshStandardMaterial({
        map: screenTex,
        emissive: '#00ffaa',
        emissiveIntensity: 1.2
      });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), screenMat);
      const monitorX = signX;
      screen.position.set(monitorX, 1.6, zPos);
      screen.rotation.y = index % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
      screen.userData = { type: 'monitor', game };
      scene.add(screen);
      interactable.push(screen);

      zPos -= doorSpacing;
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

    const minZ = -corridorLength + 12;
    const maxZ = 6;
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, minZ, maxZ);

    const pointerDown = { x: 0, y: 0 };
    const lastPointer = { x: 0, y: 0 };
    let isPointerDown = false;
    let isDragging = false;
    let targetYaw = 0;
    let targetZ = THREE.MathUtils.clamp(camera.position.z, minZ, maxZ);
    const minFov = 38;
    const maxFov = 80;
    let targetFov = THREE.MathUtils.clamp(camera.fov, minFov, maxFov);
    const yawLimit = Math.PI / 2.3;
    const dragThreshold = 6;
    const moveSensitivity = 0.05;
    const yawSensitivity = 0.0025;
    const movementStep = 9;
    const zoomStep = 3;

    const clampFov = (value) => THREE.MathUtils.clamp(value, minFov, maxFov);
    const adjustZoom = (delta) => {
      targetFov = clampFov(targetFov + delta);
    };

    const clampZ = (value) => THREE.MathUtils.clamp(value, minZ, maxZ);

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
      targetZ = clampZ(camera.position.z);
      targetYaw = THREE.MathUtils.clamp(camera.rotation.y, -yawLimit, yawLimit);
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
        targetYaw = THREE.MathUtils.clamp(targetYaw - dx * yawSensitivity, -yawLimit, yawLimit);
        const desiredZ = targetZ - dy * moveSensitivity;
        targetZ = clampZ(desiredZ);
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
      camera.position.z = clampZ(THREE.MathUtils.damp(camera.position.z, targetZ, 6, delta));
      camera.rotation.y = THREE.MathUtils.damp(camera.rotation.y, targetYaw, 6, delta);
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
        targetZ = clampZ(targetZ - movementStep);
      },
      moveBackward: () => {
        targetZ = clampZ(targetZ + movementStep);
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
    const action = direction === 'forward' ? 'moveForward' : 'moveBackward';
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
          <h3 className="text-lg font-semibold">TonPlaygram Gaming Hallway</h3>
          <p className="text-xs text-subtext">Tap a door to jump into the game lobby. Tap a monitor to preview lobby options.</p>
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
              onPointerDown={handlePointerHoldStart('backward')}
              onPointerUp={handlePointerHoldEnd}
              onPointerLeave={handlePointerHoldEnd}
              onPointerCancel={handlePointerHoldEnd}
              onClick={(event) => {
                if (event.detail === 0) {
                  controlsRef.current.moveBackward();
                }
              }}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-black/70 text-white shadow-xl backdrop-blur transition active:scale-95"
              aria-label="Walk backward"
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
              onPointerDown={handlePointerHoldStart('forward')}
              onPointerUp={handlePointerHoldEnd}
              onPointerLeave={handlePointerHoldEnd}
              onPointerCancel={handlePointerHoldEnd}
              onClick={(event) => {
                if (event.detail === 0) {
                  controlsRef.current.moveForward();
                }
              }}
              className="flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(255,215,0,0.35)] bg-gradient-to-br from-[#ffe27a] via-[#ffd141] to-[#ffb347] text-black shadow-[0_12px_30px_rgba(255,174,0,0.35)] transition active:scale-95"
              aria-label="Walk forward"
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
