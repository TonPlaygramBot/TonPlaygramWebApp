"""Prepare the user-supplied MesXwi table without changing its mesh or UVs.

Usage: python scripts/import-snooker-table.py /path/to/snooker_table.glb
Requires numpy and Pillow. Textures are resized/re-encoded; table geometry stays exact.
"""
from pathlib import Path
from io import BytesIO
import copy
import hashlib
import json
import struct
import sys
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'webapp/public/assets/snooker-royal/mesxwi'
source = Path(sys.argv[1]).read_bytes()
length = struct.unpack_from('<I', source, 12)[0]
g = json.loads(source[20:20 + length])
binary = source[28 + length:]

def accessor(index):
    a = g['accessors'][index]
    v = g['bufferViews'][a['bufferView']]
    dtype = {5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1'}[a['componentType']]
    dim = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    item = np.dtype(dtype).itemsize
    return np.ndarray((a['count'], dim), dtype, binary,
                      v.get('byteOffset', 0) + a.get('byteOffset', 0),
                      strides=(v.get('byteStride', dim * item), item)).copy()

world = {}
def visit(i, parent=np.eye(4)):
    node = g['nodes'][i]
    m = parent @ np.array(node.get('matrix', np.eye(4).flatten())).reshape(4, 4, order='F')
    if 'mesh' in node:
        world[node['mesh']] = m
    for child in node.get('children', []):
        visit(child, m)
for i in g['scenes'][0]['nodes']:
    visit(i)

def positions(mesh):
    p = accessor(g['meshes'][mesh]['primitives'][0]['attributes']['POSITION'])
    return (np.c_[p, np.ones(len(p))] @ world[mesh].T)[:, :3]

# Source mesh 39 is the six baize-covered cushions, not mesh 38 (wood rails).
# Slice actual triangles at the authored ball-centre height. Never convex-hull
# the combined mesh: doing so closes the middle and corner pocket mouths.
cloth_y = float(positions(52)[:, 1].max())
slice_y = cloth_y + 0.0525 * 0.96 / 2
ps = positions(39)
indices = accessor(g['meshes'][39]['primitives'][0]['indices']).reshape(-1, 3)
edges = {}
for ids in indices:
    tri = ps[ids]
    hits = []
    for a, b in zip(tri, np.roll(tri, -1, axis=0)):
        if (a[1] <= slice_y < b[1]) or (b[1] <= slice_y < a[1]):
            p = a + (b - a) * ((slice_y - a[1]) / (b[1] - a[1]))
            hits.append(tuple(np.round(p[[0, 2]], 6)))
    if len(hits) == 2 and hits[0] != hits[1]:
        edges[tuple(sorted(hits))] = hits
adj = {}
for a, b in edges.values():
    adj.setdefault(a, []).append(b)
    adj.setdefault(b, []).append(a)
assert all(len(v) == 2 for v in adj.values()), 'Cushion slice must form closed contours'
unused = set(adj)
contours = []
while unused:
    start = min(unused)
    loop, prev, curr = [], None, start
    while curr not in loop:
        loop.append(curr)
        unused.discard(curr)
        nxt = next(p for p in adj[curr] if p != prev)
        prev, curr = curr, nxt
    assert curr == start
    # Drop only collinear triangulation splits; retain the authored rounded jaws.
    changed = True
    while changed:
        changed = False
        for j in range(len(loop)):
            a, b, c = map(np.array, (loop[j-1], loop[j], loop[(j+1) % len(loop)]))
            ab, bc = b-a, c-b
            if abs(float(ab[0]*bc[1]-ab[1]*bc[0])) < 2e-6 * max(np.linalg.norm(ab), np.linalg.norm(bc)):
                loop.pop(j)
                changed = True
                break
    area = sum(a[0]*b[1]-b[0]*a[1] for a, b in zip(loop, loop[1:]+loop[:1]))
    if area < 0:
        loop.reverse()
    contours.append(loop)
assert len(contours) == 6, 'Expected six separate cushions'

# The six longest inner-facing straight sections define the playable rectangle.
lines = []
for loop in contours:
    for a, b in zip(loop, loop[1:]+loop[:1]):
        a, b = np.array(a), np.array(b)
        if np.linalg.norm(b-a) > .5:
            lines.append((a+b)/2)
xs = sorted(p[0] for p in lines if abs(p[0]-.1) > .5)
zs = sorted(p[1] for p in lines if abs(p[0]-.1) < .1)
field = {'minX': max(x for x in xs if x < .1), 'maxX': min(x for x in xs if x > .1),
         'minZ': max(z for z in zs if z < -1.879), 'maxZ': min(z for z in zs if z > -1.879)}

# Preserve only the table and its authored legs, pocket irons, nets and bags.
kept_meshes = set(range(31, 53))
out = copy.deepcopy(g)
for node in out['nodes']:
    if node.get('mesh', -1) not in kept_meshes:
        node.pop('mesh', None)
used_nodes = set()
def keep_node(i):
    node = out['nodes'][i]
    node['children'] = [c for c in node.get('children', []) if keep_node(c)]
    if 'mesh' in node or node['children']:
        used_nodes.add(i)
        return True
    return False
for i in g['scenes'][0]['nodes']:
    keep_node(i)
def compact(key, used):
    mapping = {old: new for new, old in enumerate(sorted(used))}
    out[key] = [out[key][i] for i in sorted(used)]
    return mapping
nodes = compact('nodes', used_nodes)
meshes = compact('meshes', kept_meshes)
for node in out['nodes']:
    node['children'] = [nodes[c] for c in node['children']]
    if not node['children']: node.pop('children')
    if 'mesh' in node: node['mesh'] = meshes[node['mesh']]
out['scenes'] = [{'name': 'MesXwi snooker table', 'nodes': [nodes[i] for i in g['scenes'][0]['nodes']]}]
primitives = [p for m in out['meshes'] for p in m['primitives']]
materials = compact('materials', {p['material'] for p in primitives})
for p in primitives: p['material'] = materials[p['material']]
def texture_infos(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.endswith('Texture') and isinstance(v, dict) and 'index' in v:
                yield v
            else:
                yield from texture_infos(v)
    elif isinstance(obj, list):
        for v in obj: yield from texture_infos(v)
infos = list(texture_infos(out['materials']))
textures = compact('textures', {i['index'] for i in infos})
for i in infos: i['index'] = textures[i['index']]
images = compact('images', {t['source'] for t in out['textures']})
for t in out['textures']: t['source'] = images[t['source']]
accessors = compact('accessors', {i for p in primitives for i in [p['indices'], *p['attributes'].values()]})
for p in primitives:
    p['indices'] = accessors[p['indices']]
    p['attributes'] = {k: accessors[v] for k, v in p['attributes'].items()}
chunks = []
offset = 0
out['bufferViews'] = []
def append_buffer(payload):
    global offset
    index = len(out['bufferViews'])
    out['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(payload)})
    payload += bytes(-len(payload) % 4)
    chunks.append(payload)
    offset += len(payload)
    return index

# The original uses shared/interleaved views containing the removed props too.
# Repack each retained accessor densely, copying its values byte-for-byte.
for old, new in accessors.items():
    a = out['accessors'][new]
    a['bufferView'] = append_buffer(accessor(old).tobytes())
    a.pop('byteOffset', None)
for image_def in out['images']:
    v = g['bufferViews'][image_def['bufferView']]
    payload = binary[v.get('byteOffset', 0):v.get('byteOffset', 0)+v['byteLength']]
    image = Image.open(BytesIO(payload))
    image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    buf = BytesIO()
    # Keep meaningful alpha (nets), otherwise JPEG saves mobile bandwidth.
    alpha = image.getchannel('A').getextrema() if 'A' in image.getbands() else (255, 255)
    if alpha[0] < 255:
        image.save(buf, format='PNG', optimize=True)
        mime = 'image/png'
    else:
        image.convert('RGB').save(buf, format='JPEG', quality=88, subsampling=0, optimize=True)
        mime = 'image/jpeg'
    image_def['mimeType'] = mime
    image_def['bufferView'] = append_buffer(buf.getvalue())
out['buffers'] = [{'byteLength': offset}]
out['asset']['extras']['modifications'] = 'Table-only extraction; textures reduced to 1024px. Original geometry and UVs preserved.'
out['asset']['extras']['sourceSha256'] = hashlib.sha256(source).hexdigest()
js = json.dumps(out, separators=(',', ':')).encode()
js += b' ' * (-len(js) % 4)
data = b''.join(chunks)
packed = struct.pack('<III', 0x46546c67, 2, 28+len(js)+len(data)) + struct.pack('<II', len(js), 0x4e4f534a) + js + struct.pack('<II', len(data), 0x004e4942) + data
OUT.mkdir(parents=True, exist_ok=True)
(OUT/'snooker-table.glb').write_bytes(packed)
bed_ps = positions(52)
bed_min, bed_max = bed_ps.min(0), bed_ps.max(0)
cx, cz = (bed_min[0]+bed_max[0])/2, (bed_min[2]+bed_max[2])/2
top = np.unique(bed_ps[bed_ps[:, 1] > cloth_y-1e-6][:, [0, 2]].round(6), axis=0)
pockets = []
# Rotate the source by 180 degrees so its baulk end matches the game's baulk end.
for sx, sz in [(1, 1), (-1, 1), (1, -1), (-1, -1), (1, 0), (-1, 0)]:
    x = float(bed_max[0] if sx > 0 else bed_min[0])
    z = float((bed_max[2] if sz > 0 else bed_min[2]) if sz else cz)
    if sz:
        lip = top[(abs(top[:, 0]-x) < .125) & (abs(top[:, 1]-z) < .125)]
        lip = sorted(lip.tolist(), key=lambda p: np.arctan2(p[1]-z, p[0]-x))
        # Close the cutout outside the bed. This is a pocket region, not an
        # oversized capture circle reaching underneath the visible cushion.
        polygon = lip + [[x+sx*.12, z+sz*.12]]
    else:
        lip = top[(abs(top[:, 0]-x) < .1) & (abs(top[:, 1]-z) < .125)]
        lip = sorted(lip.tolist(), key=lambda p: p[1])
        polygon = lip + [[x+sx*.12, lip[-1][1]], [x+sx*.12, lip[0][1]]]
    pockets.append({'center': [x, z], 'polygon': polygon, 'lip': lip})
spots = {name: world[mesh][:3, 3][[0, 2]].tolist()
         for name, mesh in [('black', 9), ('pink', 10), ('blue', 11), ('green', 12), ('brown', 13), ('yellow', 15)]}
mapping = {'sourceSha256': hashlib.sha256(source).hexdigest(), 'clothY': cloth_y,
           'cushionSliceY': slice_y, 'cushionTopY': float(ps[:, 1].max()),
           'bed': {'minX': float(bed_min[0]), 'maxX': float(bed_max[0]),
                   'minZ': float(bed_min[2]), 'maxZ': float(bed_max[2])},
           'field': field, 'cushionContours': contours, 'pockets': pockets, 'spots': spots}
(ROOT/'webapp/src/pages/Games/snookerUploadedTableGeometry.json').write_text(json.dumps(mapping, indent=2)+'\n')
print(json.dumps({'sourceBytes': len(source), 'gameBytes': len(packed), 'field': field, 'clothY': cloth_y, 'contourVertices': list(map(len, contours))}))
