import * as T from 'three';
type Face = {
  p: number[];
  z: number;
  order: number;
  color: string;
  alpha: number;
  line: boolean;
};
/** CPU projection of the same meshes and skeletal animations when WebGL is unavailable. */
export class SoftwareRenderer {
  domElement = document.createElement('canvas');
  context: CanvasRenderingContext2D;
  shadowMap = { enabled: false, type: T.PCFSoftShadowMap };
  outputColorSpace = '';
  toneMapping = 0;
  toneMappingExposure = 1;
  width = 1;
  height = 1;
  last = 0;
  ratio = 1;
  textures = new WeakMap<T.Texture, ImageData>();
  constructor() {
    const c = this.domElement.getContext('2d');
    if (!c) throw Error('Canvas unavailable');
    this.context = c;
  }
  setPixelRatio(r: number) {
    this.ratio = Math.min(r, 1.25);
  }
  setSize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.domElement.width = w * this.ratio;
    this.domElement.height = h * this.ratio;
  }
  dispose() {}
  render(scene: T.Scene, camera: T.Camera) {
    const now = performance.now();
    if (now - this.last < 32) return;
    this.last = now;
    const c = this.context,
      w = this.width,
      h = this.height;
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    c.globalAlpha = 1;
    c.fillStyle =
      scene.background instanceof T.Color
        ? scene.background.getStyle()
        : '#0c2833';
    c.fillRect(0, 0, w, h);
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    const vp = new T.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    const faces: Face[] = [];
    const world = new T.Matrix4(),
      inst = new T.Matrix4(),
      a = new T.Vector3(),
      b = new T.Vector3(),
      d = new T.Vector3(),
      normal = new T.Vector3(),
      ab = new T.Vector3(),
      ad = new T.Vector3(),
      color = new T.Color();
    scene.traverseVisible((o) => {
      if (!(o instanceof T.Mesh || o instanceof T.LineSegments)) return;
      if (o instanceof T.SkinnedMesh) o.skeleton.update();
      const geo = o.geometry,
        pos = geo.attributes.position;
      if (!pos) return;
      const index = geo.index,
        mats = Array.isArray(o.material) ? o.material : [o.material],
        groups = geo.groups.length
          ? geo.groups
          : [
              {
                start: 0,
                count: index ? index.count : pos.count,
                materialIndex: 0
              }
            ];
      const count = o instanceof T.InstancedMesh ? o.count : 1;
      for (let instance = 0; instance < count; instance++) {
        world.copy(o.matrixWorld);
        if (o instanceof T.InstancedMesh) {
          o.getMatrixAt(instance, inst);
          world.multiply(inst);
        }
        const projected: number[][] = [];
        for (let n = 0; n < pos.count; n++) {
          a.fromBufferAttribute(pos, n);
          if (o instanceof T.SkinnedMesh) o.applyBoneTransform(n, a);
          a.applyMatrix4(world);
          const wx = a.x,
            wy = a.y,
            wz = a.z;
          a.applyMatrix4(vp);
          projected.push([
            ((a.x + 1) * w) / 2,
            ((1 - a.y) * h) / 2,
            a.z,
            wx,
            wy,
            wz
          ]);
        }
        for (const group of groups) {
          const mat =
            mats.length === 1
              ? mats[0]
              : (mats[group.materialIndex || 0] as T.MeshStandardMaterial);
          if (!mat || !mat.visible) continue;
          const line = o instanceof T.LineSegments,
            stride = line ? 2 : 3;
          for (
            let n = group.start;
            n <
            Math.min(
              group.start + group.count,
              index ? index.count : pos.count
            );
            n += stride
          ) {
            const p = projected[index ? index.getX(n) : n],
              q = projected[index ? index.getX(n + 1) : n + 1],
              r = line ? q : projected[index ? index.getX(n + 2) : n + 2];
            if (!p || !q || !r || p[2] > 1 || q[2] > 1 || r[2] > 1) continue;
            if (
              Math.max(p[0], q[0], r[0]) < 0 ||
              Math.min(p[0], q[0], r[0]) > w ||
              Math.max(p[1], q[1], r[1]) < 0 ||
              Math.min(p[1], q[1], r[1]) > h
            )
              continue;
            const cross =
              (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
            if (!line && mat.side !== T.DoubleSide && cross >= 0) continue;
            color.copy(mat.color || new T.Color(0xffffff));
            let light = 1;
            if (mat.map && geo.attributes.uv) {
              let pixels = this.textures.get(mat.map);
              const img = mat.map.image;
              if (!pixels && img?.width) {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0);
                  pixels = ctx.getImageData(0, 0, img.width, img.height);
                  this.textures.set(mat.map, pixels);
                }
              }
              if (pixels) {
                const uv = geo.attributes.uv;
                const ids = [n, n + 1, n + 2].map((i) =>
                  index ? index.getX(i) : i
                );
                const u = ids.reduce((s, i) => s + uv.getX(i), 0) / 3,
                  v = ids.reduce((s, i) => s + uv.getY(i), 0) / 3;
                const x = Math.max(
                    0,
                    Math.min(pixels.width - 1, Math.floor(u * pixels.width))
                  ),
                  y = Math.max(
                    0,
                    Math.min(
                      pixels.height - 1,
                      Math.floor((mat.map.flipY ? 1 - v : v) * pixels.height)
                    )
                  );
                const offset = (y * pixels.width + x) * 4;
                color.setRGB(
                  pixels.data[offset] / 255,
                  pixels.data[offset + 1] / 255,
                  pixels.data[offset + 2] / 255,
                  T.SRGBColorSpace
                );
              }
            }
            if (!line && mat instanceof T.MeshStandardMaterial) {
              a.set(p[3], p[4], p[5]);
              b.set(q[3], q[4], q[5]);
              d.set(r[3], r[4], r[5]);
              normal
                .crossVectors(ab.subVectors(b, a), ad.subVectors(d, a))
                .normalize();
              light =
                0.7 +
                0.35 * Math.max(0, normal.dot(new T.Vector3(-0.4, 0.8, 0.35)));
            }
            color.multiplyScalar(light);
            faces.push({
              p: line
                ? [p[0], p[1], q[0], q[1]]
                : [p[0], p[1], q[0], q[1], r[0], r[1]],
              z: (p[2] + q[2] + r[2]) / 3,
              order: o.renderOrder,
              color: color.getStyle(),
              alpha: mat.opacity,
              line
            });
          }
        }
      }
    });
    faces.sort((a, b) => a.order - b.order || b.z - a.z);
    c.lineWidth = 0.7;
    for (const f of faces) {
      c.globalAlpha = f.alpha;
      c.beginPath();
      c.moveTo(f.p[0], f.p[1]);
      for (let i = 2; i < f.p.length; i += 2) c.lineTo(f.p[i], f.p[i + 1]);
      if (f.line) {
        c.strokeStyle = f.color;
        c.stroke();
      } else {
        c.closePath();
        c.fillStyle = f.color;
        c.fill();
      }
    }
    c.globalAlpha = 1;
  }
}
