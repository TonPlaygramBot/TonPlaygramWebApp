"""Rebuild the runtime pack from the supplied Albanian-Forces-Asset-Pack.zip.

Run after npm ci in webapp. Source notices and the original input hashes are
retained; editable Blender scenes stay in the original authoring ZIP.
"""
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import sys
import zipfile

webapp = Path(__file__).resolve().parents[1]
out = webapp / 'public/assets/tirana-streets/albanian-forces'
prefix = 'Albanian-Forces-V2/'
notices = [
    'webots/LICENSE', 'vehicles/cars/FN/about.txt', 'vehicles/cars/S8/about.txt',
    'stuntrally/data/cars/BV/about.txt',
    'shirts/clothes/elvs_male_shirt_untucked_bd1/elvs_male_shirt_untucked_bd1.mhclo',
    'suits/clothes/elvs_emt_uniform_pants_male/elvs_emt_uniform_pants_male.mhclo',
    'boots/clothes/mindfront_shoes_biker_boots_male/mindfront_shoes_biker_boots_male.mhclo',
]

def write(relative, data):
    path = out / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)

if len(sys.argv) != 2:
    raise SystemExit('Usage: python webapp/scripts/import-albanian-forces.py <asset-pack.zip>')
with zipfile.ZipFile(sys.argv[1]) as archive:
    manifest = json.loads(archive.read(prefix + 'manifest.json'))
    if len(manifest) != 14:
        raise ValueError('Expected the 14-model Albanian Forces v2 pack')
    for entry in manifest:
        name = entry['id']
        if not re.fullmatch(r'[a-z_]+', name):
            raise ValueError('Invalid asset ID')
        data = archive.read(prefix + f'glb/{name}.glb')
        entry['sourceSha256'] = hashlib.sha256(data).hexdigest()
        entry['sourceBytes'] = len(data)
        entry['sourceTriangles'] = entry['triangles']
        write(f'glb/{name}.glb', data)
        write(f'thumbnails/{name}.jpg', archive.read(prefix + f'thumbnails/{name}.jpg'))
        path = out / f'glb/{name}.glb'
        budget = '45000' if entry['category'] == 'person' else '40000'
        subprocess.run(['node', 'scripts/optimize-tirana-glb.mjs', str(path), budget], cwd=webapp, check=True)
        subprocess.run(['node', 'scripts/optimize-albanian-force-textures.mjs', str(path)], cwd=webapp, check=True)
        data = path.read_bytes()
        doc = json.loads(data[20:20 + struct.unpack_from('<I', data, 12)[0]])
        entry.update(file=f'/assets/tirana-streets/albanian-forces/glb/{name}.glb',
                     bytes=len(data), sha256=hashlib.sha256(data).hexdigest(),
                     triangles=doc['asset']['extras']['tiranaGeometry']['triangles'],
                     maxTextureSize=1024)
    for name in ['ATTRIBUTION.md', 'REFERENCES.md', 'README.md']:
        write('PACK-README.md' if name == 'README.md' else name, archive.read(prefix + name))
    for name in notices:
        write('notices/' + name, archive.read(prefix + 'source/sources/' + name))
    write('manifest.json', (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode())
