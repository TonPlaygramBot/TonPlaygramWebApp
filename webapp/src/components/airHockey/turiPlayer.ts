import * as THREE from 'three';
import { HumanModelLoader } from '../../games/tiranastreets/HumanModelLoader';
import { humanoidBones, normalizePlayableHuman, solveHumanoidLimb } from '../../games/tiranastreets/street-career/humanoidRig.mjs';
import { solveHumanoidGrip } from '../../games/tiranastreets/street-career/humanoidHands.mjs';
import { prepareHumanMaterials } from '../../games/tiranastreets/street-career/humanMaterials.mjs';
import { TURI_MODEL_URL } from '../../config/playerCharacter.js';
import { PoolRoyalFirstPerson } from '../../pages/Games/shared/poolRoyalFirstPerson';

// The original Air Hockey arena uses its own world scale. All contacts below
// are expressed in that arena; the original avatar remains 1.78 metres tall.
export class AirHockeyTuriPlayer {
  readonly root: THREE.Group;
  readonly bones: Map<string, THREE.Bone>;
  private readonly rests = new Map<THREE.Bone, { position: THREE.Vector3; quaternion: THREE.Quaternion }>();
  private readonly feet = new Map<'left' | 'right', THREE.Vector3>();
  private readonly legLengths = new Map<'left' | 'right', number>();
  private readonly target = new THREE.Vector3();
  private readonly hip = new THREE.Vector3();
  private readonly legUpper = new THREE.Vector3();
  private readonly along = new THREE.Vector3(0, 0, -1);
  private readonly normal = new THREE.Vector3(0, -1, 0);
  private readonly unit: number;
  private readonly releaseMaterials: () => void;
  private readonly firstPerson: PoolRoyalFirstPerson;
  private disposed = false;

  constructor(readonly model: THREE.Object3D, private readonly dimensions: {
    width: number; length: number; surfaceY: number;
  }, maxAnisotropy = 4) {
    this.root = normalizePlayableHuman(model, 1.78);
    this.root.name = 'air-hockey-turi-player';
    this.root.userData.characterId = 'turi';
    this.unit = dimensions.width / 1.2;
    this.root.scale.setScalar(this.unit);
    this.root.rotation.y = Math.PI;
    this.root.position.set(0, dimensions.surfaceY - .90 * this.unit, dimensions.length / 2 + .03 * this.unit);
    this.root.updateMatrixWorld(true);
    this.bones = humanoidBones(this.root);
    for (const bone of this.bones.values()) this.rests.set(bone, {
      position: bone.position.clone(), quaternion: bone.quaternion.clone()
    });
    for (const side of ['left', 'right'] as const) {
      const foot = this.bones.get(side + 'foot');
      if (foot) this.feet.set(side, this.root.worldToLocal(foot.getWorldPosition(new THREE.Vector3())));
      const thigh = this.bones.get(side + 'upleg'), knee = this.bones.get(side + 'leg');
      if (foot && thigh && knee) {
        const a = thigh.getWorldPosition(new THREE.Vector3()), b = knee.getWorldPosition(new THREE.Vector3());
        this.legLengths.set(side, a.distanceTo(b) + b.distanceTo(foot.getWorldPosition(new THREE.Vector3())));
      }
    }
    this.releaseMaterials = prepareHumanMaterials(model, { maxAnisotropy });
    this.firstPerson = new PoolRoyalFirstPerson({ model, bones: { head: this.bones.get('head') } });
    model.traverse(node => {
      if ((node as THREE.Mesh).isMesh) { node.frustumCulled = false; (node as THREE.Mesh).castShadow = true; }
    });
  }

  setCamera(camera: THREE.Camera, topView: boolean) {
    this.firstPerson.setCamera(camera, !topView);
  }

