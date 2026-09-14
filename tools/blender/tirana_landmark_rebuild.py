"""Original photo-referenced exteriors. Blender 4.2+, metres, Z up.
Sources and unsurveyed details are recorded in docs/tirana-mobile-world-upgrade.md.
The retained editable objects export as material batches. No scan is imported.
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'webapp/public/assets/tirana-streets/landmark-rebuild'
SOURCE=ROOT/'assets-source/tirana-landmark-rebuild'
OUT.mkdir(parents=True,exist_ok=True);SOURCE.mkdir(parents=True,exist_ok=True)
TAU=math.tau
stats={}

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    global mats
    mats={}
    for name,c,rough,metal in [('stone',(0.76,.73,.66),.83,0),('marble',(.91,.88,.79),.68,0),('lead',(.22,.29,.34),.52,.35),('glass',(.075,.13,.15),.28,.25),('gold',(.62,.43,.16),.3,.75),('wood',(.23,.07,.035),.65,0),('iron',(.11,.14,.13),.55,.65),('concrete',(.59,.6,.57),.9,0),('plaster',(.79,.74,.64),.85,0),('carpet',(.55,.018,.027),.92,0)]:
        m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
        bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal;mats[name]=m

def mesh(name,v,f,mat='marble'):
    data=bpy.data.meshes.new(name);data.from_pydata(v,[],f);data.update()
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);data.materials.append(mats[mat]);return o

def box(name,x,y,z,w,d,h,mat='marble'):
    v=[(a*w/2,b*d/2,c*h/2) for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    o=mesh(name,v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)
    o.location=(x,y,z)
    return o

def lathe(name,x,y,profile,mat='marble',segments=32):
    v=[(x+math.cos(i/segments*TAU)*r,y+math.sin(i/segments*TAU)*r,z) for r,z in profile for i in range(segments)]
    f=[]
    for j in range(len(profile)-1):
        for i in range(segments):
            a=j*segments+i;b=j*segments+(i+1)%segments;f.append((a,b,b+segments,a+segments))
    f+=[tuple(range(segments-1,-1,-1)),tuple((len(profile)-1)*segments+i for i in range(segments))]
    o=mesh(name,v,f,mat)
    for p in o.data.polygons:p.use_smooth=True
    return o

def dome(name,x,y,z,r,h,detail):
    n=12 if detail else 6;s=48 if detail else 20
    lathe(name,x,y,[(r*math.cos(j/n*math.pi/2),z+h*math.sin(j/n*math.pi/2)) for j in range(n+1)],'lead',s)
    lathe(name+' rim',x,y,[(r+.14,z-.22),(r+.14,z),(r,z+.13)],segments=s)
    if detail:
        for i in range(24):
            angle=i/24*TAU
            points=[(x+math.cos(angle)*r*math.cos(j/n*math.pi/2),y+math.sin(angle)*r*math.cos(j/n*math.pi/2),z+h*math.sin(j/n*math.pi/2)+.035) for j in range(n+1)]
            curve=bpy.data.curves.new(name+' seam','CURVE');curve.dimensions='3D';curve.bevel_depth=.035;curve.bevel_resolution=0
            poly=curve.splines.new('POLY');poly.points.add(len(points)-1)
            for p,co in zip(poly.points,points):p.co=(*co,1)
            o=bpy.data.objects.new(name+' seam',curve);bpy.context.collection.objects.link(o);o.data.materials.append(mats['lead'])

def arch(name,x,y,z,w,h,depth=.2,mat='glass',yaw=0,detail=True):
    r=w/2;straight=max(0,h-r);n=12 if detail else 6
    ring=[(-r,0),(r,0)]+[(math.cos(a)*r,straight+math.sin(a)*r) for a in [i/n*math.pi for i in range(n+1)]]
    co=[]
    for dy in [-depth/2,depth/2]:
        for dx,dz in ring:co.append((x+dx*math.cos(yaw)-dy*math.sin(yaw),y+dx*math.sin(yaw)+dy*math.cos(yaw),z+dz))
    N=len(ring);faces=[tuple(range(N-1,-1,-1)),tuple(N+i for i in range(N))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
    return mesh(name,co,faces,mat)

def window(x,y,z,yaw,detail=True,w=1.6,h=3):
    arch('Carved arched reveal',x,y,z-.1,w+.32,h+.32,.24,'stone',yaw,detail)
    dx=-math.sin(yaw)*.15;dy=math.cos(yaw)*.15
    arch('Recessed glazing',x+dx,y+dy,z,w,h,.12,'glass',yaw,detail)
    if detail:
        o=box('Window mullion',x+dx*1.5,y+dy*1.5,z+h*.44,.065,.12,h*.82);o.rotation_euler.z=yaw
        o=box('Transom',x+dx*1.5,y+dy*1.5,z+h*.4,w,.12,.065);o.rotation_euler.z=yaw

def minaret(x,y,detail):
    lathe('Octagonal minaret base',x,y,[(2.35,.65),(2.35,7.9),(1.65,10),(1.38,11)],segments=8)
    lathe('Fluted minaret shaft',x,y,[(1.38,10),(1.16,23),(1.01,35),(.82,43.5)],segments=24)
    for z in [22,31,39.5]:
        lathe('Corbel balcony',x,y,[(1.18,z-1.3),(1.5,z-.8),(1.92,z-.25),(2.04,z),(2.04,z+.22),(1.74,z+.35)],segments=32 if detail else 12)
        lathe('Balcony parapet',x,y,[(1.78,z+.35),(1.78,z+1.1),(1.66,z+1.15)],segments=32 if detail else 12)
        if detail:
            for i in range(24):
                a=i*TAU/24
                lathe('Muqarnas pendant',x+1.6*math.cos(a),y+1.6*math.sin(a),[(.11,z-.85),(.22,z-.38),(.13,z-.13)],segments=6)
                box('Balcony slit',x+1.793*math.cos(a),y+1.793*math.sin(a),z+.67,.1,.1,.36,'glass')
    lathe('Pencil spire',x,y,[(1.05,43.3),(1.1,43.6),(.7,47),(0.03,49.35)],'lead',24)
    lathe('Gold minaret finial',x,y,[(.055,49.2),(.09,49.6),(.025,50)],'gold',10)

def mosque(detail):
    reset()
    box('Foundation',0,0,.35,60,78,.7,'stone')
    box('Prayer hall',0,-14,7.4,55,46,13.4)
    box('Upper prayer volume',0,-14,17,41,36,6)
    box('West courtyard wing',-23,23,5.2,9,28,9.8)
    box('East courtyard wing',23,23,5.2,9,28,9.8)
    box('Courtyard north wing',0,33,5.2,38,8,9.8)
    box('Courtyard floor',0,22,.8,38,21,.15,'stone')
    for z,w,d in [(13.6,56,47),(14,54,46),(20,42,37)]:box('Stone cornice',0,-14,z,w,d,.32,'stone')
    lathe('Central drum',0,-14,[(13.3,20),(13.3,24.2)],segments=40)
    dome('Central lead dome',0,-14,24.2,13.5,9.3,detail)
    lathe('Central gold finial',0,-14,[(.45,33.45),(.18,34),(.33,34.25),(.08,35)],'gold',16)
    for x,y in [(-15,-14),(15,-14),(0,-29),(0,1)]:dome('Cascade half dome',x,y,18.7,9.1,6.4,detail)
    for x in [-18,18]:
        for y in [-29,1]:dome('Corner cupola',x,y,15.8,5.2,3.8,detail)
    for x in [-26,26]:
        for y in [-34,7]:minaret(x,y,detail)
    for x in [-15,-7.5,0,7.5,15]:dome('Courtyard portico cupola',x,32,10.2,3.7,2.5,detail)
    for x in [-23,23]:
        for y in [15,23]:dome('Arcade cupola',x,y,10.2,3.7,2.5,detail)
    for x in range(-21,22,6):
        for z in [1.3,7.6]:window(x,-37.15,z,math.pi,detail,w=2.1,h=4.1 if z<2 else 3.1)
        window(x,37.15,1.3,0,detail,w=2.1,h=4.1)
    for side in [-1,1]:
        for y in range(-29,33,7):
            for z in [1.2,6.7]:window(side*27.65,y,z,-side*math.pi/2,detail)
    for i in range(24):
        a=i*TAU/24;window(13.38*math.cos(a),-14+13.38*math.sin(a),20.5,a-math.pi/2,detail,w=1.2,h=2.8)
    for i in range(9):
        box('Main entrance stair',0,-40.8-i*.43,.07*(9-i),13,1.2,.14*(9-i),'stone')
    arch('Main carved doorway',0,-37.4,.7,5,6.6,.38,'stone',math.pi,detail)
    arch('Main timber doors',0,-37.63,.8,4.1,5.8,.13,'wood',math.pi,detail)
    box('Door division',0,-37.74,3.3,.075,.08,5,'gold')
    export('namazgah-'+('near' if detail else 'far'),detail)

def villa_kit():
    reset()
    # Bay modules attach to actual mapped footprints; no generic box replaces a house.
    box('Villa window reveal',0,0,1.1,1.9,.3,2.4,'stone')
    box('Villa recessed glazing',0,-.18,1.1,1.58,.055,2.08,'glass')
    for x in [-.78,0,.78]:box('Villa mullion',x,-.23,1.1,.065,.08,2.15)
    box('Villa transom',0,-.23,1.45,1.6,.08,.055)
    box('Projecting limestone sill',0,-.15,-.08,2.02,.56,.13)
    box('Lintel molding',0,-.1,2.34,2.12,.45,.17)
    export('villa-bay',True)
    reset()
    box('Terrace slab',0,-.7,0,3,1.6,.16,'stone')
    for x in [-1.42,1.42]:box('Balcony return',x,-.6,.55,.09,1.5,1.1,'iron')
    for x in [i*.2-1.4 for i in range(15)]:box('Balustrade vertical',x,-1.4,.56,.035,.04,1.05,'iron')
    box('Balcony handrail',0,-1.4,1.12,2.95,.06,.065,'iron')
    export('villa-balcony',True)

def parliament_entry():
    reset()
    # Public plenary entrance, not the different parliamentary office building.
    # Front faces Blender -Y / game +Z; fitted to the existing mapped facade.
    box('Entrance plaster backing',0,.12,6.3,23,.3,12.6)
    for x in [-10.1,-3.6,3.6,10.1]:
        box('Pilaster shaft',x,-.22,6.15,.8,.7,10.8)
        for z,w,h in [(1.0,1.15,.28),(1.32,.95,.2),(11.5,1.35,.28),(11.81,1.55,.28)]:
            box('Gold pilaster molding',x,-.32,z,w,.85,h,'gold')
        for dx in [-.21,0,.21]:box('Pilaster flute',x+dx,-.6,6.2,.06,.035,9.7,'stone')
    box('Door limestone surround',0,-.3,4.3,5.3,.65,6.5,'stone')
    box('Timber double doors',0,-.67,3.65,4.6,.18,5.1,'wood')
    for x in [-1.65,-.55,.55,1.65]:
        for z in [2.05,3.65,5.25]:box('Raised door panel',x,-.79,z,.85,.08,1.25,'wood')
    for x in [-.18,.18]:box('Brass pull',x,-.89,3.6,.04,.07,.45,'gold')
    box('Gold entrance lintel',0,-.68,6.45,5.15,.14,.18,'gold')
    box('Red emblem backing',0,-.29,8.7,2.4,.08,2.5,'carpet')
    for x in [-8.6,-6.6,-4.65,4.65,6.6,8.6]:
        box('Tall recessed window',x,-.095,5.7,1.28,.08,7.8,'glass')
        for dx in [-.68,.68]:box('Window reveal',x+dx,-.17,5.7,.13,.17,8.05,'stone')
        for z in [3.8,6.1,8.4]:box('Window transom',x,-.18,z,1.3,.09,.06)
        box('Window mullion',x,-.18,5.7,.06,.09,7.9)
    box('Lettering frieze',0,-.15,12.25,23,.4,.7)
    for i in range(8):
        h=.15*(8-i);y=-.9-i*.39
        box('Dark stone step',0,y,h/2,23,.78,h,'iron')
        box('Red carpet on step',0,y,h+.014,3.1,.78,.025,'carpet')
    export('parliament-entry',True)

def export(name,editable=True):
    if editable:bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(name+'.blend')),compress=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.context.view_layer.objects.active=next(iter(bpy.context.scene.objects))
    bpy.ops.object.convert(target='MESH')
    groups={}
    for o in bpy.context.scene.objects:
        if o.type=='MESH':groups.setdefault(o.data.materials[0].name,[]).append(o)
    for material,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=name+'-'+material
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_materials='EXPORT')
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    stats[name]={'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),'draws':len(meshes),'bytes':(OUT/(name+'.glb')).stat().st_size}
    # Small, synchronous fallback uses the very same exported vertices and normals.
    data={'parts':[]}
    for o in meshes:
        o.data.calc_loop_triangles();p=[];n=[]
        for tri in o.data.loop_triangles:
            for i in tri.vertices:
                v=o.matrix_world@o.data.vertices[i].co;normal=o.matrix_world.to_3x3()@tri.normal
                p += [round(v.x,4),round(v.z,4),round(-v.y,4)];n += [round(normal.x,4),round(normal.z,4),round(-normal.y,4)]
        data['parts'].append({'material':o.data.materials[0].name,'color':list(o.data.materials[0].diffuse_color[:3]),'positions':p,'normals':n})
    if name.endswith('far') or name.startswith('villa-') or name=='parliament-entry':
        runtime=ROOT/'webapp/src/games/tirana-landmark-rebuild'
        runtime.mkdir(parents=True,exist_ok=True)
        (runtime/(name+'.mjs')).write_text('// Evaluated Blender geometry. Regenerate with tools/blender/tirana_landmark_rebuild.py\nexport default '+json.dumps(data,separators=(',',':'))+';\n')

mosque(True);mosque(False);villa_kit();parliament_entry()
(SOURCE/'metrics.json').write_text(json.dumps(stats,indent=2))
print('ASSET_METRICS',json.dumps(stats))
