"""Portrait asset review of the editable Skanderbeg Building source (CPU)."""
import bpy
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/validation/tirana-september-repair'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets-source/tirana-skanderbeg-building/skanderbeg-building.blend'))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.world=bpy.data.worlds.new('Soft Tirana daylight');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.66,.74,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
bpy.ops.object.light_add(type='SUN',location=(30,-60,100));bpy.context.object.data.energy=2.3;bpy.context.object.rotation_euler=(.55,-.48,-.4)
bpy.ops.object.camera_add(location=(-58,-140,16));camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,42))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='PERSP';camera.data.lens=43;scene.camera=camera
bpy.ops.mesh.primitive_plane_add(size=500,location=(0,0,-.06));ground=bpy.context.object
m=bpy.data.materials.new('Pale square paving');m.diffuse_color=(.4,.41,.39,1);ground.data.materials.append(m)
scene.render.resolution_x=640;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'skanderbeg-building-portrait.png')
bpy.ops.render.render(write_still=True)
