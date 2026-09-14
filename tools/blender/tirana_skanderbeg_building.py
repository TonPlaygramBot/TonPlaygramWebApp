"""Editable, original interpretation of MVRDV's Skanderbeg Building.

Blender 4.2: blender --background --python tools/blender/tirana_skanderbeg_building.py
85 m / 25 storeys: architect dimensions. Plan placement: existing OSM footprints.
Balcony facial profiles and small fittings are authored approximations, not scans
or construction drawings. Reference imagery is not packaged in this project.
"""
import bpy, json, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets-source/tirana-skanderbeg-building'
OUT = ROOT / 'webapp/public/assets/tirana-streets/skanderbeg-building'
RUNTIME = ROOT / 'webapp/src/games/tirana-landmarks'
ANCHORS = json.loads((SOURCE / 'source-anchors.json').read_text())
TAU = math.tau
YAW = ANCHORS['frontYaw']
metrics = {}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    global materials
    materials = {}
    for name, color, roughness, metal in [
        ('porcelain', (.89,.895,.87), .63, 0),
        ('recessed-glazing', (.16,.215,.225), .23, .22),
        ('gradient-low', (.8,.84,.825), .37, .12),
        ('gradient-high', (.44,.56,.565), .26, .25),
        ('aluminium', (.5,.56,.55), .28, .7),
        ('leaves', (.12,.225,.075), .9, 0),
        ('soil', (.08,.055,.025), 1, 0),
        ('balcony-led', (.82,.72,.5), .7, 0),
    ]:
        m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
        p=m.node_tree.nodes.get('Principled BSDF')
        p.inputs['Base Color'].default_value=(*color,1)
        p.inputs['Roughness'].default_value=roughness
        p.inputs['Metallic'].default_value=metal
        if name == 'balcony-led':
            p.inputs['Emission Color'].default_value=(1,.77,.43,1)
            p.inputs['Emission Strength'].default_value=.12
        materials[name]=m


def mesh(name, verts, faces, material='porcelain', smooth=False):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
    data.materials.append(materials[material])
    # Consistent metre-based UVs for the optional 2 m mineral surface normal map.
    uv=data.uv_layers.new(name='Mineral metres')
    for poly in data.polygons:
        poly.use_smooth=smooth
        axis=max(range(3),key=lambda i:abs(poly.normal[i]))
        axes=[i for i in range(3) if i!=axis]
        for li in poly.loop_indices:
            v=data.vertices[data.loops[li].vertex_index].co
            uv.data[li].uv=(v[axes[0]]/2,v[axes[1]]/2)
    return obj


def box(name, x, y, z, w, d, h, mat='porcelain'):
    vs=[(x+a*w/2,y+b*d/2,z+c*h/2) for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    return mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)


def gauss(x, center, width):
    return math.exp(-((x-center)/width)**2)


def local_polygon(points):
    c,s=math.cos(YAW),math.sin(YAW)
    result=[]
    for x,z in points:
        dx=x-ANCHORS['anchor']['x'];dz=z-ANCHORS['anchor']['z']
        result.append((dx*c-dz*s,-(dx*s+dz*c)))
    return result


PODIUM = local_polygon(ANCHORS['podiumFootprint'])


def perimeter_limit(theta):
    # A radial intersection keeps every balcony inside the source podium site.
    dx,dy=math.sin(theta),-math.cos(theta)
    lengths=[]
    for i,a in enumerate(PODIUM):
        b=PODIUM[(i+1)%len(PODIUM)];sx=b[0]-a[0];sy=b[1]-a[1]
        den=dx*sy-dy*sx
        if abs(den)<1e-8:continue
        t=(a[0]*sy-a[1]*sx)/den;u=(a[0]*dy-a[1]*dx)/den
        if t>0 and 0<=u<=1:lengths.append(t)
    return min(lengths)-.12 if lengths else 12


