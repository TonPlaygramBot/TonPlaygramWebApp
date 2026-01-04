import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const OUTPUT_PATH = fileURLToPath(
  new URL('../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', import.meta.url)
);
const WIDTH = 1024;
const HEIGHT = 1024;
const BACKGROUND = [0x0b, 0x12, 0x24, 0xff];

const CRC_TABLE = (() => {
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.allocUnsafe(4);
  len.writeUInt32BE(data.length, 0);
  const name = Buffer.from(type, 'ascii');
  const crcBuffer = Buffer.concat([name, data]);
  const crc = Buffer.allocUnsafe(4);
  crc.writeUInt32BE(crc32(crcBuffer), 0);
  return Buffer.concat([len, name, data, crc]);
}

function createImageData() {
  const bytesPerRow = WIDTH * 4;
  const raw = Buffer.alloc((bytesPerRow + 1) * HEIGHT);

  for (let y = 0; y < HEIGHT; y += 1) {
    const rowStart = y * (bytesPerRow + 1);
    raw[rowStart] = 0x00; // filter type None
    for (let x = 0; x < WIDTH; x += 1) {
      const pixelStart = rowStart + 1 + (x * 4);
      raw[pixelStart] = BACKGROUND[0];
      raw[pixelStart + 1] = BACKGROUND[1];
      raw[pixelStart + 2] = BACKGROUND[2];
      raw[pixelStart + 3] = BACKGROUND[3];
    }
  }

  return deflateSync(raw, { level: 9 });
}

async function buildIcon() {
  const ihdrData = Buffer.allocUnsafe(13);
  ihdrData.writeUInt32BE(WIDTH, 0);
  ihdrData.writeUInt32BE(HEIGHT, 4);
  ihdrData.writeUInt8(8, 8); // bit depth
  ihdrData.writeUInt8(6, 9); // color type RGBA
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = createChunk('IHDR', ihdrData);
  const idat = createChunk('IDAT', createImageData());
  const iend = createChunk('IEND', Buffer.alloc(0));

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, Buffer.concat([signature, ihdr, idat, iend]));
}

buildIcon().catch((error) => {
  console.error('Failed to generate iOS icon', error);
  process.exitCode = 1;
});
