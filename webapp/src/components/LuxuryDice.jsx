import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const DPR_CAP = 1.75;
const DIE_SIZE = 1;
const DICE_RADIUS = 0.12;
const DICE_SEGMENTS = 6;
const DIE_COLOR = 0xffffff;
const DICE_PIP_RADIUS = DIE_SIZE * 0.093;
const DICE_PIP_DEPTH = DIE_SIZE * 0.018;
const DICE_PIP_SPREAD = DIE_SIZE * 0.3;
const DICE_FACE_INSET = DIE_SIZE * 0.064;
const DICE_PIP_RIM_INNER = DICE_PIP_RADIUS * 0.78;
const DICE_PIP_RIM_OUTER = DICE_PIP_RADIUS * 1.08;
const DICE_PIP_RIM_OFFSET = DIE_SIZE * 0.0048;
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

function placePips(group, pipMaterial, rimMaterial, geometrySet) {
  const pipGeo = new THREE.SphereGeometry(
    DICE_PIP_RADIUS,
    36,
    24,
    0,
    Math.PI * 2,
    0,
    Math.PI
  );
  pipGeo.rotateX(Math.PI);
  pipGeo.computeVertexNormals();
  const rimGeo = new THREE.RingGeometry(DICE_PIP_RIM_INNER, DICE_PIP_RIM_OUTER, 64);
  const surface = DIE_SIZE / 2;
  const faceDepth = surface - DICE_FACE_INSET * 0.6;
  const faceDefinitions = [
    { normal: new THREE.Vector3(0, 1, 0), points: [[0, 0]] },
    {
      normal: new THREE.Vector3(0, 0, 1),
      points: [
        [-DICE_PIP_SPREAD, -DICE_PIP_SPREAD],
        [DICE_PIP_SPREAD, DICE_PIP_SPREAD]
      ]
    },
    {
      normal: new THREE.Vector3(1, 0, 0),
      points: [
        [-DICE_PIP_SPREAD, -DICE_PIP_SPREAD],
        [0, 0],
        [DICE_PIP_SPREAD, DICE_PIP_SPREAD]
      ]
    },
    {
      normal: new THREE.Vector3(-1, 0, 0),
      points: [
        [-DICE_PIP_SPREAD, -DICE_PIP_SPREAD],
        [-DICE_PIP_SPREAD, DICE_PIP_SPREAD],
        [DICE_PIP_SPREAD, -DICE_PIP_SPREAD],
        [DICE_PIP_SPREAD, DICE_PIP_SPREAD]
      ]
    },
    {
      normal: new THREE.Vector3(0, 0, -1),
      points: [
        [-DICE_PIP_SPREAD, -DICE_PIP_SPREAD],
        [-DICE_PIP_SPREAD, DICE_PIP_SPREAD],
        [0, 0],
        [DICE_PIP_SPREAD, -DICE_PIP_SPREAD],
        [DICE_PIP_SPREAD, DICE_PIP_SPREAD]
      ]
    },
    {
      normal: new THREE.Vector3(0, -1, 0),
      points: [
        [-DICE_PIP_SPREAD, -DICE_PIP_SPREAD],
        [-DICE_PIP_SPREAD, 0],
        [-DICE_PIP_SPREAD, DICE_PIP_SPREAD],
        [DICE_PIP_SPREAD, -DICE_PIP_SPREAD],
        [DICE_PIP_SPREAD, 0],
        [DICE_PIP_SPREAD, DICE_PIP_SPREAD]
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
      const base = new THREE.Vector3()
        .addScaledVector(x, gx)
        .addScaledVector(y, gy)
        .addScaledVector(n, faceDepth - DICE_PIP_DEPTH * 0.5);

      const pip = new THREE.Mesh(pipGeo, pipMaterial);
      pip.position.copy(base).addScaledVector(n, DICE_PIP_DEPTH);
      pip.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(up, n));
      pip.castShadow = true;
      pip.receiveShadow = true;
      group.add(pip);
      geometrySet?.add(pip.geometry);

      const rim = new THREE.Mesh(rimGeo, rimMaterial);
      rim.position.copy(base).addScaledVector(n, DICE_PIP_RIM_OFFSET);
      rim.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n));
      rim.receiveShadow = true;
      rim.renderOrder = 6;
      group.add(rim);
      geometrySet?.add(rim.geometry);
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
      color: DIE_COLOR,
      metalness: 0.25,
      roughness: 0.35,
      clearcoat: 1.0,
      clearcoatRoughness: 0.15,
      reflectivity: 0.75,
      envMapIntensity: 1.4
    });
    const pipMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0a0a0a,
      roughness: 0.05,
      metalness: 0.6,
      clearcoat: 0.9,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.1
    });
    const pipRimMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffd700,
      emissive: 0x3a2a00,
      emissiveIntensity: 0.55,
      metalness: 1,
      roughness: 0.18,
      reflectivity: 1,
      envMapIntensity: 1.35,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });

    const dieGroup = new THREE.Group();
    const dieMesh = new THREE.Mesh(
      new RoundedBoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE, DICE_SEGMENTS, DICE_RADIUS),
      dieMaterial
    );
    dieMesh.castShadow = true;
    dieGroup.add(dieMesh);

    const pipGeometrySet = new Set();
    placePips(dieGroup, pipMaterial, pipRimMaterial, pipGeometrySet);
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
      pipRimMaterial.dispose();
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
