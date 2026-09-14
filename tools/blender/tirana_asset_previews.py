"""Render the actual exported models for non-WebGL review; no concept imagery."""
import bpy, math
from mathutils import Vector
from pathlib import Path
from tirana_mobility import ROOT,reset,mat
OUT=ROOT/'webapp/public/assets/tirana-streets/city-mobility/previews'
OUT.mkdir(exist_ok=True)
for name in ['city-bicycle','mountain-bike','delivery-ebike','city-scooter','street-motorcycle','golf-gti','namazgjah',*[f'signs/{b}' for b in ['conad','mulliri','spar','bkt','credins','raiffeisen','plaza','rogner','vodafone','one','big-market','university-tirana']]]:
 reset()
 bpy.ops.import_scene.gltf(filepath=str(ROOT/f'webapp/public/assets/tirana-streets/city-mobility/{name}.glb'))
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
 corners=[o.matrix_world@Vector(p) for o in objects for p in o.bound_box]
 lo=Vector([min(p[i] for p in corners) for i in range(3)]);hi=Vector([max(p[i] for p in corners) for i in range(3)])
 centre=(lo+hi)/2;span=max(hi-lo)
 if name=='namazgjah':lo.z=0
 for o in bpy.context.scene.objects:
  if o.parent is None:o.location-=Vector((centre.x,centre.y,lo.z))
 bpy.context.view_layer.update()
 bpy.ops.mesh.primitive_plane_add(size=span*200,location=(0,0,-.025))
 floor=bpy.context.object;floor.data.materials.append(mat('Warm pavement',(.29,.33,.3),0,.85))
 bpy.ops.object.camera_add(location=(span*1.22,-span*1.6,span*.82))
 camera=bpy.context.object;target=Vector((0,0,(hi.z-lo.z)*.43));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=span*1.42;bpy.context.scene.camera=camera
 bpy.ops.object.light_add(type='AREA',location=(span*.3,-span*.7,span*2));light=bpy.context.object;light.data.energy=span*span*150;light.data.shape='DISK';light.data.size=span*1.3
 light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
 world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.72,.8,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=20;scene.cycles.use_denoising=True
 scene.render.resolution_x=800;scene.render.resolution_y=600;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=88;scene.render.filepath=str(OUT/(name.replace('/','-')+'.jpg'))
 bpy.ops.render.render(write_still=True)
 print('RENDERED',name,flush=True)
