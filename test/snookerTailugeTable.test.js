import fs from 'node:fs';
const {
  createTailugeTable,
  Group,
  GLTFLoader
} = require('./loadTailugeEngine.cjs');

test('the actual GLTF decodes, replaces the fallback and keeps valid cloth geometry', async () => {
  const json = JSON.parse(
    fs.readFileSync(
      'webapp/public/assets/snooker-tailuge/snooker.min.gltf',
      'utf8'
    )
  );
  const binary = fs.readFileSync(
    'webapp/public/assets/snooker-tailuge/snooker.min.bin'
  );
  expect(json.buffers[0].byteLength).toBe(binary.length);
  json.buffers[0].uri = `data:application/octet-stream;base64,${binary.toString('base64')}`;
  const originalLoad = GLTFLoader.prototype.load;
  const previousProgress = global.ProgressEvent;
  global.ProgressEvent = class {
    constructor(type, options) {
      this.type = type;
      Object.assign(this, options);
    }
  };
  let complete, fail;
  const loaded = new Promise((resolve, reject) => {
    complete = resolve;
    fail = reject;
  });
  GLTFLoader.prototype.load = function (url, onLoad) {
    expect(url).toBe('/assets/snooker-tailuge/snooker.min.gltf');
    this.parse(
      JSON.stringify(json),
      '',
      (gltf) => {
        onLoad(gltf);
        complete();
      },
      fail
    );
  };
  try {
    const table = createTailugeTable(new Group(), {
      width: 1.778,
      length: 3.569,
      radius: 0.03275,
      centerY: 0.8,
      tableY: 0,
      baulkZ: -1,
      dRadius: 0.292,
      spots: {
        yellow: [-0.292, -1],
        green: [0.292, -1],
        brown: [0, -1],
        blue: [0, 0],
        pink: [0, 0.8],
        black: [0, 1.4]
      },
      isDisposed: () => false
    });
    await loaded;
    // Exercise the contract used by the existing finish menu, including arrays
    // traversed before any user changes a finish.
    const source = fs.readFileSync(
      'webapp/src/pages/Games/SnookerRoyal.jsx',
      'utf8'
    );
    const finish = source.slice(
      source.indexOf('function applyTableFinishToTable'),
      source.indexOf('function SnookerRoyalGame')
    );
    for (const match of finish.matchAll(/finishInfo\.parts\.(\w+)\.forEach/g)) {
      expect(Array.isArray(table.group.userData.finish.parts[match[1]])).toBe(
        true
      );
    }
    expect(table.group.userData.finish.clothMat).toBe(table.clothMat);
    expect(table.group.userData.modelLoaded).toBe(true);
    const cloth = [];
    table.group.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const p = mesh.geometry.getAttribute('position');
      expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
      if (mesh.material === table.clothMat) cloth.push(mesh);
    });
    expect(cloth.length).toBe(2);
    const top = cloth[0].geometry.getAttribute('position');
    expect(
      Math.max(...Array.from({ length: top.count }, (_, i) => top.getY(i)))
    ).toBeCloseTo(0.8 - 0.03275, 3);
    expect(table.group.userData.finish.parts.railMeshes).toHaveLength(2);
  } finally {
    GLTFLoader.prototype.load = originalLoad;
    global.ProgressEvent = previousProgress;
  }
});
