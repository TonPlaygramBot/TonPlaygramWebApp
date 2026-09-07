"""Move original GLB kickbacks outside the gutters to match bowling collision geometry.
Run once against the original Royal Lanes alley asset; refuses to reapply the shift.
"""
from pathlib import Path
import json,struct
path=Path(__file__).resolve().parents[1]/'webapp/public/assets/royal-lanes/models/royal-alley.glb'
data=path.read_bytes();n=struct.unpack_from('<I',data,12)[0];model=json.loads(data[20:20+n]);binary=bytearray(data[28+n:]);changed=0
for mesh in model['meshes']:
 for primitive in mesh['primitives']:
  material=model['materials'][primitive['material']]
  if material.get('name')!='Graphite gutter':continue
  accessor=model['accessors'][primitive['attributes']['POSITION']];view=model['bufferViews'][accessor['bufferView']]
  offset=view.get('byteOffset',0)+accessor.get('byteOffset',0);stride=view.get('byteStride',12)
  minimum=[float('inf')]*3;maximum=[float('-inf')]*3
  for i in range(accessor['count']):
   pos=offset+i*stride;x,y,z=struct.unpack_from('<fff',binary,pos)
   if (abs(z+19.98)<.001 or abs(z+18.78)<.001) and -.001<=y<=.561:
    center=round(x/2.45)*2.45;local=x-center
    if .558<=abs(local)<=.690:
     x+=(1 if local>0 else -1)*.176;struct.pack_into('<f',binary,pos,x);changed+=1
   for axis,value in enumerate([x,y,z]):minimum[axis]=min(minimum[axis],value);maximum[axis]=max(maximum[axis],value)
  accessor['min']=minimum;accessor['max']=maximum
assert changed==240, f'Expected 240 original kickback vertices, found {changed}; asset may already be corrected.'
payload=json.dumps(model,separators=(',',':')).encode();payload+=b' '*((-len(payload))%4)
output=struct.pack('<III',0x46546c67,2,12+8+len(payload)+8+len(binary))+struct.pack('<II',len(payload),0x4e4f534a)+payload+struct.pack('<II',len(binary),0x004e4942)+binary
path.write_bytes(output)
print('Corrected 10 kickbacks; all other alley geometry and materials preserved.')
