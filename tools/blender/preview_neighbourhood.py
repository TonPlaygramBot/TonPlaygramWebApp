"""Create a compact, embedded review payload; never changes the game GLBs."""
import base64,gzip,io,json,struct
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[2]/'webapp/public/assets/tirana-streets/neighbourhood'
payload={'assets':{},'images':{}}
for path in sorted(root.glob('*.glb')):
    data=bytearray(path.read_bytes());length=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+length]);offset=28+length
    # One centimetre position precision in this isolated inspection copy.
    # All gameplay and collision files retain their original source precision.
    for accessor in gltf['accessors']:
        if accessor['componentType']!=5126:continue
        view=gltf['bufferViews'][accessor['bufferView']]
        count=accessor['count']*{'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[accessor['type']]
        for i in range(count):
            start=offset+view.get('byteOffset',0)+accessor.get('byteOffset',0)+i*4
            value=struct.unpack_from('<f',data,start)[0];struct.pack_into('<i',data,start,round(value*100))
    payload['assets'][path.stem]=base64.b64encode(gzip.compress(data,mtime=0)).decode()
for path in sorted((root/'textures').glob('*.jpg')):
    image=Image.open(path);image.thumbnail((256,256),Image.Resampling.LANCZOS);output=io.BytesIO();image.save(output,format='JPEG',quality=82,subsampling=0)
    payload['images']['textures/'+path.name]='data:image/jpeg;base64,'+base64.b64encode(output.getvalue()).decode()
print(json.dumps(payload,separators=(',',':')))
