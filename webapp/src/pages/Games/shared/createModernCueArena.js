import * as THREE from 'three'

// A lightweight, texture-free arena shell shared by Pool and Snooker Royal.
// Geometry and vertex colours replace the former panoramic HDR backgrounds.
export function createModernCueArena ({ width, depth, floorY }) {
  const arena = new THREE.Group()
  arena.name = 'modern-cue-arena'

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.72,
    metalness: 0.18
  })
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(width * 1.35, width * 1.45, width * 0.025, 48),
    floorMaterial
  )
  floor.position.y = floorY - width * 0.02
  floor.receiveShadow = true
  arena.add(floor)

  const tierMaterial = new THREE.MeshStandardMaterial({
    color: 0x182235,
    roughness: 0.58,
    metalness: 0.32
  })
  for (let tier = 0; tier < 3; tier += 1) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(
        width * (1.48 + tier * 0.16),
        width * (1.53 + tier * 0.16),
        width * 0.12,
        48,
        1,
        true
      ),
      tierMaterial
    )
    ring.position.y = floorY + width * (0.04 + tier * 0.11)
    arena.add(ring)
  }

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0x21d4b4,
    emissive: 0x087565,
    emissiveIntensity: 1.15,
    roughness: 0.3,
    metalness: 0.35
  })
  const accent = new THREE.Mesh(
    new THREE.TorusGeometry(width * 1.46, width * 0.012, 6, 64),
    accentMaterial
  )
  accent.rotation.x = Math.PI / 2
  accent.position.y = floorY + width * 0.08
  arena.add(accent)

  const canopyMaterial = new THREE.MeshStandardMaterial({
    color: 0x202c42,
    roughness: 0.42,
    metalness: 0.55
  })
  const canopyHeight = Math.max(width, depth) * 0.92
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.035, canopyHeight, width * 0.035),
      canopyMaterial
    )
    pillar.position.set(
      Math.cos(angle) * width * 1.5,
      floorY + canopyHeight * 0.5,
      Math.sin(angle) * depth * 1.55
    )
    arena.add(pillar)
  }

  return arena
}
