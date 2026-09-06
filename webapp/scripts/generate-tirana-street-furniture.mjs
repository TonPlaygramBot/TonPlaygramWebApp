/** Generates Tirana's local street-furniture GLB; generated binaries stay out of git. */
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

globalThis.FileReader = class {
  readAsArrayBuffer (blob) { blob.arrayBuffer().then((value) => { this.result = value; this.onloadend?.() }) }
  readAsDataURL (blob) { blob.arrayBuffer().then((value) => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString('base64')}`; this.onloadend?.() }) }
}
async function generate () {
  const root = new THREE.Group()
  const mat = (name, color, roughness = 0.8, metalness = 0) => Object.assign(new THREE.MeshStandardMaterial({ color, roughness, metalness }), { name })
  const surfaces = {
    concrete: mat('Pavement stone', 0xb8b4aa, 0.95),
    metal: mat('Painted metal', 0x263a3b, 0.5, 0.65),
    green: mat('Living leaves', 0x477044, 0.9),
    bark: mat('Tree bark', 0x66503b, 1),
    red: mat('Signal red', 0xff3028, 0.3),
    amber: mat('Signal amber', 0xffaa22, 0.3),
    lime: mat('Signal green', 0x62e36e, 0.3),
    blue: mat('Albanian road sign', 0x175aa5, 0.55),
    white: mat('Reflective lettering', 0xf4f5e9, 0.4),
    wood: mat('Park bench wood', 0x825c38, 0.9)
  }
  const group = (name) => { const value = new THREE.Group(); value.name = name; root.add(value); return value }
  const mesh = (parent, geometry, surface, name, position, rotate = false) => {
    const value = new THREE.Mesh(geometry, surface); value.name = name; value.position.set(...position); if (rotate) value.rotation.x = Math.PI / 2; parent.add(value); return value
  }
  let item = group('pavement_tile'); mesh(item, new THREE.BoxGeometry(2.8, 0.12, 2.8), surfaces.concrete, 'paving_stone', [0, 0, 0])
  item = group('tree'); mesh(item, new THREE.CylinderGeometry(0.18, 0.32, 3.8, 8), surfaces.bark, 'trunk', [0, 1.9, 0]); mesh(item, new THREE.IcosahedronGeometry(1.65, 2), surfaces.green, 'canopy', [0, 4.25, 0])
  item = group('traffic_light'); mesh(item, new THREE.CylinderGeometry(0.055, 0.09, 3.5, 8), surfaces.metal, 'pole', [0, 1.75, 0]); mesh(item, new THREE.BoxGeometry(0.42, 1.05, 0.34), surfaces.metal, 'signal_case', [0, 3.35, 0])
  for (const [height, surface] of [[3.67, surfaces.red], [3.35, surfaces.amber], [3.03, surfaces.lime]]) mesh(item, new THREE.SphereGeometry(0.105, 12, 8), surface, 'signal_lens', [0, height, 0.18])
  item = group('street_sign'); mesh(item, new THREE.CylinderGeometry(0.04, 0.06, 2.5, 8), surfaces.metal, 'sign_pole', [0, 1.25, 0]); mesh(item, new THREE.BoxGeometry(1.8, 0.42, 0.08), surfaces.blue, 'street_name_board', [0, 2.38, 0]); mesh(item, new THREE.BoxGeometry(1.45, 0.05, 0.095), surfaces.white, 'lettering_stripe', [0, 2.38, 0.05])
  item = group('road_sign'); mesh(item, new THREE.CylinderGeometry(0.04, 0.06, 2.25, 8), surfaces.metal, 'sign_pole', [0, 1.12, 0]); mesh(item, new THREE.CylinderGeometry(0.48, 0.48, 0.08, 24), surfaces.white, 'sign_disc', [0, 2.1, 0], true); mesh(item, new THREE.CylinderGeometry(0.36, 0.36, 0.085, 24), surfaces.red, 'warning_ring', [0, 2.1, 0.02], true)
  item = group('park_bench'); mesh(item, new THREE.BoxGeometry(1.8, 0.12, 0.48), surfaces.wood, 'seat', [0, 0.48, 0]); mesh(item, new THREE.BoxGeometry(1.8, 0.65, 0.11), surfaces.wood, 'back', [0, 0.82, 0.2]); for (const x of [-0.7, 0.7]) mesh(item, new THREE.BoxGeometry(0.1, 0.5, 0.1), surfaces.metal, 'bench_leg', [x, 0.25, 0])
  const directory = fileURLToPath(new URL('../public/assets/tirana-streets/', import.meta.url))
  await mkdir(directory, { recursive: true })
  const data = await new Promise((resolve, reject) => new GLTFExporter().parse(root, resolve, reject, { binary: true, onlyVisible: true }))
  await writeFile(`${directory}/street-furniture.glb`, Buffer.from(data))
  console.log('Generated Tirana street-furniture.glb')
}

generate().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
