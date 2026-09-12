"""Blender 4.2+: original electric karts and a articulated, helmeted race driver.
Run: blender -b --python tools/blender/future_karts.py
Coordinates below are game metres: Y up, +Z towards the kart's nose.
"""
import bpy, math, json, pathlib
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'webapp/public/assets/kart-royale/karts'
SRC=ROOT/'assets-source/racing-karts/future'
OUT.mkdir(parents=True,exist_ok=True);SRC.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0
LOW=False
def xyz(p):return (p[0],-p[2],p[1])
def mat(name,color,metal=0,rough=.4,emission=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=(*color,1);s.inputs['Metallic'].default_value=metal;s.inputs['Roughness'].default_value=rough
 if emission:s.inputs['Emission Color'].default_value=(*color,1);s.inputs['Emission Strength'].default_value=emission
 return m
def empty(name,p=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=xyz(p);o.parent=parent;return o
def finish(o,name,m,parent):
 o.name=name;o.data.materials.append(m);bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 for f in o.data.polygons:f.use_smooth=True
 o.parent=parent;return o
def box(name,p,size,m,parent,bevel=.03):
 bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(p));o=bpy.context.object;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('Panel edge radius','BEVEL');mod.width=bevel;mod.segments=1 if LOW else 3;bpy.ops.object.modifier_apply(modifier=mod.name)
 return finish(o,name,m,parent)
def ball(name,p,size,m,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12 if LOW else 24,ring_count=6 if LOW else 12,location=xyz(p));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);return finish(o,name,m,parent)
def tube(name,a,b,r,m,parent):
 a,b=Vector(xyz(a)),Vector(xyz(b));v=b-a
 bpy.ops.mesh.primitive_cylinder_add(vertices=8 if LOW else 16,radius=r,depth=v.length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=v.to_track_quat('Z','Y').to_euler();return finish(o,name,m,parent)
def strap(name,a,b,width,m,parent):
 a,b=Vector(xyz(a)),Vector(xyz(b));v=b-a
 bpy.ops.mesh.primitive_cube_add(size=1,location=(a+b)/2);o=bpy.context.object;o.dimensions=(width,.016,v.length);o.rotation_euler=v.to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,m,parent)
def torus(name,p,r,minor,m,parent,rotation=(0,math.pi/2,0)):
 bpy.ops.mesh.primitive_torus_add(major_segments=16 if LOW else 32,minor_segments=6 if LOW else 10,major_radius=r,minor_radius=minor,location=xyz(p),rotation=rotation);return finish(bpy.context.object,name,m,parent)
def shell(name,sections,m,parent):
 verts=[]
 for z,w,lo,hi in sections:verts.extend([xyz((-w,lo,z)),xyz((w,lo,z)),xyz((w,hi,z)),xyz((-w,hi,z))])
 faces=[(3,2,1,0)]
 for i in range(len(sections)-1):
  for j in range(4):faces.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
 n=(len(sections)-1)*4;faces.append((n,n+1,n+2,n+3));mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(m);o.parent=parent;return o
def reset():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for m in list(bpy.data.materials):
  if m.users==0:bpy.data.materials.remove(m)
def batch():
 # Preserve all articulated pivots and animation nodes, batch only static parts.
 for parent in [o for o in bpy.context.scene.objects if o.type=='EMPTY' and o.name in ['body','helmet','torso'] or o.name.startswith('wheel_')]:
  for m in set(o.active_material for o in parent.children if o.type=='MESH'):
   objects=[o for o in parent.children if o.type=='MESH' and o.active_material==m and not o.name.startswith(('arm_','forearm_','hand_','harness_'))]
   if len(objects)>1:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
