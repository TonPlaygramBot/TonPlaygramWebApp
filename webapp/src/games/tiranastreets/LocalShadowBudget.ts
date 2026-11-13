import * as T from 'three';

/** Keep the existing shadow atlas around the player throughout the city.
 * Light-space texel snapping avoids sub-pixel shimmer; capped refresh avoids
 * drawing the shadow pass 90/120 times per second on high refresh phones. */
export class LocalShadowBudget {
  private elapsed = Infinity;
  private center = new T.Vector3(Infinity, Infinity, Infinity);
  private point = new T.Vector3();
  private offset = new T.Vector3(-100, 160, -90);
  private rotation = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(this.offset, new T.Vector3(), new T.Vector3(0, 1, 0)));
  private inverse = this.rotation.clone().invert();
  update(light: T.DirectionalLight, focus: {x:number;y:number;z:number}, dt: number, high: boolean) {
    const shadow = light.shadow, camera = shadow.camera;
    const texel = (camera.right - camera.left) / shadow.mapSize.x;
    this.point.copy(focus).applyQuaternion(this.inverse);
    this.point.x = Math.round(this.point.x / texel) * texel;
    this.point.y = Math.round(this.point.y / texel) * texel;
    this.point.applyQuaternion(this.rotation);
    this.elapsed += Math.max(0, dt);
    const teleported = this.center.distanceToSquared(this.point) > 64;
    if (!teleported && this.elapsed < 1 / (high ? 30 : 20) && !shadow.needsUpdate) return false;
    light.target.position.copy(this.point);
    light.position.copy(this.point).add(this.offset);
    light.target.updateMatrixWorld();
    this.center.copy(this.point); this.elapsed = 0;
    shadow.needsUpdate = true;
    return true;
  }
}
