import { useRef, useEffect } from "react";
import * as THREE from "three";

export default function HexPrismToken({ color = "#008080", photoUrl }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

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

    // Make the prism noticeably taller so tokens stand out on the board
    // Height is tripled relative to the original design
    const geometry = new THREE.CylinderGeometry(1.1, 1.1, 1.8, 6);
    geometry.scale(SCALE, SCALE, SCALE);
    const sideMaterial = new THREE.MeshStandardMaterial({ color });
    const bottomMaterial = new THREE.MeshStandardMaterial({ color });

    let topMaterial = new THREE.MeshStandardMaterial({
      color,
      side: THREE.DoubleSide,
    });
    const prism = new THREE.Mesh(
      geometry,
      [sideMaterial, topMaterial, bottomMaterial],
    );
    prism.position.y = (1.8 * SCALE) / 2; // align base with board surface
    prism.rotation.y = Math.PI / 6; // show a corner toward the viewer

    if (photoUrl) {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(
        photoUrl,
        (tex) => {
          // ensure the profile photo correctly covers the top face
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.center.set(0.5, 0.5);
          tex.rotation = -Math.PI / 2; // align with board orientation
          tex.needsUpdate = true;
          topMaterial.map = tex;
          topMaterial.needsUpdate = true;
        },
        undefined,
        (err) => console.error('Failed to load token texture', err),
      );
    }
    scene.add(prism);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(5, 10, 7.5);
    scene.add(ambient);
    scene.add(directional);

    let frameId;
    const animate = () => {
      prism.rotation.y += 0.01;
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
      sideMaterial.dispose();
      topMaterial.dispose();
      bottomMaterial.dispose();
      renderer.dispose();
    };
  }, [color, photoUrl]);

  return <div className="token-three relative" ref={mountRef} />;
}
