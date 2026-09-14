"""Original metre-scale mobility assets and imported model preparation, Blender 4.5.
Run with Blender's Python module or blender -b --python ... -- --uploads DIR.
GLB assets are material-batched; the .blend keeps editable source objects.
"""
import argparse, hashlib, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'webapp/public/assets/tirana-streets/city-mobility'
SOURCE=ROOT/'assets-source/tirana-city-mobility'
OUT.mkdir(parents=True,exist_ok=True);SOURCE.mkdir(parents=True,exist_ok=True)
metrics={}

def reset():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for data in [bpy.data.meshes,bpy.data.curves,bpy.data.materials,bpy.data.images]:
        for item in list(data):
            if item.users==0:data.remove(item)

def mat(name,color,metal=0,rough=.4):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
    return m

def finish(obj,name,m):
    obj.name=name;obj.data.materials.append(m)
    for p in obj.data.polygons:p.use_smooth=True
    return obj

def tube(name,a,b,r,m,vertices=10):
    a,b=Vector(a),Vector(b);d=b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=d.length,location=(a+b)/2)
    o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return finish(o,name,m)

def ball(name,p,s,m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=10,location=p)
    o=bpy.context.object;o.scale=s;return finish(o,name,m)

def box(name,p,s,m,bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.scale=s
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(o,name,m)
    if bevel:
        mod=o.modifiers.new('Edge radii','BEVEL');mod.width=bevel;mod.segments=2
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def torus(name,p,r,t,m):
    bpy.ops.mesh.primitive_torus_add(major_segments=40,minor_segments=8,major_radius=r,minor_radius=t,location=p,rotation=(0,math.pi/2,0))
    return finish(bpy.context.object,name,m)

def export(name,blend=True):
    if blend:bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(name+'.blend')),compress=True)
    objs=[o for o in bpy.context.scene.objects if o.type=='MESH']
    for o in objs:
        bpy.context.view_layer.objects.active=o;o.select_set(True)
    # Geometry is exported in few material batches; wheels retain named pivots.
    batches={}
    for o in objs:
        if o.name.startswith('wheel-'):continue
        key=tuple(m.name for m in o.data.materials if m);batches.setdefault(key,[]).append(o)
    for group in batches.values():
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:o.select_set(True)
        bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join()
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',export_cameras=False,export_lights=False,export_extras=True,export_image_format='AUTO')
    b=(OUT/(name+'.glb')).read_bytes()
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    metrics[name]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects),'meshes':len(objects)}

