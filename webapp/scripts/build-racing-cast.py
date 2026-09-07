"""Blender 4.5 original articulated satirical cast, civilians and police truck.
Run with Blender bpy: python build-racing-cast.py [--render]
Reference photos are NOT embedded. Coordinates: Blender X right, -Y forward, Z up.
"""
import bpy, math, pathlib, json, sys, hashlib
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'webapp/public/assets/kart-royale/cast';OUT.mkdir(parents=True,exist_ok=True)
SOURCES=ROOT/'webapp/art-src/racing';SOURCES.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.render.fps=30
mats={}
def mat(n,c,rough=.75,metal=0):
 if n in mats:return mats[n]
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;mats[n]=m;return m
skin=mat('warm skin',(.58,.37,.25));dark=mat('black leather',(.014,.02,.028),.44);white=mat('ivory shirt',(.84,.84,.78));iris=mat('brown eyes',(.05,.025,.014),.25);lip=mat('natural lips',(.40,.16,.12));steel=mat('brushed metal',(.25,.31,.36),.35,.7)
parts=[]
def tag(o,n,m,bone=None):
 o.name=n;o.data.materials.append(m)
 for f in o.data.polygons:f.use_smooth=True
 if bone:o['bone']=bone
 parts.append(o);return o

def ell(n,loc,scale,m,bone=None,segments=20,rings=12):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return tag(o,n,m,bone)
def box(n,loc,scale,m,bone=None,bevel=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('rounded tailoring','BEVEL');mod.width=bevel;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return tag(o,n,m,bone)
def limb(n,a,b,r1,r2,m,bone):
 a,b=Vector(a),Vector(b);d=b-a;bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=r1,radius2=r2,depth=d.length,location=(a+b)/2);o=bpy.context.object;o.rotation_mode='QUATERNION';o.rotation_quaternion=d.to_track_quat('Z','Y');return tag(o,n,m,bone)

