#!/usr/bin/env python3
"""Vendor the CC0 Poly Haven apartment kit and build three reusable residences.

The downloaded mesh buffers and original 1K textures are preserved byte-for-byte.
Only scene transforms/selection change: the source's catalogue grid is never
rendered as a building. Run manually; production builds require no network.
"""
import concurrent.futures
import copy
import hashlib
import json
import math
from pathlib import Path
import urllib.request
import shutil

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'public/assets/tirana-streets/residential'
ASSET = 'modular_urban_apartments_facade'
API = f'https://api.polyhaven.com/files/{ASSET}'
SOURCE = f'https://polyhaven.com/a/{ASSET}'


def local_url(url):
    # All reviewed URLs have plain ASCII paths and no query string. This is the
    # same deterministic mapping as external-assets/downloader.localAssetUrl.
    from urllib.parse import urlparse
    parsed = urlparse(url)
    return '/assets/external/' + parsed.netloc + parsed.path


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'TonPlaygramWebApp-residence-import/1.0'})
    with urllib.request.urlopen(req, timeout=60) as response:
        return response.read()


def vendor(pair):
    rel, info = pair
    path = DEST / rel
    content = path.read_bytes() if path.exists() else fetch(info['url'])
    if hashlib.md5(content).hexdigest() != info['md5']:
        raise ValueError(f'Upstream checksum mismatch: {rel}')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return {'path': rel, 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest(),
            'upstreamMd5': info['md5'], 'url': info['url']}


