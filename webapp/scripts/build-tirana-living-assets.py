#!/usr/bin/env python3
"""Vendor attributed glTF sources as self-contained mobile GLBs (Pillow required).
Usage: python build-tirana-living-assets.py CACHE_DIR OUTPUT_DIR SOURCES_JSON
Only sources whose individual license has been reviewed belong in SOURCES_JSON.
"""
import base64, concurrent.futures, hashlib, io, json, pathlib, struct, sys, urllib.request
from PIL import Image
CACHE, OUT, MANIFEST = map(pathlib.Path, sys.argv[1:])
CACHE.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)

def fetch(url):
    path=CACHE/hashlib.sha256(url.encode()).hexdigest()
    if path.exists():
        data=path.read_bytes()
        if not data.startswith(b"version https://git-lfs.github.com/spec/v1"):return data
    with urllib.request.urlopen(url,timeout=45) as response: data=response.read()
    if data.startswith(b"version https://git-lfs.github.com/spec/v1") and url.startswith("https://raw.githubusercontent.com/"):
        data=fetch(url.replace("https://raw.githubusercontent.com/", "https://media.githubusercontent.com/media/", 1))
    path.write_bytes(data);return data

def source(url):
    data=fetch(url)
    if data[:4]==b'glTF':
        size=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+size]);binary=data[28+size:]
    else:doc=json.loads(data);binary=None
    return doc,binary

def bake(entry):
    url=entry['url'];doc,binary=source(url)
    origin=url.rsplit('/',1)[0]+'/'
    def resource(uri):return base64.b64decode(uri.split(',',1)[1]) if uri.startswith('data:') else fetch(urllib.parse.urljoin(origin,uri))
    buffers=[resource(b['uri']) if b.get('uri') else binary for b in doc.get('buffers',[])]
    views=[buffers[v.get('buffer',0)][v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']] for v in doc.get('bufferViews',[])]
    for img in doc.get('images',[]):
        raw=resource(img.pop('uri')) if 'uri' in img else views[img['bufferView']]
        im=Image.open(io.BytesIO(raw));im.thumbnail((entry.get('textureSize',512),)*2,Image.Resampling.LANCZOS)
        alpha=im.mode in ('RGBA','LA') or 'transparency' in im.info
        im=im.convert('RGBA' if alpha else 'RGB');stream=io.BytesIO()
        im.save(stream,format='PNG' if alpha else 'JPEG',**({'optimize':True} if alpha else {'quality':88,'optimize':True}))
        data=stream.getvalue();img['mimeType']='image/png' if alpha else 'image/jpeg'
        if 'bufferView' in img:views[img['bufferView']]=data
        else:
            img['bufferView']=len(views);views.append(data);doc.setdefault('bufferViews',[]).append({})
    # Older Ludo sources use an obsolete spec/gloss extension. Preserve diffuse,
    # normal, occlusion and emissive maps while converting factors to core PBR.
    for mat in doc.get('materials',[]):
        ext=mat.get('extensions',{}).pop('KHR_materials_pbrSpecularGlossiness',None)
        if ext:
            pbr=mat.setdefault('pbrMetallicRoughness',{});pbr.update(baseColorFactor=ext.get('diffuseFactor',[1,1,1,1]),metallicFactor=0,roughnessFactor=max(.15,1-ext.get('glossinessFactor',.5)))
            if 'diffuseTexture' in ext:pbr['baseColorTexture']=ext['diffuseTexture']
        # Transparent car glass uses alpha blending rather than an extra mobile transmission pass.
        if entry.get('mobileCar'):
            if mat.get('extensions',{}).pop('KHR_materials_transmission',None):
                mat['alphaMode']='BLEND';mat.setdefault('pbrMetallicRoughness',{})['baseColorFactor']=[.12,.19,.22,.58]
    for key in ['extensionsUsed','extensionsRequired']:
        if key in doc:doc[key]=[s for s in doc[key] if s!='KHR_materials_pbrSpecularGlossiness' and not(entry.get('mobileCar') and s=='KHR_materials_transmission')]
    output=bytearray()
    for v,data in zip(doc['bufferViews'],views):
        output.extend(b'\0'*((-len(output))%4));v['buffer']=0;v['byteOffset']=len(output);v['byteLength']=len(data);output.extend(data)
    doc['buffers']=[{'byteLength':len(output)}];output.extend(b'\0'*((-len(output))%4))
    doc.setdefault('asset',{})['extras']={**doc.get('asset',{}).get('extras',{}),'tiranaSource':url,'tiranaLicense':entry['license'],'tiranaChanges':'Embedded dependencies; resized textures; core-PBR compatibility conversion.'}
    js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
    result=struct.pack('<III',0x46546c67,2,28+len(js)+len(output))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(output),0x004e4942)+output
    target=OUT/(entry['id']+'.glb');target.write_bytes(result)
    tris=sum(doc['accessors'][p['indices']]['count']//3 if 'indices' in p else doc['accessors'][p['attributes']['POSITION']]['count']//3 for m in doc.get('meshes',[]) for p in m['primitives'])
    return {**entry,'file':target.name,'bytes':len(result),'sha256':hashlib.sha256(result).hexdigest(),'triangles':tris,'animations':[a.get('name') for a in doc.get('animations',[])]}

entries=json.loads(MANIFEST.read_text());results=[];failures=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    futures={pool.submit(bake,e):e for e in entries}
    for job in concurrent.futures.as_completed(futures):
        entry=futures[job]
        try:
            row=job.result();results.append(row);print(row['id'],row['bytes'],row['triangles'],flush=True)
        except Exception as error:failures.append(entry['id']);print('FAILED',entry['id'],str(error),flush=True)
(OUT/'living-sources.json').write_text(json.dumps(sorted(results,key=lambda r:r['id']),indent=2)+'\n')
if failures:raise SystemExit('Failed assets: '+', '.join(failures))
