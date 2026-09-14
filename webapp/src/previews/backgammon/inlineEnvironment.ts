import * as THREE from 'three';
// Preview-only furniture. Production uses environment.ts and Murlan's complete
// model/HDRI catalogue. This scene performs no external asset requests.
export function disposeBackgammonObject(root: THREE.Object3D) {
  root.traverse((node: any) => {
    node.geometry?.dispose();
    (Array.isArray(node.material)
      ? node.material
      : node.material
        ? [node.material]
        : []
    ).forEach((material: any) => material.dispose());
  });
  root.removeFromParent();
}
export function createBackgammonEnvironment({
  scene,
  fallbackChair,
  tableHeight,
  tableRadius,
  chairDistance,
  seatY
}: any) {
  const group = new THREE.Group();
  scene.add(group);
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(tableRadius, tableRadius, 0.13, 8),
    new THREE.MeshStandardMaterial({ color: '#173e39', roughness: 0.6 })
  );
  top.position.y = tableHeight - 0.065;
  top.receiveShadow = true;
  group.add(top);
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.55, tableHeight, 12),
    new THREE.MeshStandardMaterial({ color: '#422b23' })
  );
  pedestal.position.y = tableHeight / 2 - 0.08;
  group.add(pedestal);
  const chairs: THREE.Group[] = [];
  return {
    table() {},
    finish() {},
    hdri() {},
    chairs(option: any) {
      chairs.forEach(disposeBackgammonObject);
      chairs.length = 0;
      for (const side of [-1, 1]) {
        const chair = fallbackChair(
          option.primary || option.seatColor,
          option.legColor
        );
        chair.position.set(0, seatY, side * chairDistance);
        chair.rotation.y = side > 0 ? Math.PI : 0;
        group.add(chair);
        chairs.push(chair);
      }
    },
    dispose() {
      disposeBackgammonObject(group);
    }
  };
}