def export(id):
 batch();bpy.ops.object.select_all(action='SELECT')
 file=OUT/f'{id}{"-lod" if LOW else ""}.glb'
 bpy.ops.export_scene.gltf(filepath=str(file),export_format='GLB',export_yup=True,export_extras=True,export_materials='EXPORT')
 if not LOW:bpy.ops.wm.save_as_mainfile(filepath=str(SRC/f'{id}.blend'),compress=True)
 tris=0
 for o in bpy.context.scene.objects:
  if o.type=='MESH':o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles)
 return {'id':id,'lod':LOW,'file':file.name,'bytes':file.stat().st_size,'triangles':tris}
manifest=[]
for id,style,color in [('photon',0,(.08,.65,.95)),('vortex',1,(.6,.08,.9)),('aegis',2,(.92,.38,.055))]:
 for LOW in [False,True]:
  reset();paint=mat('paint',color,.38,.27);carbon=mat('Carbon ceramic',(.026,.038,.05),.45,.4);metal=mat('Titanium',(.48,.57,.64),.82,.26);rubber=mat('Slick tyre',(.016,.019,.024),0,.86);light=mat('energy',(.2,.85,1),.3,.22,2);red=mat('brake_light',(1,.035,.018),.1,.3,1)
  body=empty('body');body['design']=['Twin ion-channel sprint kart','Split-fin vectoring kart','Armoured endurance kart'][style]
  shell('Carbon monocoque',[(-1.20,.38,.18,.38),(-.65,.48,.16,.42),(.45,.37,.16,.40),(1.25,.28,.20,.26)],carbon,body)
  shell('Spear nose',[(.32,.16,.30,.57),(.8,.34,.27,.46),(1.25,.27,.22,.29)],paint,body)
  for side in [-1,1]:
   pod=empty('pod_'+str(side),(side*.59,0,0),body)
   shell('Energy sidepod',[(-1.12,.13,.29,.52),(-.45,.17,.25,.56),(.56,.10,.26,.38)],paint,pod)
   tube('Ion strip',(side*.67,.47,-.91),(side*.67,.38,.49),.016,light,body)
   tube('Side bumper',(side*.82,.24,-.95),(side*.82,.24,.95),.035,metal,body)
  box('Battery pack',(0,.32,-.83),(.57,.28,.44),carbon,body,.06)
  box('Seat cushion',(0,.40,-.24),(.46,.13,.5),carbon,body,.07)
  back=box('Racing bucket',(0,.70,-.53),(.52,.68,.13),carbon,body,.07);back.rotation_euler.x=-.18
  for side in [-1,1]:box('Seat bolster',(side*.24,.54,-.32),(.1,.31,.44),carbon,body,.04)
  tube('Column',(0,.26,.38),(0,.70,.16),.024,metal,body)
  steer=empty('steering_wheel',(0,.70,.16),body)
  torus('Steering rim',(0,0,0),.17,.023,carbon,steer,(math.pi/2,0,0));box('Digital hub',(0,0,0),(.22,.08,.04),light,steer,.015)
  for front,z in [(True,.78),(False,-.78)]:
   for side,x in [('l',.77),('r',-.77)]:
    suffix=('f' if front else 'r')+side;parent=empty('steer_'+suffix,(x,.28,z),body) if front else body
    wheel=empty('wheel_'+suffix,(0,0,0) if front else (x,.28,z),parent)
    torus('Tyre',(0,0,0),.205,.075,rubber,wheel)
    tube('Turbine rim',(-.105,0,0),(.105,0,0),.155,metal,wheel)
    for s in [-1,1]:torus('Rim light',(s*.11,0,0),.115,.011,light,wheel)
    tube('Suspension arm',(x*.35,.27,z*.82),(x,.28,z),.023,metal,body)
  box('Rear brake lamp',(0,.45,-1.21),(.43,.045,.035),red,body,.01)
  if style==0:
   for x in [-.25,.25]:
    tube('Ion thruster',(x,.40,-.87),(x,.40,-1.26),.11,metal,body)
    tube('Thruster core',(x,.40,-1.25),(x,.40,-1.28),.078,light,body)
   wing=empty('aero_wing',(0,.61,-1.04),body);box('Sprint aerofoil',(0,0,0),(1.18,.045,.23),paint,wing,.012)
  elif style==1:
   for x in [-.43,.43]:
    fin=empty('aero_fin_'+str(x),(x,.40,-.78),body)
    shell('Vector fin',[(-.37,.035,0,.48),(.22,.035,0,.09)],paint,fin)
   wing=empty('aero_wing',(0,.76,-1.08),body);box('Split wing',(0,0,0),(1.45,.045,.23),paint,wing,.01)
  else:
   for x in [-.43,.43]:
    tube('Head protection hoop',(x,.37,-.60),(x,1.05,-.65),.03,metal,body)
    box('Armour plate',(x,.57,-.06),(.08,.27,.73),paint,body,.04)
   tube('Hoop crown',(-.43,1.05,-.65),(.43,1.05,-.65),.03,metal,body)
   wing=empty('aero_wing',(0,.57,-1.04),body);box('Active diffuser',(0,0,0),(1.20,.055,.28),carbon,wing,.01)
  empty('driver_eye',(0,1.16,-.32),body);empty('driver_mount',(0,0,0),body)
  manifest.append(export(id))

