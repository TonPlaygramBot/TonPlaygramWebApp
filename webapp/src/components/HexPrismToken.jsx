import { useRef, useEffect } from "react";
import * as THREE from "three";

export default function HexPrismToken({ color = "#008080", photoUrl, name }) {
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

    // Split geometry so each side can have its own shaded material
    geometry.clearGroups();
    for (let i = 0; i < 6; i++) {
      geometry.addGroup(i * 6, 6, i);
    }
    geometry.addGroup(36, 18, 6); // top
    geometry.addGroup(54, 18, 7); // bottom

    const baseColor = new THREE.Color(color);
    const sideMaterials = [];
    for (let i = 0; i < 6; i++) {
      const hsl = {};
      baseColor.getHSL(hsl);
      // distribute shades around the prism from darker to lighter
      const l = Math.min(1, Math.max(0, hsl.l - 0.1 + (i / 5) * 0.2));
      const shade = new THREE.Color().setHSL(hsl.h, hsl.s, l);
      sideMaterials.push(new THREE.MeshStandardMaterial({ color: shade }));
    }

    const topMaterial = new THREE.MeshStandardMaterial({
      color: baseColor.clone().offsetHSL(0, 0, 0.2),
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

    let nameTexture = null;
    let planes = [];
    if (name) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#11172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
      ctx.fillStyle = '#ffffff';
      ctx.font = '32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, canvas.width / 2, canvas.height / 2);
      nameTexture = new THREE.CanvasTexture(canvas);
      const textMaterial = new THREE.MeshBasicMaterial({
        map: nameTexture,
        transparent: true,
      });
      const planeGeom = new THREE.PlaneGeometry(SCALE * 2, SCALE * 0.6);
      const radius = 1.1 * SCALE + 0.05;
      for (let i = 0; i < 6; i++) {
        const plane = new THREE.Mesh(planeGeom, textMaterial);
        const angle = i * (Math.PI / 3) + Math.PI / 6;
        plane.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        plane.rotation.y = angle;
        prism.add(plane);
        planes.push(plane);
      }
    }

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
      sideMaterials.forEach((m) => m.dispose());
      planes.forEach((p) => {
        p.geometry.dispose();
      });
      if (nameTexture) nameTexture.dispose();
      topMaterial.dispose();
      bottomMaterial.dispose();
      renderer.dispose();
    };
  }, [color, name]);

  return (
    <div className="token-three relative" ref={mountRef}>
      {photoUrl && (
        <img src={photoUrl} alt="token" className="token-photo" />
      )}
    </div>
  );
}
