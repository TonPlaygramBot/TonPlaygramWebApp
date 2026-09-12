"""Blender 4.5 source kit. Run from repository root. Metres; Y-up runtime.
Original authored models, not extracted proprietary imagery. The compact baked
mesh payload and GLB are exported from the same evaluated Blender geometry.
"""
import bpy, math, json, gzip, base64, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=Path.cwd(); SOURCE=ROOT/'assets-source/tirana-city-completion'
OUT=ROOT/'webapp/public/assets/tirana-streets/completion';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system='METRIC'
M={}
for key,color,rough,metal in [
 ('stone',(.67,.64,.58),.86,0),('frame',(.76,.79,.76),.48,.25),
 ('dark',(.055,.073,.074),.6,.35),('glass',(.10,.19,.23),.23,.5),
 ('steel',(.35,.39,.39),.4,.7),('green',(.13,.23,.15),.74,.2),
 ('rubber',(.025,.032,.03),.94,0),('leaf',(.19,.29,.11),.93,0)]:
 m=bpy.data.materials.new(key);m.diffuse_color=(*color,1);m.use_nodes=True
 n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Roughness'].default_value=rough;n.inputs['Metallic'].default_value=metal;M[key]=m

def model(name):
 c=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(c);return c
def attach(o,c,material):
 for old in list(o.users_collection):old.objects.unlink(o)
 c.objects.link(o);o.data.materials.append(M[material]);return o
def box(c,mat,p,s,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(p[0],-p[2],p[1]));o=bpy.context.object;o.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('Manufactured edge bevel','BEVEL');mod.width=bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
 return attach(o,c,mat)
def cyl(c,mat,p,r,h):
 bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=r,depth=h,location=(p[0],-p[2],p[1]));return attach(bpy.context.object,c,mat)
def bar(c,mat,a,b,r):
 start=Vector((a[0],-a[2],a[1]));end=Vector((b[0],-b[2],b[1]));d=end-start
 bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=d.length,location=(start+end)/2);o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return attach(o,c,mat)

c=model('window_bay')
# Nominal 1.45 x 1.65 opening, centred vertically, outward depth is positive Z.
box(c,'dark',(0,0,.046),(1.60,1.83,.06))
box(c,'glass',(0,0,.082),(1.34,1.51,.04),0)
for x in [-.735,.735]:box(c,'frame',(x,0,.12),(.07,1.72,.12))
for y in [-.825,.825]:box(c,'frame',(0,y,.12),(1.54,.07,.12))
box(c,'frame',(0,0,.125),(.055,1.60,.10));box(c,'frame',(0,.1,.13),(1.42,.035,.10))
box(c,'stone',(0,-.91,.15),(1.76,.12,.35));box(c,'stone',(0,.94,.11),(1.76,.12,.25))

c=model('entrance_bay')
box(c,'dark',(0,0,.06),(2.16,2.48,.12))
box(c,'glass',(0,0,.13),(1.88,2.25,.045))
for x in [-1.02,0,1.02]:box(c,'frame',(x,0,.18),(.065,2.4,.13))
for y in [-1.18,1.18]:box(c,'frame',(0,y,.18),(2.1,.07,.13))
for x in [-.13,.13]:bar(c,'steel',(x,-.25,.28),(x,.22,.28),.018)
box(c,'stone',(0,-1.17,.22),(2.38,.12,.50))
box(c,'stone',(0,1.34,.42),(2.75,.14,.85))

c=model('balcony_bay')
box(c,'stone',(0,-1.0,.49),(2.55,.16,1.1))
for x in [-1.17,1.17]:bar(c,'dark',(x,-.93,1.0),(x,.02,1.0),.028)
bar(c,'steel',(-1.2,.04,1.0),(1.2,.04,1.0),.032)
for x in [-1.0,-.75,-.5,-.25,0,.25,.5,.75,1.0]:bar(c,'dark',(x,-.91,1.0),(x,0,1.0),.015)
for x in [-1.19,1.19]:bar(c,'steel',(x,.04,0),(x,.04,1.0),.03)
box(c,'dark',(0,-.64,1.0),(2.42,.30,.045))

c=model('air_conditioner')
box(c,'frame',(0,0,.30),(.80,.52,.40));box(c,'dark',(.10,0,.512),(.43,.41,.015),0)
for y in [-.16,-.1,-.04,.02,.08,.14]:box(c,'steel',(.10,y,.53),(.41,.02,.025),0)
for x in [-.29,.29]:box(c,'steel',(x,-.31,.24),(.045,.1,.45))

c=model('litter_bin')
cyl(c,'dark',(0,.52,0),.29,.82);cyl(c,'steel',(0,.14,0),.32,.12)
box(c,'dark',(0,.97,0),(.67,.10,.61));box(c,'steel',(0,1.13,-.2),(.60,.07,.18))
for x in [-.27,.27]:box(c,'steel',(x,1.06,-.2),(.055,.22,.18))
for a in range(16):
 angle=a*math.tau/16;bar(c,'steel',(math.cos(angle)*.292,.2,math.sin(angle)*.292),(math.cos(angle)*.292,.85,math.sin(angle)*.292),.012)

