"""Blender 4.3 source authoring. Run with blender -b --python ... -- <repo root>.
Original geometry; reference photographs are observation only, never textures.
Packed triangles are exported from evaluated Blender meshes for runtime/preview.
"""
import bpy,sys,json,math,gzip,pathlib,base64
from mathutils import Vector
ROOT=pathlib.Path(sys.argv[sys.argv.index('--')+1]);OUT=ROOT/'assets-source/tirana-east'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
PALETTE={'plaster':(.76,.70,.59,1),'white':(.9,.88,.81,1),'roof':(.42,.16,.07,1),'glass':(.055,.16,.19,1),'frame':(.7,.72,.71,1),'wood':(.2,.10,.045,1),'red':(.63,.017,.025,1),'green':(.12,.33,.12,1),'yellow':(.93,.59,.04,1),'metal':(.16,.19,.20,1),'fruit':(.68,.07,.04,1),'blue':(.14,.29,.42,1)}
MATS={}
for n,c in PALETTE.items():
 m=bpy.data.materials.new(n);m.diffuse_color=c;m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=c;bs.inputs['Roughness'].default_value=.38 if n=='glass' else .78;MATS[n]=m
class Model:
 def __init__(self,name):self.name=name;self.v=[];self.f=[];self.mat=[]
 def face(self,pts,mat):
  start=len(self.v);self.v.extend(pts);self.f.append(tuple(range(start,len(self.v))));self.mat.append(list(MATS).index(mat))
 def box(self,c,s,mat):
  x,y,z=c;w,d,h=[n/2 for n in s];v=[(x+a*w,y+b*d,z+c*h) for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
  for ids in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:self.face([v[i] for i in ids],mat)
 def sphere(self,c,r,mat,segments=8,rings=4):
  x,y,z=c
  for j in range(rings):
   a=-math.pi/2+j*math.pi/rings;b=a+math.pi/rings
   for i in range(segments):
    t=i*2*math.pi/segments;u=t+2*math.pi/segments
    self.face([(x+r*math.cos(phi)*math.cos(theta),y+r*math.cos(phi)*math.sin(theta),z+r*math.sin(phi)) for phi,theta in [(a,t),(a,u),(b,u),(b,t)]],mat)
 def object(self):
  me=bpy.data.meshes.new(self.name);me.from_pydata(self.v,[],self.f);me.update();o=bpy.data.objects.new(self.name,me);bpy.context.collection.objects.link(o)
  for m in MATS.values():me.materials.append(m)
  for p,mi in zip(me.polygons,self.mat):p.material_index=mi
  return o
models={}
def keep(m):models[m.name]=m.object()
# Kit front points toward Blender -Y (Three +Z); window dimensions in metres.
for name,style in [('house-bay','wood'),('campus-bay','frame')]:
 m=Model(name);m.box((0,-.075,0),(1.4,.11,1.55),'glass')
 for x in [-.76,.76,0]:m.box((x,-.14,0),(.09,.16,1.7),style)
 for z in [-.82,.82]:m.box((0,-.14,z),(1.62,.16,.09),style)
 m.box((0,-.24,-.91),(1.8,.42,.13),'white')
 if name=='house-bay':
  for x in [-1.0,1.0]:
   m.box((x,-.08,0),(.3,.09,1.62),'green')
   for z in [-.6,-.4,-.2,0,.2,.4,.6]:m.box((x,-.14,z),(.28,.055,.07),'wood')
 keep(m)
for name,col in [('campus-yellow-bay','yellow'),('campus-red-bay','red'),('campus-green-bay','green')]:
 m=Model(name);m.box((0,-.06,0),(1.55,.12,1.7),'glass')
 for x in [-.84,.84]:m.box((x,-.14,0),(.11,.18,1.91),col)
 for z in [-.9,.9]:m.box((0,-.14,z),(1.79,.18,.11),col)
 m.box((0,-.14,0),(.065,.18,1.8),'frame');keep(m)
m=Model('campus-modern-bay');m.box((0,-.04,0),(2.1,.14,2.35),'glass')
for x in [-1.12,1.12,0]:m.box((x,-.14,0),(.075,.18,2.45),'frame')
for x in [-1.36,1.36]:m.box((x,-.3,0),(.32,.65,3.2),'white')
m.box((0,-.3,-1.4),(2.9,.65,.28),'white')
for x in [-1.1,-.85,-.6,-.35,-.1,.15,.4,.65,.9,1.15]:m.box((x,-.7,-.87),(.03,.04,.86),'metal')
m.box((0,-.7,-.4),(2.45,.06,.055),'metal');keep(m)
m=Model('modern-house-bay');m.box((0,-.06,0),(2.4,.12,2.1),'glass')
for x in [-1.25,0,1.25]:m.box((x,-.14,0),(.07,.18,2.23),'metal')
for z in [-1.09,1.09]:m.box((0,-.14,z),(2.55,.18,.07),'metal')
keep(m)
m=Model('house-door');m.box((0,-.09,1.15),(1.15,.12,2.3),'wood');m.box((.38,-.18,1.08),(.06,.08,.28),'metal');m.box((0,-.08,2.48),(1.8,.5,.15),'white');keep(m)
m=Model('campus-entry');m.box((0,-.08,1.25),(2.8,.12,2.5),'glass')
for x in [-1.45,0,1.45]:m.box((x,-.18,1.25),(.1,.2,2.6),'frame')
m.box((0,-.7,2.85),(3.5,1.7,.18),'white');keep(m)
for name in ['produce','supermarket']:
 m=Model(name);m.box((0,.12,1.25),(4,.16,2.5),'glass');m.box((0,-.1,3.02),(4.8,.3,.65),'green' if name=='produce' else 'red')
 for x in [-2,0,2]:m.box((x,0,1.25),(.08,.18,2.5),'frame')
 if name=='produce':
  # Shallow racks remain within 0.65 m from frontage, reducing sidewalk intrusion.
  for x in [-1.7,-.9,.9,1.7]:
   m.box((x,-.35,.45),(.64,.54,.8),'wood')
   for ix in range(3):
    for iy in range(2):m.sphere((x+(ix-1)*.16,-.34+(iy-.5)*.18,.92),.09,'fruit' if x<0 else 'yellow')
  m.box((0,-.48,2.6),(4.7,1.05,.1),'green')
 else:
  for x in [-1.7,1.7]:m.box((x,-.35,.8),(.4,.5,1.4),'white')
 keep(m)
m=Model('gondola');m.box((0,0,.24),(2.0,1.8,.42),'red');m.box((0,0,1.25),(1.91,1.71,1.6),'glass');m.box((0,0,2.13),(2.0,1.8,.19),'red')
for x in [-.96,.96]:
 for y in [-.86,.86]:m.box((x,y,1.26),(.07,.07,1.6),'red')
for x in [-.46,.46]:m.box((x,-.88,1.27),(.045,.055,1.62),'metal')
m.box((0,0,2.8),(.14,.14,1.25),'metal');m.box((0,0,3.43),(.2,.65,.13),'metal');keep(m)
m=Model('station');m.box((0,0,.25),(12,25,.5),'white')
for x in [-5.5,5.5]:
 for y in [-10,-3,4,11]:m.box((x,y,3.2),(.55,.6,6.2),'white')
m.box((0,0,6.4),(13,27,.4),'metal');m.box((0,12.3,3.5),(11.6,.16,5.8),'glass');m.box((0,12.3,6.6),(12,.3,.7),'red');keep(m)
m=Model('belvedere');
for i in range(6):
 a=i*math.pi/3;b=(i+1)*math.pi/3
 # Hexagonal massing inspired by the glazed round hotel, dimensions estimated.
 m.face([(9*math.cos(a),9*math.sin(a),0),(9*math.cos(b),9*math.sin(b),0),(9*math.cos(b),9*math.sin(b),20),(9*math.cos(a),9*math.sin(a),20)],'white')
for j in range(5):
 for i in range(18):
  a=i*math.pi/9;b=(i+1)*math.pi/9
  m.face([(9.06*math.cos(a),9.06*math.sin(a),2+j*3.4),(9.06*math.cos(b),9.06*math.sin(b),2+j*3.4),(9.06*math.cos(b),9.06*math.sin(b),3.8+j*3.4),(9.06*math.cos(a),9.06*math.sin(a),3.8+j*3.4)],'glass')
for i in range(24):
 a=i*math.pi/12;b=(i+1)*math.pi/12;m.face([(9.2*math.cos(a),9.2*math.sin(a),20),(9.2*math.cos(b),9.2*math.sin(b),20),(9.2*math.cos(b),9.2*math.sin(b),26),(9.2*math.cos(a),9.2*math.sin(a),26)],'glass');m.box((9.3*math.cos(a),9.3*math.sin(a),23),(.13,.13,6.2),'frame')
m.face([(9.3*math.cos(i*math.pi/12),9.3*math.sin(i*math.pi/12),26.1) for i in range(24)],'metal');keep(m)
inputs=json.loads((OUT/'building-input.json').read_text());roofs={}
for b in inputs['houses']:
 p=b['p'];h=b['h'];n=len(p)
 # Honour explicit flat roofs and courtyard/concave outlines. No overhang into roads.
 signs=[]
 for i in range(n):
  a,c,d=p[i],p[(i+1)%n],p[(i+2)%n];cross=(c[0]-a[0])*(d[1]-c[1])-(c[1]-a[1])*(d[0]-c[0]);
  if abs(cross)>.01:signs.append(cross>0)
 if b.get('holes') or not signs or min(signs)!=max(signs) or b.get('roofShape')=='flat':continue
 cx=sum(v[0] for v in p)/n;cz=sum(v[1] for v in p)/n
 # Roof peak height estimated from footprint, only for explicitly typed houses.
 rh=min(2.7,max(.7,min(max(v[0] for v in p)-min(v[0] for v in p),max(v[1] for v in p)-min(v[1] for v in p))*.19))
 m=Model('roof-'+b['id'])
 ridge=None
 if n==4:
  edges=[(math.dist(p[i],p[(i+1)%n]),i) for i in range(n)];length,idx=max(edges);a,c=p[idx],p[(idx+1)%n];ux=(c[0]-a[0])/length;uz=(c[1]-a[1])/length
  ridge=[(-ux*length*.22,uz*length*.22,h+rh),(ux*length*.22,-uz*length*.22,h+rh)]
 for i,a in enumerate(p):
  c=p[(i+1)%n];aa=(a[0]-cx,-(a[1]-cz),h);cc=(c[0]-cx,-(c[1]-cz),h)
  if ridge:
   ra=min(ridge,key=lambda r:(r[0]-aa[0])**2+(r[1]-aa[1])**2);rc=min(ridge,key=lambda r:(r[0]-cc[0])**2+(r[1]-cc[1])**2);pts=[aa,cc,rc]+([] if ra==rc else [ra])
  else:pts=[aa,cc,(0,0,h+rh)]
  if (Vector(pts[1])-Vector(pts[0])).cross(Vector(pts[2])-Vector(pts[0])).z<0:pts.reverse()
  m.face(pts,'roof')
 keep(m);roofs[b['id']]=dict(x=cx,z=cz,height=h+rh)
# Export evaluated Blender triangles with baked normals/linear vertex colours.
pack={}
for name,o in models.items():
 me=o.data;me.calc_loop_triangles();v=[];norm=[];colors=[]
 for tri in me.loop_triangles:
  color=PALETTE[list(MATS)[me.polygons[tri.polygon_index].material_index]][:3];normal=tri.normal
  for index in tri.vertices:
   p=me.vertices[index].co;v.extend([round(p.x,4),round(p.z,4),round(-p.y,4)]);norm.extend([round(normal.x,5),round(normal.z,5),round(-normal.y,5)]);colors.extend(color)
 pack[name]=dict(p=v,n=norm,c=colors)
(OUT/'blender-meshes.json.gz').write_bytes(gzip.compress(json.dumps({'models':pack,'roofs':roofs},separators=(',',':')).encode(),mtime=0))
encoded=base64.b64encode((OUT/'blender-meshes.json.gz').read_bytes()).decode()
(ROOT/'webapp/src/games/tirana-east/blenderData.mjs').write_text("// Generated by Blender; original meshes, see source script.\nimport {decodeSource} from '../tirana-neighbourhood/decodeSource.mjs';\nexport const BLENDER=decodeSource(['"+encoded+"']);\n")
# Arrange the reusable kit library beside the source-frame houses for editing.
for i,(name,o) in enumerate(models.items()):
 if name.startswith('roof-'):
  r=roofs[name[5:]];o.location=(r['x'],-r['z'],0)
 else:o.location=(-6000+(i%5)*35,6000+(i//5)*35,0)
# Full original source footprint walls remain editable in the .blend, while the
# live game shares its already-streamed walls and only loads the detail pack.
for b in inputs['houses']+inputs['dorms']:
 m=Model('source-wall-'+b['id'])
 for ring in [b['p']]+b.get('holes',[]):
  for i,a in enumerate(ring):
   c=ring[(i+1)%len(ring)];m.face([(a[0],-a[1],0),(c[0],-c[1],0),(c[0],-c[1],b['h']),(a[0],-a[1],b['h'])],'plaster' if b in inputs['houses'] else 'white')
 m.object()
# Convenient complete authoring file; runtime only loads the compact derived data.
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'houses-campus-cableway.blend'),compress=True)
(OUT/'blender-metrics.json').write_text(json.dumps({'blender':bpy.app.version_string,'models':len(pack),'roofCount':len(roofs),'triangles':{k:len(v['p'])//9 for k,v in pack.items()},'source':'webapp/scripts/blender/build_tirana_east.py'},indent=2)+'\n')
print('BLENDER EXPORTED',len(pack),'models',len(roofs),'footprint roofs')
