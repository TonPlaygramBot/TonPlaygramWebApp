import * as THREE from 'three';
import type { HumanRig } from './poolRoyalReferenceHuman.ts';

/** Hide the local face in one camera's colour pass, retaining its shadow and
 * its normal appearance in every broadcast/replay camera. Never hide a bone. */
export class PoolRoyalFirstPerson {
  readonly meshes: THREE.Mesh[] = [];
  private camera: THREE.Camera | null = null;
  private hidden = false;

  constructor(human: HumanRig) {
    const headBones = new Set<THREE.Bone>();
    human.bones.head?.traverse(object => {
      if ((object as THREE.Bone).isBone) headBones.add(object as THREE.Bone);
    });
    human.model!.traverse(object => {
      const mesh = object as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      let headOnly = /^(EyeLeft|EyeRight|Wolf3D_(Head|Teeth|Beard|Headwear|Hair))$/i.test(mesh.name);
      // Also cover head accessories whose names differ from the bundled model.
      if (!headOnly && mesh.isSkinnedMesh) {
        const { skinIndex, skinWeight } = mesh.geometry.attributes;
        headOnly = Boolean(skinIndex && skinWeight);
        for (let i = 0; headOnly && i < skinIndex.count; i++) {
          let weight = 0;
          for (let j = 0; j < 4; j++) {
            if (headBones.has(mesh.skeleton.bones[skinIndex.getComponent(i, j)])) weight += skinWeight.getComponent(i, j);
          }
          if (weight < 0.85) headOnly = false;
        }
      }
      if (!headOnly) return;
      this.meshes.push(mesh);
      const suppress = { value: 0 };
      const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(source => {
        const material = source.clone();
        const compile = source.onBeforeCompile;
        material.onBeforeCompile = (shader, renderer) => {
          compile.call(material, shader, renderer);
          shader.uniforms.poolLocalFace = suppress;
          shader.fragmentShader = 'uniform float poolLocalFace;\n' + shader.fragmentShader.replace(
            '#include <clipping_planes_fragment>',
            '#include <clipping_planes_fragment>\nif (poolLocalFace > 0.5) discard;'
          );
        };
        material.customProgramCacheKey = () => `${source.customProgramCacheKey()}-pool-local-face-v1`;
        return material;
      });
      mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
      const before = mesh.onBeforeRender;
      mesh.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
        before.call(mesh, renderer, scene, camera, geometry, material, group);
        suppress.value = this.hidden && camera === this.camera ? 1 : 0;
      };
    });
  }

  setCamera(camera: THREE.Camera | null, hidden: boolean) {
    this.camera = camera;
    this.hidden = hidden;
  }
}
