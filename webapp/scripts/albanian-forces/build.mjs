/** Offline-only authoring tools; preserve pivots, skinning and animation. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
if (!process.argv[2])
  throw Error('Usage: node build.mjs /path/to/Albanian-Forces-V2');
const input = path.resolve(process.argv[2]);
const output = fileURLToPath(
  new URL('../../public/assets/kart-royale/albanian-forces/', import.meta.url)
);
const manifest = JSON.parse(
  await fs.readFile(path.join(input, 'manifest.json'), 'utf8')
);
await fs.mkdir(output, { recursive: true });
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const records = [];
for (const asset of manifest) {
  const src = await fs
    .readFile(path.join(input, `${asset.id}.glb`))
    .catch(() => fs.readFile(path.join(input, 'glb', `${asset.id}.glb`)));
  for (const low of [false, true]) {
    const doc = await io.readBinary(src);
    await doc.transform(dedup(), weld());
    if (low)
      await doc.transform(
        simplify({
          simplifier: MeshoptSimplifier,
          ratio: asset.category === 'person' ? 0.12 : 0.2,
          error: 0.02
        })
      );
    await doc.transform(prune({ keepLeaves: true }));
    for (const texture of doc.getRoot().listTextures()) {
      const source = texture.getImage();
      if (!source) continue;
      const meta = await sharp(source).metadata();
      const size = low ? 512 : 1024;
      let pipeline = sharp(source).resize({
        width: size,
        height: size,
        fit: 'inside',
        withoutEnlargement: true
      });
      pipeline = meta.hasAlpha
        ? pipeline.png({ compressionLevel: 9 })
        : pipeline.jpeg({ quality: low ? 76 : 86 });
      texture
        .setImage(await pipeline.toBuffer())
        .setMimeType(meta.hasAlpha ? 'image/png' : 'image/jpeg');
    }
    const name = `${asset.id}${low ? '-lod' : ''}.glb`;
    const data = await io.writeBinary(doc);
    await fs.writeFile(path.join(output, name), data);
    const triangles = doc
      .getRoot()
      .listMeshes()
      .reduce(
        (sum, m) =>
          sum +
          m
            .listPrimitives()
            .reduce(
              (s, p) =>
                s +
                (p.getIndices()?.getCount() ||
                  p.getAttribute('POSITION').getCount()) /
                  3,
              0
            ),
        0
      );
    records.push({
      id: asset.id,
      category: asset.category,
      file: name,
      low,
      bytes: data.length,
      triangles,
      animations: doc
        .getRoot()
        .listAnimations()
        .map((a) => a.getName())
    });
    console.log(
      `${name}: ${triangles} triangles, ${(data.length / 1048576).toFixed(2)} MiB`
    );
  }
}
await fs.writeFile(
  path.join(output, 'manifest.json'),
  JSON.stringify(records, null, 2) + '\n'
);