def build_human(identity,label,shape,hair_color,suit_color,beard=False,long_hair=False,receding=False,police=False):
 global parts
 parts=[];bpy.ops.object.select_all(action='DESELECT')
 hair=mat(identity+' hair',hair_color);suit=mat(identity+' tailoring',suit_color);tie=mat(identity+' tie',(.28,.07,.22) if identity=='ulsi-manja' else (.12,.28,.46));w,d,h=shape
 # Broad shoulders taper to a separate fitted waist; overlapping tailored joints
 # deform through a real skeleton, not disconnected screen-space shapes.
 ell('jacket torso',(0,0,1.22),(.245,.135,.33),suit,'spine_02')
 box('shirt front',(0,-.125,1.31),(.12,.025,.27),white,'spine_02',.012)
 for sign in [-1,1]:
  lapel=box('lapel',(sign*.09,-.146,1.33),(.07,.025,.28),suit,'spine_02',.012);lapel.rotation_euler.y=sign*.23
  for z in [1.06,1.17]:ell('jacket button',(sign*.045,-.14,z),(.011,.008,.011),dark,'spine_02',12,8)
 if identity!='belinda-balluku':box('tie',(0,-.156,1.29),(.043,.02,.23),tie,'spine_02',.009)
 else:ell('sunburst brooch',(.12,-.164,1.38),(.026,.009,.026),mat('brooch gold',(.65,.43,.10),.3,.6),'spine_02')
 ell('hips',(0,.01,.93),(.20,.12,.16),suit,'pelvis')
 ell('neck',(0,0,1.53),(.065,.07,.13),skin,'head')
 head=ell(label+' face',(0,-.01,1.72),(w,d,h),skin,'head',28,18)
 # Shaped cheeks, chin, nose and eyelids give each portrait a distinct silhouette.
 ell('chin',(0,-d*.49,1.72-h*.75),(w*.66,d*.62,h*.33),skin,'head')
 for sign in [-1,1]:
  ell('cheek',(sign*w*.57,-d*.70,1.70),(w*.4,.03,h*.32),skin,'head')
  ell('ear',(sign*w*.99,.005,1.73),(.027,.022,.052),skin,'head')
  ell('eye white',(sign*w*.42,-d*.91,1.755),(.030,.012,.013),white,'head',16,8)
  ell('iris',(sign*w*.42,-d*1.005,1.755),(.011,.005,.011),iris,'head',12,8)
  brow=ell('expressive eyebrow',(sign*w*.42,-d*.96,1.785),(.039,.01,.008 if identity!='blendi-gonxhe' else .014),mat('natural eyebrows',(.10,.075,.06)),'head',16,8);brow.rotation_euler.y=sign*.09
 ell('nose bridge',(0,-d*.98,1.735),(.025,.024,.06),skin,'head')
 ell('nose tip',(0,-d*1.17,1.71),(.039 if identity in ('edi-rama','blendi-gonxhe') else .029,.025,.019),skin,'head')
 ell('mouth',(0,-d*.94,1.66),(.047,.01,.008),lip,'head',16,8)
 # Hair cap uses only back/side scalp for receding hairlines; no opaque helmet.
 # Smooth authored scalp surface with a face-specific hairline.
 vertices=[];faces=[];rings=9;segments=32
 for j in range(rings+1):
  for i in range(segments):
   a=i*math.tau/segments
   front=max(0,-math.sin(a));limit=1.78-front*1.03
   phi=(.95+(limit-.95)*j/rings) if receding else (.025+(limit-.025)*j/rings)
   vertices.append((math.cos(a)*math.sin(phi)*w*1.025,math.sin(a)*math.sin(phi)*d*1.025,1.72+math.cos(phi)*h*1.035))
 for j in range(rings):
  for i in range(segments):
   a=(i+.5)*math.tau/segments
   if receding and math.sin(a)<-.25:continue
   n=j*segments+i;m=j*segments+(i+1)%segments
   faces.append((n,m,m+segments,n+segments))
 geo=bpy.data.meshes.new('shaped scalp');geo.from_pydata(vertices,[],faces);geo.update();o=bpy.data.objects.new('sculpted hairline',geo);scene.collection.objects.link(o);tag(o,'sculpted hairline',hair,'head')
 if long_hair:
  for sign in [-1,1]:
   for j in range(5):
    o=ell('long sculpted wave',(sign*(w+.014),.018-j*.014,1.68-j*.052),(.055,.046,.18),hair,'head');o.rotation_euler.y=sign*(.15+j*.035)
  ell('back hair',(0,.075,1.65),(w*1.06,.065,.26),hair,'head')
 if beard:
  for sign in [-1,1]:ell('beard cheek',(sign*w*.68,-d*.62,1.665),(.035,.035,.056),hair,'head')
  ell('beard chin',(0,-d*.58,1.61),(w*.8,.067,.057 if identity=='edi-rama' else .036),hair,'head')
  ell('moustache',(0,-d*1.005,1.681),(.043,.012,.010),hair,'head')
 if police:
  ell('police cap',(0,0,1.895),(.14,.125,.045),suit,'head')
  box('cap visor',(0,-.114,1.88),(.21,.115,.016),dark,'head',.015)
  box('vest',(0,-.026,1.22),(.41,.27,.37),mat('police vest',(.045,.059,.085)),'spine_02')
  box('reflective chest stripe',(0,-.169,1.35),(.32,.01,.027),white,'spine_02',.002)
  ell('cap badge',(0,-.121,1.91),(.018,.004,.022),mat('badge gold',(.60,.47,.15),.4,.5),'head')
 for suffix,sign in [('l',1),('r',-1)]:
  shoulder=(sign*.22,0,1.44);elbow=(sign*.40,0,1.20);hand=(sign*.49,-.02,1.0)
  limb('upper sleeve',shoulder,elbow,.075,.059,suit,'upperarm_'+suffix)
  limb('lower sleeve',elbow,hand,.06,.042,suit,'lowerarm_'+suffix)
  ell('palm',(sign*.49,-.02,.985),(.047,.03,.065),skin,'hand_'+suffix)
  for finger in range(4):
   ell('finger',(sign*(.457+finger*.021),-.026,.933),(.010,.016,.035),skin,'hand_'+suffix,10,6)
  ell('thumb',(sign*.537,-.023,.98),(.015,.022,.034),skin,'hand_'+suffix,10,6)
  hip=(sign*.12,.01,.94);knee=(sign*.135,0,.54);ankle=(sign*.14,0,.10)
  limb('trouser thigh',hip,knee,.096,.073,suit,'thigh_'+suffix);limb('trouser calf',knee,ankle,.073,.049,suit,'calf_'+suffix)
  box('shoe',(sign*.14,-.065,.065),(.12,.26,.115),dark,'foot_'+suffix,.035)
 # Bind merged material groups to an anatomical armature, all vertices weighted.
 arm=bpy.data.armatures.new(label+' rig');rig=bpy.data.objects.new(identity,arm);scene.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 bones=[('pelvis',(0,0,.91),(0,0,1.1),None),('spine_02',(0,0,1.1),(0,0,1.48),'pelvis'),('head',(0,0,1.48),(0,0,1.9),'spine_02')]
 for suffix,sign in [('l',1),('r',-1)]:
  bones += [('upperarm_'+suffix,(sign*.22,0,1.44),(sign*.40,0,1.20),'spine_02'),('lowerarm_'+suffix,(sign*.40,0,1.20),(sign*.49,-.02,1.0),'upperarm_'+suffix),('hand_'+suffix,(sign*.49,-.02,1.0),(sign*.49,-.02,.91),'lowerarm_'+suffix),('thigh_'+suffix,(sign*.12,.01,.94),(sign*.135,0,.54),'pelvis'),('calf_'+suffix,(sign*.135,0,.54),(sign*.14,0,.10),'thigh_'+suffix),('foot_'+suffix,(sign*.14,0,.10),(sign*.14,-.19,.065),'calf_'+suffix)]
 for n,a,b,parent in bones:
  bone=arm.edit_bones.new(n);bone.head=a;bone.tail=b
  if parent:bone.parent=arm.edit_bones[parent]
 bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
 for o in parts:
  group=o.vertex_groups.new(name=o.get('bone','spine_02'));group.add(list(range(len(o.data.vertices))),1,'REPLACE')
  o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name=identity+' skinned mesh';mesh.parent=rig;modifier=mesh.modifiers.new('anatomical deformation','ARMATURE');modifier.object=rig
 # Action stored in the editable source and GLB; runtime IK handles exact hand aim.
 for frame,angle in [(1,0),(15,-.8),(21,1.2),(30,.3),(44,0)]:
  b=rig.pose.bones['upperarm_r'];b.rotation_mode='XYZ';b.rotation_euler.x=angle;b.keyframe_insert('rotation_euler',frame=frame)
 rig.animation_data.action.name='Throw';scene.frame_set(1)
 rig['characterName']=label;rig['fictionalPortrayal']=True;rig['assetAuthor']='TonPlaygram original Blender mesh'
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True)
 export(identity)
 return rig,mesh

