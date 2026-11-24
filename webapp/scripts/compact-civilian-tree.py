"""Downsample only embedded image pixels; preserve exact geometry, material IDs, and leaf alpha mask."""
from io import BytesIO
from pathlib import Path
import hashlib
import json
import struct
from PIL import Image

webapp = Path(__file__).resolve().parents[1]
source = webapp / 'public/assets/tirana-streets/city-realism/urban-tree-lod1.glb'
output = webapp / 'public/assets/tirana-city-game/districts/lana-tree.glb'
blob = source.read_bytes()
expected = 'b82e54b393ec75a022be569da11851d9f9211894349413f8ce594239ce2cf3cb'
if hashlib.sha256(blob).hexdigest() != expected:
    raise ValueError('The reviewed Poly Haven derivative must not change silently')
json_len = struct.unpack_from('<I', blob, 12)[0]
gltf = json.loads(blob[20:20 + json_len])
binary = blob[28 + json_len:]
images = {img['bufferView']: img for img in gltf['images']}
out = bytearray()
outputs = []
if len(gltf['buffers']) != 1:
    raise ValueError('Only embedded source data is supported')
for i, view in enumerate(gltf['bufferViews']):
    initial = view.get('byteOffset', 0)
    part = binary[initial:initial + view['byteLength']]
    image = images.get(i)
    if image:
        image_type = image['mimeType']
        im = Image.open(BytesIO(part))
        im.thumbnail((256, 256), Image.Resampling.LANCZOS)
        # Preserve actual alpha; only the resized PNG retains an alpha-capable container.
        store = BytesIO()
        if image_type == 'image/jpeg':
            im.convert('RGB').save(store, format='JPEG', quality=79, optimize=True)
        elif image_type == 'image/png':
            im.save(store, format='PNG', optimize=True)
        else:
            raise ValueError(image_type)
        part = store.getvalue()
        outputs.append((im.size, len(part)))
    view['byteOffset'] = len(out)
    view['byteLength'] = len(part)
    out.extend(part)
    out.extend(b'\0' * (-len(out) % 4))
gltf['buffers'][0]['byteLength'] = len(out)
text = json.dumps(gltf, ensure_ascii=True, separators=(',', ':')).encode()
text += b' ' * (-len(text) % 4)
header = struct.pack('<4sIII4s', b'glTF', 2, 28 + len(text) + len(out), len(text), b'JSON')
output.write_bytes(header + text + struct.pack('<I4s', len(out), b'BIN\0') + out)
print({'inputBytes': len(blob), 'outputBytes': output.stat().st_size, 'images': outputs,
       'sha256': hashlib.sha256(output.read_bytes()).hexdigest()})
