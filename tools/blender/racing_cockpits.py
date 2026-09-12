"""Blender 4.3+: blender -b --python tools/blender/racing_cockpits.py.
Five original cockpit families, authored around the driver's eye in metres.
These are fitted game interiors, not reproductions of manufacturer interiors.
Static surfaces are joined by material; wheel and gauge pivots stay independent.
"""
import bpy, math, json, random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'webapp/public/assets/kart-royale/cockpits'
SRC=ROOT/'assets-source/racing-cockpits'
OUT.mkdir(parents=True,exist_ok=True);SRC.mkdir(parents=True,exist_ok=True)
def xyz(p):return (p[0],-p[2],p[1])
def mat(name,color,rough=.5,metal=0,glow=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal
 if glow:b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=glow
 return m
def empty(name,p=(0,0,0)):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=xyz(p);return o
def finish(o,name,m,parent=None):
 o.name=name;o.data.materials.append(m);bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 if parent:o.parent=parent
 return o
def box(name,p,size,m,parent=None,r=.015):
 bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(p));o=bpy.context.object;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if r:
  mod=o.modifiers.new('Soft manufactured edges','BEVEL');mod.width=r;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
 return finish(o,name,m,parent)
def tube(name,a,b,r,m,parent=None):
 a,b=Vector(xyz(a)),Vector(xyz(b));v=b-a
 bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=v.length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=v.to_track_quat('Z','Y').to_euler();return finish(o,name,m,parent)
def ring(name,p,r,thick,m,parent=None):
 bpy.ops.mesh.primitive_torus_add(major_segments=48,minor_segments=8,major_radius=r,minor_radius=thick,location=xyz(p),rotation=(math.pi/2,0,0));return finish(bpy.context.object,name,m,parent)
def label(text,p,size,m,parent=None):
 bpy.ops.object.text_add(location=xyz(p),rotation=(-math.pi/2,0,math.pi));o=bpy.context.object
 # Facing +Z, the driver's visual right is -X; text reads left-to-right.
 o.rotation_euler=(math.pi/2,0,math.pi);o.data.body=text;o.data.size=size;o.data.align_x='CENTER';o.data.extrude=.0003
 bpy.ops.object.convert(target='MESH');return finish(bpy.context.object,'Instrument '+text,m,parent)
def join_static():
 groups={}
 for o in list(bpy.context.scene.objects):
  if o.type=='MESH' and o.parent is None:groups.setdefault(o.data.materials[0].name,[]).append(o)
 for name,objects in groups.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name='Cabin '+name
