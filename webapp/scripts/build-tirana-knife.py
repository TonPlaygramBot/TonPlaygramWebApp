"""Bundle Vinrax's CC0 low-poly knife, OGA source below.
Readable OBJ + PBR textures are retained in assets-source/tirana-agent/knife.
https://opengameart.org/content/knife-low-poly
"""
from pathlib import Path
import struct,json,gzip,math,hashlib
root=Path(__file__).resolve().parents[2];source=root/'assets-source/tirana-agent/knife'
v=[];uv=[];norm=[];faces=[]
for line in gzip.decompress((source/'knife.obj.gz').read_bytes()).decode('latin1').splitlines():
 s=line.split()
 if not s:continue
 if s[0]=='v':v.append(tuple(map(float,s[1:4])))
 if s[0]=='vt':uv.append(tuple(map(float,s[1:3])))
 if s[0]=='vn':norm.append(tuple(map(float,s[1:4])))
 if s[0]=='f':
  corners=[tuple(int(c) if c else 0 for c in t.split('/')) for t in s[1:]]
  for k in range(1,len(corners)-1):faces.extend([corners[0],corners[k],corners[k+1]])
lo=[min(p[i] for p in v) for i in range(3)];hi=[max(p[i] for p in v) for i in range(3)];center=[(a+b)/2 for a,b in zip(lo,hi)];scale=.30/(hi[1]-lo[1])
positions=[];normals=[];coords=[]
for f in faces:
 p=v[f[0]-1];positions.extend([(p[2]-center[2])*scale,(p[0]-center[0])*scale,(p[1]-center[1])*scale]);t=uv[f[1]-1] if len(f)>1 and f[1] else (0,0);coords.extend([t[0],1-t[1]])
 n=norm[f[2]-1] if len(f)>2 and f[2] else (0,0,0);normals.extend([n[2],n[0],n[1]])
if not norm:
 for i in range(0,len(positions),9):
  a=positions[i:i+3];b=positions[i+3:i+6];c=positions[i+6:i+9];u=[b[j]-a[j] for j in range(3)];w=[c[j]-a[j] for j in range(3)];n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];l=math.sqrt(sum(x*x for x in n)) or 1;normals[i:i+9]=[x/l for x in n]*3
binary=bytearray();views=[];access=[]
def view(b,target=None):
 i=len(views);o={'buffer':0,'byteOffset':len(binary),'byteLength':len(b)}
 if target:o['target']=target
 views.append(o);binary.extend(b);binary.extend(b'\0'*((-len(binary))%4));return i
def attr(a,n):
 i=len(access);o={'bufferView':view(struct.pack('<'+'f'*len(a),*a),34962),'componentType':5126,'count':len(a)//n,'type':'VEC'+str(n)}
 if n==3:o.update(min=[min(a[j::n]) for j in range(n)],max=[max(a[j::n]) for j in range(n)])
 access.append(o);return i
attrs={'POSITION':attr(positions,3),'NORMAL':attr(normals,3),'TEXCOORD_0':attr(coords,2)}
images=[{'bufferView':view((source/'diffuse.jpg').read_bytes()),'mimeType':'image/jpeg'}]
j={'asset':{'version':'2.0','generator':'build-tirana-knife.py','copyright':'Vinrax. CC0. https://opengameart.org/content/knife-low-poly'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'Combat Knife','mesh':0}],'meshes':[{'primitives':[{'attributes':attrs,'material':0}]}],'materials':[{'name':'Original knife finish','doubleSided':True,'pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':.45,'roughnessFactor':.42}}],'textures':[{'source':0}],'images':images,'accessors':access,'bufferViews':views,'buffers':[{'byteLength':len(binary)}]}
s=json.dumps(j,separators=(',',':')).encode();s+=b' '*((-len(s))%4);out=struct.pack('<III',0x46546c67,2,28+len(s)+len(binary))+struct.pack('<II',len(s),0x4e4f534a)+s+struct.pack('<II',len(binary),0x004e4942)+binary
(root/'webapp/public/assets/tirana-streets/living/combat-knife.glb').write_bytes(out);print({'triangles':len(faces)//3,'bytes':len(out),'lengthMetres':.30,'sha256':hashlib.sha256(out).hexdigest()})
