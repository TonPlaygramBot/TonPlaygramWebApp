"""Reproducible CPU material/model review of the committed Blender scene.
blender -b assets-source/tirana-neighbourhood/neighbourhood.blend --python tools/blender/render_neighbourhood.py
"""
import bpy
from mathutils import Vector
from pathlib import Path
out=Path('/tmp/tirana-neighbourhood-renders');out.mkdir(exist_ok=True)
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True
scene.render.resolution_x=480;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.65,.78,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
scene.view_settings.view_transform='AgX'
camera_data=bpy.data.cameras.new('Review camera');camera=bpy.data.objects.new('Review camera',camera_data);scene.collection.objects.link(camera);scene.camera=camera;camera_data.lens=48
sun_data=bpy.data.lights.new('Afternoon sun','SUN');sun_data.energy=2.3;sun_data.angle=.08;sun=bpy.data.objects.new('Afternoon sun',sun_data);scene.collection.objects.link(sun);sun.rotation_euler=(.35,-.5,-.35)
for name in ['njesia-2','grand','britaniku','produce']:
    for collection in scene.collection.children:collection.hide_render=collection.name!=name
    collection=bpy.data.collections[name]
    objects=[o for o in collection.objects if o.type=='MESH']
    points=[o.matrix_world@Vector(p) for o in objects for p in o.bound_box]
    minimum=Vector(tuple(min(p[i] for p in points) for i in range(3)));maximum=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    center=(minimum+maximum)/2;span=max(maximum-minimum)
    camera.location=center+Vector((span*.95,-span*1.45,span*.8));camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
print('RENDERED',out)
