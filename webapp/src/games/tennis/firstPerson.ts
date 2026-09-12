import * as THREE from 'three';

type PlayerPart = {
  mesh: THREE.Mesh;
  full: THREE.BufferGeometry;
  hands: THREE.BufferGeometry | null;
  visible: boolean;
};

/** Table Tennis Royal's skinned forearm/hand crop, applied after tennis kit
 * construction. Keep real fingers, deformation and materials; hide the head,
 * hair and torso only for the seat whose eyes we are looking through. */
export function preparePlayerView(model: THREE.Object3D): PlayerPart[] {
  const parts: PlayerPart[] = [];
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const full = object.geometry;
    const indices: number[] = [];
    if (
      object instanceof THREE.SkinnedMesh &&
      full.attributes.skinIndex &&
      full.attributes.skinWeight
    ) {
      const skinIndex = full.attributes.skinIndex,
        skinWeight = full.attributes.skinWeight;
      const handVertex = (vertex: number) => {
        let weight = 0;
        for (let k = 0; k < 4; k++) {
          const name =
            object.skeleton.bones[skinIndex.getComponent(vertex, k)]?.name
              .toLowerCase()
              .replace(/[_.\-\s]/g, '') || '';
          if (
            /forearm|lowerarm|hand|finger|thumb|index|middle|ring|pinky/.test(
              name
            )
          )
            weight += skinWeight.getComponent(vertex, k);
        }
        return weight > 0.6;
      };
      const count = full.index?.count ?? full.attributes.position.count;
      for (let i = 0; i < count; i += 3) {
        const triangle = [0, 1, 2].map((k) =>
          full.index ? full.index.getX(i + k) : i + k
        );
        if (triangle.every(handVertex)) indices.push(...triangle);
      }
    }
    const hands = indices.length ? full.clone() : null;
    if (hands) {
      hands.setIndex(indices);
      hands.clearGroups();
    }
    parts.push({ mesh: object, full, hands, visible: object.visible });
  });
  return parts;
}

export function showPlayerView(parts: PlayerPart[], firstPerson: boolean) {
  for (const part of parts) {
    part.mesh.visible = part.visible && (!firstPerson || Boolean(part.hands));
    part.mesh.geometry = firstPerson && part.hands ? part.hands : part.full;
  }
}

export function disposePlayerView(parts: PlayerPart[]) {
  // Restore full geometry so normal model disposal also releases that buffer.
  showPlayerView(parts, false);
  parts.forEach((part) => part.hands?.dispose());
}
