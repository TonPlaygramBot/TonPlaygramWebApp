"""Original articulated buses + eight head-shape variants of the bundled RPM human.
Run: blender -b --python webapp/scripts/blender/build_tirana_population.py
Bus dimensions in metres; source reference links are recorded in ATTRIBUTION.md.
"""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'webapp/public/assets/tirana-streets/population'
OUT.mkdir(parents=True,exist_ok=True)
def reset():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,color,metal=0,rough=.6,alpha=1):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,alpha);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,alpha);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if alpha<1:p.inputs['Alpha'].default_value=alpha;m.surface_render_method='DITHERED'
 return m
def xyz(x,y,z):return (x,-z,y)
def box(name,w,h,d,x,y,z,m,parent=None,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(x,y,z));o=bpy.context.object;o.name=name;o.dimensions=(w,d,h);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if bevel:
  mod=o.modifiers.new('Soft manufactured edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 if parent:o.parent=parent;o.matrix_parent_inverse=parent.matrix_world.inverted()
 return o
def text(name,value,size,x,y,z,m,side=False):
 c=bpy.data.curves.new(name,'FONT');c.body=value;c.size=size;c.align_x='CENTER';c.extrude=.001
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.location=xyz(x,y,z);o.rotation_euler=(math.pi/2,0,math.pi) if not side else (math.pi/2,0,-math.pi/2);o.data.materials.append(m);return o
def export(path):
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_yup=True,export_animations=False,export_extras=True)
reset()
green=mat('Tirana Green Line enamel',(.24,.62,.035),.3,.25);dark=mat('Window band',(.024,.038,.044),.25,.26);glass=mat('Tinted transparent safety glazing',(.12,.24,.27),.15,.12,.24)
rubber=mat('Tire rubber',(.019,.024,.025),0,.87);silver=mat('Brushed aluminium',(.42,.48,.48),.78,.24);white=mat('Warm interior panels',(.72,.75,.72),0,.7)
seat=mat('Blue woven seat fabric',(.035,.13,.24),0,.9);yellow=mat('Handrails',(.94,.64,.025),.3,.42);black=mat('Accordion rubber',(.08,.085,.078),0,.95)
red=mat('Red tail lens',(.7,.012,.006),.15,.21);lamp=mat('Headlamp lens',(.95,.92,.74),.1,.17)
rear=bpy.data.objects.new('ArticulatedRear',None);bpy.context.collection.objects.link(rear);rear.location=xyz(0,0,1.6);bpy.context.view_layer.update()
for section,z,length,parent in [('Front',-3.85,10.3,None),('Rear',5.7,6.6,rear)]:
 box(section+' floor',2.5,.22,length,0,.67,z,dark,parent)
 box(section+' roof',2.53,.16,length,0,3.08,z,green,parent,.055)
 for side in [-1,1]:
  box(section+' lower body',.10,.73,length,side*1.225,1.12,z,green,parent,.035)
  box(section+' sill',.13,.14,length,side*1.225,1.56,z,dark,parent)
  box(section+' window band',.07,1.19,length-.18,side*1.246,2.22,z,glass,parent)
  for k in range(math.ceil(length/1.4)+1):
   zz=z-length/2+k*length/math.ceil(length/1.4);box(section+' window mullion',.08,1.42,.07,side*1.25,2.27,zz,dark,parent)
 box(section+' ceiling',2.35,.04,length-.1,0,2.96,z,white,parent)
 # Aisle stays open. Every row has a backrest, cushion, and metal support.
 for row in range(int(length/1.05)-1):
  zz=z-length/2+1.25+row*1.05
  for side in [-1,1]:
   box('Seat cushion',.77,.12,.48,side*.8,1.0,zz,seat,parent,.055)
   box('Seat back',.77,.64,.12,side*.8,1.35,zz+.24,seat,parent,.05)
   box('Seat support',.08,.35,.08,side*.8,.8,zz,silver,parent)
  if row%3==0:
   for side in [-1,1]:box('Yellow grab pole',.045,2.23,.045,side*.37,1.8,zz,yellow,parent)
for k in range(13):
 z=1.4+k*.067
 for side in [-1,1]:box('Accordion fold',.15,2.23,.045,side*1.20,1.91,z,black)
 box('Accordion roof fold',2.45,.12,.045,0,3.0,z,black)
