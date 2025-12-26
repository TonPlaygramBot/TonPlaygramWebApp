const TYPE_COMPONENTS = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3
};

const MATERIAL_TEMPLATE = {
  pbrMetallicRoughness: {
    baseColorFactor: [0.95, 0.87, 0.72, 1],
    metallicFactor: 0.05,
    roughnessFactor: 0.85
  }
};

const encodeBufferToDataUri = (buffer) => {
  const view = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < view.length; i++) {
    binary += String.fromCharCode(view[i]);
  }
  return `data:application/octet-stream;base64,${btoa(binary)}`;
};

const packBufferSections = (sections) => {
  let offset = 0;
  const layout = [];

  sections.forEach((section) => {
    const aligned = Math.ceil(offset / 4) * 4;
    const padding = aligned - offset;
    offset = aligned;

    layout.push({
      ...section,
      byteOffset: offset,
      padding
    });

    offset += section.data.byteLength;
  });

  const buffer = new ArrayBuffer(offset);
  const target = new Uint8Array(buffer);

  layout.forEach((section) => {
    const slice = new Uint8Array(section.data.buffer, section.data.byteOffset, section.data.byteLength);
    target.set(slice, section.byteOffset);
  });

  return { buffer, layout };
};

const computeMinMax = (values, stride) => {
  const min = new Array(stride).fill(Number.POSITIVE_INFINITY);
  const max = new Array(stride).fill(Number.NEGATIVE_INFINITY);

  for (let i = 0; i < values.length; i += stride) {
    for (let c = 0; c < stride; c++) {
      const value = values[i + c];
      if (value < min[c]) min[c] = value;
      if (value > max[c]) max[c] = value;
    }
  }

  return { min, max };
};

export function createGltfFromGeometry({
  name,
  positions,
  normals,
  uvs,
  indices,
  materialOverrides = {}
}) {
  const sections = [
    {
      key: 'POSITION',
      data: new Float32Array(positions),
      componentType: 5126,
      type: 'VEC3',
      target: 34962
    }
  ];

  if (normals?.length) {
    sections.push({
      key: 'NORMAL',
      data: new Float32Array(normals),
      componentType: 5126,
      type: 'VEC3',
      target: 34962
    });
  }

  if (uvs?.length) {
    sections.push({
      key: 'TEXCOORD_0',
      data: new Float32Array(uvs),
      componentType: 5126,
      type: 'VEC2',
      target: 34962
    });
  }

  sections.push({
    key: 'INDICES',
    data: new Uint16Array(indices),
    componentType: 5123,
    type: 'SCALAR',
    target: 34963
  });

  const { buffer, layout } = packBufferSections(sections);

  const bufferViews = layout.map((section) => ({
    buffer: 0,
    byteOffset: section.byteOffset,
    byteLength: section.data.byteLength,
    target: section.target
  }));

  const accessors = [];
  let positionAccessorIndex = -1;
  let indexAccessorIndex = -1;
  const attributeAccessors = {};

  layout.forEach((section, index) => {
    const componentCount = TYPE_COMPONENTS[section.type];
    const accessor = {
      bufferView: index,
      componentType: section.componentType,
      count: section.data.length / componentCount,
      type: section.type
    };

    if (section.key === 'POSITION') {
      positionAccessorIndex = index;
      const { min, max } = computeMinMax(section.data, componentCount);
      accessor.min = min;
      accessor.max = max;
      attributeAccessors.POSITION = index;
    }

    if (section.key === 'NORMAL') {
      attributeAccessors.NORMAL = index;
    }

    if (section.key === 'TEXCOORD_0') {
      attributeAccessors.TEXCOORD_0 = index;
    }

    if (section.key === 'INDICES') {
      indexAccessorIndex = index;
    }

    accessors.push(accessor);
  });

  if (positionAccessorIndex === -1 || indexAccessorIndex === -1) {
    throw new Error('A glTF mesh requires at least POSITION and INDICES accessors.');
  }

  const pbrMetallicRoughness = {
    ...MATERIAL_TEMPLATE.pbrMetallicRoughness,
    ...(materialOverrides.baseColorFactor ? { baseColorFactor: materialOverrides.baseColorFactor } : {}),
    ...(materialOverrides.metallicFactor !== undefined ? { metallicFactor: materialOverrides.metallicFactor } : {}),
    ...(materialOverrides.roughnessFactor !== undefined ? { roughnessFactor: materialOverrides.roughnessFactor } : {})
  };

  const gltf = {
    asset: {
      version: '2.0',
      generator: 'TonPlaygram procedural glTF builder'
    },
    buffers: [
      {
        uri: encodeBufferToDataUri(buffer),
        byteLength: buffer.byteLength
      }
    ],
    bufferViews,
    accessors,
    materials: [
      {
        name: `${name}Material`,
        ...MATERIAL_TEMPLATE,
        pbrMetallicRoughness
      }
    ],
    meshes: [
      {
        name: `${name}Mesh`,
        primitives: [
          {
            attributes: attributeAccessors,
            indices: indexAccessorIndex,
            material: 0
          }
        ]
      }
    ],
    nodes: [
      {
        mesh: 0,
        name: `${name}Node`
      }
    ],
    scenes: [
      {
        nodes: [0]
      }
    ],
    scene: 0
  };

  return gltf;
}

