"""Blender 4.5: continuous OSM pavements and an original urban prop kit.
Prepare layout with export-tirana-street-layout.mjs; pass its JSON path as argv[-1].
Requires bpy and Shapely 2.1. No Google geometry is read or stored.
"""
import bpy, json, math, sys, os, runpy
from pathlib import Path
from mathutils import Vector
from shapely.geometry import LineString, Polygon, Point, box as sbox
from shapely.ops import unary_union
from shapely import constrained_delaunay_triangles

BASE=Path(__file__).resolve().parent.parent/'public/assets/tirana-streets'
ART=Path(__file__).resolve().parent.parent/'art/tirana-streets';ART.mkdir(parents=True,exist_ok=True)
data=json.loads(Path(sys.argv[-1]).read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.unit_settings.system='METRIC'
def material(name,color,rough=.75,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
paving=material('Scanned concrete pavers',(.72,.69,.64))
for channel,target in [('diff','Base Color'),('rough','Roughness'),('nor_gl','Normal')]:
 tex=paving.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(BASE/'materials'/f'pavement_02-{channel}.jpg'))
 if channel!='diff':tex.image.colorspace_settings.name='Non-Color'
 source=tex.outputs['Color']
 if channel=='nor_gl':
  normal=paving.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.7;paving.node_tree.links.new(source,normal.inputs['Color']);source=normal.outputs['Normal']
 paving.node_tree.links.new(source,paving.node_tree.nodes.get('Principled BSDF').inputs[target])
stone=material('Fine concrete edges',(.58,.6,.57),.94)
steel=material('Brushed graphite steel',(.075,.095,.105),.43,.72)
silver=material('Galvanized steel',(.35,.39,.41),.4,.78)
wood=material('Weathered timber slats',(.25,.12,.055),.84)
green=material('Living shrub leaves',(.12,.25,.065),.9)
soil=material('Dark planter soil',(.085,.06,.035),1)
red=material('Hydrant enamel',(.52,.07,.035),.38,.3)
tactile=material('Ochre tactile pavers',(.63,.47,.18),.85)
glass=material('Shelter laminated glass',(.22,.38,.39),.16,.12)
glass.diffuse_color=(.22,.38,.39,.24);glass.surface_render_method='DITHERED';glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.24
def empty(name):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);return o
def parent(obj,root,mat):
 obj.parent=root;obj.data.materials.append(mat);return obj
def cube(root,mat,loc,scale,bevel=.015):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);parent(o,root,mat)
 if bevel:
  b=o.modifiers.new('Soft manufactured edges','BEVEL');b.width=bevel;b.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=b.name)
 return o
def cylinder(root,mat,loc,r,depth,rotation=(0,0,0),vertices=12):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc,rotation=rotation);return parent(bpy.context.object,root,mat)
def join_parts(root):
 # Material batching and applied transforms preserve repeatable local prototypes.
 for mat in set(o.data.materials[0] for o in root.children if o.type=='MESH'):
  bpy.ops.object.select_all(action='DESELECT');parts=[o for o in root.children if o.type=='MESH' and o.data.materials[0]==mat]
  for o in parts:o.select_set(True)
  bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object;o.name=root.name+' '+mat.name
  bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)

road_paths=[(LineString([r['a'],r['b']]),r['w']) for r in data['roads'] if not r['walk']]
road=unary_union([p.buffer(w/2+.08,quad_segs=3) for p,w in road_paths])
outer=unary_union([p.buffer(w/2+2.4,quad_segs=3) for p,w in road_paths])
buildings=unary_union([Polygon(b['p']).buffer(.05) for b in data['buildings'] if len(b['p'])>=3])
shop=data['shop'];excluded=sbox(shop['x']-5.12,shop['z']-4.35,shop['x']+5.12,shop['z']+4.35)
river=unary_union([LineString(r['line']).buffer(r['width']/2+.05,quad_segs=3) for r in data['water']])
bridge=unary_union([LineString([r['a'],r['b']]).buffer(r['w']/2+2.5,cap_style=2) for r in data['roads'] if r.get('bridge')])
network=outer.difference(road).difference(buildings).difference(excluded).difference(river.difference(bridge)).buffer(0).simplify(.018,preserve_topology=True)
curbs=road.buffer(.17,quad_segs=2).difference(road).intersection(network).buffer(0)
ramps=unary_union([Point(s['x'],s['z']).buffer(s['width']/2+2.9,quad_segs=10) for s in data['signals']])
low=unary_union([Point(s['x'],s['z']).buffer(s['width']/2+2.0,quad_segs=10) for s in data['signals']])
def height(x,z):
 value=.23
 for s in data['signals']:
  distance=math.hypot(x-s['x'],z-s['z'])-s['width']/2-2
  if distance<.9:value=min(value,.115+.115*max(0,distance)/.9)
 return value
