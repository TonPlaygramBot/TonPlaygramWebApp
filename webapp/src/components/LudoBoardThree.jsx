import { useEffect, useRef } from 'react';

export default function LudoBoardThree() {
  const mountRef = useRef(null);

  useEffect(() => {
    let cleanup = () => {};
    let canceled = false;

    (async () => {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      if (canceled) return;

      const mount = mountRef.current;
      if (!mount) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        45,
        mount.clientWidth / mount.clientHeight,
        0.1,
        100,
      );
      camera.position.set(1.2, 1.0, 1.2);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      mount.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);

      // Lights
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(1, 2, 1);
      scene.add(dirLight);

      // Board geometry and materials
      const boardGeo = new THREE.BoxGeometry(1, 0.05, 1);
      const materials = [];

      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.fillStyle = '#000000';
      ctx.fillRect(512 - 5, 0, 10, 1024);
      ctx.fillRect(0, 512 - 5, 1024, 10);
      const circles = [
        [256, 256, '#ff0000'],
        [768, 256, '#00ff00'],
        [256, 768, '#ffff00'],
        [768, 768, '#0000ff'],
      ];
      circles.forEach(([x, y, color]) => {
        ctx.fillStyle = color;
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 2; c++) {
            ctx.beginPath();
            ctx.arc(x + (c ? 60 : -60), y + (r ? 60 : -60), 40, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
      const boardTex = new THREE.CanvasTexture(canvas);
      const boardMat = new THREE.MeshPhongMaterial({ map: boardTex });
      materials[4] = materials[5] = boardMat;
      materials[6] = materials[7] = new THREE.MeshPhongMaterial({ color: 0xdddddd });
      for (let i of [0, 1, 2, 3, 8, 9, 10, 11]) {
        materials[i] = new THREE.MeshPhongMaterial({ color: 0xcccccc });
      }

      const loader = new THREE.TextureLoader();
      const logoTex = loader.load('/assets/TonPlayGramLogo.jpg');
      const makeLogoMat = () => new THREE.MeshBasicMaterial({ map: logoTex, side: THREE.DoubleSide });
      materials[0] = materials[1] = makeLogoMat();
      materials[2] = materials[3] = makeLogoMat();
      materials[8] = materials[9] = makeLogoMat();
      materials[10] = materials[11] = makeLogoMat();

      const boardMesh = new THREE.Mesh(boardGeo, materials);
      boardMesh.position.y = 0.025;
      scene.add(boardMesh);

      const tokenColors = [0xff0000, 0x00ff00, 0xffff00, 0x0000ff];
      tokenColors.forEach((hex, ci) => {
        for (let i = 0; i < 4; i++) {
          const cylGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.01, 16);
          const mat = new THREE.MeshStandardMaterial({ color: hex });
          const mesh = new THREE.Mesh(cylGeo, mat);
          const offset = 0.3;
          mesh.position.set(
            (ci % 2 ? offset : -offset) + ((i % 2) * 0.06 - 0.03),
            0.03,
            (ci < 2 ? offset : -offset) + (Math.floor(i / 2) * 0.06 - 0.03),
          );
          scene.add(mesh);
        }
      });

      let frameId;
      const animate = () => {
        controls.update();
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
      window.addEventListener('resize', handleResize);

      cleanup = () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', handleResize);
        mount.removeChild(renderer.domElement);
        renderer.dispose();
        boardGeo.dispose();
        boardTex.dispose();
        materials.forEach(m => m.dispose && m.dispose());
      };
    })();

    return () => {
      canceled = true;
      cleanup();
    };
  }, []);

  return <div ref={mountRef} style={{ width: '100%', height: '400px' }} />;
}

