"""Render the editable source for a reproducible asset review. Blender 4.2+."""
import bpy
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/validation/tirana-mobile-upgrade'
OUT.mkdir(parents=True,exist_ok=True)
for name,eye,target in [('namazgah-near',(-105,-130,90),(0,0,17)),('parliament-entry',(-15,-39,19),(0,0,5.5))]:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets-source/tirana-landmark-rebuild'/(name+'.blend')))
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12;scene.cycles.use_denoising=True
    scene.world=bpy.data.worlds.new('Review daylight');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.42,.5,.57,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
    bpy.ops.object.light_add(type='SUN',location=(30,-70,100));bpy.context.object.data.energy=3;bpy.context.object.rotation_euler=(.4,-.35,-.3)
    bpy.ops.object.camera_add(location=eye);camera=bpy.context.object;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=116 if name.startswith('namazgah') else 28;scene.camera=camera
    bpy.ops.mesh.primitive_plane_add(size=350,location=(0,0,-.08));ground=bpy.context.object;m=bpy.data.materials.new('Review ground');m.diffuse_color=(.19,.23,.2,1);ground.data.materials.append(m)
    scene.render.resolution_x=960;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/(name+'.png'))
    bpy.ops.render.render(write_still=True)
