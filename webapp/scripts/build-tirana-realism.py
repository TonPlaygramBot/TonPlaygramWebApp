"""Blender 4.5: authored cabin and park furnishings in metres, glTF Y up.
Run: blender -b --python webapp/scripts/build-tirana-realism.py
Generic fitted cabin, not an OEM scan. All geometry is original project work.
"""
import bpy, math, pathlib, json, hashlib
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'webapp/public/assets/tirana-streets/realism'
SOURCE=ROOT/'assets-source/tirana-urban'
OUT.mkdir(parents=True,exist_ok=True);SOURCE.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def mat(name,color,roughness=.7,metal=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=roughness;p.inputs['Metallic'].default_value=metal
    return m
leather=mat('Charcoal grained upholstery',(.018,.023,.029),.83)
trim=mat('Brushed aluminium',(.27,.30,.32),.32,.8)
rubber=mat('Rubber',(.009,.012,.014),.96)
stitch=mat('Seat stitching',(.20,.23,.24),.9)
display=mat('Instrument glass',(.008,.018,.022),.16)
ivory=mat('Instrument markings',(.65,.76,.69),.48)
orange=mat('Needle orange',(.95,.19,.04),.45)
wood=mat('Weathered timber',(.20,.10,.045),.88)
steel=mat('Park painted iron',(.045,.062,.055),.65,.65)

# Bake grained leather from Blender's noise into portable glTF PBR textures.
bpy.ops.mesh.primitive_plane_add(size=2)
plane=bpy.context.object;plane.data.materials.append(leather)
nodes=leather.node_tree.nodes;links=leather.node_tree.links;p=nodes.get('Principled BSDF')
noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=145
noise.inputs['Detail'].default_value=2;noise.inputs['Roughness'].default_value=.78
ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.009,.012,.016,1)
ramp.color_ramp.elements[1].color=(.032,.039,.045,1)
links.new(noise.outputs['Fac'],ramp.inputs['Fac']);links.new(ramp.outputs['Color'],p.inputs['Base Color'])
bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.22;bump.inputs['Distance'].default_value=.015
links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],p.inputs['Normal'])
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=4
maps={}
for name,kind in [('leather-base','DIFFUSE'),('leather-normal','NORMAL')]:
    image=bpy.data.images.new(name,512,512);image.colorspace_settings.name='Non-Color' if kind=='NORMAL' else 'sRGB'
    image.filepath_raw=str(OUT/(name+'.png'));image.file_format='PNG'
    node=nodes.new('ShaderNodeTexImage');node.image=image;nodes.active=node
    scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=False;scene.render.bake.use_pass_color=True
    bpy.ops.object.bake(type=kind);image.save();maps[kind]=node
links.new(maps['DIFFUSE'].outputs['Color'],p.inputs['Base Color'])
normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.35
links.new(maps['NORMAL'].outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],p.inputs['Normal'])
bpy.data.objects.remove(plane,do_unlink=True)

def xyz(p): return (p[0],-p[2],p[1])
def finish(o,name,material,bevel=0):
    o.name=name;o.data.materials.append(material)
    if bevel:
        mod=o.modifiers.new('Soft manufactured edges','BEVEL');mod.width=bevel;mod.segments=3
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    for poly in o.data.polygons: poly.use_smooth=True
    return o
def box(name,p,size,material,bevel=.01):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(p));o=bpy.context.object
    o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,material,bevel)
def tube(name,a,b,r,material,vertices=20):
    a,b=Vector(xyz(a)),Vector(xyz(b));v=b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=v.length,location=(a+b)/2)
    o=bpy.context.object;o.rotation_euler=v.to_track_quat('Z','Y').to_euler()
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    return finish(o,name,material,.003)
def ring(name,p,r,thickness,material):
    bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=thickness,major_segments=48,minor_segments=10,location=xyz(p),rotation=(math.pi/2,0,0))
    o=bpy.context.object;bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    return finish(o,name,material)
def text(name,value,p,size,material):
    bpy.ops.object.text_add(location=xyz(p),rotation=(math.pi/2,0,0));o=bpy.context.object
    o.name=name;o.data.body=value;o.data.size=size;o.data.align_x='CENTER';o.data.extrude=.0004;o.data.materials.append(material)
    bpy.ops.object.convert(target='MESH');return bpy.context.object
def export(name):
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(name+'.blend')),compress=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',export_yup=True,export_extras=True)

# Driver eye is (0,0,0), front is -Z. Controls remain within reach of the seat.
box('Dashboard',( .34,-.37,-.73),(1.72,.26,.48),leather,.06)
box('Lower console',(.34,-.70,-.65),(1.70,.37,.30),leather,.05)
box('Passenger trim',(.83,-.34,-.472),(.58,.028,.014),trim)
for x in [-.39,.31,.42,1.02]:
    box('Vent housing',(x,-.36,-.482),(.13,.105,.026),trim)
    for y in range(5):box('Vent vane',(x,-.397+y*.018,-.461),(.11,.007,.012),rubber,.001)