def export(identity):
 bpy.ops.export_scene.gltf(filepath=str(OUT/(identity+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_materials='EXPORT')

cast=[('edi-rama','Edi Rama',(.137,.118,.182),(.64,.65,.63),(.055,.10,.19),True,False,True),('belinda-balluku','Belinda Balluku',(.116,.108,.176),(.018,.014,.015),(.055,.067,.12),False,True,False),('erion-brace','Erion Braçe',(.104,.108,.185),(.11,.095,.08),(.07,.10,.16),True,False,False),('ulsi-manja','Ulsi Manja',(.125,.11,.177),(.20,.20,.19),(.045,.055,.095),True,False,True),('blendi-gonxhe','Blendi Gonxhe',(.149,.121,.176),(.24,.245,.24),(.018,.021,.025),False,False,False)]
created=[]
for row in cast:created.append(build_human(*row))
created.append(build_human('police','Policia',(.12,.11,.17),(.035,.035,.03),(.035,.055,.11),police=True))
# Water cannon truck, with local turret/nozzle pivots. Three.js rotates only turret.
parts=[];blue=mat('police truck blue',(.028,.09,.28),.32,.28);glass=mat('truck safety glass',(.065,.15,.20),.18,.45);rubber=mat('truck tires',(.016,.021,.026))
root=bpy.data.objects.new('water-cannon',None);scene.collection.objects.link(root)
box('chassis',(0,0,.74),(2.2,6.6,.36),steel)
box('water tank',(0,.65,1.65),(2.20,3.8,1.60),blue,bevel=.19)
box('cab',(0,-2.3,1.67),(2.25,1.75,1.9),blue,bevel=.12)
box('windshield',(0,-3.19,2.12),(1.97,.045,.70),glass,bevel=.04)
for sign in [-1,1]:
 box('cab side window',(sign*1.135,-2.42,2.12),(.03,1.18,.64),glass,bevel=.03)
 for y in [-2.25,.5,2.1]:
  bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.54,depth=.27,location=(sign*1.13,y,.56),rotation=(0,math.pi/2,0));tag(bpy.context.object,'tire',rubber)
  bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.27,depth=.28,location=(sign*1.14,y,.56),rotation=(0,math.pi/2,0));tag(bpy.context.object,'wheel hub',steel)
 box('headlamp',(sign*.78,-3.20,1.1),(.38,.05,.2),white,bevel=.035)
 box('beacon',(sign*.67,-2.1,2.70),(.35,.26,.12),mat('beacon blue',(.1,.33,.95)),bevel=.045)