const createCubeGeometry = (size = 1) => {
  const half = size / 2;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const faces = [
    {
      normal: [0, 0, 1],
      corners: [
        [-half, -half, half],
        [half, -half, half],
        [half, half, half],
        [-half, half, half]
      ]
    },
    {
      normal: [0, 0, -1],
      corners: [
        [half, -half, -half],
        [-half, -half, -half],
        [-half, half, -half],
        [half, half, -half]
      ]
    },
    {
      normal: [0, 1, 0],
      corners: [
        [-half, half, half],
        [half, half, half],
        [half, half, -half],
        [-half, half, -half]
      ]
    },
    {
      normal: [0, -1, 0],
      corners: [
        [-half, -half, -half],
        [half, -half, -half],
        [half, -half, half],
        [-half, -half, half]
      ]
    },
    {
      normal: [1, 0, 0],
      corners: [
        [half, -half, half],
        [half, -half, -half],
        [half, half, -half],
        [half, half, half]
      ]
    },
    {
      normal: [-1, 0, 0],
      corners: [
        [-half, -half, -half],
        [-half, -half, half],
        [-half, half, half],
        [-half, half, -half]
      ]
    }
  ];

  faces.forEach((face) => {
    const startIndex = positions.length / 3;
    const faceUvs = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1]
    ];

    face.corners.forEach((corner, cornerIndex) => {
      positions.push(...corner);
      normals.push(...face.normal);
      uvs.push(...faceUvs[cornerIndex]);
    });

    indices.push(
      startIndex,
      startIndex + 1,
      startIndex + 2,
      startIndex,
      startIndex + 2,
      startIndex + 3
    );
  });

  return { positions, normals, uvs, indices };
};

const createGroundPlaneGeometry = (size = 1) => {
  const half = size / 2;
  const positions = [
    -half, 0, -half,
    half, 0, -half,
    half, 0, half,
    -half, 0, half
  ];
  const normals = [
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0
  ];
  const uvs = [
    0, 0,
    1, 0,
    1, 1,
    0, 1
  ];
  const indices = [0, 1, 2, 0, 2, 3];
  return { positions, normals, uvs, indices };
};

