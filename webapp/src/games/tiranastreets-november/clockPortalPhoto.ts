import * as THREE from 'three';

export const CLOCK_PORTAL_ASSET = '/assets/tirana-streets/environment/tirana-clock-portal-2024.webp';

// Clock Tower OSM way 233519333. Its in-game base is a six-metre square.
// The 2024 portal photograph was taken from the west (negative scene X).
// Photo coverage is the entrance only; the other walls stay untouched.
export const CLOCK_PORTAL_PLACEMENT = Object.freeze({
  x: -3.016,
  y: 1.95,
  z: 0,
  yaw: -Math.PI / 2,
  width: 2.42,
  height: 3.52
});

export async function addClockPortalPhoto(
  clockGroup: THREE.Group,
  worldTextures: Set<THREE.Texture>,
  isDisposed: () => boolean,
  load = (url: string) => new THREE.TextureLoader().loadAsync(url)
) {
  if (isDisposed()) return null;
  let texture: THREE.Texture;
  try { texture = await load(CLOCK_PORTAL_ASSET); }
  catch { return null; }
  if (isDisposed()) { texture.dispose(); return null; }
  texture.colorSpace = THREE.SRGBColorSpace;
  worldTextures.add(texture);
  const p = CLOCK_PORTAL_PLACEMENT;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(p.width, p.height),
    new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      roughness: 0.88,
      metalness: 0,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    })
  );
  panel.name = 'Clock Tower portal (© Steffen Schmitz / Wikimedia Commons / CC BY-SA 4.0)';
  panel.position.set(p.x, p.y, p.z);
  panel.rotation.y = p.yaw;
  panel.receiveShadow = true;
  clockGroup.add(panel);
  return panel;
}
