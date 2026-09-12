"""Complete eight mapped Tirana blocks with the Blender facade kit.
All footprints, heights and IDs come from building-input.json; facade rhythm is
authored. Local metres export at the recorded origin, with original collisions.
"""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.geometry import tessellate_polygon
ROOT=Path.cwd();SOURCE=ROOT/'assets-source/tirana-city-completion';OUT=ROOT/'webapp/public/assets/tirana-streets/neighbourhood'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'city-completion-kit.blend'))
templates={}
for name in ['window_bay','balcony_bay','air_conditioner','entrance_bay']:
 collection=bpy.data.collections[name];templates[name]=[]
 for o in collection.objects:
  o.data.calc_loop_triangles()
  templates[name].append((o.data.materials[0],[(o.matrix_world@v.co).copy() for v in o.data.vertices],[tuple(t.vertices) for t in o.data.loop_triangles]))
materials={m.name:m for m in bpy.data.materials}
for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
data=json.loads((SOURCE/'building-input.json').read_text());metrics=[]
for bi,b in enumerate(data['buildings']):
 ox,oz=b['origin'];parts={}
 def append(mat,verts,faces):
  p=parts.setdefault(mat,{'v':[],'f':[]});offset=len(p['v']);p['v'].extend(verts);p['f'].extend(tuple(offset+i for i in f) for f in faces)
 ring=[Vector((x-ox,-(z-oz),0)) for x,z in b['p']];h=b['h'];low=b.get('minHeight',0)
 verts=[(p.x,p.y,low) for p in ring]+[(p.x,p.y,h) for p in ring];n=len(ring);faces=[]
 # Blender tessellates concave n-gons without changing the source outline.
 for tri in tessellate_polygon([ring]):
  ids=list(tri) if isinstance(tri[0],int) else [min(range(len(ring)),key=lambda i:(ring[i]-v).length) for v in tri]
  faces.append(tuple(n+i for i in ids));faces.append(tuple(reversed(ids)))
 for i in range(n):j=(i+1)%n;faces.append((i,j,n+j,n+i))
 shell=bpy.data.materials.new('Block '+b['id']+' mineral plaster');shell.use_nodes=True
 palette=[(.70,.62,.48),(.61,.66,.65),(.76,.69,.57),(.68,.55,.48)]
 shell.diffuse_color=(*palette[bi%len(palette)],1);shell.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=shell.diffuse_color;shell.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.9
 append(shell,verts,faces)
 for module in b['modules']:
  transform=Matrix.Translation(Vector((module['x']-ox,-(module['z']-oz),module['y'])))@Matrix.Rotation(module['yaw'],4,'Z')
  for mat,vs,fs in templates[module['model']]:append(mat,[transform@v for v in vs],fs)
 # Recessed roof deck follows footprint. Coping is inset at each wall edge;
 # never add a guessed pitched roof when the source has no roof shape.
 if b.get('roofShape') in (None,'flat'):
  for i,a in enumerate(ring):
   bb=ring[(i+1)%n];d=bb-a;length=d.length
   if length<.6:continue
   normal=Vector((-d.y,d.x,0)).normalized()*.07
   a=a+normal;bb=bb+normal;off=normal.normalized()*.07
   v=[tuple(p) for p in [a-off+Vector((0,0,h-.12)),bb-off+Vector((0,0,h-.12)),bb+off+Vector((0,0,h-.12)),a+off+Vector((0,0,h-.12)),a-off+Vector((0,0,h)),bb-off+Vector((0,0,h)),bb+off+Vector((0,0,h)),a+off+Vector((0,0,h))]]
   append(materials['stone'],v,[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)])
 collection=bpy.data.collections.new('source-way-'+b['id']);bpy.context.scene.collection.children.link(collection);objects=[]
 for mat,p in parts.items():
  mesh=bpy.data.meshes.new(b['id']+' '+mat.name);mesh.from_pydata(p['v'],[],p['f']);mesh.update();obj=bpy.data.objects.new(mesh.name,mesh);collection.objects.link(obj);obj.data.materials.append(mat);objects.append(obj)
 bpy.ops.object.select_all(action='DESELECT')
 for obj in objects:obj.select_set(True)
 path=OUT/('completion-'+b['id']+'.glb')
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
 metrics.append({'id':b['id'],'file':path.name,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'origin':b['origin'],'height':h,'source':b['source'],'triangles':sum(len(p['f']) for p in parts.values()),'accuracy':'OSM footprint and existing height; authored facade detail'})
 for obj in objects:obj.location=(ox,-oz,0)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'completed-buildings.blend'),compress=True)
(SOURCE/'building-metrics.json').write_text(json.dumps(metrics,indent=2)+'\n');print(json.dumps(metrics))
