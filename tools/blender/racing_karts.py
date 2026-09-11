"""Blender 4.2+: blender -b --python tools/blender/racing_karts.py
Build five original, metre-scale karts with UVs, packed Poly Haven PBR and
independent wheel/steering pivots. Export high/low GLBs and editable .blend.
"""
import bpy, math, json, pathlib
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'webapp/public/assets/kart-royale/karts'
SRC=ROOT/'assets-source/racing-karts'
OUT.mkdir(parents=True,exist_ok=True)
def xyz(p): return (p[0],-p[2],p[1])
def material(name,color,metal=0,rough=.4):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 return m

def empty(name,p=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=xyz(p);o.parent=parent;return o

def finish(o,name,mat,parent):
 o.name=name;o.data.materials.append(mat)
 bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 for face in o.data.polygons: face.use_smooth=True
 o.parent=parent
 return o

def box(name,p,size,mat,parent,bevel=.035):
 bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(p));o=bpy.context.object;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('Rounded manufactured edges','BEVEL');mod.width=bevel;mod.segments=2 if LOW else 3;bpy.ops.object.modifier_apply(modifier=mod.name)
 return finish(o,name,mat,parent)

def tube(name,a,b,r,mat,parent,vertices=None):
 a,b=Vector(xyz(a)),Vector(xyz(b));v=b-a
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices or (8 if LOW else 16),radius=r,depth=v.length,location=(a+b)/2)
 o=bpy.context.object;o.rotation_euler=v.to_track_quat('Z','Y').to_euler();return finish(o,name,mat,parent)

def torus(name,p,major,minor,mat,parent):
 bpy.ops.mesh.primitive_torus_add(major_segments=16 if LOW else 40,minor_segments=6 if LOW else 12,location=xyz(p),major_radius=major,minor_radius=minor,rotation=(0,math.pi/2,0))
 return finish(bpy.context.object,name,mat,parent)

def shell(name,sections,mat,parent):
 # Each station is (forward, half-width, bottom, top), producing an aero wedge.
 verts=[]
 for z,w,lo,hi in sections:
  verts += [xyz((-w,lo,z)),xyz((w,lo,z)),xyz((w,hi,z)),xyz((-w,hi,z))]
 faces=[(3,2,1,0)]
 for i in range(len(sections)-1):
  for j in range(4): faces.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
 n=(len(sections)-1)*4;faces.append((n,n+1,n+2,n+3))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 mod=o.modifiers.new('Panel radii','BEVEL');mod.width=.028;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
 finish(o,name,mat,parent);return o

