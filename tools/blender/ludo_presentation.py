"""Author Ludo's presentation meshes in Blender; cosmetic game models only.
Run: blender --background --factory-startup --python tools/blender/ludo_presentation.py
Y is visual up, +X vehicle nose. Projectiles point +Y. No engineering internals.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'webapp/public/assets/ludo/presentation'
OUT.mkdir(parents=True,exist_ok=True)
GENERATED=ROOT/'webapp/src/assets/ludo-presentation.json'
GENERATED.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
materials={}
def material(name,color,metal,rough):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    materials[name]=m;return m
material('copper',(.52,.23,.085),.86,.27)
material('brass',(.63,.43,.15),.82,.29)
material('primer',(.25,.25,.22),.8,.36)
material('olive',(.16,.19,.105),.22,.62)
material('ivory',(.66,.65,.56),.12,.58)
material('steel',(.12,.15,.16),.78,.34)
material('rubber',(.025,.03,.026),0,.92)
material('glass',(.045,.12,.14),.35,.12)
material('red',(.43,.025,.02),.08,.52)
material('light',(.85,.71,.40),.12,.23)
models={};active=[]
def add(obj,name,mat):
    obj.name=name;obj.data.materials.append(materials[mat]);active.append(obj);return obj

def box(name,size,pos,mat='olive',bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        m=o.modifiers.new('machined edges','BEVEL');m.width=min(bevel,min(size)*.18);m.segments=2
        o.data.use_auto_smooth=True
        m=o.modifiers.new('weighted normals','WEIGHTED_NORMAL')
    return add(o,name,mat)

def lathe(name,profile,mat='copper',segments=24,axis='y',pos=(0,0,0)):
    verts=[];faces=[]
    for h,r in profile:
        for i in range(segments):
            a=2*math.pi*i/segments;x,z=r*math.cos(a),r*math.sin(a)
            v=(x,h,z) if axis=='y' else (h,x,z) if axis=='x' else (x,z,h)
            verts.append(tuple(v[j]+pos[j] for j in range(3)))
    for k in range(len(profile)-1):
        for i in range(segments):
            a=k*segments+i;b=k*segments+(i+1)%segments;faces.append((a,a+segments,b+segments,b) if axis=='y' else (a,b,b+segments,a+segments))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
    for p in mesh.polygons:p.use_smooth=True
    return add(o,name,mat)

def panel(name,outline,thickness,mat='olive'):
    verts=[(x,y+h,z) for h in [-thickness/2,thickness/2] for x,y,z in outline];n=len(outline)
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);return add(o,name,mat)

def finish(key):
    global active
    deps=bpy.context.evaluated_depsgraph_get();parts={}
    for obj in active:
        ev=obj.evaluated_get(deps);mesh=ev.to_mesh();mesh.calc_loop_triangles()
        mat=obj.data.materials[0];part=parts.setdefault(mat.name,{'positions':[],'normals':[]})
        for tri in mesh.loop_triangles:
            for vi in tri.vertices:
                v=obj.matrix_world@mesh.vertices[vi].co
                normal=mesh.vertices[vi].normal if mesh.polygons[tri.polygon_index].use_smooth else tri.normal
                normal=obj.matrix_world.to_3x3()@normal;normal.normalize()
                part['positions'].extend(round(float(c),5) for c in v)
                part['normals'].extend(round(float(c),4) for c in normal)
        ev.to_mesh_clear()
    for part in parts.values():
        lookup={};positions=[];normals=[];indices=[]
        for i in range(0,len(part['positions']),3):
            vertex=tuple(part['positions'][i:i+3]+part['normals'][i:i+3])
            if vertex not in lookup:
                lookup[vertex]=len(positions)//3;positions.extend(vertex[:3]);normals.extend(vertex[3:])
            indices.append(lookup[vertex])
        part.update(positions=positions,normals=normals,indices=indices)
    models[key]=parts
    bpy.ops.object.select_all(action='DESELECT')
    collection=bpy.data.collections.new(key);bpy.context.scene.collection.children.link(collection)
    for obj in active:
        obj.select_set(True)
        for c in list(obj.users_collection):c.objects.unlink(obj)
        collection.objects.link(obj)
    bpy.context.view_layer.objects.active=active[0]
    bpy.ops.export_scene.gltf(filepath=str(OUT/(key+'.glb')),use_selection=True,export_format='GLB',export_yup=False,export_apply=True)
    for o in active:o.hide_set(True)
    active=[]

# Unit-radius, unit-length meshes. Runtime scales each to the weapon's own profile.
for key,blunt in [('pistol-round',True),('smg-round',True),('revolver-round',True),('rifle-round',False),('marksman-round',False),('sniper-round',False),('jacketed-round',False)]:
    if blunt: profile=[(-.5,0),(-.5,.78),(-.44,1),(.10,1),(.25,.95),(.37,.75),(.46,.42),(.5,0)]
    else: profile=[(-.5,0),(-.5,.66),(-.35,1),(.10,1),(.23,.87),(.34,.65),(.43,.34),(.5,0)]
    lathe('jacket-ogive',profile)
    lathe('cannelure',[(-.21,.98),(-.195,.93),(-.17,.93),(-.155,.98)],'brass')
    finish(key)
lathe('pellet',[(math.cos(i*math.pi/12)*.5,math.sin(i*math.pi/12)) for i in range(12,-1,-1)],'primer',16);finish('buckshot-pellet')
for key,neck,shotgun in [('pistol-case',False,False),('rifle-case',True,False),('shotgun-case',False,True)]:
    profile=[(-.5,0),(-.5,1.12),(-.44,1.12),(-.42,.88),(-.37,.88),(-.35,1),(.20,.94),(.32,.66 if neck else .94),(.50,.66 if neck else .94),(.50,.56 if neck else .82),(.40,.56 if neck else .82),(-.32,.82),(-.40,0)]
    lathe('open-case-body',profile,'red' if shotgun else 'brass')
    lathe('case-head',[(-.50,0),(-.50,1.12),(-.38,1.12),(-.38,1)],'brass')
    lathe('struck-primer',[(-.507,0),(-.507,.2),(-.512,.36),(-.502,.4)],'primer')
    finish(key)
for key in ['rocket-warhead','explosive-warhead','cannon-shell','grenade-round','frag-grenade','explosive-charge','molotov-bottle','explosive-canister']:
    if key=='frag-grenade':
        lathe('segmented-body',[(-.5,0),(-.43,.7),(-.2,1),(.2,1),(.38,.65),(.44,.45)],'olive');box('lever',(.3,.58,.22),(.18,.32,0),'steel',.025)
    elif key=='molotov-bottle':
        lathe('bottle',[(-.5,0),(-.5,.85),(-.35,1),(.12,1),(.26,.4),(.5,.4),(.5,0)],'glass');box('cloth',(.25,.25,.2),(0,.57,0),'ivory',.03)
    elif key in ['explosive-canister','explosive-charge']:
        lathe('canister',[(-.5,0),(-.5,.8),(-.43,1),(.4,1),(.5,.8),(.5,0)],'red' if key=='explosive-charge' else 'olive')
    elif key=='grenade-round':
        lathe('rounded-grenade',[(-.5,0),(-.5,.9),(.12,1),(.3,.86),(.45,.46),(.5,0)],'olive')
    else:
        lathe('warhead',[(-.5,0),(-.5,.64),(-.4,.82),(.14,1),(.28,.85),(.40,.51),(.48,.18),(.5,0)],'olive')
        if 'rocket' in key or 'explosive' in key:
            for a in [0,math.pi/2]:
                o=box('tail-fin',(2.8,.22,.09),(0,-.34,0),'steel',.015);o.rotation_euler.y=a
    finish(key)
# Tactical missile, +X nose, with ogive, seams, control surfaces and exhaust recess.
lathe('missile-body',[(-.69,0),(-.69,.058),(-.60,.082),(.40,.09),(.56,.082),(.68,.06),(.79,.025),(.84,0)],'olive',32,'x')
for x in [-.5,.27,.47]:lathe('panel-seam',[(x,.0905),(x+.012,.0905)],'steel',24,'x')
lathe('exhaust-lip',[(-.72,.05),(-.72,.076),(-.68,.08),(-.66,.052)],'steel',24,'x')
for a in range(4):
    o=panel('swept-fin',[(-.58,0,.07),(-.23,0,.08),(-.45,0,.25),(-.64,0,.25)],.012,'olive');o.rotation_euler.x=a*math.pi/2
finish('missile')
# 6x6 vehicle; tread blocks, hubs, cabin seams, mirrors, lamps and chassis.
box('ladder-chassis',(2.35,.16,.78),(0,-.16,0),'steel')
box('rear-bed',(1.55,.22,1.0),(-.34,.05,0))
box('cab',(0.78,.63,.97),(.82,.40,0),bevel=.07)
box('hood',(.42,.25,.9),(1.18,.16,0),bevel=.04)
box('front-bumper',(.14,.14,1.13),(1.42,-.05,0),'steel')
for z in [-.25,.25]:
    box('windshield',(.018,.25,.40),(1.215,.52,z),'glass')
    box('headlamp',(.025,.115,.15),(1.496,.10,z*1.6),'light')
for z in [-.491,.491]:
    box('side-window',(.40,.24,.012),(.75,.54,z),'glass')
    box('door-panel',(.51,.27,.016),(.73,.22,z),'olive')
    box('handle',(.10,.022,.032),(.55,.36,z),'steel')
    box('mirror-stalk',(.025,.025,.18),(1.02,.51,z*1.10),'steel')
    box('mirror',(.075,.13,.035),(1.02,.53,z*1.35),'steel')
    box('step',(.52,.07,.18),(.72,-.07,z),'steel')
for i in range(7):box('radiator-slat',(.014,.026,.53),(1.401,.16+i*.025,0),'rubber')
for x in [-.9,-.38,.91]:
    lathe('axle',[(-.58,.04),(.58,.04)],'steel',12,'z',(x,-.32,0))
    for z in [-.58,.58]:
        lathe('tire',[(-.12,.13),(-.12,.22),(-.085,.255),(.085,.255),(.12,.22),(.12,.13),(-.12,.13)],'rubber',24,'z',(x,-.32,z))
        lathe('wheel-hub',[(-.126,0),(-.126,.13),(.126,.13),(.126,0)],'steel',20,'z',(x,-.32,z))
        for j in range(16):
            a=j*2*math.pi/16;o=box('tread',(.075,.035,.23),(x+math.sin(a)*.253,-.32+math.cos(a)*.253,z),'rubber',.004);o.rotation_euler.z=-a
        for j in range(6):
            a=j*math.pi/3;box('lug',(.023,.023,.015),(x+math.sin(a)*.08,-.32+math.cos(a)*.08,z+(.132 if z>0 else -.132)),'brass',.003)
box('fuel-tank',(.42,.23,.33),(-.05,-.05,-.50),'steel',.035)
box('launcher-pedestal',(.58,.28,.65),(-.35,.32,0),'steel')
finish('truck')
# Delta-wing propeller drone; no jet flame. Separate rear propeller animation node.
lathe('fuselage',[(-1.35,0),(-1.35,.14),(-.8,.19),(.65,.17),(1.25,.09),(1.52,0)],'ivory',28,'x')
panel('delta-wing',[(-1.20,0,-1.70),(1.0,0,0),(-1.20,0,1.70),(-1.38,0,.48),(-1.38,0,-.48)],.065,'ivory')
for z in [-1.58,1.58]:
    box('winglet',(.48,.32,.025),(-1.08,.13,z),'ivory')
    box('control-surface',(.33,.014,.68),(-1.19,.042,z*.68),'steel',.002)
for x in [-.9,-.35,.25]:lathe('fuselage-seam',[(x,.19),(x+.012,.19)],'steel',20,'x')
lathe('engine', [(-1.54,.08),(-1.54,.14),(-1.32,.14)],'steel',20,'x')
box('vent',(.27,.035,.13),(-1.3,.17,0),'rubber')
finish('drone')
lathe('propeller-hub',[(-.04,0),(-.04,.075),(.06,.075),(.1,0)],'steel',20,'x')
for a in [0,math.pi]:
    o=box('propeller-blade',(.025,.60,.08),(0,.36 if a==0 else -.36,.02),'rubber',.012);o.rotation_euler.y=.20
finish('drone-propeller')
# Material-batched, evaluated Blender meshes for synchronous pooled WebGL effects.
palette={name:{'color':list(m.diffuse_color)[:3],'metalness':m.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value,'roughness':m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value} for name,m in materials.items()}
GENERATED.write_text(json.dumps({'generator':'Blender '+bpy.app.version_string,'materials':palette,'models':models},separators=(',',':')))
for obj in bpy.data.collections['truck'].objects:obj.hide_set(False)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source/ludo-presentation.blend'))
print('LUDO MODELS',len(models),'mesh data bytes',GENERATED.stat().st_size)