const createHexPrismGeometry = (radius = 0.5, height = 0.3) => {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const topY = height / 2;
  const bottomY = -height / 2;
  const segments = 6;
  const step = (Math.PI * 2) / segments;

  const addVertex = (position, normal, uv) => {
    positions.push(...position);
    normals.push(...normal);
    uvs.push(...uv);
    return (positions.length / 3) - 1;
  };

  const radialToUv = (x, z) => [x / (radius * 2) + 0.5, z / (radius * 2) + 0.5];

  const topCenter = addVertex([0, topY, 0], [0, 1, 0], [0.5, 0.5]);
  const bottomCenter = addVertex([0, bottomY, 0], [0, -1, 0], [0.5, 0.5]);

  const topRing = [];
  const bottomRing = [];

  for (let i = 0; i < segments; i++) {
    const angle = step * i;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    topRing.push(addVertex([x, topY, z], [0, 1, 0], radialToUv(x, z)));
    bottomRing.push(addVertex([x, bottomY, z], [0, -1, 0], radialToUv(x, z)));
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    indices.push(topCenter, topRing[i], topRing[next]);
    indices.push(bottomCenter, bottomRing[next], bottomRing[i]);
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const angle = step * i;
    const nextAngle = step * (i + 1);
    const x0 = Math.cos(angle) * radius;
    const z0 = Math.sin(angle) * radius;
    const x1 = Math.cos(nextAngle) * radius;
    const z1 = Math.sin(nextAngle) * radius;
    const normal = (() => {
      const nx = x0 + x1;
      const nz = z0 + z1;
      const length = Math.hypot(nx, nz) || 1;
      return [nx / length, 0, nz / length];
    })();

    const bottom0 = addVertex([x0, bottomY, z0], normal, [0, 0]);
    const bottom1 = addVertex([x1, bottomY, z1], normal, [1, 0]);
    const top1 = addVertex([x1, topY, z1], normal, [1, 1]);
    const top0 = addVertex([x0, topY, z0], normal, [0, 1]);

    indices.push(bottom0, bottom1, top1, bottom0, top1, top0);
  }

  return { positions, normals, uvs, indices };
};

const definitions = [
  {
    id: 'voxel-cube',
    name: 'Voxel Cube',
    description: 'Unit cube with per-face normals for crisp lighting in voxel or arcade scenes.',
    tags: ['Collision-ready', 'Low-poly', 'Grid aligned'],
    material: {
      baseColorFactor: [0.94, 0.82, 0.62, 1],
      roughnessFactor: 0.9
    },
    geometryFactory: () => createCubeGeometry(1)
  },
  {
    id: 'ground-tile',
    name: 'Ground Tile',
    description: '1×1m tiled plane for floors, arenas, or board-game cells.',
    tags: ['UV mapped', 'Snaps to grid', 'Single quad'],
    material: {
      baseColorFactor: [0.76, 0.92, 0.84, 1],
      roughnessFactor: 0.75
    },
    geometryFactory: () => createGroundPlaneGeometry(1)
  },
  {
    id: 'hex-plinth',
    name: 'Hex Support Plinth',
    description: 'Low-profile hexagonal pillar for props, podiums, or modular terrain.',
    tags: ['Caps included', 'Even texels', 'Hero prop base'],
    material: {
      baseColorFactor: [0.85, 0.9, 0.98, 1],
      roughnessFactor: 0.8
    },
    geometryFactory: () => createHexPrismGeometry(0.5, 0.3)
  }
];

export const getProceduralLibraryEntries = () =>
  definitions.map((definition) => {
    const geometry = definition.geometryFactory();
    const gltf = createGltfFromGeometry({
      name: definition.name,
      positions: geometry.positions,
      normals: geometry.normals,
      uvs: geometry.uvs,
      indices: geometry.indices,
      materialOverrides: definition.material
    });
    const text = JSON.stringify(gltf, null, 2);

    return {
      ...definition,
      gltf,
      download: {
        fileName: `${definition.id}.gltf`,
        sizeKb: Math.max(1, Math.ceil(text.length / 1024)),
        text
      },
      stats: {
        triangles: geometry.indices.length / 3,
        vertices: geometry.positions.length / 3
      }
    };
  });

export const buildProceduralBundle = (entries = getProceduralLibraryEntries()) => ({
  generatedAt: new Date().toISOString(),
  note: 'Text-only glTF pack; generate binaries on demand client-side.',
  objects: entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    description: entry.description,
    gltf: entry.gltf
  }))
});