def polygons(geom):
 if geom.is_empty:return []
 if geom.geom_type=='Polygon':return [geom]
 return [p for part in geom.geoms for p in polygons(part)]
root=empty('pavement_network');triangles=0;cells=0
minx,minz,maxx,maxz=network.bounds
for x in range(math.floor(minx/100)*100,math.ceil(maxx/100)*100,100):
 for z in range(math.floor(minz/100)*100,math.ceil(maxz/100)*100,100):
  bounds=sbox(x,z,x+100,z+100)
  for name,geom,mat in [('pavers',network,paving),('curb',curbs,stone)]:
   portion=geom.intersection(bounds);vs=[];fs=[]
   # Constrain ramp boundaries, so sloping faces cannot bridge over the lowered crossing.
   regions=[portion.difference(ramps),portion.intersection(ramps).difference(low),portion.intersection(low)]
   for region in regions:
    for poly in polygons(region):
     if poly.area<.015:continue
     for tri in constrained_delaunay_triangles(poly).geoms:
      points=list(tri.exterior.coords)[:3];i=len(vs);vs.extend([(px,-pz,height(px,pz)+(0.008 if name=='curb' else 0)) for px,pz in points])
      a,b,c=points;cross=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);fs.append((i,i+2,i+1) if cross>0 else (i,i+1,i+2));triangles+=1
     if name=='curb':
      for ring in [poly.exterior,*poly.interiors]:
       pts=list(ring.coords)
       for a,b in zip(pts,pts[1:]):
        i=len(vs);vs.extend([(a[0],-a[1],.095),(b[0],-b[1],.095),(b[0],-b[1],height(*b)+.008),(a[0],-a[1],height(*a)+.008)]);fs.append((i,i+1,i+2,i+3))
   if not fs:continue
   mesh=bpy.data.meshes.new(f'{name}_{x}_{z}');mesh.from_pydata(vs,[],fs);mesh.update();uv=mesh.uv_layers.new()
   for face in mesh.polygons:
    for li in face.loop_indices:
     v=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(v.x/2.1,v.y/2.1)
   obj=bpy.data.objects.new(mesh.name,mesh);scene.collection.objects.link(obj);parent(obj,root,mat);cells+=1

kit=[]
g=empty('bus_shelter');kit.append(g)
for x in [-1.95,1.95]:
 for y in [-.7,.7]:cube(g,steel,(x,y,1.32),(.075,.075,2.64))
cube(g,steel,(0,0,2.67),(4.25,1.75,.13));cube(g,glass,(0,.72,1.45),(3.85,.02,2.16),0)
for x in [-1.95,1.95]:cube(g,glass,(x,0,1.45),(.02,1.36,2.16),0)
for i in range(4):cube(g,wood,(0,.23+i*.11,.48),(2.55,.085,.055))
for x in [-1,1]:cube(g,steel,(x,.39,.25),(.08,.43,.5))
cube(g,steel,(-1.52,.68,1.45),(.62,.07,.94));cube(g,tactile,(-1.52,.63,1.45),(.54,.012,.85),0)
g=empty('bicycle_rack');kit.append(g)
for x in [-.75,0,.75]:
 for y in [-.32,.32]:cylinder(g,silver,(x,y,.4),.034,.8)
 cylinder(g,silver,(x,0,.8),.034,.64,(math.pi/2,0,0))
