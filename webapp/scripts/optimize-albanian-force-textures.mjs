// Keep all PBR channels; cap embedded texture dimensions for mobile GPU memory.
import {readFile, writeFile} from 'node:fs/promises';
import sharp from 'sharp';
const path = process.argv[2];
if (!path) throw Error('Pass a GLB path');
const bytes = await readFile(path), jsonLength = bytes.readUInt32LE(12);
const doc = JSON.parse(bytes.subarray(20, 20 + jsonLength));
const bin = bytes.subarray(28 + jsonLength);
const views = doc.bufferViews.map(v => Buffer.from(bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength)));
for (const image of doc.images || []) {
  if (image.bufferView === undefined) throw Error('Force textures must be embedded');
  const input = views[image.bufferView], metadata = await sharp(input).metadata();
  if (Math.max(metadata.width, metadata.height) <= 1024) continue;
  const resized = sharp(input).resize({width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true});
  views[image.bufferView] = image.mimeType === 'image/jpeg'
    ? await resized.jpeg({quality: 88, chromaSubsampling: '4:4:4'}).toBuffer()
    : await resized.png({compressionLevel: 9}).toBuffer();
}
const chunks = []; let offset = 0;
doc.bufferViews.forEach((view, i) => {
  const padding = Buffer.alloc((4 - offset % 4) % 4); chunks.push(padding); offset += padding.length;
  view.byteOffset = offset; view.byteLength = views[i].length; view.buffer = 0;
  chunks.push(views[i]); offset += views[i].length;
});
doc.buffers = [{byteLength: offset}]; chunks.push(Buffer.alloc((4 - offset % 4) % 4));
doc.asset.extras = {...doc.asset.extras, tiranaTextureMaxSize: 1024};
let json = Buffer.from(JSON.stringify(doc)); json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
const binary = Buffer.concat(chunks), header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + binary.length, 8);
header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
binHeader.writeUInt32LE(binary.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
await writeFile(path, Buffer.concat([header, json, binHeader, binary]));