def bike(kind,index):
    reset()
    rubber=mat('Rubber',(.018,.022,.026),0,.83);metal=mat('Brushed aluminium',(.43,.47,.5),.88,.26)
    dark=mat('Engine and saddle',(.026,.031,.035),.25,.5);chrome=mat('Chrome',(.7,.75,.78),.94,.16)
    paint=mat('Enamel',[(.035,.24,.19),(.72,.10,.028),(.026,.12,.27),(.57,.025,.035),(.065,.08,.1)][index],.58,.23)
    red=mat('Rear reflector',(.8,.01,.01),.15,.2);white=mat('Headlamp',(.86,.92,1),.25,.16)
    motor=index>=3;r=.29 if motor else .335;wb=1.32 if motor else 1.12;rear=wb/2;front=-wb/2
    for yi,label in [(rear,'rear'),(front,'front')]:
        torus('wheel-'+label,(0,yi,r),r-.035,.065 if motor else .03,rubber)
        torus('Rim',(0,yi,r),r-.075,.022 if motor else .013,metal)
        tube('Axle',(-.13,yi,r),(.13,yi,r),.025,metal)
        count=8 if motor else 20
        for k in range(count):
            t=k*math.tau/count;tube('Spoke',(.012,yi,r),(.012,yi+math.sin(t)*(r-.082),r+math.cos(t)*(r-.082)),.014 if motor else .0035,chrome,6)
        torus('Disc brake',(.095,yi,r),.11,.018,chrome)
    pedal=(0,.05,.3);seat=(0,.19,.87);head=(0,front+.12,.91)
    for a,b in [(pedal,seat),(seat,head),(head,pedal),(pedal,(0,rear,r)),(seat,(0,rear,r))]:tube('Frame',a,b,.044 if motor else .021,paint)
    for side in [-1,1]:
        tube('Front fork',(side*.09,front,r),(side*.09,front+.12,.93),.026 if motor else .015,metal)
        tube('Swing arm',(side*.12,rear,r),(side*.12,.05,.35),.026 if motor else .015,dark)
    tube('Stem',head,(0,front+.1,1.07),.025,metal)
    barY=front+.1
    tube('Handlebar',(-.34,barY,1.08),(.34,barY,1.08),.018,chrome)
    for side in [-1,1]:
        tube('Grip',(side*.24,barY,1.08),(side*.37,barY+.025,1.08),.025,rubber)
        tube('Brake lever',(side*.25,barY-.08,1.08),(side*.35,barY-.06,1.08),.008,metal)
    ball('Saddle',(0,.21,.9),(.14,.23,.047),dark)
    if not motor:
        tube('Crank axle',(-.13,.05,.3),(.13,.05,.3),.016,metal)
        for side in [-1,1]:
            tube('Crank',(side*.12,.05,.3),(side*.12,.05+side*.12,.3),.012,metal)
            box('Pedal',(side*.18,.05+side*.12,.3),(.12,.085,.035),dark,.005)
        torus('Chainring',(.08,.05,.3),.09,.01,metal)
        for dz in [-.07,.07]:tube('Chain',(.08,.05,.3+dz),(.08,rear,r+dz*.5),.008,dark,6)
        if index==1:
            tube('Suspension',(0,front+.105,.64),(0,front+.14,.86),.035,dark)
            for yi in [front,rear]:
                for k in range(28):
                    a=k*math.tau/28;box('Tread',(0,yi+math.sin(a)*r,r+math.cos(a)*r),(.05,.026,.018),rubber,.002)
        if index in [0,2]:
            for side in [-1,1]:tube('Carrier leg',(side*.1,rear,r),(side*.15,rear,.77),.009,metal)
            box('Luggage rack',(0,rear,.79),(.31,.45,.035),dark,.006)
        if index==0:
            # Wire basket and raised city handlebars.
            for z in [.82,1.02]:
                for x in [-.2,.2]:tube('Basket',(x,front-.05,z),(x,front-.32,z),.009,metal)
                for y in [front-.05,front-.32]:tube('Basket',(-.2,y,z),(.2,y,z),.009,metal)
            for x in [-.2,-.1,0,.1,.2]:tube('Basket wires',(x,front-.32,.82),(x,front-.32,1.02),.004,metal,6)
        if index==2:
            box('Battery',(0,.035,.53),(.10,.24,.3),dark)
            box('Delivery case',(0,rear,.98),(.48,.43,.38),paint,.04)
            box('Reflective strip',(0,rear+.222,.97),(.38,.009,.045),white,.002)
    else:
        ball('Fuel tank',(0,-.12,.74),(.23,.32,.18),paint)
        box('Engine',(0,.10,.46),(.4,.4,.3),dark,.07)
        for z in [.38,.43,.48,.53]:box('Cooling fins',(0,.11,z),(.44,.3,.025),metal,.008)
        tube('Exhaust',(.21,.1,.3),(.24,rear+.18,.34),.045,chrome,16)
        ball('Seat',(0,.29,.8),(.2,.33,.08),dark)
        ball('Front mudguard',(0,front,r+.22),(.11,.29,.055),paint)
        box('Plate',(0,rear+.18,.46),(.24,.02,.09),white,.003)
        for side in [-1,1]:
            tube('Mirror arm',(side*.28,barY,1.08),(side*.4,barY,1.25),.009,chrome)
            ball('Mirror',(side*.4,barY,1.26),(.072,.03,.042),dark)
        if index==3:
            ball('Scooter leg shield',(0,front+.17,.68),(.30,.1,.38),paint)
            box('Floorboard',(0,.04,.32),(.43,.68,.065),dark,.035)
            ball('Rear fairing',(0,.46,.56),(.29,.34,.25),paint)
        else:
            for side in [-1,1]:tube('Crash rail',(side*.25,-.17,.47),(side*.25,.28,.32),.024,chrome)
    ball('Headlight',(0,front-.035,.98),(.075,.04,.066),white)
    box('Tail light',(0,rear+.10,.77),(.12,.03,.04),red,.008)
    tube('Kickstand',(.03,.15,.35),(.20,.25,.04),.012,dark)
    export(kind)

def prepare_upload(path,name,length,rotation=0,texture_limit=2048,ground_quantile=0):
    reset();bpy.ops.import_scene.gltf(filepath=str(path))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    # Bake the imported hierarchy before measuring real vertices. Rotated scan
    # bounding boxes include empty corners and cannot define the ground plane.
    for o in objects:
        matrix=Matrix.Rotation(rotation,4,'Z')@o.matrix_world.copy()
        o.parent=None;o.data=o.data.copy();o.data.transform(matrix);o.matrix_world=Matrix.Identity(4)
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)
    points=[v.co.copy() for o in objects for v in o.data.vertices]
    lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    factor=length/max(hi.x-lo.x,hi.y-lo.y);center=(lo+hi)/2
    floor=sorted(p.z for p in points)[int((len(points)-1)*ground_quantile)]
    transform=Matrix.Scale(factor,4)@Matrix.Translation((-center.x,-center.y,-floor))
    for o in objects:o.data.transform(transform)
    bpy.context.view_layer.update()
    for im in bpy.data.images:
        w,h=im.size
        if max(w,h)>texture_limit:im.scale(round(w*texture_limit/max(w,h)),round(h*texture_limit/max(w,h)))
    export(name,False)
    metrics[name]['original']=path.name
    metrics[name]['originalSha256']=hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]
    p=argparse.ArgumentParser();p.add_argument('--uploads',type=Path);p.add_argument('--bikes-only',action='store_true');opts=p.parse_args(args)
    for i,name in enumerate(['city-bicycle','mountain-bike','delivery-ebike','city-scooter','street-motorcycle']):bike(name,i)
    if opts.uploads and not opts.bikes_only:
        prepare_upload(opts.uploads/'great_mosque_of_tirana_albania.glb','namazgjah',110,ground_quantile=.1)
        prepare_upload(opts.uploads/'volkswagen_golf_gti_2025.glb','golf-gti',4.29,-math.pi/2,1024)
    (OUT/'manifest.json').write_text(json.dumps(metrics,indent=2)+'\n')

if __name__=='__main__':main()
