"""Render packed, evaluated Blender assets for deterministic review (no browser)."""
import bpy,sys,json,gzip,pathlib,math
from mathutils import Vector
root=pathlib.Path(sys.argv[sys.argv.index('--')+1]);data=json.loads(gzip.decompress((root/'assets-source/tirana-east/blender-meshes.json.gz').read_bytes()));selection=json.loads(pathlib.Path('/tmp/east-review-selection.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
mat=bpy.data.materials.new('Blender original vertex finish');mat.use_nodes=True;nodes=mat.node_tree.nodes;v=nodes.new('ShaderNodeVertexColor');v.layer_name='Color';mat.node_tree.links.new(v.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color']);nodes.get('Principled BSDF').inputs['Roughness'].default_value=.8

def mesh(name,p,c,position=(0,0,0),yaw=0):
 verts=[(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)];faces=[(i,i+1,i+2) for i in range(0,len(verts),3)];me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();colour=me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
 for i in range(len(verts)):colour.data[i].color=tuple(c[i*3:i*3+3])+ (1,)
 o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.data.materials.append(mat);o.location=position;o.rotation_euler.z=-yaw;return o
# Layout focused authored kit pieces with source-derived full house massing.
for i,name in enumerate(['house-bay','modern-house-bay','campus-modern-bay','campus-yellow-bay','produce','supermarket','gondola','station','belvedere']):
 m=data['models'][name];x=(i%3)*16;y=(i//3)*30;mesh(name,m['p'],m['c'],(x,y,0))
view=selection['views'][0];house=min(selection['buildings'],key=lambda b:(sum(p[0] for p in b['p'])/len(b['p'])-view['x'])**2+(sum(p[1] for p in b['p'])/len(b['p'])-view['z'])**2)
roof=data['models'].get('roof-'+house['id']);
if roof:mesh('private-house-roof',roof['p'],roof['c'],(50,10,0))
# Support body from the exact source footprint, centred in the same roof frame.
p=house['p'];cx=sum(v[0] for v in p)/len(p);cz=sum(v[1] for v in p)/len(p);h=house['h'];verts=[]
for i,a in enumerate(p):
 b=p[(i+1)%len(p)];v=[(a[0]-cx,0,a[1]-cz),(b[0]-cx,0,b[1]-cz),(b[0]-cx,h,b[1]-cz),(a[0]-cx,h,a[1]-cz)]
 for ids in [(0,1,2),(0,2,3)]:
  for j in ids:verts.extend(v[j])
mesh('private-house-footprint',verts,[.75,.69,.58]*(len(verts)//3),(50,10,0))
bpy.ops.mesh.primitive_plane_add(size=240,location=(20,25,-.1));floor=bpy.context.object;fm=bpy.data.materials.new('ground');fm.diffuse_color=(.18,.23,.16,1);floor.data.materials.append(fm)
bpy.ops.object.light_add(type='AREA',location=(30,-30,65));bpy.context.object.data.energy=120000;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=55
bpy.ops.object.camera_add(location=(115,-135,105));cam=bpy.context.object;cam.rotation_euler=(Vector((23,25,8))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=155;bpy.context.scene.camera=cam
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath='/tmp/tirana-east-blender-review.png';scene.world.color=(.22,.27,.3);bpy.ops.render.render(write_still=True)