for y in [-.32,.32]:cube(g,steel,(0,y,.04),(1.9,.13,.08))
g=empty('utility_cabinet');kit.append(g)
cube(g,stone,(0,0,.09),(1,.55,.18));cube(g,steel,(0,0,.75),(.87,.43,1.3))
for x in [-.215,.215]:
 cube(g,silver,(x,-.225,.75),(.395,.018,1.17),.007)
 for z in [.4,.46,.52,.58]:cube(g,steel,(x,-.241,z),(.27,.01,.012),0)
 cylinder(g,steel,(x+.11,-.25,.87),.025,.015,(math.pi/2,0,0))
g=empty('stone_planter');kit.append(g)
cube(g,stone,(0,0,.35),(1.2,1.2,.7),.05);cube(g,soil,(0,0,.72),(1.02,1.02,.06),.03)
for i in range(48):
 a=i*2.399;r=.46*math.sqrt((i+.5)/48);loc=(math.cos(a)*r,math.sin(a)*r,.88+.24*math.cos(i*1.76)**2)
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.16,location=loc);o=parent(bpy.context.object,g,green);o.scale=(1,.85,1.4)
g=empty('hydrant');kit.append(g)
cylinder(g,red,(0,0,.4),.13,.8);cylinder(g,steel,(0,0,.09),.2,.08)
bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.145,location=(0,0,.79));parent(bpy.context.object,g,red)
for x in [-.19,.19]:cylinder(g,red,(x,0,.58),.082,.2,(0,math.pi/2,0));cylinder(g,steel,(x*1.45,0,.58),.092,.04,(0,math.pi/2,0))
g=empty('manhole_cover');kit.append(g)
cylinder(g,steel,(0,0,.008),.37,.016,vertices=32);cylinder(g,silver,(0,0,.013),.32,.01,vertices=32)
for x in [-.21,-.14,-.07,0,.07,.14,.21]:cube(g,steel,(x,0,.022),(.022,.43,.009),0)
g=empty('tactile_tile');kit.append(g)
cube(g,tactile,(0,0,.018),(1,.55,.035),.005)
for x in [-.4,-.2,0,.2,.4]:
 for y in [-.18,0,.18]:cylinder(g,tactile,(x,y,.041),.027,.014,vertices=8)
for g in kit:join_parts(g)
# Additional foreground props receive shared, simple collision footprints in streetDressing.mjs.
for image in bpy.data.images:
 if image.filepath:
  image.filepath='//'+os.path.relpath(image.filepath,ART)
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'tirana-street-kit.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(BASE/'street-kit.glb'),export_format='GLB',export_yup=True,export_apply=True,export_image_format='AUTO',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_draco_position_quantization=18,export_draco_normal_quantization=10,export_draco_texcoord_quantization=16)
runpy.run_path(str(Path(__file__).with_name('externalize-street-textures.py')))['externalize'](BASE/'street-kit.glb')
summary={'pavementCells':cells,'pavementTriangles':triangles,'pavementAreaM2':round(network.area),'propModels':[g.name for g in kit]}
(BASE/'street-kit-metrics.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary),flush=True)

# A genuine CPU render of these modeled assets for authoring inspection (not a game screenshot).
for o in root.children_recursive:o.hide_render=True
for i,g in enumerate(kit):
 g.location=(i*5,0,0)
 for o in g.children_recursive:o.hide_render=i>3
bpy.ops.mesh.primitive_plane_add(size=200,location=(7,0,-.01));ground=bpy.context.object;ground.data.materials.append(paving)
for loop in ground.data.uv_layers.active.data:loop.uv*=50
bpy.ops.object.light_add(type='SUN',location=(-10,-12,20));sun=bpy.context.object;sun.data.energy=2.6;sun.rotation_euler=(.55,-.4,-.4);sun.data.angle=.07
scene.world=bpy.data.worlds.new('Daylight');scene.world.color=(.28,.34,.42)
bpy.ops.object.camera_add(location=(8,-20,10));camera=bpy.context.object;camera.rotation_euler=(Vector((7,0,.8))-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera;camera.data.lens=38
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=20;scene.render.resolution_x=1100;scene.render.resolution_y=780;scene.render.resolution_percentage=100
scene.render.filepath=str(ART/'street-kit-preview.png');bpy.ops.render.render(write_still=True)