for LOW in [False,True]:
 reset();suit=mat('race_suit',(.13,.22,.3),0,.72);dark=mat('Race undersuit',(.027,.04,.05),0,.82);helmetpaint=mat('helmet_paint',(.86,.93,.96),.3,.3);visor=mat('Mirror visor',(.025,.14,.20),.88,.14);belt=mat('harness_webbing',(1,.27,.04),0,.83);alloy=mat('Buckle titanium',(.61,.68,.73),.8,.3)
 root=empty('driver');root['safety']='Full-face helmet and five-point racing harness';torso=empty('torso',(0,.56,-.29),root)
 ball('Race jacket',(0,.20,-.025),(.235,.30,.135),suit,torso);ball('Pelvis',(0,.48,-.27),(.23,.13,.18),dark,root)
 helmet=empty('helmet',(0,1.14,-.32),root)
 ball('Full face shell',(0,0,0),(.22,.255,.23),helmetpaint,helmet)
 ball('Visor',(0,.045,.188),(.192,.113,.065),visor,helmet)
 box('Chin guard',(0,-.145,.16),(.36,.115,.17),helmetpaint,helmet,.05)
 for x in [-.195,.195]:ball('Visor hinge',(x,.005,.03),(.025,.04,.04),alloy,helmet)
 for side,x in [('l',.20),('r',-.20)]:
  shoulder=(x,.95,-.32);elbow=(x*1.6,.71,-.07);hand=(x*.8,.70,.16)
  # Runtime articulates these tapered sections to keep gloved hands on the rim.
  tube('arm_'+side,shoulder,elbow,.079,suit,root);ball('elbow_'+side,elbow,(.085,.09,.085),dark,root)
  tube('forearm_'+side,elbow,hand,.065,suit,root);ball('hand_'+side,hand,(.066,.061,.07),dark,root)
  hip=(x*.66,.47,-.23);knee=(x*.88,.32,.29);foot=(x*.88,.22,.65)
  tube('Thigh',hip,knee,.098,suit,root);ball('Knee',knee,(.09,.1,.10),dark,root);tube('Shin',knee,foot,.073,suit,root);box('boot_'+side,foot,(.15,.14,.25),dark,root,.045)
  strap('harness_shoulder_'+side,(x*.8,.995,-.20),(x*.26,.56,-.105),.052,belt,root)
  strap('harness_lap_'+side,(x*1.1,.49,-.29),(0,.56,-.095),.055,belt,root)
 strap('harness_crotch',(0,.39,-.05),(0,.56,-.10),.046,belt,root)
 box('Harness buckle',(0,.555,-.074),(.10,.08,.038),alloy,root,.015)
 manifest.append(export('race-driver'))
(OUT/'future-manifest.json').write_text(json.dumps({'generator':'Blender '+bpy.app.version_string,'units':'metres','up':'+Y','forward':'+Z','license':'Original project artwork','assets':manifest},indent=2))