box('front bumper',(0,-3.25,.72),(2.35,.2,.25),dark)
box('POLICIA panel',(0,-3.224,1.52),(1.3,.02,.23),white,bevel=.01)
for o in parts:o.parent=root
# Label is mesh lettering, not a bitmap portrait.
for y in [.5]:
 for sign in [-1,1]:
  bpy.ops.object.text_add(location=(sign*1.117,y,1.7),rotation=(math.pi/2,0,sign*math.pi/2));o=bpy.context.object;o.data.body='POLICIA';o.data.align_x='CENTER';o.data.size=.27;o.data.extrude=.001;o.data.materials.append(white);o.parent=root;bpy.ops.object.convert(target='MESH')
turret=bpy.data.objects.new('turret',None);scene.collection.objects.link(turret);turret.parent=root;turret.location=(0,-.65,2.68)
parts=[];limb('cannon barrel',(0,-.65,2.75),(0,-2.25,3.0),.09,.065,steel,None)
for o in parts:o.parent=turret;o.matrix_parent_inverse=turret.matrix_world.inverted()
nozzle=bpy.data.objects.new('nozzle',None);scene.collection.objects.link(nozzle);nozzle.parent=turret;nozzle.location=(0,-1.6,.32)
bpy.context.view_layer.update()
# Correct barrel relative to its turret at export.
for o in parts:o.location-=turret.location
def select_tree(o):
 o.select_set(True)
 for child in o.children:select_tree(child)
bpy.ops.object.select_all(action='DESELECT');select_tree(root);export('water-cannon')
# Save a reviewable editable scene with characters arranged in a lineup.
for i,(rig,mesh) in enumerate(created):rig.location.x=(i-2.5)*1.2
root.location=(6,2,0)
scene.frame_end=44;scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES/'tirana-cast.blend'),compress=True)
manifest={'generator':'Blender '+bpy.app.version_string,'license':'MIT (original meshes)','portraitImagesEmbedded':False,'characters':[{'id':r[0],'name':r[1]} for r in cast],'files':[]}
for p in sorted(OUT.glob('*.glb')):manifest['files'].append({'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
if '--render' in sys.argv:
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.render.resolution_x=1600;scene.render.resolution_y=550;scene.render.resolution_percentage=100
 bpy.ops.object.camera_add(location=(0,-8,3.0));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=7.8;scene.camera=cam
 for loc,power,size in [((0,-4,6),1600,7),((4,2,5),1000,5)]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
 scene.world=bpy.data.worlds.new('Studio');scene.world.color=(.22,.22,.22);scene.render.filepath=str(SOURCES/'cast-review.png');bpy.ops.render.render(write_still=True)
print('Built',len(manifest['files']),'Blender assets',flush=True)