for x in [-.15,.15]:
    tube('Instrument dial',(x,-.295,-.475),(x,-.295,-.454),.118,display,48)
    ring('Instrument bezel',(x,-.295,-.447),.119,.007,trim)
    for i in range(11):
        a=-2.45+i*.49;tx=x+math.sin(a)*.097;ty=-.295+math.cos(a)*.097
        box('Gauge tick',(tx,ty,-.439),(.007,.013,.002),ivory,.001)
        if i%2==0:text('Dial label',str(i*20),(x+math.sin(a)*.073,-.302+math.cos(a)*.073,-.435),.019,ivory)
needle=box('SpeedNeedle',(-.15,-.257,-.43),(.006,.076,.004),orange,.001)
bpy.context.scene.cursor.location=xyz((-.15,-.295,-.43))
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
box('Navigation display',(.60,-.35,-.467),(.27,.14,.012),display)
text('Console label','TIRANA',(.60,-.344,-.452),.027,ivory)
for i in range(3):ring('Climate dial',(.45+i*.14,-.5,-.46),.032,.009,trim)
wheel=ring('SteeringWheel',(0,-.40,-.39),.18,.023,leather)
for a in [math.pi/2,-math.pi/2,math.pi]:
    part=tube('Wheel spoke',(0,-.40,-.39),(math.sin(a)*.17,-.40+math.cos(a)*.17,-.39),.017,trim)
    part.parent=wheel;part.matrix_parent_inverse=wheel.matrix_world.inverted()
hub=box('Wheel hub',(0,-.40,-.37),(.17,.08,.055),leather,.022);hub.parent=wheel;hub.matrix_parent_inverse=wheel.matrix_world.inverted()
tube('Steering column',(0,-.42,-.69),(0,-.4,-.42),.035,rubber)
for side in [-.48,1.20]:
    box('Door panel',(side,-.47,.12),(.075,.73,1.4),leather,.03)
    box('Door armrest',(side,-.43,.02),(.12,.07,.48),leather,.025)
    box('Door handle',(side,-.29,-.26),(.055,.035,.15),trim)
    tube('A pillar',(side,-.21,-.95),(side,.42,-.50),.036,leather)
box('Headliner',(.34,.43,.50),(1.77,.07,2.1),leather,.03)
box('Floor',(.34,-1.05,.42),(1.77,.10,2.6),rubber,.01)
box('Centre tunnel',(.47,-.82,.35),(.27,.39,1.7),leather,.04)
for x in [0,.90]:
    box('Seat cushion',(x,-.64,.30),(.45,.18,.49),leather,.07)
    box('Seat back',(x,-.29,.58),(.47,.74,.17),leather,.07)
    box('Headrest',(x,.10,.60),(.27,.25,.12),leather,.045)
    for edge in [-.17,.17]:tube('Double stitched seam',(x+edge,-.55,.06),(x+edge,-.55,.52),.0018,stitch,8)
    for y in range(5):box('Seat upholstery rib',(x,-.55+y*.10,.484),(.29,.012,.008),stitch,.004)
tube('Gearstick',(.47,-.68,-.13),(.47,-.48,-.15),.014,trim)
box('Gear grip',(.47,-.46,-.15),(.065,.067,.065),leather,.02)
for x in [-.12,.09]:box('Pedal',(x,-.94,-.61),(.085,.025,.15),rubber)
export('driver-interior')

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
# Public park bench: slim slats, continuous metal supports, real metre scale.
for z in [-.21,-.10,.01,.12,.23]:box('Timber seat slat',(0,.46,z),(1.65,.045,.08),wood,.008)
for y in [.61,.74,.87]:box('Timber back slat',(0,y,.29),(1.65,.10,.035),wood,.008)
for x in [-.59,.59]:
    tube('Front leg',(x,.04,-.17),(x,.44,-.17),.026,steel)
    tube('Rear support',(x,.04,.20),(x,.93,.31),.026,steel)
    tube('Seat rail',(x,.43,-.25),(x,.43,.31),.028,steel)
    tube('Armrest',(x,.68,-.24),(x,.68,.29),.022,steel)
    tube('Armrest upright',(x,.43,-.17),(x,.68,-.17),.022,steel)
export('park-bench')
manifest=[]
for f in OUT.glob('*.glb'):
    data=f.read_bytes();manifest.append({'file':f.name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'authoring':'Blender 4.5.3','license':'Original project asset','units':'metres'})
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest))
