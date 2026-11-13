import * as THREE from 'three';

/** Hide the local face in one camera's colour pass, retaining its shadow and
 * its normal appearance in every broadcast/replay camera. Never hide a bone. */
export class PoolRoyalFirstPerson {
  readonly meshes: THREE.Mesh[] = [];
  private camera: THREE.Camera | null = null;
  private hidden = false;
  private cleanup: (() => void)[] = [];

  constructor(human: { model: THREE.Object3D | null; bones: { head?: THREE.Bone | null } }) {
    const headBones = new Set<THREE.Bone>();
    human.bones.head?.traverse(object => {
      if ((object as THREE.Bone).isBone) headBones.add(object as THREE.Bone);
    });
    human.model!.traverse(object => {
      const mesh = object as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      let headOnly = /^(EyeLeft|EyeRight|Wolf3D_(Head|Teeth|Beard|Headwear|Hair))$/i.test(mesh.name);
      let headWeights: Float32Array | undefined;
      // Also cover head accessories whose names differ from the bundled model.
      if (!headOnly && mesh.isSkinnedMesh) {
        const { skinIndex, skinWeight } = mesh.geometry.attributes;
        headOnly = Boolean(skinIndex && skinWeight);
        headWeights = skinIndex && skinWeight ? new Float32Array(skinIndex.count) : undefined;
        for (let i = 0; headWeights && i < skinIndex.count; i++) {
          let weight = 0;
          for (let j = 0; j < 4; j++) {
            if (headBones.has(mesh.skeleton.bones[skinIndex.getComponent(i, j)])) weight += skinWeight.getComponent(i, j);
          }
          headWeights[i] = weight;
          if (weight < 0.85) headOnly = false;
        }
      }
      // Turi's face and body share a skinned mesh. Clip only head-weighted
      // fragments for the local eye camera; never hide his cue arm or torso.
      const partialHead = !headOnly && Boolean(headWeights?.some(weight => weight > 0.5));
      if (!headOnly && !partialHead) return;
      const sourceGeometry = mesh.geometry;
      const sourceMaterial = mesh.material;
      if (partialHead) {
        mesh.geometry = mesh.geometry.clone();
        mesh.geometry.setAttribute('poolLocalHeadWeight', new THREE.BufferAttribute(headWeights!, 1));
      }
      this.meshes.push(mesh);
      const suppress = { value: 0 };
      const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(source => {
        const material = source.clone();
        const compile = source.onBeforeCompile;
        material.onBeforeCompile = (shader, renderer) => {
          compile.call(material, shader, renderer);
          shader.uniforms.poolLocalFace = suppress;
          if (partialHead) shader.vertexShader =
            'attribute float poolLocalHeadWeight;\nvarying float poolHeadWeight;\n' + shader.vertexShader.replace(
              '#include <begin_vertex>', '#include <begin_vertex>\npoolHeadWeight = poolLocalHeadWeight;');
          shader.fragmentShader = 'uniform float poolLocalFace;\n' +
            (partialHead ? 'varying float poolHeadWeight;\n' : '') + shader.fragmentShader.replace(
            '#include <clipping_planes_fragment>',
            `#include <clipping_planes_fragment>\nif (poolLocalFace > 0.5${partialHead ? ' && poolHeadWeight > 0.35' : ''}) discard;`
          );
        };
        material.customProgramCacheKey = () => `${source.customProgramCacheKey()}-pool-local-face-v2-${partialHead ? 'weighted' : 'full'}`;
        return material;
      });
      mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
      const before = mesh.onBeforeRender;
      mesh.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
        before.call(mesh, renderer, scene, camera, geometry, material, group);
        suppress.value = this.hidden && camera === this.camera ? 1 : 0;
      };
      this.cleanup.push(() => {
        mesh.onBeforeRender = before;
        mesh.material = sourceMaterial;
        materials.forEach(material => material.dispose());
        if (partialHead) {
          mesh.geometry.dispose();
          mesh.geometry = sourceGeometry;
        }
      });
    });
  }

  setCamera(camera: THREE.Camera | null, hidden: boolean) {
    this.camera = camera;
    this.hidden = hidden;
  }

  /** Restore the authored resources before the owning actor disposes them. */
  dispose() {
    for (const cleanup of this.cleanup) cleanup();
    this.cleanup.length = 0;
    this.meshes.length = 0;
    this.camera = null;
    this.hidden = false;
  }
}