def contour(height, count, inset=0, facial=True):
    result=[]
    for i in range(count):
        t=i/count*TAU;angle=math.atan2(math.sin(t),math.cos(t))
        # Forehead and scalp taper, cheek bones, eye sockets, bridge/tip of nose,
        # separated moustache/lip and vertically scalloped beard are all formed
        # in the balcony perimeter, as in the architect's sculptural approach.
        top=max(0,(height-66)/19)
        rx=10.7*(1-.28*top*top)
        depth=12.2*(1-.3*top*top)
        r=1/math.sqrt((math.sin(t)/rx)**2+(math.cos(t)/depth)**2)
        frontal=gauss(angle,0,.92)
        nose=4.5*gauss(height,55,6)*gauss(angle,0,.17)
        eyes=-2.6*gauss(height,64,2.6)*(gauss(angle,.42,.2)+gauss(angle,-.42,.2))
        brow=1.05*gauss(height,68,2.5)*frontal
        cheeks=.85*gauss(height,56,7)*(gauss(angle,.57,.3)+gauss(angle,-.57,.3))
        mouth=-1.7*gauss(height,45,2)*gauss(angle,0,.34)
        lip=.8*gauss(height,47.5,1.8)*gauss(angle,0,.4)
        beard=(1.5+.52*math.cos(17*angle))*gauss(height,34,11)*frontal
        ears=1.3*gauss(height,59,6)*(gauss(angle,1.45,.2)+gauss(angle,-1.45,.2))
        if facial:r+=nose+eyes+brow+cheeks+mouth+lip+beard+ears
        shoulder=max(0,1-height/30)**1.5
        r=r*(1-shoulder)+perimeter_limit(t)*shoulder
        r=max(2,min(r,perimeter_limit(t)))-inset
        result.append((r*math.sin(t),-r*math.cos(t)))
    return result


def ring(name, path, low, high, material='porcelain', inset=0, closed=False, sheet=False):
    # Closed slabs use complete top/bottom faces; balustrades are thin annuli.
    n=len(path)
    verts=[(x,y,z) for z in [low,high] for x,y in path]
    faces=[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    if closed:
        faces.extend([tuple(range(n-1,-1,-1)),tuple(range(n,2*n))])
    elif not sheet:
        inner=[]
        for x,y in path:
            r=math.hypot(x,y);inner.append((x*(r-inset)/r,y*(r-inset)/r))
        verts.extend((x,y,z) for z in [low,high] for x,y in inner)
        for i in range(n):
            j=(i+1)%n
            faces.extend([(2*n+j,2*n+i,3*n+i,3*n+j),(n+i,n+j,3*n+j,3*n+i),(j,i,2*n+i,2*n+j)])
    return mesh(name,verts,faces,material)


def shrub(x,y,z,seed):
    # A few shared-looking leaf masses are merged by material at export; no
    # alpha cards, per-plant materials or individual runtime draw calls.
    for j in range(3):
        a=(seed*.7+j*2.2);r=.24+.08*math.sin(seed+j)
        cx=x+math.cos(a)*.27;cy=y+math.sin(a)*.27;h=.55+.2*math.cos(seed+j)
        verts=[(cx,cy,z+h+.3),(cx,cy,z-.1)]+[(cx+math.cos(i/6*TAU)*r,cy+math.sin(i/6*TAU)*r,z+h*.45) for i in range(6)]
        faces=[]
        for i in range(6):faces.extend([(0,2+i,2+(i+1)%6),(1,2+(i+1)%6,2+i)])
        mesh('Native Mediterranean balcony shrub',verts,faces,'leaves',True)


def build(detail):
    reset();n=64 if detail else 16
    collisions=[]
    # One retail floor, four office floors, twenty residential floors.
    height=85;step=height/25
    for floor in range(25):
        base=floor*step;top=(floor+1)*step
        path=contour(top,n)
        ring(f'Storey {floor+1:02} sculpted balcony slab',path,top-.25,top,closed=True)
        # Interior glazing remains rational behind the sculpted balconies; it
        # must not inherit the nose or bridge across the recessed eye sockets.
        core=contour(top,n,3.7 if floor>=5 else 1.5,facial=False)
        ring(f'Storey {floor+1:02} recessed glazing',core,base+.08,top-.25,'recessed-glazing',sheet=True)
        if detail:
            # Exact mesh contours also drive every game collision consumer.
            # Do not reuse the obsolete full-height OSM placeholder prisms.
            collisions.extend([
                {'part':f'core-{floor:02}','minY':base+.08,'h':top-.25,'p':core},
                {'part':f'slab-{floor:02}','minY':top-.25,'h':top,'p':path},
            ])
        if floor==24:continue
        if detail:
            ring(f'Storey {floor+1:02} milk-white glass gradient',path,top,top+.62,'gradient-low',sheet=True)
            ring(f'Storey {floor+1:02} upper glass gradient',path,top+.62,top+1.08,'gradient-high',sheet=True)
            ring(f'Storey {floor+1:02} slim handrail',path,top+1.075,top+1.11,'aluminium',.045)
            inner=[(x*(1-.045/math.hypot(x,y)),y*(1-.045/math.hypot(x,y))) for x,y in path]
            collisions.append({'part':f'guard-{floor:02}','minY':top,'h':top+1.11,'p':path,'holes':[inner]})
            led=[(x*.996,y*.996) for x,y in path]
            ring(f'Storey {floor+1:02} underside LED',led,top-.3,top-.265,'balcony-led',.06)
            for i in range(0,n,3):
                x,y=core[i]
                box('Window vertical mullion',x,y,base+step/2,.065,.065,step-.3,'aluminium')
            for i in range(0,n,12):
                x,y=path[(i+floor*2)%n];r=math.hypot(x,y);x*=1-.7/r;y*=1-.7/r
                box('Built-in balcony planter',x,y,top+.27,1.0,.8,.53)
                box('Planter soil',x,y,top+.545,.86,.67,.025,'soil')
                shrub(x,y,top+.55,floor*8+i)
            for i in range(0,n,4):
                x,y=path[i];box('Glass panel joint',x,y,top+.53,.018,.018,1.05,'aluminium')
        else:
            # Milk glass and slab merge to one pale material at distance.
            ring(f'Storey {floor+1:02} pale guard',path,top,top+.87,'porcelain',sheet=True)
    if detail:
        path=contour(step,n,1.5,facial=False)
        for i in range(0,n,8):
            x,y=path[i];box('Retail entrance frame',x,y,1.6,.14,.14,3.2,'aluminium')
        for x in [-1.4,1.4]:
            # Entrance faces the square, set back behind the ground-floor edge.
            intersections=[]
            for i,a in enumerate(path):
                b=path[(i+1)%len(path)]
                if min(a[0],b[0])<=x<=max(a[0],b[0]) and abs(b[0]-a[0])>1e-8:
                    intersections.append(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]))
            box('Retail double door pull',x,min(intersections)-.065,1.4,.045,.06,.65,'aluminium')
    export('near' if detail else 'far',detail)
    if detail:
        # Blender XY -> Three XZ. Heights are relative to the exported asset;
        # the runtime adds the group's ground datum exactly once.
        for solid in collisions:
            solid['p']=[[round(x,5),round(-y,5)] for x,y in solid['p']]
            if 'holes' in solid:solid['holes']=[[[round(x,5),round(-y,5)] for x,y in hole] for hole in solid['holes']]
        (RUNTIME/'skanderbeg-building-collision.mjs').write_text('// Exact authored mesh contours, regenerated by tools/blender/tirana_skanderbeg_building.py\nexport default '+json.dumps(collisions,separators=(',',':'))+';\n')


