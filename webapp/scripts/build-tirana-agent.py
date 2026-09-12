"""Build the bundled CC0 suited player from Quaternius' unmodified source.
Source: https://quaternius.com/packs/ultimatemodularcharacters.html
The source glTF is embedded-data JSON. Output keeps its original rig and clips.
"""
from pathlib import Path
import json,base64,struct,hashlib,gzip
ROOT=Path(__file__).resolve().parents[2]
p=ROOT/'assets-source/tirana-agent/suit-original.gltf.gz'
source=gzip.decompress(p.read_bytes());j=json.loads(source)
# Costume adaptation: charcoal suit, white shirt and deep-red tie. Remove the
# artist's separate handgun because runtime owns the player's actual equipment.
for n in j['nodes']:
 if n.get('name')=='Pistol': n.pop('mesh',None);n.pop('skin',None)
for m in j['materials']:
 c={'Suit':[.025,.028,.032,1],'Tie':[.44,.009,.016,1],'White':[.9,.88,.83,1],'Hair':[.6172067523,.4178851247,.2383975834,1]}.get(m.get('name'))
 if c:m['pbrMetallicRoughness']['baseColorFactor']=c
# The hair is a separate primitive. Keep the complete scalp from Skin.
for m in j['meshes']:
 if m.get('name')=='Cube.006':m['primitives']=[p for p in m['primitives'] if j['materials'][p.get('material',0)]['name']!='Hair']
j['asset']['copyright']='Quaternius, CC0-1.0. Costume adaptation for TonPlaygram. Not an IO Interactive asset.'
j['asset']['generator']='build-tirana-agent.py'
j['extras']={'source':'https://quaternius.com/packs/ultimatemodularcharacters.html','license':'CC0-1.0','sourceSHA256':hashlib.sha256(source).hexdigest(),'heightMetres':1.78,'appearance':'Bald suited agent with red tie'}
binary=bytearray()
for i,buf in enumerate(j['buffers']):
 offset=len(binary);raw=base64.b64decode(buf['uri'].split(',',1)[1]);binary.extend(raw);binary.extend(b'\0'*((-len(binary))%4))
 for v in j['bufferViews']:
  if v.get('buffer',0)==i:v['byteOffset']=v.get('byteOffset',0)+offset;v['buffer']=0
# Keep the three locomotion clips used by the full-body controller and repack
# only referenced accessors/views. Authoring source still retains all 24 clips.
j['animations']=[a for a in j['animations'] if a['name'] in ['Idle','Walk','Run']]
meshes=sorted({n['mesh'] for n in j['nodes'] if 'mesh' in n});mapping={old:i for i,old in enumerate(meshes)}
j['meshes']=[j['meshes'][i] for i in meshes]
for n in j['nodes']:
 if 'mesh' in n:n['mesh']=mapping[n['mesh']]
refs=[]
for m in j['meshes']:
 for p in m['primitives']:
  refs.extend((p['attributes'],k) for k in p['attributes'])
  if 'indices' in p:refs.append((p,'indices'))
  for t in p.get('targets',[]):refs.extend((t,k) for k in t)
for skin in j.get('skins',[]):
 if 'inverseBindMatrices' in skin:refs.append((skin,'inverseBindMatrices'))
for a in j['animations']:
 for sm in a['samplers']:refs.extend([(sm,'input'),(sm,'output')])
used=sorted({o[k] for o,k in refs});mapping={old:i for i,old in enumerate(used)}
for o,k in refs:o[k]=mapping[o[k]]
j['accessors']=[j['accessors'][i] for i in used]
views=sorted({a['bufferView'] for a in j['accessors'] if 'bufferView' in a});mapping={old:i for i,old in enumerate(views)}
packed=bytearray();newviews=[]
for i in views:
 v=j['bufferViews'][i].copy();start=v.get('byteOffset',0);raw=binary[start:start+v['byteLength']];v['byteOffset']=len(packed);packed.extend(raw);packed.extend(b'\0'*((-len(packed))%4));newviews.append(v)
for a in j['accessors']:
 if 'bufferView' in a:a['bufferView']=mapping[a['bufferView']]
j['bufferViews']=newviews;binary=packed
j['buffers']=[{'byteLength':len(binary)}]
data=json.dumps(j,separators=(',',':')).encode();data+=b' '*((-len(data))%4)
out=struct.pack('<III',0x46546c67,2,28+len(data)+len(binary))+struct.pack('<II',len(data),0x4e4f534a)+data+struct.pack('<II',len(binary),0x004e4942)+binary
p=ROOT/'webapp/public/assets/tirana-streets/living/suited-agent.glb';p.write_bytes(out);print({'bytes':len(out),'animations':len(j['animations']),'sha256':hashlib.sha256(out).hexdigest()})