  update(mallet: THREE.Object3D, knobHeight: number) {
    if (this.disposed) return;
    for (const [bone, rest] of this.rests) {
      bone.position.copy(rest.position); bone.quaternion.copy(rest.quaternion);
    }
    mallet.getWorldPosition(this.target);
    this.target.y += Math.max(0, knobHeight);
    // Side steps follow the mallet. A forward lean adds reach without changing
    // the touch controls, mallet position, collision bodies or puck physics.
    this.root.position.x = THREE.MathUtils.clamp(this.target.x, -this.dimensions.width * .44, this.dimensions.width * .44);
    this.root.updateMatrixWorld(true);
    const depth = Math.max(0, this.dimensions.length / 2 - this.target.z) / this.unit;
    const lean = THREE.MathUtils.clamp(depth * .65, 0, .68);
    const hips = this.bones.get('hips');
    if (hips?.parent) {
      hips.getWorldPosition(this.hip);
      this.hip.z -= lean * this.unit;
      this.hip.y -= (.08 + lean * .14) * this.unit;
      hips.position.copy(hips.parent.worldToLocal(this.hip));
    }
    const spine = this.bones.get('spine');
    if (spine) spine.rotateX(.14 + lean * .25);
    this.root.updateMatrixWorld(true);
    // Lower the pelvis as he leans so both planted feet stay inside the
    // measured leg reach. A sideways step moves the whole stance together.
    let lowerBy = 0;
    for (const [side, local] of this.feet) {
      const thigh = this.bones.get(side + 'upleg');
      if (!thigh) continue;
      const foot = this.root.localToWorld(this.hip.copy(local));
      const upper = thigh.getWorldPosition(this.legUpper);
      const length = (this.legLengths.get(side) || 0) * .985;
      const horizontal = (upper.x - foot.x) ** 2 + (upper.z - foot.z) ** 2;
      lowerBy = Math.max(lowerBy, upper.y - foot.y - Math.sqrt(Math.max(0, length * length - horizontal)));
    }
    if (hips?.parent && lowerBy > 0) {
      hips.getWorldPosition(this.hip); this.hip.y -= lowerBy;
      hips.position.copy(hips.parent.worldToLocal(this.hip));
      this.root.updateMatrixWorld(true);
    }
    solveHumanoidGrip(this.root, this.bones, 'right', this.target, this.along, this.normal, .65);
    this.target.set(this.root.position.x - .22 * this.unit,
      this.dimensions.surfaceY + .045 * this.unit, this.dimensions.length / 2);
    solveHumanoidGrip(this.root, this.bones, 'left', this.target, this.along, this.normal, .1);
    for (const [side, local] of this.feet) {
      this.target.copy(local); this.root.localToWorld(this.target);
      solveHumanoidLimb(this.root, this.bones, side, this.target, true);
    }
    this.root.updateMatrixWorld(true);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent(); this.firstPerson.dispose(); this.releaseMaterials();
    disposeTuriModel(this.model);
  }
}

function disposeTuriModel(model: THREE.Object3D) {
  const resources = new Set<{ dispose: () => void }>();
  model.traverse(node => {
    const mesh = node as THREE.SkinnedMesh;
    if (!mesh.isMesh) return;
    resources.add(mesh.geometry);
    if (mesh.skeleton) resources.add(mesh.skeleton);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      resources.add(material);
      for (const value of Object.values(material)) if ((value as THREE.Texture)?.isTexture) resources.add(value as THREE.Texture);
    }
  });
  resources.forEach(resource => resource.dispose());
}

export function loadAirHockeyTuri(renderer: THREE.WebGLRenderer,
  dimensions: { width: number; length: number; surfaceY: number },
  onLoaded: (actor: AirHockeyTuriPlayer) => void, onError: (error: unknown) => void) {
  const loader = new HumanModelLoader(); loader.configure(renderer);
  let cancelled = false;
  loader.loadAsync(TURI_MODEL_URL).then(gltf => {
    if (cancelled) { disposeTuriModel(gltf.scene); return; }
    let actor: AirHockeyTuriPlayer;
    try { actor = new AirHockeyTuriPlayer(gltf.scene, dimensions, renderer.capabilities.getMaxAnisotropy()); }
    catch (error) { disposeTuriModel(gltf.scene); throw error; }
    onLoaded(actor);
  }).catch(error => { if (!cancelled) onError(error); }).finally(() => loader.dispose());
  return () => { cancelled = true; };
}
