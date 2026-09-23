import * as T from 'three';

/** Scan streamed scene additions in bounded slices. A complete pass reconciles
 * removals, so existing rain/window lighting stays available during discovery. */
export class EnvironmentMaterialRegistry {
  readonly materials = new Set<T.MeshStandardMaterial>();
  readonly lights = new Set<T.PointLight>();
  private walk?: Generator<T.Object3D>;
  private foundMaterials = new Set<T.MeshStandardMaterial>();
  private foundLights = new Set<T.PointLight>();
  private nextScan = -Infinity;
  constructor(private scene: T.Scene, private onMaterial: (material:T.MeshStandardMaterial)=>void) {}
  update(seconds:number,maxNodes=384) {
    if(!this.walk && (seconds >= this.nextScan || seconds < this.nextScan - 3)) {
      this.foundMaterials.clear();this.foundLights.clear();
      this.walk=this.nodes(this.scene);
    }
    if(!this.walk)return;
    for(let count=0;count<maxNodes;count++) {
      const next=this.walk.next();
      if(next.done) {
        for(const m of this.materials)if(!this.foundMaterials.has(m))this.materials.delete(m);
        for(const light of this.lights)if(!this.foundLights.has(light))this.lights.delete(light);
        this.walk=undefined;this.nextScan=seconds+2;return;
      }
      const o=next.value;
      if(o instanceof T.PointLight && o.userData.environmentLight) {
        this.lights.add(o);this.foundLights.add(o);
      }
      if(!(o instanceof T.Mesh))continue;
      for(const m of Array.isArray(o.material)?o.material:[o.material]) {
        if(!(m instanceof T.MeshStandardMaterial)
          || (!m.userData.environmentLight && !m.userData.environmentSurface && !m.userData.environmentWindow))continue;
        this.foundMaterials.add(m);
        if(!this.materials.has(m)) { this.materials.add(m);this.onMaterial(m); }
      }
    }
  }
  private *nodes(root:T.Object3D):Generator<T.Object3D> {
    yield root;
    for(const child of root.children)yield* this.nodes(child);
  }
  dispose() { this.walk=undefined;this.materials.clear();this.lights.clear();this.foundMaterials.clear();this.foundLights.clear(); }
}
