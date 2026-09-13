"""Build mobile GLBs from the five supplied originals; never modify the inputs.

Usage: python scripts/import-tirana-uploaded-weapons.py /path/to/uploads
Requires Pillow and numpy. Retains embedded author/license/source metadata.
"""
import hashlib
import io
import itertools
import json
from pathlib import Path
import struct
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'webapp/public/assets/tirana-streets/weapons'
# Keep the assembled firearm; omit display floors, stands, spare magazines,
# loose ammunition and the second posed copy in the Dragunov presentation.
MODELS = [
    ('adaptiveCombatRifleAttack', 'adaptive_combat_rifle.glb', list(range(5)), -90),
    ('dragunovAttack', 'svd_63_-_dragunov.glb', [2, 3, 4], 90),
    ('vityazAttack', 'pp-19-01_vityaz.glb', list(range(17)), 0),
    ('ar15Attack', 'ar15_rifle.glb', list(range(5, 15)) + list(range(42, 67)), 90),
    ('makarovAttack', 'makarov_pm.glb', list(range(8)), 0),
]


def build(source_dir):
    OUT.mkdir(parents=True, exist_ok=True)
    report = []
    for weapon_id, filename, keep, yaw in MODELS:
        original = (source_dir / filename).read_bytes()
        assert original[:4] == b'glTF'
        length = struct.unpack_from('<I', original, 12)[0]
        doc = json.loads(original[20:20 + length])
        binary = original[28 + length:]
        views = [binary[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
                 for v in doc['bufferViews']]
        for node in doc['nodes']:
            if 'mesh' in node and node['mesh'] not in keep:
                del node['mesh']
        doc.pop('animations', None)

        def prune(collection, refs):
            old = doc.get(collection, [])
            mapping = {}
            new = []
            for owner, key in refs:
                index = owner[key]
                if index not in mapping:
                    mapping[index] = len(new)
                    new.append(old[index])
                owner[key] = mapping[index]
            doc[collection] = new

        prune('meshes', [(n, 'mesh') for n in doc['nodes'] if 'mesh' in n])
        primitives = [p for m in doc['meshes'] for p in m['primitives']]
        prune('materials', [(p, 'material') for p in primitives if 'material' in p])
        texture_refs = []

        def find_textures(value):
            if not isinstance(value, dict):
                return
            for key, item in value.items():
                if key.endswith('Texture') and isinstance(item, dict) and 'index' in item:
                    texture_refs.append((item, 'index'))
                else:
                    find_textures(item)

        for material in doc['materials']:
            find_textures(material)
        prune('textures', texture_refs)
        prune('images', [(t, 'source') for t in doc['textures'] if 'source' in t])
        color_images = set()
        for material in doc['materials']:
            pbr = material.get('pbrMetallicRoughness', {})
            for tex in [pbr.get('baseColorTexture'), material.get('emissiveTexture')]:
                if tex:
                    color_images.add(doc['textures'][tex['index']]['source'])
        for i, image in enumerate(doc['images']):
            im = Image.open(io.BytesIO(views[image['bufferView']]))
            alpha = 'A' in im.getbands() and im.getchannel('A').getextrema()[0] < 255
            im.thumbnail((512, 512) if i in color_images else (256, 256), Image.Resampling.LANCZOS)
            out = io.BytesIO()
            if i in color_images and not alpha:
                im.convert('RGB').save(out, format='JPEG', quality=88, optimize=True)
                image['mimeType'] = 'image/jpeg'
            else:
                im.convert('RGBA' if alpha else 'RGB').save(out, format='PNG', optimize=True)
                image['mimeType'] = 'image/png'
            image.pop('uri', None)
            image['bufferView'] = len(views)
            views.append(out.getvalue())
            doc['bufferViews'].append({'buffer': 0, 'byteLength': len(out.getvalue())})

        # A parent normalization preserves every original mesh transform and UV.
        points = []

        def bounds(index, parent):
            node = doc['nodes'][index]
            # The supplied five originals use matrices exclusively.
            assert not any(k in node for k in ('translation', 'rotation', 'scale'))
            matrix = np.array(node.get('matrix', np.eye(4).T.reshape(-1))).reshape(4, 4).T
            world = parent @ matrix
            if 'mesh' in node:
                for primitive in doc['meshes'][node['mesh']]['primitives']:
                    a = doc['accessors'][primitive['attributes']['POSITION']]
                    corners = np.array([list(p) + [1] for p in itertools.product(*zip(a['min'], a['max']))])
                    points.extend((world @ corners.T).T[:, :3])
            for child in node.get('children', []):
                bounds(child, world)

        angle = np.deg2rad(yaw)
        rotation = np.array([[np.cos(angle), 0, np.sin(angle), 0], [0, 1, 0, 0],
                             [-np.sin(angle), 0, np.cos(angle), 0], [0, 0, 0, 1]])
        scene = doc['scenes'][doc.get('scene', 0)]
        for node in scene['nodes']:
            bounds(node, rotation)
        lo, hi = np.min(points, axis=0), np.max(points, axis=0)
        scale = 1 / max(hi - lo)
        transform = np.eye(4)
        transform[:3, :3] *= scale
        transform[:3, 3] = -(lo + hi) / 2 * scale
        scene['nodes'], children = [len(doc['nodes'])], scene['nodes']
        doc['nodes'].append({'name': 'TiranaWeaponForward', 'children': children,
                             'matrix': (transform @ rotation).T.reshape(-1).tolist()})

        refs = [(p, 'indices') for p in primitives if 'indices' in p]
        refs += [(p['attributes'], k) for p in primitives for k in p['attributes']]
        prune('accessors', refs)
        refs = [(a, 'bufferView') for a in doc['accessors']]
        refs += [(im, 'bufferView') for im in doc['images']]
        old_views = doc['bufferViews']
        packed, new_views, mapping = bytearray(), [], {}
        for owner, key in refs:
            old = owner[key]
            if old not in mapping:
                mapping[old] = len(new_views)
                packed.extend(b'\0' * (-len(packed) % 4))
                new_views.append({**old_views[old], 'buffer': 0,
                                  'byteOffset': len(packed), 'byteLength': len(views[old])})
                packed.extend(views[old])
            owner[key] = mapping[old]
        doc['bufferViews'] = new_views
        doc['buffers'] = [{'byteLength': len(packed)}]
        provenance = doc['asset'].setdefault('extras', {})
        provenance['tiranaChanges'] = 'Assembled firearm only; embedded mobile PBR textures; centered with barrel facing +Z.'
        provenance['originalSha256'] = hashlib.sha256(original).hexdigest()
        encoded = json.dumps(doc, separators=(',', ':'), ensure_ascii=True).encode()
        encoded += b' ' * (-len(encoded) % 4)
        packed.extend(b'\0' * (-len(packed) % 4))
        output = struct.pack('<5I', 0x46546c67, 2, 28 + len(encoded) + len(packed), len(encoded), 0x4e4f534a)
        output += encoded + struct.pack('<2I', len(packed), 0x004e4942) + packed
        assert len(output) < 20 * 1024 * 1024, 'Held weapon download budget exceeded'
        destination=OUT / f'{weapon_id}.glb'
        destination.write_bytes(output)
        subprocess.run(['node', str(ROOT / 'webapp/scripts/optimize-tirana-glb.mjs'), str(destination), '26000'], check=True)
        output=destination.read_bytes()
        assert len(output) < 5 * 1024 * 1024, 'Mobile weapon budget exceeded'
        entry = {'id': weapon_id, 'file': filename, 'url': f'/assets/tirana-streets/weapons/{weapon_id}.glb',
                 'bytes': len(output), 'originalBytes': len(original), 'sha256': hashlib.sha256(output).hexdigest(),
                 'credits': provenance}
        report.append(entry)
        print(weapon_id, len(original), '->', len(output), flush=True)
    (OUT / 'manifest.json').write_text(json.dumps({'schemaVersion': 1, 'weapons': report}, indent=2) + '\n')


if __name__ == '__main__':
    build(Path(sys.argv[1]))