c=model('waste_container')
box(c,'green',(0,.65,0),(1.35,1.06,.87),.065);box(c,'dark',(0,1.23,0),(1.48,.14,.99),.04)
for x in [-.49,.49]:
 for z in [-.30,.30]:cyl(c,'rubber',(x,.105,z),.11,.18)
for x in [-.74,.74]:bar(c,'steel',(x,.88,-.25),(x,.88,.25),.04)
box(c,'frame',(0,.82,.446),(.4,.3,.018),0)

c=model('sign_pole')
cyl(c,'steel',(0,1.36,0),.036,2.72);box(c,'stone',(0,.045,0),(.24,.09,.24))
# The cutout atlas carries each sign's proper outline (octagon/circle/triangle).

c=model('direction_pole')
for x in [-.72,.72]:cyl(c,'steel',(x,1.9,0),.048,3.8)
box(c,'steel',(0,3.23,0),(3.3,1.20,.07))

c=model('traffic_signals')
cyl(c,'dark',(0,1.94,0),.062,3.88);box(c,'stone',(0,.07,0),(.3,.14,.3))
box(c,'dark',(0,3.45,.11),(.43,1.14,.32),.04)
for y in [3.80,3.45,3.10]:
 box(c,'dark',(0,y+.17,.30),(.45,.06,.30));box(c,'dark',(0,y,.283),(.32,.30,.01),0)
box(c,'dark',(.17,1.40,.10),(.14,.23,.15))

c=model('street_lamp')
cyl(c,'dark',(0,3.5,0),.075,7);cyl(c,'steel',(0,.42,0),.11,.80)
bar(c,'dark',(0,6.92,0),(0,7.1,1.2),.055)
box(c,'steel',(0,7.10,1.4),(.36,.12,.85));box(c,'frame',(0,7.02,1.4),(.29,.035,.72))

c=model('shrub')
for i in range(9):
 a=i*2.399;r=.32*(.4+(i%3)*.25)
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.4,location=(math.cos(a)*r,math.sin(a)*r,.35+(i%3)*.13));o=bpy.context.object;o.scale=(1,.88,.85);attach(o,c,'leaf')

payload={'materials':{},'models':{}}
for key,m in M.items():
 node=m.node_tree.nodes.get('Principled BSDF');payload['materials'][key]={'color':list(m.diffuse_color)[:3],'roughness':node.inputs['Roughness'].default_value,'metalness':node.inputs['Metallic'].default_value}
for collection in list(bpy.data.collections):
 if not collection.objects:continue
 parts={}
 for obj in collection.objects:
  if obj.type!='MESH':continue
  obj.data.calc_loop_triangles();mat=obj.data.materials[0].name
  part=parts.setdefault(mat,{'position':[],'normal':[]});normalmat=obj.matrix_world.to_3x3().inverted().transposed()
  for tri in obj.data.loop_triangles:
   for vi in tri.vertices:
    p=obj.matrix_world@obj.data.vertices[vi].co;n=(normalmat@tri.normal).normalized()
    part['position'].extend(round(v,5) for v in (p.x,p.z,-p.y));part['normal'].extend(round(v,5) for v in (n.x,n.z,-n.y))
 payload['models'][collection.name]=[{'material':m,**p} for m,p in parts.items()]
 # Join by material for editable, compact native source and glTF.
 for mat in parts:
  bpy.ops.object.select_all(action='DESELECT');objects=[o for o in collection.objects if o.type=='MESH' and o.data.materials[0].name==mat]
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=collection.name+'__'+mat

SOURCE.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'city-completion-kit.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'city-completion-kit.glb'),export_format='GLB',export_yup=True,export_apply=True)
packed=base64.b64encode(gzip.compress(json.dumps(payload,separators=(',',':')).encode(),compresslevel=9,mtime=0)).decode()
(ROOT/'webapp/src/games/tirana-city-completion/meshData.mjs').write_text("// Baked from Blender evaluated geometry. Original project asset.\nimport {decodeSource} from '../tirana-neighbourhood/decodeSource.mjs';\nexport const COMPLETION_MESHES=decodeSource(['"+packed+"']);\n")
metrics={'models':{k:sum(len(p['position'])//9 for p in v) for k,v in payload['models'].items()},'glbBytes':(OUT/'city-completion-kit.glb').stat().st_size,'blenderVersion':bpy.app.version_string,'generator':'tools/blender/tirana_city_completion.py'}
(SOURCE/'kit-metrics.json').write_text(json.dumps(metrics,indent=2)+'\n');print(json.dumps(metrics))
