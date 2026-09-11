"""Share 1K PBR images across the Blender exports, retaining editable 2K sources.
Run after tirana_neighbourhood.py. No decoder or remote asset host is required.
"""
import hashlib
import io
import json
import struct
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / 'webapp/public/assets/tirana-streets/neighbourhood'
TEX = ROOT / 'textures'
TEX.mkdir(exist_ok=True)
for path in sorted(ROOT.glob('*.glb')):
    blob = path.read_bytes()
    size = struct.unpack_from('<I', blob, 12)[0]
    gltf = json.loads(blob[20:20+size])
    binary = blob[28+size:]
    removed = set()
    for image in gltf.get('images', []):
        if 'bufferView' not in image:
            continue
        index = image.pop('bufferView')
        removed.add(index)
        view = gltf['bufferViews'][index]
        start = view.get('byteOffset', 0)
        pixels = Image.open(io.BytesIO(binary[start:start+view['byteLength']])).convert('RGB')
        pixels.thumbnail((1024,1024), Image.Resampling.LANCZOS)
        encoded = io.BytesIO()
        pixels.save(encoded, format='JPEG', quality=90, subsampling=0, optimize=True)
        data = encoded.getvalue()
        name = hashlib.sha256(data).hexdigest()[:20]+'.jpg'
        (TEX/name).write_bytes(data)
        image['uri'] = 'textures/'+name
        image['mimeType'] = 'image/jpeg'
    if not removed:
        continue
    views, output, mapping = [], bytearray(), {}
    for index, view in enumerate(gltf['bufferViews']):
        if index in removed:
            continue
        offset = len(output)
        start = view.get('byteOffset',0)
        output.extend(binary[start:start+view['byteLength']])
        output.extend(b'\0' * (-len(output)%4))
        mapping[index] = len(views)
        views.append({**view, 'byteOffset':offset})
    for accessor in gltf.get('accessors',[]):
        if 'bufferView' in accessor:
            accessor['bufferView'] = mapping[accessor['bufferView']]
        assert 'sparse' not in accessor, 'Handle sparse accessors before packing'
    gltf['bufferViews'] = views
    gltf['buffers'][0]['byteLength'] = len(output)
    encoded = json.dumps(gltf,separators=(',',':')).encode()
    encoded += b' ' * (-len(encoded)%4)
    path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(encoded)+len(output))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(output),0x004e4942)+output)
manifest = json.loads((ROOT/'manifest.json').read_text())
for item in manifest['models']:
    blob = (ROOT/item['file']).read_bytes()
    item['bytes'] = len(blob)
    item['sha256'] = hashlib.sha256(blob).hexdigest()
manifest['textures'] = [{'file':'textures/'+p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(TEX.glob('*.jpg'))]
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('GLB bytes',sum(m['bytes'] for m in manifest['models']),'shared texture bytes',sum(m['bytes'] for m in manifest['textures']))
