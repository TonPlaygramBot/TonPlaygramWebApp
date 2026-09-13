import * as THREE from "three";

type Face = { p: number[]; depth: number; order: number; fill: string; alpha: number; image?: CanvasImageSource; uv?: number[]; iw?: number; ih?: number };
/** CPU projection of the same Three.js scene for browsers without a GPU context. */
export class AirHockeySoftwareRenderer {
  domElement = document.createElement("canvas");
  context = this.domElement.getContext("2d", { alpha: true })!;
  shadowMap = { enabled: false, type: 0 };
  outputColorSpace: string = ""; toneMapping: number = 0; toneMappingExposure = 1;
  width = 1; height = 1; ratio = 1; isSoftwareRenderer = true;
  background = document.createElement("canvas"); backgroundKey = ""; staticVersion = 0;
  matrix = new THREE.Matrix4(); world = new THREE.Vector3(); normal = new THREE.Vector3(); normalMatrix = new THREE.Matrix3();
  light = new THREE.Vector3(-.4, .9, .3).normalize();
  setPixelRatio(ratio: number) { this.ratio = Math.min(ratio, 1.4); }
  setClearColor(_color: number, _alpha: number) {}
  setSize(w: number, h: number) { this.width = w; this.height = h; this.domElement.width = Math.round(w * this.ratio); this.domElement.height = Math.round(h * this.ratio); this.background.width = this.domElement.width; this.background.height = this.domElement.height; this.backgroundKey = ""; this.domElement.style.width = w + "px"; this.domElement.style.height = h + "px"; }
  render(scene: THREE.Scene, camera: THREE.Camera) {
    const ctx = this.context, w = this.width, h = this.height;
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0); ctx.clearRect(0, 0, w, h); ctx.fillStyle = "#050505"; ctx.fillRect(0, 0, w, h);
    scene.updateMatrixWorld(); camera.updateMatrixWorld();
    const key = camera.matrixWorld.elements.join(",") + camera.projectionMatrix.elements.join(",") + this.staticVersion;
    const cached = key === this.backgroundKey;
    if (cached) ctx.drawImage(this.background, 0, 0, w, h);
    const viewProjection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const faces: Face[] = [];
    // A soft contact shadow keeps the table grounded without GPU shadow maps.
    if (!cached) {
    this.world.set(0, -3.36, .1).project(camera);
    ctx.save(); ctx.translate((this.world.x + 1) * w / 2, (1 - this.world.y) * h / 2); ctx.scale(1, .52);
    const shadow = ctx.createRadialGradient(0, 0, w * .12, 0, 0, w * .48);
    shadow.addColorStop(0, "#0009"); shadow.addColorStop(1, "#0000"); ctx.fillStyle = shadow; ctx.fillRect(-w / 2, -w / 2, w, w); ctx.restore();
    }
    scene.traverseVisible(obj => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (cached && obj.renderOrder < 3) return;
      if (obj.geometry.type === "PlaneGeometry" && obj.position.y < -3) return;
      const geometry = obj.geometry, pos = geometry.getAttribute("position"), normals = geometry.getAttribute("normal"), uvs = geometry.getAttribute("uv"), idx = geometry.index;
      const material = (Array.isArray(obj.material) ? obj.material[0] : obj.material) as THREE.MeshStandardMaterial;
      if (!material.visible || material.opacity < .01 || !pos) return;
      this.matrix.multiplyMatrices(viewProjection, obj.matrixWorld); this.normalMatrix.getNormalMatrix(obj.matrixWorld);
      const projected = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        this.world.fromBufferAttribute(pos, i).applyMatrix4(this.matrix);
        projected[i * 3] = (this.world.x + 1) * w / 2; projected[i * 3 + 1] = (1 - this.world.y) * h / 2; projected[i * 3 + 2] = this.world.z;
      }
      const count = idx ? idx.count : pos.count;
      for (let n = 0; n < count; n += 3) {
        const a = idx ? idx.getX(n) : n, b = idx ? idx.getX(n + 1) : n + 1, c = idx ? idx.getX(n + 2) : n + 2;
        const p = [projected[a * 3], projected[a * 3 + 1], projected[b * 3], projected[b * 3 + 1], projected[c * 3], projected[c * 3 + 1]];
        const depth = (projected[a * 3 + 2] + projected[b * 3 + 2] + projected[c * 3 + 2]) / 3;
        if (depth > 1 || depth < -1) continue;
        if (Math.max(p[0], p[2], p[4]) < 0 || Math.min(p[0], p[2], p[4]) > w || Math.max(p[1], p[3], p[5]) < 0 || Math.min(p[1], p[3], p[5]) > h) continue;
        const winding = (p[2] - p[0]) * (p[5] - p[1]) - (p[3] - p[1]) * (p[4] - p[0]);
        if (material.side !== THREE.DoubleSide && winding >= 0) continue;
        if (Math.abs(winding) < .03) continue;
        let light = 1;
        if (normals && material.type !== "MeshBasicMaterial") {
          this.normal.fromBufferAttribute(normals, a).applyNormalMatrix(this.normalMatrix);
          light = .55 + Math.max(0, this.normal.dot(this.light)) * .62;
        }
        const color = material.color || new THREE.Color(0xffffff);
        const to = (v: number) => Math.round(THREE.MathUtils.clamp(Math.pow(v, 1 / 2.2) * light * 255, 0, 255));
        const onSurface = material.map && Math.abs(pos.getY(a)) < .01 && Math.abs(pos.getY(b)) < .01 && Math.abs(pos.getY(c)) < .01;
        const face: Face = { p, depth, order: obj.renderOrder + (onSurface ? 1 : 0), alpha: material.opacity, fill: `rgb(${to(color.r)},${to(color.g)},${to(color.b)})` };
        const image = material.map?.image as HTMLImageElement | undefined;
        if (material.map) face.fill = light > 1 ? "#293c48" : light > .8 ? "#1f303e" : "#101e2a";
        if (onSurface && image?.complete && image.naturalWidth > 0 && uvs) {
          face.image = image; face.iw = image.naturalWidth; face.ih = image.naturalHeight;
          face.uv = [uvs.getX(a), uvs.getY(a), uvs.getX(b), uvs.getY(b), uvs.getX(c), uvs.getY(c)];
          face.fill = "#effcfe";
        }
        if (onSurface && face.uv) {
          const vertices = [a, b, c].map(i => [pos.getX(i), pos.getY(i), pos.getZ(i), uvs.getX(i), uvs.getY(i)]);
          const subdivide = (v: number[][], level: number) => {
            if (level) {
              const mid = (a: number[], b: number[]) => a.map((n, i) => (n + b[i]) / 2);
              const ab = mid(v[0], v[1]), bc = mid(v[1], v[2]), ca = mid(v[2], v[0]);
              for (const triangle of [[v[0], ab, ca], [ab, v[1], bc], [ca, bc, v[2]], [ab, bc, ca]]) subdivide(triangle, level - 1);
              return;
            }
            const points = v.map(vertex => new THREE.Vector3(vertex[0], vertex[1], vertex[2]).applyMatrix4(this.matrix));
            faces.push({ ...face, p: points.flatMap(p => [(p.x + 1) * w / 2, (1 - p.y) * h / 2]), depth: points.reduce((sum, p) => sum + p.z, 0) / 3, uv: v.flatMap(p => [p[3], p[4]]) });
          };
          subdivide(vertices, 2);
        } else faces.push(face);
      }
    });
    faces.sort((a, b) => a.order - b.order || b.depth - a.depth);
    let backgroundSaved = cached;
    for (const face of faces) {
      if (!backgroundSaved && face.order >= 3) {
        const backing = this.background.getContext("2d")!;
        backing.clearRect(0, 0, this.background.width, this.background.height);
        backing.drawImage(this.domElement, 0, 0); this.backgroundKey = key; backgroundSaved = true;
      }
      const p = face.p; ctx.globalAlpha = face.alpha;
      const cx = (p[0] + p[2] + p[4]) / 3, cy = (p[1] + p[3] + p[5]) / 3;
      const outline = face.image ? p.map((value, i) => value + Math.sign(value - (i % 2 ? cy : cx)) * .35) : p;
      ctx.beginPath(); ctx.moveTo(outline[0], outline[1]); ctx.lineTo(outline[2], outline[3]); ctx.lineTo(outline[4], outline[5]); ctx.closePath();
      ctx.fillStyle = face.fill; ctx.fill();
      if (face.image && face.uv) {
        const uv = face.uv, iw = face.iw!, ih = face.ih!;
        const u0 = uv[0] * iw, v0 = uv[1] * ih, u1 = uv[2] * iw, v1 = uv[3] * ih, u2 = uv[4] * iw, v2 = uv[5] * ih;
        const det = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
        if (Math.abs(det) > .01) {
          const a = ((p[2] - p[0]) * (v2 - v0) - (p[4] - p[0]) * (v1 - v0)) / det;
          const b = ((p[3] - p[1]) * (v2 - v0) - (p[5] - p[1]) * (v1 - v0)) / det;
          const c = ((p[4] - p[0]) * (u1 - u0) - (p[2] - p[0]) * (u2 - u0)) / det;
          const d = ((p[5] - p[1]) * (u1 - u0) - (p[3] - p[1]) * (u2 - u0)) / det;
          ctx.save(); ctx.clip(); ctx.transform(a, b, c, d, p[0] - a * u0 - c * v0, p[1] - b * u0 - d * v0); ctx.drawImage(face.image, 0, 0); ctx.restore();
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  dispose() { this.domElement.width = this.domElement.height = 1; }
}
