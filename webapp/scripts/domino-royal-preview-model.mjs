import sharp from 'sharp';
import { createHash } from 'node:crypto';

/** Compact only embedded images. Geometry, skin data and node transforms stay exact. */
export async function compactPreviewModel(source) {
  const jsonLength = source.readUInt32LE(12);
  const document = JSON.parse(source.subarray(20, 20 + jsonLength).toString('utf8'));
  const binary = source.subarray(28 + jsonLength);
  const imageByView = new Map((document.images || []).map((image) => [image.bufferView, image]));
  const chunks = []; let length = 0;
  const sourceGeometry = createHash('sha256'), packedGeometry = createHash('sha256');
  for (let index = 0; index < document.bufferViews.length; index++) {
    const view = document.bufferViews[index];
    let bytes = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    const image = imageByView.get(index);
    if (image) {
      const resized = sharp(bytes).resize({ width: 192, height: 192, fit: 'inside', withoutEnlargement: true });
      const metadata = await sharp(bytes).metadata();
      if (metadata.hasAlpha) { bytes = await resized.png({ palette: true, colours: 256, compressionLevel: 9 }).toBuffer(); image.mimeType = 'image/png'; }
      else { bytes = await resized.jpeg({ quality: 83, chromaSubsampling: '4:4:4' }).toBuffer(); image.mimeType = 'image/jpeg'; }
    } else { sourceGeometry.update(bytes); packedGeometry.update(bytes); }
    const padding = (4 - length % 4) % 4;
    if (padding) { chunks.push(Buffer.alloc(padding)); length += padding; }
    view.byteOffset = length; view.byteLength = bytes.length; view.buffer = 0;
    chunks.push(bytes); length += bytes.length;
  }
  document.buffers = [{ byteLength: length }];
  let json = Buffer.from(JSON.stringify(document));
  json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const data = Buffer.concat([...chunks, Buffer.alloc((4 - length % 4) % 4)]);
  const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + data.length, 8); header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const binaryHeader = Buffer.alloc(8); binaryHeader.writeUInt32LE(data.length); binaryHeader.writeUInt32LE(0x004e4942, 4);
  const originalGeometrySha256 = sourceGeometry.digest('hex'), geometrySha256 = packedGeometry.digest('hex');
  if (originalGeometrySha256 !== geometrySha256) throw new Error('Preview geometry changed while packing images.');
  return { model: Buffer.concat([header, json, binaryHeader, data]), geometrySha256, sourceBytes: source.length, images: imageByView.size };
}
