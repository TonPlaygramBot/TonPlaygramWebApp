// ludoBoard.js
// Three.js script: renders a 3D Ludo board as a shallow prism with mapped faces

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// 1. Scene, camera, renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(1.2, 1.2, 1.2);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// 2. Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(1, 2, 1);
scene.add(dirLight);

// 3. Geometry & face mapping
// Create a shallow prism box: width=1, height=0.05, depth=1
const boardGeo = new THREE.BoxGeometry(1, 0.05, 1);
// Face indices for BoxGeometry:
// 0–1: +X, 2–3: -X, 4–5: +Y (top), 6–7: -Y (bottom), 8–9: +Z, 10–11: -Z

// Prepare materials array (12 entries)
const materials = Array(12).fill(null);

// 3a. Draw board pattern to a canvas
const size = 1024;
const canvas = document.createElement('canvas');
canvas.width = canvas.height = size;
const ctx = canvas.getContext('2d');

// White background
ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, size, size);

// Draw central cross
const cell = size / 15;
ctx.fillStyle = '#003366'; // dark-blue squares
for (let i = 6; i <= 8; i++) {
  for (let j = 6; j <= 8; j++) {
    if (i === 7 || j === 7) {
      ctx.fillRect(i * cell, j * cell, cell, cell);
    }
  }
}

// Draw home circles in corners (2×2 circles each)
const colors = ['#ff0000','#00ff00','#ffff00','#0000ff'];
const offsets = [ [0,0], [0,13], [13,13], [13,0] ];
offsets.forEach((off, ci) => {
  ctx.fillStyle = colors[ci];
  for (let dx = 0; dx < 2; dx++) {
    for (let dy = 0; dy < 2; dy++) {
      const x = (off[0] + 1 + dx*4) * cell;
      const y = (off[1] + 1 + dy*4) * cell;
      ctx.beginPath();
      ctx.arc(x + cell/2, y + cell/2, cell*0.8, 0, Math.PI*2);
      ctx.fill();
    }
  }
});

const boardTex = new THREE.CanvasTexture(canvas);
const boardMat = new THREE.MeshPhongMaterial({ map: boardTex });

// Assign board material to top face (4 & 5)
materials[4] = boardMat;
materials[5] = boardMat;

// Bottom face: simple gray
const bottomMat = new THREE.MeshPhongMaterial({ color: 0x888888 });
materials[6] = bottomMat;
materials[7] = bottomMat;

// Side faces: placeholder material (will apply logos later)
const sidePlaceholder = new THREE.MeshPhongMaterial({ color: 0xcccccc });
[0,1,2,3,8,9,10,11].forEach(i => materials[i] = sidePlaceholder);
// 4. Build and add board mesh
const boardMesh = new THREE.Mesh(boardGeo, materials);
boardMesh.position.y = 0.025;
scene.add(boardMesh);

// 5. Render loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// TODO: Later, load your logo texture and replace materials[0–1], [2–3], [8–9], [10–11] so logos face inward.
