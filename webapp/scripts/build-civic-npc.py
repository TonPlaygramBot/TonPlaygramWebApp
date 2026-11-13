"""Build a stylized civic NPC from the repository's CC0 Quaternius suit rig.

This is an authored game character, not a photogrammetric likeness. Preserve
the complete source geometry, skeleton and animation channels. The runtime
normalizes the figure to 1.98 m and uses the shared humanoid animation/IK code.
"""
from pathlib import Path
import copy, hashlib, json, struct

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'webapp/public/assets/tirana-streets/living/operator.glb'
OUT = ROOT / 'webapp/public/assets/tirana-streets/civic'
OUT.mkdir(parents=True, exist_ok=True)
raw = SOURCE.read_bytes()
json_length = struct.unpack_from('<I', raw, 12)[0]
model = json.loads(raw[20:20 + json_length])
binary_header = 20 + json_length
binary_length = struct.unpack_from('<I', raw, binary_header)[0]
binary = bytearray(raw[binary_header + 8:binary_header + 8 + binary_length])

palette = {'Suit': [.019, .023, .029, 1], 'White': [.86, .87, .85, 1],
           'Tie': [.048, .055, .075, 1], 'Hair': [.49, .51, .49, 1],
           'Eyebrows': [.24, .25, .24, 1]}
for material in model['materials']:
    color = palette.get(material.get('name'))
    if color:
        material.setdefault('pbrMetallicRoughness', {})['baseColorFactor'] = color
# Paint short grey facial hair on the source's own lower-face vertices. This
# retains the original skin surface and skin weights, without an attached face
# plate, image overlay, duplicate surface, or mismatched head/neck texture.
for mesh in model['meshes']:
    if mesh.get('name') != 'Cube.006':
        continue
    for primitive in mesh['primitives']:
        original_material = model['materials'][primitive.get('material', 0)]
        if original_material.get('name') != 'Skin':
            continue
        accessor = model['accessors'][primitive['attributes']['POSITION']]
        view = model['bufferViews'][accessor['bufferView']]
        offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        stride = view.get('byteStride', 12)
        skin = original_material['pbrMetallicRoughness']['baseColorFactor'][:3]
        colors = bytearray()
        def smooth(a, b, value):
            t = max(0, min(1, (value - a) / (b - a)))
            return t * t * (3 - 2 * t)
        for index in range(accessor['count']):
            x, y, z = struct.unpack_from('<fff', binary, offset + index * stride)
            blend = smooth(1.54, 1.57, y) * (1-smooth(1.635, 1.672, y)) * smooth(.04, .095, z)
            # Keep the center of the lip readable; retain continuous cheeks.
            blend *= 1 - .75 * (1-smooth(.016, .034, abs(x))) * smooth(1.62, 1.645, y)
            color = [skin[channel]*(1-blend)+[.45,.46,.44][channel]*blend for channel in range(3)]
            colors.extend(struct.pack('<fff', *color))
        color_offset = len(binary)
        binary.extend(colors)
        binary.extend(b'\0' * (-len(binary) % 4))
        model['bufferViews'].append({'buffer':0,'byteOffset':color_offset,'byteLength':len(colors),'target':34962})
        model['accessors'].append({'bufferView':len(model['bufferViews'])-1,'componentType':5126,'count':accessor['count'],'type':'VEC3'})
        primitive['attributes']['COLOR_0'] = len(model['accessors'])-1
        material = copy.deepcopy(original_material)
        material['name'] = 'Civic face · continuous skin and grey stubble'
        material['pbrMetallicRoughness']['baseColorFactor'] = [1,1,1,1]
        model['materials'].append(material)
        primitive['material'] = len(model['materials'])-1
model['buffers'][0]['byteLength'] = len(binary)
model['asset']['generator'] = 'TonPlaygram build-civic-npc.py'
model['asset']['copyright'] = 'Quaternius, CC0-1.0; TonPlaygram costume adaptation.'
model['extras'] = {
    'character': 'Edi Rama — stylized fictional game NPC',
    'likeness': 'Artistic approximation, not a scan or exact portrait',
    'heightMetres': 1.98,
    'source': 'https://quaternius.com/packs/ultimatemodularcharacters.html',
    'license': 'CC0-1.0', 'sourceSHA256': hashlib.sha256(raw).hexdigest()
}
encoded = json.dumps(model, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
output = (struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary))
          + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded
          + struct.pack('<II', len(binary), 0x004e4942) + binary)
(OUT / 'edi-rama-stylized.glb').write_bytes(output)
(OUT / 'manifest.json').write_text(json.dumps({
    **model['extras'], 'file': 'edi-rama-stylized.glb', 'bytes': len(output),
    'sha256': hashlib.sha256(output).hexdigest(),
    'changes': ['charcoal suit', 'grey hair and eyebrows', 'grey lower-face stubble on original skin vertices', 'original rig and clips retained'],
    'itinerary': 'Fictional game route; no real schedule or tracking data'
}, indent=2) + '\n')
print(json.dumps({'bytes': len(output), 'sha256': hashlib.sha256(output).hexdigest()}))
