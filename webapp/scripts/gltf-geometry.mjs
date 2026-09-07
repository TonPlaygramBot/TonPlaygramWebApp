// Headless geometry verification using the same bundled official Draco decoder
// as the browser. Textures are omitted; this is not a GPU rendering check.
import * as T from 'three';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const assets = new URL('../public/assets/tirana-streets/', import.meta.url);
const decoderFile = new URL('draco/draco_wasm_wrapper.js', assets);
const commonjs = { exports: {} };
new Function(
  'module',
  'exports',
  'require',
  '__dirname',
  '__filename',
  readFileSync(decoderFile, 'utf8')
)(
  commonjs,
  commonjs.exports,
  createRequire(import.meta.url),
  fileURLToPath(new URL('.', decoderFile)),
  fileURLToPath(decoderFile)
);
const draco = await commonjs.exports({
  wasmBinary: readFileSync(new URL('draco/draco_decoder.wasm', assets))
});
const adapter = {
  preload() {},
  decodeDracoFile(buffer, done, ids, types, _color, fail) {
    const decoder = new draco.Decoder(),
      mesh = new draco.Mesh();
    try {
      const result = decoder.DecodeArrayToMesh(
        new Int8Array(buffer),
        buffer.byteLength,
        mesh
      );
      if (!result.ok()) throw Error(result.error_msg());
      const geometry = new T.BufferGeometry(),
        count = mesh.num_faces() * 3;
      let ptr = draco._malloc(count * 4);
      decoder.GetTrianglesUInt32Array(mesh, count * 4, ptr);
      geometry.setIndex(
        new T.BufferAttribute(
          new Uint32Array(draco.HEAPU8.buffer, ptr, count).slice(),
          1
        )
      );
      draco._free(ptr);
      for (const [name, id] of Object.entries(ids)) {
        const attr = decoder.GetAttributeByUniqueId(mesh, id),
          size = attr.num_components(),
          n = mesh.num_points() * size;
        const ArrayType = globalThis[types[name]],
          byteLength = n * ArrayType.BYTES_PER_ELEMENT;
        const dataType = {
          Float32Array: draco.DT_FLOAT32,
          Uint16Array: draco.DT_UINT16,
          Uint8Array: draco.DT_UINT8
        }[types[name]];
        if (!dataType)
          throw Error('Unsupported verification type: ' + types[name]);
        ptr = draco._malloc(byteLength);
        decoder.GetAttributeDataArrayForAllPoints(
          mesh,
          attr,
          dataType,
          byteLength,
          ptr
        );
        geometry.setAttribute(
          name,
          new T.BufferAttribute(
            new ArrayType(draco.HEAPU8.buffer, ptr, n).slice(),
            size
          )
        );
        draco._free(ptr);
      }
      done(geometry);
    } catch (error) {
      fail(error);
    } finally {
      draco.destroy(mesh);
      draco.destroy(decoder);
    }
  }
};
export async function geometryOnly(name) {
  const b = readFileSync(new URL(name, assets)),
    n = b.readUInt32LE(12),
    j = JSON.parse(b.subarray(20, 20 + n).toString());
  j.buffers[0].uri =
    'data:application/octet-stream;base64,' +
    b.subarray(28 + n).toString('base64');
  delete j.images;
  delete j.textures;
  for (const m of j.materials ?? []) {
    delete m.normalTexture;
    delete m.occlusionTexture;
    delete m.emissiveTexture;
    if (m.pbrMetallicRoughness) {
      delete m.pbrMetallicRoughness.baseColorTexture;
      delete m.pbrMetallicRoughness.metallicRoughnessTexture;
    }
  }
  globalThis.ProgressEvent ??= class {};
  return new GLTFLoader()
    .setDRACOLoader(adapter)
    .parseAsync(JSON.stringify(j), '');
}