specs=[('apex','Apex Sprint',(0.72,.025,.015),.265,0),('oobi','Eagle Shifter',(.025,.17,.66),.265,1),('oodi','Illyrian Drift',(.48,.06,.7),.275,2),('ooli','Besa Endurance',(.025,.32,.18),.285,3),('oopi','Dajti Cross',(.85,.25,.015),.34,4)]
manifest=[]
for id,label,color,radius,style in specs:
 for LOW in [False,True]:
  bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
  for m in list(bpy.data.materials):
   if m.users==0:bpy.data.materials.remove(m)
  paint=material('paint',color,.5,.27);rubber=material('Vulcanised rubber',(.018,.021,.025),0,.82)
  alloy=material('Machined aluminium',(.48,.51,.56),.88,.24);dark=material('Black powder coat',(.035,.04,.045),.65,.36)
  seat=material('Bucket seat',(.025,.028,.033),0,.7);stripe=material('Ivory race markings',(.86,.9,.91),.2,.35)
  metal=material('Poly Haven metal_plate',(.4,.4,.4),1,.5)
  nodes=metal.node_tree.nodes;links=metal.node_tree.links;bsdf=nodes.get('Principled BSDF')
  for key,socket in [('Diffuse','Base Color'),('Rough','Roughness'),('Metal','Metallic'),('nor_gl','Normal')]:
   tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(SRC/'textures'/f'{key}.jpg'),check_existing=True)
   tex.image.colorspace_settings.name='sRGB' if key=='Diffuse' else 'Non-Color';tex.image.pack()
   if key=='nor_gl':
    normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.3;links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bsdf.inputs[socket])
   else: links.new(tex.outputs['Color'],bsdf.inputs[socket])
  body=empty('body');height=.10 if style==4 else 0
  # Welded space frame, visible tubular bumpers and cross-members.
  for x in [-.48,.48]:
   tube('Frame rail',(x,.24+height,-1.02),(x,.24+height,1),.035,dark,body)
   tube('Seat brace',(x,.26+height,-.5),(x*.58,.82+height,-.55),.028,dark,body)
  for z in [-1.03,-.6,.5,1.02]:tube('Cross member',(-.48,.24+height,z),(.48,.24+height,z),.03,metal,body)
  box('Floor tray',(0,.245+height,.0),(.95,.04,1.9),metal,body,.012)
  for z in [-1.2,1.2]:
   tube('Bumper',(-.68,.30+height,z),(.68,.30+height,z),.05,dark,body)
   for x in [-.55,.55]:tube('Bumper bracket',(x,.3+height,z),(x,.25+height,z*.82),.025,alloy,body)
  shell('Nose',[(.28,.23,.27+height,.49+height),(.95,.40,.28+height,.40+height),(1.24,.33,.25+height,.32+height)],paint,body)
  box('Nose stripe',(0,.408+height,.85),(.11,.008,.41),stripe,body,.003)
  for x in [-.63,.63]:
   box('Side pod',(x,.37+height,-.05),(.25,.24,1.05),paint,body,.09)
   if not LOW:
    for z in [-.3,-.18,-.06]:box('Pod vent',(x,.495+height,z),(.16,.009,.035),dark,body,.004)
  box('Seat cushion',(0,.39+height,-.25),(.47,.12,.5),seat,body,.09)
  back=box('Seat back',(0,.65+height,-.51),(.5,.56,.12),seat,body,.065)
  back.rotation_euler.x=math.radians(-12)
  for x in [-.24,.24]:box('Seat bolster',(x,.48+height,-.28),(.10,.22,.48),seat,body,.045)
  for x in [-.1,.1]:box('Harness',(x,.67+height,-.428),(.055,.40,.018),stripe,body,.006)
  tube('Steering column',(0,.28+height,.42),(0,.69+height,.17),.022,alloy,body)
  steering=empty('steering_wheel',(0,.70+height,.16),body)
  # Ring in a plane facing the driver, baked geometry; animation owns pivot Z.
  bpy.ops.mesh.primitive_torus_add(major_segments=16 if LOW else 32,minor_segments=6,major_radius=.17,minor_radius=.022,location=(0,0,0),rotation=(math.pi/2,0,0))
  finish(bpy.context.object,'Leather steering rim',rubber,steering)
  for x in [-.15,.15]:tube('Steering spoke',(0,0,0),(x,0,0),.014,alloy,steering)
  tube('Steering spoke',(0,0,0),(0,-.14,0),.014,alloy,steering)
  # Rear engine, fins, exhaust and chain drive.
  box('Engine block',(.34,.46+height,-.73),(.36,.32,.37),metal,body,.025)
  for i in range(3 if LOW else 7):box('Cooling fin',(.34,.34+height+i*.039,-.73),(.40,.018,.40),alloy,body,.006)
  box('Cylinder head',(.34,.67+height,-.73),(.3,.12,.31),dark,body,.025)
  tube('Exhaust header',(.50,.46+height,-.77),(.66,.47+height,-1.02),.045,alloy,body)
  tube('Exhaust muffler',(.66,.47+height,-1.02),(.39,.47+height,-1.15),.075,dark,body)
  tube('Rear axle',(-.85,radius,-.78),(.85,radius,-.78),.027,alloy,body)
  box('Chain guard',(.22,.29+height,-.68),(.045,.12,.48),dark,body,.02)
  # Wheels are empty pivot nodes with axle along X. Front steer is a Y pivot.
  for front,z in [(True,.78),(False,-.78)]:
   for side,x in [('l',.79),('r',-.79)]:
    suffix=('f' if front else 'r')+side
    steer=empty('steer_'+suffix,(x,radius,z),body) if front else body
    wheel=empty('wheel_'+suffix,(0,0,0) if front else (x,radius,z),steer)
    torus('Tyre', (0,0,0),radius*.73,radius*.27,rubber,wheel)
    width=.20 if front else .26
    tube('Rim barrel',(-width*.48,0,0),(width*.48,0,0),radius*.52,alloy,wheel,16 if LOW else 32)
    for s in [-1,1]:
     tube('Hub cap',(s*width*.5,0,0),(s*(width*.5+.016),0,0),.065,dark,wheel)
     if not LOW:
      for j in range(6):
       a=j*math.tau/6;tube('Lug',(s*width*.51,.10*math.sin(a),.10*math.cos(a)),(s*width*.56,.10*math.sin(a),.10*math.cos(a)),.013,dark,wheel,6)
    if style==4:
     for j in range(12 if LOW else 24):
      a=j*math.tau/(12 if LOW else 24)
      block=box('Tread',(0,radius*.95*math.sin(a),radius*.95*math.cos(a)),(.19,.055,.08),rubber,wheel,.008);block.rotation_euler.x=a
    if front:
     tube('Tie rod',(x*.8,.28+height,z),(.15 if x>0 else -.15,.28+height,.58),.015,alloy,body)
  # Genuine silhouette differences, not just recolouring.
  if style==1:
   box('Radiator',(-.39,.66,-.7),(.25,.5,.12),metal,body,.02)
   tube('Shifter lever',(.26,.38,.0),(.28,.65,.08),.018,alloy,body)
   box('Shifter grip',(.28,.68,.08),(.06,.09,.06),rubber,body,.02)
  if style==2:
   for x in [-.38,.38]:tube('Wing stay',(x,.34,-1),(x,.66,-1.02),.018,dark,body)
   box('Low drift wing',(0,.68,-1.02),(1.05,.045,.23),paint,body,.015)
   box('Rear diffuser',(0,.23,-1.07),(.76,.05,.28),dark,body,.015)
  if style==3:
   shell('Endurance fairing',[(-.9,.39,.30,.52),(-.5,.38,.3,.54)],paint,body)
   for x in [-.30,.30]:
    lamp=material('Warm headlight',(.9,.88,.65),0,.2);p=lamp.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(1,.9,.6,1);p.inputs['Emission Strength'].default_value=2
    box('Headlamp',(x,.43,1.05),(.13,.08,.035),lamp,body,.02)
   box('Fuel tank',(-.3,.53,-.7),(.3,.34,.34),dark,body,.05)
  if style==4:
   for x in [-.47,.47]:
    tube('Roll hoop',(x,.32,-.56),(x,1.23,-.54),.033,dark,body)
    tube('Cage brace',(x,1.23,-.54),(x,.38,-1.0),.028,dark,body)
   tube('Hoop top',(-.47,1.23,-.54),(.47,1.23,-.54),.033,dark,body)
   box('Skid plate',(0,.21,0),(.9,.04,1.9),metal,body,.025)
  empty('exhaust_mount',(.42,.47+height,-1.17),body)
  empty('driver_eye',(0,1.05+height,-.28),body)
  # UV unwrap all mesh surfaces; join static pieces per material but preserve pivots.
  for o in list(bpy.context.scene.objects):
   if o.type=='MESH':
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.025);bpy.ops.object.mode_set(mode='OBJECT')
  parents=[o for o in bpy.context.scene.objects if o.type=='EMPTY']
  for parent in parents:
   mats=set(o.active_material for o in parent.children if o.type=='MESH')
   for mat in mats:
    objs=[o for o in parent.children if o.type=='MESH' and o.active_material==mat]
    if len(objs)>1:
     bpy.ops.object.select_all(action='DESELECT')
     for o in objs:o.select_set(True)
     bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join()
  bpy.ops.object.select_all(action='SELECT')
  file=OUT/f'{id}{"-lod" if LOW else ""}.glb'
  bpy.ops.export_scene.gltf(filepath=str(file),export_format='GLB',export_yup=True,export_extras=True,export_materials='EXPORT',export_image_format='JPEG',export_jpeg_quality=85)
  triangles=sum(len(o.data.loop_triangles) for o in bpy.context.scene.objects if o.type=='MESH')
  if not LOW:
   bpy.ops.wm.save_as_mainfile(filepath=str(SRC/f'{id}.blend'),compress=True)
  manifest.append({'id':id,'name':label,'lod':LOW,'file':file.name,'bytes':file.stat().st_size,'wheelRadius':radius})
(OUT/'manifest.json').write_text(json.dumps({'generator':'Blender '+bpy.app.version_string,'units':'metres','up':'+Y','forward':'+Z','assets':manifest},indent=2))