def make_residence(source, kind, bays, floors, side_bays, dependencies):
    """Use the artist's actual wall/window/trim meshes as four closed facades.

    Panels have native extents [-3,0] x [0,3]. Facade normals and projecting
    cornices face positive local Z, which is the entrance direction.
    There are no procedural replacement wall/window textures or geometries.
    """
    out = copy.deepcopy(source)
    by_name = {node['name']: node['mesh'] for node in source['nodes']}
    out['nodes'] = []
    out['scenes'] = [{'name': f'Tirana {kind}', 'nodes': []}]
    out['scene'] = 0
    width, depth = bays * 3, side_bays * 3

    def add(mesh, x, y, z, yaw=0, scale=None, name=None, rotation=None):
        node = {'name': name or mesh, 'mesh': by_name[mesh], 'translation': [x, y, z],
                'rotation': rotation or [0, math.sin(yaw / 2), 0, math.cos(yaw / 2)]}
        if scale:
            node['scale'] = scale
        out['scenes'][0]['nodes'].append(len(out['nodes']))
        out['nodes'].append(node)

    # Walk each facade in its native horizontal direction. Front faces +Z.
    faces = [(bays, 0, width / 2, depth / 2),
             (bays, math.pi, -width / 2, -depth / 2),
             (side_bays, math.pi / 2, width / 2, -depth / 2),
             (side_bays, -math.pi / 2, -width / 2, depth / 2)]
    for face, (count, yaw, start_x, start_z) in enumerate(faces):
        for bay in range(count):
            x = start_x - bay * 3 * math.cos(yaw)
            z = start_z + bay * 3 * math.sin(yaw)
            for floor in range(floors):
                y = floor * 3
                entry = face == 0 and bay == bays // 2 and floor == 0
                wall = 'wall_door_centered_large_01' if entry else 'wall_window_centered_large_01'
                detail = 'door_centered_large_01' if entry else 'window_centered_large_01'
                add(wall, x, y, z, yaw, name=f'{kind}_wall_{face}_{bay}_{floor}')
                # Doors remain an independent node for gameplay to hide/open.
                add(detail, x, y, z, yaw, name='residential_entry_door' if entry else f'{kind}_window_{face}_{bay}_{floor}')
                if floor < floors - 1:
                    add('cornice_standard_standard_01', x, y + 2.8, z, yaw)
            add('crown_standard_standard_01', x, floors * 3, z, yaw)

    # Roof and floor reuse the original plaster panel, turned horizontally.
    # They close the envelope; collision/interior are owned by buildingAccess.
    add('wall_standard_standard_01', width / 2, floors * 3, depth / 2,
        scale=[bays, side_bays, 1], rotation=[-math.sqrt(.5), 0, 0, math.sqrt(.5)], name=f'{kind}_roof')
    add('wall_standard_standard_01', width / 2, 0, -depth / 2,
        scale=[bays, side_bays, 1], rotation=[math.sqrt(.5), 0, 0, math.sqrt(.5)], name=f'{kind}_floor')
    out['asset']['generator'] = 'TonPlaygram CC0 residence assembly; original Poly Haven meshes and materials'
    out['asset']['copyright'] = 'James Ray Cock / Poly Haven; CC0-1.0'
    out['extras'] = {'source': SOURCE, 'license': 'CC0-1.0', 'type': kind,
                     'dimensions': [width, floors * 3 + .75, depth],
                     'door': {'x': 0, 'z': depth / 2, 'width': 2.08, 'height': 2.81},
                     'interior': 'Gameplay interior is supplied separately by BuildingAccessVisuals.'}
    compact_document(out, dependencies)
    path = DEST / f'{kind}.gltf'
    path.write_text(json.dumps(out, separators=(',', ':')) + '\n')
    return {'kind': kind, 'path': path.name, 'nodes': len(out['nodes']),
            'dimensions': out['extras']['dimensions'], 'door': out['extras']['door'],
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def compact_document(out, dependencies):
    # Keep only referenced JSON records; byte offsets still address the unchanged
    # shared upstream binary. Original textures use verified same-origin paths.
    mesh_ids = sorted({node['mesh'] for node in out['nodes']})
    mesh_map = {old: new for new, old in enumerate(mesh_ids)}
    out['meshes'] = [out['meshes'][old] for old in mesh_ids]
    for node in out['nodes']:
        node['mesh'] = mesh_map[node['mesh']]
    accessor_ids = sorted({i for mesh in out['meshes'] for primitive in mesh['primitives']
                           for i in [primitive['indices'], *primitive['attributes'].values()]})
    accessor_map = {old: new for new, old in enumerate(accessor_ids)}
    out['accessors'] = [out['accessors'][old] for old in accessor_ids]
    for mesh in out['meshes']:
        for primitive in mesh['primitives']:
            primitive['indices'] = accessor_map[primitive['indices']]
            primitive['attributes'] = {name: accessor_map[value] for name, value in primitive['attributes'].items()}
    view_ids = sorted({a['bufferView'] for a in out['accessors']})
    view_map = {old: new for new, old in enumerate(view_ids)}
    out['bufferViews'] = [out['bufferViews'][old] for old in view_ids]
    for accessor in out['accessors']:
        accessor['bufferView'] = view_map[accessor['bufferView']]
    for resource in out['buffers'] + out['images']:
        resource['uri'] = local_url(dependencies[resource['uri']]['url'])


def make_facade_kit(source, dependencies):
    out = copy.deepcopy(source)
    wanted = {'wall_standard_standard_01', 'wall_door_centered_large_01', 'door_centered_large_01', 'wall_window_centered_large_01', 'window_centered_large_01', 'cornice_standard_standard_01', 'crown_standard_standard_01'}
    out['nodes'] = [{'name': node['name'], 'mesh': node['mesh']} for node in source['nodes'] if node['name'] in wanted]
    out['scenes'] = [{'name': 'Original facade modules for mapped residences', 'nodes': list(range(len(out['nodes'])))}]
    out['scene'] = 0
    compact_document(out, dependencies)
    path = DEST / 'facade-kit.gltf'
    path.write_text(json.dumps(out, separators=(',', ':')) + '\n')
    return {'path': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'modules': sorted(wanted)}


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(fetch(API))['gltf']['1k']['gltf']
    files = {f'{ASSET}_1k.gltf': {k: v for k, v in manifest.items() if k != 'include'}, **manifest['include']}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        records = list(pool.map(vendor, files.items()))
    source = json.loads((DEST / f'{ASSET}_1k.gltf').read_text())
    variants = [make_residence(source, 'house', 3, 1, 2, manifest['include']),
                make_residence(source, 'villa', 3, 2, 3, manifest['include']),
                make_residence(source, 'apartment', 3, 4, 2, manifest['include'])]
    kit = make_facade_kit(source, manifest['include'])
    for record in records:
        if record['path'] in manifest['include']:
            target = ROOT / 'public' / local_url(record['url']).lstrip('/')
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(DEST / record['path'], target)
    (DEST / 'sources.json').write_text(json.dumps({
        'asset': ASSET, 'author': 'James Ray Cock', 'source': SOURCE,
        'license': 'CC0-1.0', 'licenseUrl': 'https://creativecommons.org/publicdomain/zero/1.0/',
        'providerLicense': 'https://polyhaven.com/license', 'resolution': '1k',
        'modifications': 'Three building scene assemblies from original meshes; original geometry buffer and textures unchanged.',
        'files': sorted(records, key=lambda row: row['path']), 'variants': variants, 'facadeKit': kit,
        'runtimeFiles': [dict(record, localUrl=local_url(record['url'])) for record in records if record['path'] in manifest['include']]
    }, indent=2) + '\n')
    print(f'Verified {len(records)} source files ({sum(row["bytes"] for row in records):,} bytes); built {len(variants)} residences.')


if __name__ == '__main__':
    main()
