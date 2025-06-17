import { useRef, useEffect } from "react";
import * as THREE from "three";

export default function HexPrismToken({ color = "#008080", photoUrl }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(3, 4, 5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const geometry = new THREE.CylinderGeometry(1, 1, 2.5, 6);
    const sideMaterial = new THREE.MeshStandardMaterial({ color });
    const bottomMaterial = new THREE.MeshStandardMaterial({ color });

    let topMaterial = new THREE.MeshStandardMaterial({ color });
    const prism = new THREE.Mesh(geometry, [sideMaterial, topMaterial, bottomMaterial]);

    if (photoUrl) {
      const loader = new THREE.TextureLoader();
      loader.crossOrigin = 'anonymous';
      loader.load(photoUrl, (tex) => {
        // ensure the profile photo correctly covers the top face
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.center.set(0.5, 0.5);
        tex.rotation = -Math.PI / 2; // align with board orientation
        tex.needsUpdate = true;
        topMaterial.map = tex;
        topMaterial.needsUpdate = true;
      });
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

  return <div className="token-three" ref={mountRef} />;
}
