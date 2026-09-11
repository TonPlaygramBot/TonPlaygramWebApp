"""Deduplicate GLB images across the fleet; keep shared same-origin glTF textures."""
import struct,json,hashlib,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]/'webapp/public/assets/kart-royale/karts'
TEX=ROOT/'textures';TEX.mkdir(exist_ok=True)
for p in ROOT.glob('*.glb'):
 b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);binary=b[28+n:]
 image_views=set()
 for im in g.get('images',[]):
  if 'bufferView' not in im:continue
  idx=im.pop('bufferView');image_views.add(idx);v=g['bufferViews'][idx];data=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
  ext='png' if im.get('mimeType')=='image/png' else 'jpg';name=hashlib.sha256(data).hexdigest()[:16]+'.'+ext
  (TEX/name).write_bytes(data);im['uri']='textures/'+name
 if not image_views:continue
 views=[];out=bytearray();mapping={}
 for idx,v in enumerate(g['bufferViews']):
  if idx in image_views:continue
  offset=len(out);out.extend(binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]);out.extend(b'\0'*((-len(out))%4))
  mapping[idx]=len(views);views.append({**v,'byteOffset':offset})
 for accessor in g.get('accessors',[]):
  if 'bufferView' in accessor:accessor['bufferView']=mapping[accessor['bufferView']]
 g['bufferViews']=views;g['buffers'][0]['byteLength']=len(out)
 j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
 p.write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(out))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(out),0x004e4942)+out)
manifest=json.loads((ROOT/'manifest.json').read_text())
for a in manifest['assets']:
 b=(ROOT/a['file']).read_bytes();a['bytes']=len(b);n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n])
 a['triangles']=sum(g['accessors'][p['indices']]['count']//3 for mesh in g['meshes'] for p in mesh['primitives'])
 a['drawPrimitives']=sum(len(mesh['primitives']) for mesh in g['meshes'])
manifest['sharedTexturesBytes']=sum(p.stat().st_size for p in TEX.iterdir());(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('Fleet bytes:',sum(p.stat().st_size for p in ROOT.glob('*.glb')),'shared texture bytes:',manifest['sharedTexturesBytes'])