# Front cockpit and large windshield.
box('Front bumper',2.54,.23,.19,0,.76,-8.95,green,None,.06)
box('Front panel',2.5,.70,.12,0,1.19,-8.98,green,None,.06)
box('Panoramic windshield',2.38,1.25,.04,0,2.19,-9.01,glass)
box('Destination housing',2.40,.30,.10,0,2.86,-9.03,dark)
text('Route display','UNAZA • TIRANË',.17,0,2.81,-9.10,yellow)
text('Municipal label','BASHKIA TIRANË',.115,0,1.39,-9.07,white)
text('Front plate','AA 030 TP',.10,0,.92,-9.085,white)
for side in [-1,1]:
 box('LED headlight',.5,.15,.09,side*.85,.99,-9.06,lamp,None,.04)
 box('Mirror arm',.34,.055,.055,side*1.41,2.68,-8.1,dark)
 box('Mirror housing',.13,.48,.24,side*1.55,2.51,-8.1,dark,None,.04)
 for z in [-7.0,-1.0,7.0]:
  parent=rear if z>2 else None
  bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.51,depth=.28,location=xyz(side*1.19,.52,z),rotation=(0,math.pi/2,0));o=bpy.context.object;o.name='Wheel';o.data.materials.append(rubber)
  if parent:o.parent=parent;o.matrix_parent_inverse=parent.matrix_world.inverted()
  bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=.29,depth=.30,location=xyz(side*1.2,.52,z),rotation=(0,math.pi/2,0));o=bpy.context.object;o.name='Wheel hub';o.data.materials.append(silver)
  if parent:o.parent=parent;o.matrix_parent_inverse=parent.matrix_world.inverted()
  for bolt in range(8):
   a=bolt*math.pi/4;box('Wheel bolt',.035,.045,.045,side*1.36,.52+math.sin(a)*.2,z+math.cos(a)*.2,dark,parent)
# Transparent door leaves on the passenger side.
for j,z in enumerate([-7.45,-.15,6.8]):
 parent=rear if z>2 else None
 for leaf in [-1,1]:
  o=box('Door_'+str(j)+'_'+str(leaf),.08,2.12,.57,1.28,1.74,z+leaf*.3,glass,parent)
  box('Door rail',.095,.06,1.23,1.29,.73,z,silver,parent)
box('Driver dashboard',1.52,.3,.56,-.37,1.57,-8.17,dark)
box('Driver seat',.65,.6,.22,-.65,1.42,-7.30,seat)
box('Hybrid roof pack',1.9,.34,2.2,0,3.31,-3.1,white,None,.08)
box('Rear engine panel',2.5,1.32,.12,0,1.41,8.98,green,rear)
for side in [-1,1]:box('Tail light',.16,.5,.07,side*1.06,1.31,9.07,red,rear)
for i in range(13):box('Engine vent',1.23,.034,.035,0,1.00+i*.047,9.07,dark,rear)
text('Livery name','GREEN LINE',.35,-1.31,1.2,-3.5,white,True)
# Combine static pieces by material; preserve the hinge and door names.
for parent in [None,rear]:
 for m in list(bpy.data.materials):
  objects=[o for o in list(bpy.context.scene.objects) if o.type=='MESH' and o.parent==parent and len(o.data.materials)==1 and o.data.materials[0]==m and not o.name.startswith(('Door_','Wheel'))]
  if len(objects)>1:
   bpy.ops.object.select_all(action='DESELECT')
   for o in objects:o.select_set(True)
   bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
export(OUT/'tirana-articulated-bus.glb')
# Eight distinct facial proportions, clothing palettes, and builds on the bundled rig.
# Original source's skeleton, UV maps and textured facial features are retained.
for i in range(8):
 reset();bpy.ops.import_scene.gltf(filepath=str(ROOT/'webapp/public/assets/table-tennis/chess-human.glb'))
 for o in list(bpy.context.scene.objects):
  if o.type!='MESH':continue
  if 'Headwear' in o.name:
   bpy.data.objects.remove(o,do_unlink=True);continue
  if any(s in o.name for s in ['Head','Teeth','Eye','Beard']):
   # Same transform for linked facial features keeps eyes and teeth in alignment.
   for v in o.data.vertices:
    z=v.co.z;v.co.x*= [.89,1.08,.96,1.16,.93,1.03,1.12,.97][i]
    v.co.y*= [.96,1.04,1.1,.9,1.06,.94,1.03,1.08][i]
   if o.data.shape_keys:
    for block in o.data.shape_keys.key_blocks:
     for v in block.data:v.co.x*=[.89,1.08,.96,1.16,.93,1.03,1.12,.97][i];v.co.y*=[.96,1.04,1.1,.9,1.06,.94,1.03,1.08][i]
  if 'Beard' in o.name and i in [0,2,4,7]:bpy.data.objects.remove(o,do_unlink=True);continue
  for slot in o.material_slots:
   if not slot.material:continue
   m=slot.material.copy();slot.material=m;p=m.node_tree.nodes.get('Principled BSDF') if m.use_nodes else None
   if 'Outfit_Top' in o.name:
    colors=[(.13,.3,.5,1),(.54,.19,.09,1),(.13,.33,.16,1),(.48,.41,.16,1),(.26,.12,.4,1),(.45,.44,.41,1),(.08,.21,.25,1),(.57,.29,.36,1)]
    if p:
     for link in list(p.inputs['Base Color'].links):m.node_tree.links.remove(link)
     p.inputs['Base Color'].default_value=colors[i]
   elif 'Head' in o.name and p:p.inputs['Roughness'].default_value=.54+i*.035
 export(OUT/f'citizen-{i}.glb')
print('TIRANA POPULATION ASSETS COMPLETE',OUT)