manifest=[]
for style in ['sedan','sport','suv','armored','kart']:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for m in list(bpy.data.materials):
  if m.users==0:bpy.data.materials.remove(m)
 leather=mat('Grained charcoal leather',(.025,.031,.037),.76)
 # Packed repeatable micrograin is an exported texture, not a runtime noise shader.
 rng=random.Random(42);grain=bpy.data.images.new('Cockpit leather grain',width=256,height=256)
 pixels=[]
 for _ in range(256*256):
  v=rng.uniform(.15,.23);pixels.extend((v*.83,v*.92,v,1))
 grain.pixels=pixels;grain.pack()
 tex=leather.node_tree.nodes.new('ShaderNodeTexImage');tex.image=grain
 leather.node_tree.links.new(tex.outputs['Color'],leather.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
 rubber=mat('Soft black polymer',(.009,.013,.016),.83)
 alloy=mat('Brushed aluminium',(.38,.43,.48),.3,.85)
 trim=mat('Cabin trim',(.15,.055,.026) if style=='sedan' else (.045,.06,.07),.34,.3)
 stitch=mat('Contrast stitching',(.64,.19,.065) if style=='sport' else (.42,.47,.46),.8)
 white=mat('Instrument backlight',(.71,.88,.96),.4,0,.55)
 red=mat('Gauge needles',(.95,.13,.055),.4,0,.5)
 screen=mat('Display glass',(.007,.026,.038),.24,.3)
 eye=empty('DriverEye');eye['space']='Metres, Y up, +Z forward; origin at driver eyes'
 is_kart=style=='kart';left=0 if is_kart else -.4
 if not is_kart:
  box('Dashboard',(left,-.34,.75),(1.72,.23,.47),leather,r=.075)
  box('Lower dashboard',(left,-.55,.84),(1.67,.24,.22),rubber,r=.055)
  box('Brushed trim strip',(left,-.375,.50),(1.60,.032,.025),trim,r=.008)
  box('Passenger glove box',(-.78,-.53,.69),(.64,.16,.04),leather,r=.025)
  box('Glove box latch',(-.78,-.5,.66),(.12,.019,.014),alloy,r=.003)
  box('Centre tunnel',(-.4,-.76,.10),(.27,.25,1.2),leather,r=.055)
  box('Centre display',(-.42,-.31,.495),(.25,.16,.023),screen,r=.015)
  label('RACING',(-.42,-.29,.48),.024,white)
  label('TIRANA',(-.42,-.34,.48),.019,white)
  for x in [.39,-.29,-.64,-1.13]:
   box('Air vent',(x,-.31,.493),(.16,.074,.025),rubber,r=.012)
   for i in range(4):box('Vent blade',(x,-.334+i*.016,.477),(.136,.004,.008),alloy,r=.001)
  for x in [-.49,-.36]:ring('Climate control',(x,-.51,.50),.026,.006,alloy)
  for x in [.46,-1.27]:
   box('Door card',(x,-.53,-.03),(.085,.45,1.35),leather,r=.035)
   box('Door armrest',(x,-.57,-.04),(.15,.07,.58),trim,r=.025)
   box('Door handle',(x+(-.055 if x>0 else .055),-.40,.24),(.025,.025,.15),alloy)
   tube('Windshield pillar',(x,-.24,.95),(x*.85,.34,.58),.033,leather)
   for j in range(20):box('Door seam',(x+(-.047 if x>0 else .047),-.35,-.56+j*.055),(.004,.003,.025),stitch,r=0)
  for x in [0,-.80]:
   box('Seat cushion',(x,-.64,-.09),(.47,.14,.52),leather,r=.065)
   box('Seat back',(x,-.31,-.43),(.47,.62,.13),leather,r=.075)
   box('Headrest',(x,.035,-.44),(.29,.21,.10),leather,r=.045)
   for side in [-1,1]:box('Seat bolster',(x+side*.22,-.47,-.12),(.08,.25,.45),leather,r=.04)
  box('Footwell',(left,-.99,.2),(1.53,.045,1.5),rubber)
  for x in [-.08,.09]:box('Pedal',(x,-.88,.74),(.08,.13,.025),alloy,r=.01)
  tube('Gear lever',(-.4,-.71,.19),(-.4,-.56,.21),.016,alloy)
  box('Gear knob',(-.4,-.54,.21),(.065,.065,.065),leather,r=.022)
 else:
  box('Kart instrument pod',(0,-.31,.61),(.38,.17,.13),rubber,r=.055)
 wheel=empty('SteeringWheel',(0,-.36,.42))
 ring('Leather steering rim',(0,0,0),.174,.020,leather,wheel)
 box('Steering hub',(0,-.012,0),(.14,.075,.045),rubber,wheel,r=.02)
 for x in [-.14,.14]:tube('Wheel spoke',(0,0,0),(x,-.015,0),.014,alloy,wheel)
 tube('Lower wheel spoke',(0,-.015,0),(0,-.15,0),.016,alloy,wheel)
 box('Wheel centre mark',(0,.173,-.003),(.018,.017,.033),stitch,wheel,r=.004)
 for x in [-.11,.11]:
  ring('Gauge bezel',(x,-.235,.482),.09,.009,alloy)
  box('Gauge backing',(x,-.235,.494),(.183,.19,.021),screen,r=.075)
  for j in range(13):
   a=-2.3+j*4.6/12
   tx=x+math.sin(a)*.072;ty=-.235+math.cos(a)*.072
   tube('Instrument tick',(tx,ty,.471),(x+math.sin(a)*.081,-.235+math.cos(a)*.081,.471),.0025,white)
  label('KM/H' if x>0 else 'RPM',(x,-.276,.469),.014,white)
  needle=empty('SpeedNeedle' if x>0 else 'TachNeedle',(x,-.235,.465))
  tube('Needle',(0,0,0),(0,.064,0),.0035,red,needle)
  ring('Needle cap',(0,0,0),.007,.004,alloy,needle)
 if style=='armored':
  for x in [-.95,-.78,-.61]:box('Rugged switch',(x,-.48,.48),(.04,.07,.03),alloy,r=.006)
  tube('Grab handle',(-.91,-.13,.58),(-.62,-.13,.58),.016,alloy)
 if style=='sport':
  for x in [-.16,.16]:box('Paddle shifter',(x,-.36,.46),(.045,.10,.025),alloy,r=.009)
 join_static()
 bpy.context.scene.unit_settings.system='METRIC'
 bpy.ops.wm.save_as_mainfile(filepath=str(SRC/(style+'.blend')),compress=True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(style+'.glb')),export_format='GLB',export_yup=True,export_animations=False,export_extras=True)
 manifest.append({'style':style,'bytes':(OUT/(style+'.glb')).stat().st_size,'source':f'assets-source/racing-cockpits/{style}.blend','eye':[0,0,0]})
(OUT/'manifest.json').write_text(json.dumps({'generator':'Blender '+bpy.app.version_string,'description':'Original fitted cockpit families; not OEM scans','models':manifest},indent=2)+'\n')
