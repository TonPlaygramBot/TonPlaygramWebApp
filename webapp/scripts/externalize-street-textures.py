"""Losslessly share GLB image bytes with the existing material assets.
The GLB remains a glTF 2.0 binary geometry container with relative image URIs.
No resampling, color conversion, or quality reduction is performed.
"""
import hashlib, json, struct, sys
from pathlib import Path

def externalize(path):
    path=Path(path);data=path.read_bytes();length=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+length]);binary=data[28+length:]
    directory=path.parent/'materials';directory.mkdir(exist_ok=True)
    existing={hashlib.sha256(p.read_bytes()).hexdigest():p.name for p in directory.iterdir() if p.is_file()}
    removed=set();records=[]
    for image in doc.get('images',[]):
        if 'bufferView' not in image:continue
        index=image.pop('bufferView');view=doc['bufferViews'][index];start=view.get('byteOffset',0)
        content=binary[start:start+view['byteLength']];digest=hashlib.sha256(content).hexdigest()
        name=existing.get(digest)
        if not name:
            name='street-kit-'+image.get('name','material')+('.jpg' if image.get('mimeType')=='image/jpeg' else '.png')
            (directory/name).write_bytes(content)
        image['uri']='materials/'+name;removed.add(index)
        records.append({'file':image['uri'],'sha256':digest,'bytes':len(content),'source':'Exact Blender GLB image bytes'})
    if not removed:return
    result=bytearray();views=[];indices={}
    for index,view in enumerate(doc['bufferViews']):
        if index in removed:continue
        indices[index]=len(views);start=view.get('byteOffset',0)
        result.extend(b'\x00'*((-len(result))%4));offset=len(result)
        result.extend(binary[start:start+view['byteLength']]);views.append({**view,'byteOffset':offset})
    def remap(value):
        if isinstance(value,dict):
            for key,item in value.items():
                if key=='bufferView':value[key]=indices[item]
                else:remap(item)
        elif isinstance(value,list):
            for item in value:remap(item)
    remap(doc);doc['bufferViews']=views;doc['buffers'][0]['byteLength']=len(result)
    raw=json.dumps(doc,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4)
    result.extend(b'\x00'*((-len(result))%4))
    path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(raw)+len(result))+struct.pack('<II',len(raw),0x4e4f534a)+raw+struct.pack('<II',len(result),0x004e4942)+result)
    (directory/'street-kit-runtime-sources.json').write_text(json.dumps(records,indent=2)+'\n')
    print(json.dumps({'geometryGLBBytes':path.stat().st_size,'sharedImageBytes':sum(r['bytes'] for r in records),'images':len(records)}))

if __name__=='__main__':externalize(sys.argv[1])
