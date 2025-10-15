import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const DPR_CAP = 1.75;
const DIE_SIZE = 1;
const DICE_RADIUS = 0.12;
const DICE_SEGMENTS = 6;
const GOLD_COLOR = 0xffd700;
const BACKGROUND_COLOR = 0x0b0f1a;

const orientationMap = (() => {
  const map = {};
  map[1] = new THREE.Quaternion();
  map[2] = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  map[3] = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2));
  map[4] = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
  map[5] = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  map[6] = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0));
  return map;
})();

function placePips(group, pipMaterial, geometrySet) {
  const pipRadius = 0.09;
  const pipDepth = 0.08;
  const pipGeo = new THREE.CylinderGeometry(pipRadius, pipRadius, pipDepth, 28, 1);
  const surface = DIE_SIZE / 2;
  const embedOffset = 0.0025;
  const centerOffset = surface - pipDepth / 2 + embedOffset;
  const faceDefinitions = [
    { normal: new THREE.Vector3(0, 1, 0), points: [[0, 0]] },
    {
      normal: new THREE.Vector3(0, 0, 1),
      points: [
        [-0.3, -0.3],
        [0.3, 0.3]
      ]
    },
    {
      normal: new THREE.Vector3(1, 0, 0),
      points: [
        [-0.3, -0.3],
        [0, 0],
        [0.3, 0.3]
      ]
    },
    {
      normal: new THREE.Vector3(-1, 0, 0),
      points: [
        [-0.3, -0.3],
        [-0.3, 0.3],
        [0.3, -0.3],
        [0.3, 0.3]
      ]
    },
    {
      normal: new THREE.Vector3(0, 0, -1),
      points: [
        [-0.3, -0.3],
        [-0.3, 0.3],
        [0, 0],
        [0.3, -0.3],
        [0.3, 0.3]
      ]
    },
    {
      normal: new THREE.Vector3(0, -1, 0),
      points: [
        [-0.3, -0.3],
        [-0.3, 0],
        [-0.3, 0.3],
        [0.3, -0.3],
        [0.3, 0],
        [0.3, 0.3]
      ]
    }
  ];

  const up = new THREE.Vector3(0, 1, 0);
  faceDefinitions.forEach(({ normal, points }) => {
    const n = normal.clone().normalize();
    const referenceUp = Math.abs(n.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const x = new THREE.Vector3().crossVectors(referenceUp, n).normalize();
    const y = new THREE.Vector3().crossVectors(n, x).normalize();
    points.forEach(([gx, gy]) => {
      const mesh = new THREE.Mesh(pipGeo, pipMaterial);
      mesh.position
        .copy(new THREE.Vector3())
        .addScaledVector(x, gx)
        .addScaledVector(y, gy)
        .addScaledVector(n, centerOffset);
      mesh.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(up, n));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      geometrySet?.add(mesh.geometry);
    });
  });
}

