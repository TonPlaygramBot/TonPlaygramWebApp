import bpy, math, os
from mathutils import Vector
from pathlib import Path
root=str(Path(__file__).resolve().parents[1])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=root+'/webapp/public/assets/jetski-royal/watercraft.glb')
for obj in bpy.context.selected_objects:
 if obj.type=='MESH':
  for p in obj.data.polygons:p.use_smooth=True
# Original glTF becomes Z-up in Blender; the bow points +X.
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,.05));water=bpy.context.object
mat=bpy.data.materials.new('Adriatic water');mat.use_nodes=True
n=mat.node_tree.nodes;l=mat.node_tree.links;bs=n.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.008,.23,.28,1);bs.inputs['Roughness'].default_value=.16;bs.inputs['Metallic'].default_value=.25
noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=5;noise.inputs['Detail'].default_value=3
bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.35;bump.inputs['Distance'].default_value=.08;l.new(noise.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],bs.inputs['Normal']);water.data.materials.append(mat)
world=bpy.data.worlds.new('Mediterranean sky');bpy.context.scene.world=world;world.use_nodes=True
sky=world.node_tree.nodes.new('ShaderNodeTexSky');sky.sky_type='NISHITA';sky.sun_elevation=.5;sky.sun_rotation=2;world.node_tree.links.new(sky.outputs['Color'],world.node_tree.nodes['Background'].inputs[0]);world.node_tree.nodes['Background'].inputs[1].default_value=.4
bpy.ops.object.light_add(type='AREA',location=(1,-4,7));bpy.context.object.data.energy=1200;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=5
bpy.ops.object.camera_add(location=(5.1,-5.1,3.1));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.45))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=47;bpy.context.scene.camera=camera
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=False;scene.render.resolution_x=1200;scene.render.resolution_y=760;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='WEBP';scene.render.image_settings.quality=90;scene.render.filepath=root+'/webapp/public/assets/jetski-royal/cover.webp';scene.view_settings.view_transform='AgX';bpy.ops.render.render(write_still=True)
