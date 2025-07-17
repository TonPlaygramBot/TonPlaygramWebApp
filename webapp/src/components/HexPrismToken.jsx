import { useRef, useEffect } from "react";
import * as THREE from "three";
import { getAvatarUrl } from '../utils/avatarUtils.js';

export default function HexPrismToken({ color = "#008080", topColor, photoUrl, className = "", rolling = false, active = false, spin = true }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    // the hexagon element is rendered just before this token
    const hexEl = mount.previousElementSibling;

    const width = mount.clientWidth;
    const height = mount.clientHeight;
    const SCALE = 3;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(3 * SCALE, 4 * SCALE, 5 * SCALE);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    // Slightly reduce prism height so tokens are less tall
    // Height is now 20% shorter than before
    const geometry = new THREE.CylinderGeometry(1.1, 1.1, 1.44, 6);
    geometry.scale(SCALE, SCALE, SCALE);

    // Split geometry so each side can have its own shaded material
    geometry.clearGroups();
    for (let i = 0; i < 6; i++) {
      geometry.addGroup(i * 6, 6, i);
    }
    geometry.addGroup(36, 18, 6); // top
    geometry.addGroup(54, 18, 7); // bottom

    const baseColor = new THREE.Color(color);
    const sideMaterials = Array.from({ length: 6 }, () =>
      new THREE.MeshStandardMaterial({ color: baseColor })
    );

    const topMaterial = new THREE.MeshStandardMaterial({
      color: topColor ? new THREE.Color(topColor) : baseColor.clone().offsetHSL(0, 0, 0.2),
      side: THREE.DoubleSide,
    });
    const bottomMaterial = new THREE.MeshStandardMaterial({
      color: baseColor.clone().offsetHSL(0, 0, -0.2),
    });

    const prism = new THREE.Mesh(
      geometry,
      [...sideMaterials, topMaterial, bottomMaterial],
    );
    prism.rotation.y = Math.PI / 6; // show a corner toward the viewer
    scene.add(prism);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(5, 10, 7.5);
    scene.add(ambient);
    scene.add(directional);

    let frameId;
    const animate = () => {
      if (spin) {
        prism.rotation.y += 0.01;
      }
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      mount.removeChild(renderer.domElement);
      geometry.dispose();
      sideMaterials.forEach((m) => m.dispose());
      topMaterial.dispose();
      bottomMaterial.dispose();
      renderer.dispose();
    };
  }, [color, topColor, spin]);


  return (
    <div className={`token-three relative ${className}`} ref={mountRef}>
      {photoUrl && (
        <img
          src={getAvatarUrl(photoUrl)}
          alt="token"
          className={`token-photo${rolling ? ' rolling' : ''}${active ? ' active' : ''}`}
          style={{ '--token-border-color': color }}
        />
      )}
    </div>
  );
}
