"""Pack the Blender exports with standard glTF quantization and existing PBR maps.
No additional decoder is needed. Precision: positions <= 2 mm per axis.
Run AFTER export_tirana_regional_heroes.py from the repository root.
"""
import struct,json,hashlib
from pathlib import Path
ROOT=Path('webapp/public/assets/tirana-streets/neighbourhood')
IMAGES={'plastered_wall_02-nor_gl':'textures/5bfcaef476f2fdfbfc02.jpg','plastered_wall_02-diff':'textures/00e7859ea95f80fc04d6.jpg','plastered_wall_02-rough':'textures/5bfa573f0f5043eaea64.jpg'}
def load(path):
 data=path.read_bytes();size=struct.unpack_from('<I',data,12)[0];return json.loads(data[20:20+size]),data[28+size:]
def write(path,g,binary):
 payload=json.dumps(g,separators=(',',':')).encode();payload+=b' '*((-len(payload))%4);binary+=b'\0'*((-len(binary))%4)
 path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(payload)+len(binary))+struct.pack('<II',len(payload),0x4e4f534a)+payload+struct.pack('<II',len(binary),0x004e4942)+binary)
def pack_grand():
 path=ROOT/'grand.glb';g,binary=load(path)
 if 'KHR_mesh_quantization' in g.get('extensionsUsed',[]):return
 views=g['bufferViews'];output=bytearray();new_views=[];attrs={}
 for mesh in g['meshes']:
  for primitive in mesh['primitives']:
   for kind,index in primitive['attributes'].items():attrs[index]=kind
 for index,a in enumerate(g['accessors']):
  v=views[a['bufferView']];offset=v.get('byteOffset',0)+a.get('byteOffset',0);kind=attrs.get(index);n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
  old_size={5121:1,5123:2,5125:4,5126:4}[a['componentType']];stride=v.get('byteStride',n*old_size)
  target={5121:'B',5123:'H',5125:'I',5126:'f'}[a['componentType']];component=a['componentType'];normalized=False
  factor=1
  if kind=='POSITION':target='h';component=5122;factor=256
  elif kind=='NORMAL':target='b';component=5120;factor=127;normalized=True
  elif kind=='TEXCOORD_0':target='h';component=5122;factor=1024
  width=struct.calcsize('<'+target*n);packed_stride=(width+3)//4*4 if kind else width
  data=bytearray();minimum=[float('inf')]*n;maximum=[-float('inf')]*n
  for i in range(a['count']):
   values=struct.unpack_from('<'+{5121:'B',5123:'H',5125:'I',5126:'f'}[a['componentType']]*n,binary,offset+i*stride)
   if kind in ['POSITION','NORMAL','TEXCOORD_0']:values=[round(v*factor) for v in values]
   for j,val in enumerate(values):minimum[j]=min(minimum[j],val);maximum[j]=max(maximum[j],val)
   data.extend(struct.pack('<'+target*n,*values));data.extend(b'\0'*(packed_stride-width))
  output.extend(b'\0'*((-len(output))%4));new={'buffer':0,'byteOffset':len(output),'byteLength':len(data)}
  if kind:new['byteStride']=packed_stride;new['target']=34962
  else:new['target']=34963
  a['bufferView']=len(new_views);a.pop('byteOffset',None);a['componentType']=component
  if normalized:a['normalized']=True
  if 'min' in a:a['min']=minimum
  if 'max' in a:a['max']=maximum
  new_views.append(new);output.extend(data)
 for node in g['nodes']:
  if 'mesh' in node:node['scale']=[v/256 for v in node.get('scale',[1,1,1])]
 for image in g.get('images',[]):
  image.pop('bufferView',None);image['uri']=IMAGES[image['name']];image['mimeType']='image/jpeg';assert (ROOT/image['uri']).is_file()
 def textures(obj):
  if isinstance(obj,dict):
   for key,value in obj.items():
    if key.endswith('Texture') and isinstance(value,dict) and 'index' in value:value.setdefault('extensions',{})['KHR_texture_transform']={'scale':[1/1024,1/1024]}
    elif key!='extensions':textures(value)
  elif isinstance(obj,list):
   for value in obj:textures(value)
 textures(g.get('materials',[]))
 g['bufferViews']=new_views;g['buffers']=[{'byteLength':len(output)}];g['extensionsUsed']=['KHR_mesh_quantization','KHR_texture_transform'];g['extensionsRequired']=['KHR_mesh_quantization','KHR_texture_transform'];write(path,g,bytes(output))
pack_grand()
manifest=json.loads((ROOT/'manifest.json').read_text());manifest['blender']='4.5.3 LTS (regional hero refresh; existing kits 4.2.9)'
for model in manifest['models']:
 if model['asset'] not in ['grand','njesia-2']:continue
 path=ROOT/model['file'];data=path.read_bytes();g,_=load(path)
 model.update(bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),triangles=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives']))
total=sum(a['bytes'] for a in manifest['models']+manifest['textures']);assert total<5200000,total
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print('TOTAL NEIGHBOURHOOD BYTES',total)
