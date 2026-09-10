import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  mergeGeometries,
  mergeVertices
} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
/** Original reference-inspired game meshes. +Z is forward; +X is vehicle-left.
 * Components are deliberately hollow so cockpit cameras see through glass. */
export function createConvoyVehicle(
  kind: 'brabus-g' | 'defender' | 'brabus-s65',
  low = false
) {
  const sedan = kind === 'brabus-s65',
    defender = kind === 'defender';
  const root = new T.Group();
  root.name = kind;
  const body = new T.Group();
  body.name = 'body';
  root.add(body);
  const material = (
    name: string,
    color: number,
    roughness = 0.7,
    metalness = 0.1
  ) => {
    const m = new T.MeshStandardMaterial({ name, color, roughness, metalness });
    return m;
  };
  const paint = material(
      'military_paint',
      defender ? 0x66745b : 0x172029,
      defender ? 0.71 : 0.27,
      defender ? 0.19 : 0.5
    ),
    trim = material('rubber', 0x151b1d, 0.88),
    chrome = material('brightwork', defender ? 0x48524b : 0xa6b0b6, 0.22, 0.87),
    dark = material('cabin_trim', 0x20272a, 0.76),
    fabric = material('fabric', defender ? 0x4a5045 : 0x343036, 0.92),
    wood = material('cabin_wood', 0x49392e, 0.46, 0.08),
    glass = material('armoured_glass', 0x738b8d, 0.13, 0.13),
    white = material('headlamp', 0xdce7e8, 0.18, 0.15),
    red = material('tail_lamp', 0xa31e25, 0.24),
    accent = material('caliper', defender ? 0x333c38 : 0xa83229, 0.55, 0.2);
  glass.transparent = true;
  glass.opacity = 0.34;
  glass.depthWrite = false;
  glass.side = T.DoubleSide;
  white.emissive.setHex(0xcadce5);
  white.emissiveIntensity = 0.65;
  red.emissive.setHex(0x4c0505);
  red.emissiveIntensity = 0.5;
  const mesh = (
    name: string,
    g: T.BufferGeometry,
    m: T.Material,
    p: number[],
    parent: T.Object3D = body
  ) => {
    const o = new T.Mesh(g, m);
    o.name = name;
    o.position.set(...(p as [number, number, number]));
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const box = (
    name: string,
    p: number[],
    s: number[],
    m: T.Material = paint,
    parent: T.Object3D = body,
    round = 0.025
  ) =>
    mesh(
      name,
      round
        ? new RoundedBoxGeometry(
            ...(s as [number, number, number]),
            low ? 1 : 2,
            Math.min(round, Math.min(...s) / 3)
          )
        : new T.BoxGeometry(...(s as [number, number, number])),
      m,
      p,
      parent
    );
  const cyl = (
    name: string,
    p: number[],
    r: number,
    d: number,
    m: T.Material = chrome,
    parent: T.Object3D = body
  ) => mesh(name, new T.CylinderGeometry(r, r, d, low ? 16 : 28), m, p, parent);
  const rod = (
    name: string,
    a: number[],
    b: number[],
    r: number,
    m: T.Material = chrome,
    parent: T.Object3D = body
  ) => {
    const A = new T.Vector3(...(a as [number, number, number])),
      B = new T.Vector3(...(b as [number, number, number]));
    const o = mesh(
      name,
      new T.CylinderGeometry(r, r, A.distanceTo(B), low ? 6 : 8),
      m,
      A.clone().add(B).multiplyScalar(0.5).toArray(),
      parent
    );
    o.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      B.sub(A).normalize()
    );
    return o;
  };
  function panel(
    name: string,
    p: number[][],
    m: T.Material = paint,
    parent: T.Object3D = body
  ) {
    const a: number[] = [],
      uv: number[] = [];
    for (let i = 1; i < p.length - 1; i++)
      for (const j of [0, i, i + 1]) {
        a.push(...p[j]);
        uv.push(p[j][0] + p[j][2], p[j][1]);
      }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(a, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    (m as T.MeshStandardMaterial).side = T.DoubleSide;
    return mesh(name, g, m, [0, 0, 0], parent);
  }
  function glazing(name: string, p: number[][], frame: T.Material = trim) {
    panel(name, p, glass);
    for (let i = 0; i < p.length; i++)
      rod(
        name + ' surround',
        p[i],
        p[(i + 1) % p.length],
        sedan ? 0.022 : 0.035,
        frame
      );
  }
  const rad = sedan ? 0.35 : defender ? 0.405 : 0.4,
    frontZ = sedan ? 1.61 : 1.43,
    rearZ = sedan ? -1.55 : defender ? -1.59 : -1.44;
  const frontEnd = sedan ? 2.57 : defender ? 2.28 : 2.2,
    rearEnd = sedan ? -2.63 : defender ? -2.28 : -2.11;
  const shoulder = sedan ? 1.01 : 1.25,
    roof = sedan ? 1.5 : 1.99,
    width = sedan ? 0.95 : 0.93;
  box(
    'Floor',
    [0, sedan ? 0.39 : 0.57, -0.2],
    [1.69, 0.12, sedan ? 4.4 : 3.9],
    dark
  );
  for (const x of [-0.59, 0.59])
    box('Chassis rail', [x, rad - 0.02, 0], [0.1, 0.16, 4], trim);
  // Lower sill and individually separated door panels never fill the cabin.
  for (const s of [-1, 1]) {
    const x = width * s;
    box(
      'Rocker',
      [x, sedan ? 0.39 : 0.57, -0.05],
      [0.09, 0.17, sedan ? 3.48 : 3.11],
      trim
    );
    box(
      'Front door',
      [x, (shoulder + (sedan ? 0.52 : 0.7)) / 2, 0.43],
      [0.1, shoulder - (sedan ? 0.52 : 0.7), sedan ? 1.45 : 1.29],
      paint
    );
    box(
      'Rear door',
      [x, (shoulder + (sedan ? 0.52 : 0.7)) / 2, -0.86],
      [0.1, shoulder - (sedan ? 0.52 : 0.7), sedan ? 1.08 : 1.18],
      paint
    );
    box(
      'Rear quarter',
      [x, shoulder - 0.18, sedan ? -1.88 : -1.83],
      [0.13, 0.36, sedan ? 1.45 : 0.79],
      paint
    );
    rod(
      'Beltline',
      [x + s * 0.012, shoulder, -2.08],
      [x + s * 0.012, shoulder, 1.22],
      0.017,
      sedan ? chrome : trim
    );
    for (const z of [0.4, -0.87]) {
      box(
        'Door handle',
        [x + s * 0.035, shoulder - 0.12, z],
        [0.064, 0.035, 0.18],
        sedan ? chrome : trim
      );
      if (!low)
        box(
          'Handle pocket',
          [x + s * 0.018, shoulder - 0.12, z],
          [0.015, 0.078, 0.23],
          dark
        );
    }
    if (!sedan) {
      box('Running board', [s * 1.02, 0.48, -0.1], [0.29, 0.07, 2.36], trim);
      if (!defender)
        for (const z of [0.95, -0.31, -1.56])
          for (const y of [0.87, 1.17])
            box(
              'Exposed G hinge',
              [x + s * 0.026, y, z],
              [0.07, 0.072, 0.1],
              paint
            );
    }
  }
  if (sedan) {
    // Curved, tapered bonnet and boot use a loft of distinct body sections.
    const loft = (name: string, sections: number[][]) => {
      for (let i = 0; i < sections.length - 1; i++) {
        const [z, y, w] = sections[i],
          [z2, y2, w2] = sections[i + 1];
        panel(
          name,
          [
            [-w, y, z],
            [w, y, z],
            [w2, y2, z2],
            [-w2, y2, z2]
          ],
          paint
        );
        for (const s of [-1, 1])
          panel(
            name + ' shoulder',
            [
              [s * w, y, z],
              [s * w2, y2, z2],
              [s * (w2 + 0.06), y2 - 0.14, z2],
              [s * (w + 0.06), y - 0.14, z]
            ],
            paint
          );
      }
    };
    loft('Bonnet', [
      [1.08, 1.04, 0.87],
      [1.5, 1.02, 0.91],
      [2.18, 0.92, 0.87],
      [2.57, 0.85, 0.76]
    ]);
    loft('Boot', [
      [-1.84, 0.96, 0.84],
      [-2.1, 0.94, 0.9],
      [-2.38, 0.87, 0.87],
      [-2.63, 0.78, 0.73]
    ]);
    box(
      'Front lower body',
      [0, 0.64, 2.13],
      [1.87, 0.31, 0.74],
      paint,
      body,
      0.12
    );
    box(
      'Rear lower body',
      [0, 0.57, -2.19],
      [1.88, 0.38, 0.82],
      paint,
      body,
      0.11
    );
    box('Roof', [0, 1.48, -0.32], [1.57, 0.105, 1.84], paint, body, 0.06);
    glazing(
      'Windscreen',
      [
        [-0.84, 1.04, 1.1],
        [0.84, 1.04, 1.1],
        [0.74, 1.455, 0.51],
        [-0.74, 1.455, 0.51]
      ],
      chrome
    );
    glazing(
      'Rear screen',
      [
        [-0.82, 0.98, -1.84],
        [0.82, 0.98, -1.84],
        [0.72, 1.445, -1.2],
        [-0.72, 1.445, -1.2]
      ],
      chrome
    );
    for (const s of [-1, 1]) {
      glazing(
        'Front side window',
        [
          [s * 0.951, 1.02, 1.08],
          [s * 0.951, 1.02, -0.15],
          [s * 0.78, 1.435, -0.15],
          [s * 0.78, 1.435, 0.48]
        ],
        chrome
      );
      glazing(
        'Rear side window',
        [
          [s * 0.951, 1.02, -0.23],
          [s * 0.92, 1.02, -1.8],
          [s * 0.765, 1.43, -1.18],
          [s * 0.78, 1.435, -0.23]
        ],
        chrome
      );
      rod(
        'B pillar',
        [s * 0.951, 1.01, -0.19],
        [s * 0.779, 1.456, -0.19],
        0.041,
        trim
      );
      box(
        'Mirror',
        [s * 1.055, 1.075, 0.89],
        [0.23, 0.12, 0.22],
        paint,
        body,
        0.055
      );
      box(
        'Mirror reflector',
        [s * 1.055, 1.075, 0.77],
        [0.18, 0.074, 0.008],
        chrome
      );
      panel(
        'Headlight housing',
        [
          [s * 0.51, 0.83, 2.594],
          [s * 0.89, 0.79, 2.5],
          [s * 0.86, 0.96, 2.38],
          [s * 0.54, 0.99, 2.47]
        ],
        dark
      );
      for (let j = 0; j < 3; j++)
        rod(
          'Triple LED eyebrow',
          [s * (0.56 + j * 0.115), 0.91, 2.52 - j * 0.026],
          [s * (0.62 + j * 0.108), 0.85, 2.566 - j * 0.022],
          0.017,
          white
        );
      box(
        'Front intake',
        [s * 0.66, 0.57, 2.521],
        [0.34, 0.19, 0.024],
        trim,
        body,
        0.045
      );
      box(
        'Rear lamp',
        [s * 0.73, 0.84, -2.57],
        [0.4, 0.18, 0.065],
        red,
        body,
        0.055
      );
      for (let j = 0; j < 3; j++)
        box(
          'Rear lamp LED blade',
          [s * 0.73, 0.79 + j * 0.051, -2.61],
          [0.31, 0.012, 0.018],
          red
        );
      for (const dx of [-0.08, 0.08])
        box(
          'Exhaust outlet',
          [s * 0.62 + dx, 0.38, -2.626],
          [0.12, 0.065, 0.13],
          chrome,
          body,
          0.02
        );
    }
    box(
      'S65 grille surround',
      [0, 0.86, 2.594],
      [1.1, 0.33, 0.045],
      chrome,
      body,
      0.08
    );
    box('S65 grille', [0, 0.86, 2.62], [1.02, 0.28, 0.025], trim, body, 0.066);
    for (let i = 0; i < 3; i++)
      box(
        'S65 grille blade',
        [0, 0.78 + i * 0.08, 2.645],
        [0.97, 0.024, 0.025],
        chrome
      );
    box('Front splitter', [0, 0.405, 2.48], [1.93, 0.052, 0.28], trim);
    box('Boot lip', [0, 0.93, -2.32], [1.69, 0.037, 0.22], trim);
  } else {
    const windBottom = defender ? 1.22 : 0.94,
      windTop = defender ? 0.69 : 0.8;
    box(
      'Bonnet',
      [0, defender ? 1.24 : 1.3, 1.64],
      [1.7, 0.12, defender ? 1.28 : 1.35],
      paint,
      body,
      defender ? 0.06 : 0.025
    );
    box(
      'Roof',
      [0, roof - 0.03, -0.68],
      [1.78, 0.1, defender ? 3.06 : 2.98],
      defender ? trim : paint,
      body,
      0.05
    );
    glazing('Windscreen', [
      [-0.85, 1.32, windBottom],
      [0.85, 1.32, windBottom],
      [0.82, 1.92, windTop],
      [-0.82, 1.92, windTop]
    ]);
    for (const s of [-1, 1]) {
      const x = s * 0.935,
        tx = s * 0.866;
      glazing('Driver side glass', [
        [x, 1.32, windBottom - 0.07],
        [x, 1.32, -0.3],
        [tx, 1.91, -0.3],
        [tx, 1.91, windTop - 0.07]
      ]);
      glazing('Rear passenger glass', [
        [x, 1.32, -0.4],
        [x, 1.32, -1.31],
        [tx, 1.91, -1.31],
        [tx, 1.91, -0.4]
      ]);
      glazing('Rear quarter glass', [
        [x, 1.32, -1.41],
        [x, 1.32, rearEnd + 0.08],
        [tx, 1.91, rearEnd + 0.08],
        [tx, 1.91, -1.41]
      ]);
      rod('B pillar', [x, 1.25, -0.35], [tx, 1.96, -0.35], 0.045, trim);
      rod(
        'Rear pillar',
        [x, 1.25, -1.36],
        [tx, 1.96, -1.36],
        defender ? 0.095 : 0.045,
        defender ? paint : trim
      );
      rod(
        'Rear corner',
        [x, 1.25, rearEnd + 0.045],
        [tx, 1.96, rearEnd + 0.045],
        0.057,
        paint
      );
      box(
        'Mirror',
        [s * 1.07, 1.49, 0.93],
        [0.22, 0.23, 0.27],
        defender ? trim : paint,
        body,
        0.046
      );
      box(
        'Mirror reflector',
        [s * 1.07, 1.49, 0.785],
        [0.165, 0.175, 0.01],
        chrome
      );
      box('Engine cheek', [s * 0.905, 1.12, 1.71], [0.17, 0.3, 0.84], paint);
      if (defender) {
        box('Bonnet vent', [s * 0.65, 1.31, 1.62], [0.25, 0.017, 0.42], trim);
        box(
          'Lower side applique',
          [s * 0.961, 0.765, -0.02],
          [0.06, 0.15, 2.45],
          trim
        );
      }
    }
    box('Rear door', [0, 1.015, rearEnd], [1.81, 0.64, 0.1], paint);
    glazing('Rear glass', [
      [-0.79, 1.37, rearEnd - 0.06],
      [0.79, 1.37, rearEnd - 0.06],
      [0.79, 1.88, rearEnd - 0.06],
      [-0.79, 1.88, rearEnd - 0.06]
    ]);
    box('Rear header', [0, 1.945, rearEnd], [1.84, 0.09, 0.1], paint);
    box(
      'Front bumper',
      [0, 0.76, frontEnd - 0.03],
      [1.98, 0.27, 0.27],
      defender ? chrome : paint,
      body,
      0.065
    );
    box(
      'Front lower intake',
      [0, 0.71, frontEnd + 0.12],
      [1.33, 0.12, 0.025],
      trim
    );
    box('Rear bumper', [0, 0.65, rearEnd - 0.035], [1.94, 0.19, 0.25], trim);
    box('Main grille', [0, 1.11, frontEnd], [1.18, 0.36, 0.03], trim);
    for (let j = 0; j < (defender ? 2 : 3); j++)
      box(
        'Grille horizontal blade',
        [0, 1.02 + j * 0.083, frontEnd + 0.028],
        [1.11, 0.035, 0.04],
        defender ? dark : chrome
      );
    for (const s of [-1, 1]) {
      const x = s * 0.72;
      if (defender) {
        box(
          'Square headlight housing',
          [x, 1.115, frontEnd + 0.01],
          [0.39, 0.35, 0.06],
          trim,
          body,
          0.055
        );
        const halo = mesh(
          'Defender DRL ring',
          new T.TorusGeometry(0.12, 0.017, 6, low ? 16 : 28),
          white,
          [x, 1.115, frontEnd + 0.052]
        );
        box(
          'Defender DRL bar',
          [x, 1.15, frontEnd + 0.065],
          [0.25, 0.027, 0.018],
          white
        );
        for (const y of [1.13, 1.43])
          box(
            'Rear square lamp',
            [s * 0.8, y, rearEnd - 0.075],
            [0.18, 0.19, 0.045],
            red,
            body,
            0.036
          );
        box(
          'Rear marker lamp',
          [s * 0.62, 1.41, rearEnd - 0.074],
          [0.09, 0.08, 0.04],
          red,
          body,
          0.02
        );
      } else {
        cyl(
          'Round headlamp surround',
          [x, 1.24, frontEnd + 0.01],
          0.175,
          0.045,
          chrome
        ).rotation.x = Math.PI / 2;
        cyl(
          'Round headlamp lens',
          [x, 1.24, frontEnd + 0.04],
          0.145,
          0.05,
          dark
        ).rotation.x = Math.PI / 2;
        mesh('G LED halo', new T.TorusGeometry(0.127, 0.014, 6, 32), white, [
          x,
          1.24,
          frontEnd + 0.075
        ]);
        box(
          'G bumper DRL',
          [x, 0.84, frontEnd + 0.12],
          [0.29, 0.035, 0.023],
          white
        );
        box(
          'Bonnet corner indicator',
          [s * 0.82, 1.405, 1.96],
          [0.17, 0.057, 0.14],
          white,
          body,
          0.024
        );
        box(
          'Rear rectangular lamp',
          [s * 0.67, 0.88, rearEnd - 0.067],
          [0.35, 0.17, 0.06],
          red
        );
        for (let j = 0; j < 2; j++)
          cyl(
            'Side exit exhaust',
            [s * 1.04, 0.48, -0.62 - j * 0.18],
            0.047,
            0.16,
            chrome
          ).rotation.z = Math.PI / 2;
      }
    }
    if (defender) {
      for (const x of [-0.72, 0.72])
        rod(
          'Roof expedition rail',
          [x, 2.07, -1.99],
          [x, 2.07, 0.5],
          0.028,
          trim
        );
      for (let j = 0; j < 4; j++)
        rod(
          'Rack crossbar',
          [-0.74, 2.04, -1.84 + j * 0.7],
          [0.74, 2.04, -1.84 + j * 0.7],
          0.026,
          trim
        );
      box('Expedition case', [0, 2.15, -1.14], [1.06, 0.22, 0.65], trim);
      rod(
        'Raised air intake',
        [-1.005, 1.21, 0.98],
        [-0.94, 1.96, 0.73],
        0.06,
        trim
      );
      box('Intake head', [-0.94, 1.98, 0.72], [0.17, 0.12, 0.18], trim);
    } else {
      box(
        'BRABUS hood insert',
        [0, 1.387, 1.63],
        [0.87, 0.07, 0.85],
        trim,
        body,
        0.03
      );
      for (const x of [-0.33, 0.33])
        box('Hood vent', [x, 1.43, 1.64], [0.22, 0.023, 0.37], dark);
    }
  }
  // Signature wheel arches are full strips with open wheel wells.
  for (const x of [-1, 1])
    for (const z of [frontZ, rearZ]) {
      const radius = rad + 0.055,
        outer = radius + 0.095;
      const angles = sedan
        ? Array.from({ length: 17 }, (_, i) => (i * Math.PI) / 16)
        : [0, 0.57, 1.1, Math.PI - 1.1, Math.PI - 0.57, Math.PI];
      for (let i = 0; i < angles.length - 1; i++) {
        const a = angles[i],
          b = angles[i + 1],
          y = rad;
        panel(
          'Wheel arch',
          [
            [x * 0.98, y + Math.sin(a) * radius, z + Math.cos(a) * radius],
            [x * 0.98, y + Math.sin(b) * radius, z + Math.cos(b) * radius],
            [x * 1.01, y + Math.sin(b) * outer, z + Math.cos(b) * outer],
            [x * 1.01, y + Math.sin(a) * outer, z + Math.cos(a) * outer]
          ],
          sedan ? paint : trim
        );
        panel(
          'Arch shoulder',
          [
            [x * 0.89, y + Math.sin(a) * outer, z + Math.cos(a) * outer],
            [x * 1.01, y + Math.sin(a) * outer, z + Math.cos(a) * outer],
            [x * 1.01, y + Math.sin(b) * outer, z + Math.cos(b) * outer],
            [x * 0.89, y + Math.sin(b) * outer, z + Math.cos(b) * outer]
          ],
          paint
        );
      }
    }
  function wheel(id: string, x: number, z: number, spare = false) {
    const p = new T.Group();
    p.name = id.startsWith('f') ? 'steer_' + id : 'axle_' + id;
    p.position.set(x, rad, z);
    root.add(p);
    const w = new T.Group();
    w.name = 'wheel_' + id;
    p.add(w);
    const tire = mesh(
      'Tire',
      new T.TorusGeometry(
        rad * 0.775,
        rad * 0.225,
        low ? 7 : 10,
        low ? 24 : 36
      ),
      trim,
      [0, 0, 0],
      w
    );
    tire.rotation.y = Math.PI / 2;
    const rim = cyl('Rim barrel', [0, 0, 0], rad * 0.64, 0.205, chrome, w);
    rim.rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) {
      const brake = cyl(
        'Brake disc',
        [side * 0.115, 0, 0],
        rad * 0.53,
        0.018,
        dark,
        w
      );
      brake.rotation.z = Math.PI / 2;
      const hub = cyl(
        'Wheel hub',
        [side * 0.135, 0, 0],
        rad * 0.17,
        0.052,
        chrome,
        w
      );
      hub.rotation.z = Math.PI / 2;
      for (let i = 0; i < (defender ? 5 : 10); i++) {
        const a = (i * Math.PI * 2) / (defender ? 5 : 10);
        const sp = box(
          'Alloy spoke',
          [side * 0.15, Math.sin(a) * rad * 0.38, Math.cos(a) * rad * 0.38],
          [0.029, rad * 0.055, rad * 0.49],
          chrome,
          w,
          0.003
        );
        sp.rotation.x = -a;
      }
      if (!low)
        for (let i = 0; i < 5; i++) {
          const a = i * Math.PI * 0.4;
          cyl(
            'Wheel bolt',
            [side * 0.17, Math.sin(a) * rad * 0.11, Math.cos(a) * rad * 0.11],
            0.015,
            0.025,
            chrome,
            w
          ).rotation.z = Math.PI / 2;
        }
    }
    if (!low && !sedan)
      for (let j = 0; j < 32; j++) {
        const a = (j * Math.PI) / 16;
        const lug = box(
          'All terrain tread',
          [0, Math.sin(a) * rad * 0.983, Math.cos(a) * rad * 0.983],
          [0.18, 0.046, 0.025],
          trim,
          w,
          0
        );
        lug.rotation.x = -a;
      }
    if (!spare)
      box(
        'Brake caliper',
        [x + Math.sign(x) * 0.08, rad + 0.06, z - 0.16],
        [0.07, 0.18, 0.08],
        accent
      );
    if (spare) {
      p.position.set(0, 1.16, rearEnd - 0.28);
      p.rotation.y = Math.PI / 2;
      if (!defender) {
        const cover = cyl(
          'Spare wheel cover',
          [-0.165, 0, 0],
          rad * 0.965,
          0.07,
          paint,
          w
        );
        cover.rotation.z = Math.PI / 2;
      }
    }
  }
  for (const x of [-0.91, 0.91])
    for (const z of [frontZ, rearZ])
      wheel((z === frontZ ? 'f' : 'r') + (x > 0 ? 'l' : 'r'), x, z);
  if (!sedan) wheel('spare', 0, 0, true);
  // Custom interior with three rear places, high back front seats and a left driver.
  if (!low) {
    const interior = new T.Group();
    interior.name = 'interior';
    body.add(interior);
    const floor = sedan ? 0.45 : 0.65,
      cushion = floor + 0.2,
      seatback = cushion + 0.32;
    for (const z of [0.02, -0.96])
      for (const x of z === 0.02 ? [-0.46, 0.46] : [-0.49, 0, 0.49]) {
        box(
          'Seat cushion',
          [x, cushion, z],
          [z === 0.02 ? 0.62 : 0.46, 0.14, 0.59],
          fabric,
          interior,
          0.055
        );
        const back = box(
          'Seat back',
          [x, seatback, z - 0.23],
          [z === 0.02 ? 0.61 : 0.44, 0.65, 0.17],
          fabric,
          interior,
          0.055
        );
        back.rotation.x = -0.09;
        box(
          'Headrest',
          [
            x,
            seatback + (sedan ? 0.32 : 0.43),
            z - (sedan && z < 0 ? 0.18 : 0.27)
          ],
          [0.32, 0.2, 0.14],
          fabric,
          interior,
          0.04
        );
        rod(
          'Seat belt',
          [x - 0.23, seatback + 0.24, z - 0.12],
          [x + 0.23, cushion + 0.08, z + 0.2],
          0.014,
          trim,
          interior
        );
      }
    const dy = sedan ? 0.91 : 1.2;
    box('Dashboard', [0, dy, 0.79], [1.72, 0.24, 0.35], dark, interior, 0.06);
    box(
      'Dashboard trim',
      [0, dy - 0.02, 0.602],
      [1.68, 0.033, 0.025],
      sedan ? wood : chrome,
      interior
    );
    box(
      'Console',
      [0, cushion + 0.07, 0.42],
      [0.3, 0.3, 0.49],
      dark,
      interior,
      0.03
    );
    box(
      'Instrument screen',
      [0.46, dy + 0.08, 0.595],
      [0.4, 0.135, 0.016],
      dark,
      interior,
      0.015
    );
    for (const x of [0.35, 0.56]) {
      cyl(
        'Speed dial',
        [x, dy + 0.08, 0.58],
        0.049,
        0.01,
        chrome,
        interior
      ).rotation.x = Math.PI / 2;
      rod(
        'Dial needle',
        [x, dy + 0.08, 0.567],
        [x + 0.02, dy + 0.115, 0.567],
        0.005,
        white,
        interior
      );
    }
    box(
      'Centre display',
      [0, dy + 0.08, 0.586],
      [0.28, 0.16, 0.024],
      dark,
      interior,
      0.01
    );
    for (let i = 0; i < 3; i++)
      box(
        'Screen status line',
        [0, dy + 0.12 - i * 0.036, 0.57],
        [0.2 - i * 0.02, 0.011, 0.01],
        white,
        interior,
        0
      );
    for (const x of [-0.73, -0.35, 0.75])
      box(
        'Air vent',
        [x, dy + 0.01, 0.602],
        [0.16, 0.065, 0.024],
        trim,
        interior,
        0.01
      );
    const steering = new T.Group();
    steering.name = 'steering_wheel';
    steering.position.set(0.46, dy + 0.035, 0.35);
    steering.rotation.x = -0.32;
    body.add(steering);
    mesh(
      'Steering rim',
      new T.TorusGeometry(0.176, 0.018, 7, 28),
      trim,
      [0, 0, 0],
      steering
    );
    for (let j = 0; j < 3; j++) {
      const a = (j * Math.PI * 2) / 3;
      rod(
        'Steering spoke',
        [0, 0, 0],
        [Math.sin(a) * 0.17, Math.cos(a) * 0.17, 0],
        0.013,
        chrome,
        steering
      );
    }
    box('Steering hub', [0, 0, 0], [0.11, 0.08, 0.05], trim, steering);
  }
  for (const x of [-0.45, 0.45])
    rod(
      'Wiper',
      [x - 0.25, shoulder + 0.07, sedan ? 1.115 : 1.23],
      [x + 0.21, shoulder + 0.09, sedan ? 1.085 : 1.21],
      0.009,
      trim
    );
  root.userData = {
    model: kind,
    source: 'Original photo-inspired game reconstruction',
    armour:
      'Fictional visual trim and arcade shield rating; no ballistic certification',
    forward: '+Z',
    units: 'metres'
  };
  return root;
}
/** Batch static meshes per component, preserving wheel and steering pivots. */
export function optimiseVehicle(group: T.Group) {
  group.updateMatrixWorld(true);
  const bins = new Map<T.Material, T.BufferGeometry[]>();
  for (const child of [...group.children]) {
    if (child instanceof T.Group) optimiseVehicle(child);
    else if (child instanceof T.Mesh) {
      const geo = child.geometry.index
        ? child.geometry.toNonIndexed()
        : child.geometry.clone();
      geo.applyMatrix4(child.matrix);
      const key = child.material as T.Material;
      const list = bins.get(key) || [];
      list.push(geo);
      bins.set(key, list);
      group.remove(child);
    }
  }
  for (const [m, gs] of bins) {
    const merged = mergeGeometries(gs, false);
    if (merged) {
      const indexed = mergeVertices(merged, 0.0001);
      const mesh = new T.Mesh(indexed, m);
      mesh.name = m.name + '_batch';
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    }
    gs.forEach((g) => g.dispose());
  }
}