def export(level, editable):
    if editable:
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'skanderbeg-building.blend'),compress=True)
    groups={}
    for obj in list(bpy.context.scene.objects):
        if obj.type=='MESH':groups.setdefault(obj.data.materials[0].name,[]).append(obj)
    for material,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
        bpy.context.object.name='Skanderbeg Building '+material
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'skanderbeg-building-{level}.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_materials='EXPORT')
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    metrics[level]={'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects),'drawCalls':len(objects),'bytes':(OUT/f'skanderbeg-building-{level}.glb').stat().st_size}
    if level=='far':
        # Exact same Blender-evaluated distant model is available synchronously:
        # opening the game or a failed network request never shows a blank site.
        data={'parts':[]}
        for obj in objects:
            obj.data.calc_loop_triangles();positions=[];normals=[]
            for tri in obj.data.loop_triangles:
                for i in tri.vertices:
                    v=obj.matrix_world@obj.data.vertices[i].co
                    normal=obj.matrix_world.to_3x3()@tri.normal
                    positions.extend([round(v.x,4),round(v.z,4),round(-v.y,4)])
                    normals.extend([round(normal.x,4),round(normal.z,4),round(-normal.y,4)])
            data['parts'].append({'material':obj.data.materials[0].name,'color':list(obj.data.materials[0].diffuse_color[:3]),'positions':positions,'normals':normals})
        (RUNTIME/'skanderbeg-building-far.mjs').write_text('// Blender-evaluated distant sculpture. Regenerate with tools/blender/tirana_skanderbeg_building.py\nexport default '+json.dumps(data,separators=(',',':'))+';\n')


build(True);build(False)
(SOURCE/'metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
print('SKANDERBEG_BUILDING_METRICS',json.dumps(metrics))