export default function LuxuryDice({
  value = 1,
  rolling = false,
  size = 120,
  transparent = false
}) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const diceGroupRef = useRef(null);
  const animationRef = useRef(null);
  const controlsRef = useRef(null);
  const pmremRef = useRef(null);
  const envTargetRef = useRef(null);
  const pipGeometrySetRef = useRef(new Set());
  const targetQuaternionRef = useRef(
    (orientationMap[value] || orientationMap[1]).clone()
  );
  const rollingRef = useRef(rolling);
  const spinRef = useRef(new THREE.Vector3());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || size;
    const height = container.clientHeight || size;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: transparent
    });
    renderer.setPixelRatio(Math.min(DPR_CAP, window.devicePixelRatio || 1));
    renderer.setSize(width, height);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.6;
    if (transparent) {
      renderer.setClearColor(0x000000, 0);
    }
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = transparent ? null : new THREE.Color(BACKGROUND_COLOR);

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    pmremRef.current = pmrem;
    const envTarget = pmrem.fromScene(new RoomEnvironment(renderer), 0.04);
    envTargetRef.current = envTarget;
    scene.environment = envTarget.texture;

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.set(0.85, 0.9, 1.8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 1;
    controls.maxDistance = 5;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    let ground = null;
    if (!transparent) {
      ground = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshStandardMaterial({
          color: BACKGROUND_COLOR,
          metalness: 0.3,
          roughness: 0.9
        })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.55;
      ground.receiveShadow = true;
      scene.add(ground);
    }

    const hemi = new THREE.HemisphereLight(0xffffff, 0x101318, 0.7);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(1.2, 2.0, 1.0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.normalBias = 0.025;
    key.shadow.bias = -0.0005;
    scene.add(key);

    const dieMaterial = new THREE.MeshPhysicalMaterial({
      color: GOLD_COLOR,
      metalness: 1.0,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 1.0,
      envMapIntensity: 2.0
    });
    const pipMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      metalness: 0.5,
      roughness: 0.8,
      envMapIntensity: 0.4
    });

    const dieGroup = new THREE.Group();
    const dieMesh = new THREE.Mesh(
      new RoundedBoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE, DICE_SEGMENTS, DICE_RADIUS),
      dieMaterial
    );
    dieMesh.castShadow = true;
    dieGroup.add(dieMesh);

    const pipGeometrySet = new Set();
    placePips(dieGroup, pipMaterial, pipGeometrySet);
    pipGeometrySetRef.current = pipGeometrySet;
    scene.add(dieGroup);
    diceGroupRef.current = dieGroup;
    dieGroup.quaternion.copy(targetQuaternionRef.current);

    const clock = new THREE.Clock();
    const animate = () => {
      const delta = clock.getDelta();
      if (diceGroupRef.current) {
        if (rollingRef.current) {
          const spin = spinRef.current;
          diceGroupRef.current.rotateX(spin.x * delta);
          diceGroupRef.current.rotateY(spin.y * delta);
          diceGroupRef.current.rotateZ(spin.z * delta);
          spin.multiplyScalar(0.9);
        } else {
          diceGroupRef.current.quaternion.slerp(targetQuaternionRef.current, 0.2);
        }
      }
      controls.update();
      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = (width, height) => {
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    let resizeCleanup = () => {};
    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver((entries) => {
        if (!entries.length) return;
        const rect = entries[0].contentRect;
        const nextWidth = rect.width || size;
        const nextHeight = rect.height || size;
        handleResize(nextWidth, nextHeight);
      });
      resizeObserver.observe(container);
      resizeCleanup = () => resizeObserver.disconnect();
    } else {
      const onResize = () => {
        const nextWidth = container.clientWidth || size;
        const nextHeight = container.clientHeight || size;
        handleResize(nextWidth, nextHeight);
      };
      window.addEventListener('resize', onResize);
      resizeCleanup = () => window.removeEventListener('resize', onResize);
    }

    return () => {
      cancelAnimationFrame(animationRef.current);
      resizeCleanup();
      controls.dispose();
      if (ground) {
        ground.geometry.dispose();
        ground.material.dispose();
      }
      dieMesh.geometry.dispose();
      dieMaterial.dispose();
      pipMaterial.dispose();
      pipGeometrySetRef.current.forEach((geo) => geo.dispose());
      pipGeometrySetRef.current.clear();
      hemi.dispose?.();
      key.dispose?.();
      if (envTargetRef.current) {
        envTargetRef.current.texture.dispose();
        envTargetRef.current.dispose();
      }
      pmremRef.current?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      diceGroupRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
    };
  }, [size]);

  useEffect(() => {
    rollingRef.current = rolling;
    if (rolling) {
      spinRef.current.set(
        (Math.random() * 2 - 1) * 8,
        (Math.random() * 2 - 1) * 8,
        (Math.random() * 2 - 1) * 8
      );
    }
  }, [rolling]);

  useEffect(() => {
    const orientation = orientationMap[value] || orientationMap[1];
    targetQuaternionRef.current.copy(orientation);
    if (diceGroupRef.current && !rollingRef.current) {
      diceGroupRef.current.quaternion.slerp(targetQuaternionRef.current, 0.6);
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        width: typeof size === 'number' ? `${size}px` : size,
        height: typeof size === 'number' ? `${size}px` : size
      }}
    />
  );
}
