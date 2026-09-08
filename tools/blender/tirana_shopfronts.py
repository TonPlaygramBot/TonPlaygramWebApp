"""Blender 4.x authoring/render pipeline for the original Tirana shopfronts.
Run: blender --background --python tools/blender/tirana_shopfronts.py -- \
     --assets artifacts/tirana-shopfronts --output artifacts/tirana-blender
The glTF exporter is run first with webapp/scripts/export-tirana-shopfronts.mjs.
No Google imagery, extracted geometry or third-party models are imported.
"""
from __future__ import annotations
import argparse
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

BRANDS = ('lana', 'drita', 'lagjja', 'velo')

def material(name: str, colour: tuple, roughness: float = 0.55, metal: float = 0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = colour
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metal
    return m

def cube(name: str, location: tuple, scale: tuple, mat, bevel: float = 0.035):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new('Machined edge', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 3
        obj.modifiers.new('Weighted corners', 'WEIGHTED_NORMAL')
    return obj

def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

def area(name, position, energy, size, target):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size = energy, 'DISK', size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    aim(obj, target)
    return obj

def sphere(name, location, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj

def product_scene(output: Path):
    """Original studio still-life, separately rendered; not a real shop photo."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    ceramic = material('Warm porcelain', (0.80, 0.77, 0.67, 1), 0.22)
    coffee = material('Coffee', (0.045, 0.019, 0.007, 1), 0.19)
    stone = material('Studio stone', (0.09, 0.14, 0.12, 1), 0.8)
    # Revolved cup profile, with real thickness rather than a solid cylinder.
    profile = [(0.0, 0.06), (0.25, 0.06), (0.31, 0.12), (0.35, 0.64),
               (0.33, 0.67), (0.305, 0.64), (0.27, 0.14), (0.0, 0.14)]
    vertices, faces, segments = [], [], 96
    for radius, z in profile:
        vertices.extend((radius*math.cos(i*2*math.pi/segments),
                         radius*math.sin(i*2*math.pi/segments), z) for i in range(segments))
    for j in range(len(profile)-1):
        for i in range(segments):
            k = (i+1) % segments
            faces.append((j*segments+i, j*segments+k, (j+1)*segments+k, (j+1)*segments+i))
    mesh = bpy.data.meshes.new('Revolved cup mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    cup = bpy.data.objects.new('Original porcelain cup', mesh)
    bpy.context.collection.objects.link(cup)
    cup.data.materials.append(ceramic)
    for p in mesh.polygons:
        p.use_smooth = True
    bpy.ops.mesh.primitive_torus_add(major_segments=64, minor_segments=16,
                                   location=(0.34, 0, 0.37), rotation=(math.pi/2, 0, 0),
                                   major_radius=0.20, minor_radius=0.045)
    bpy.context.object.data.materials.append(ceramic)
    sphere('Coffee surface', (0, 0, 0.60), (0.32, 0.32, 0.012), coffee)
    sphere('Porcelain saucer', (0, 0, 0.035), (0.58, 0.58, 0.035), ceramic)
    cube('Studio tabletop', (0, 0, -0.09), (200, 200, 0.1), stone)
    area('Key softbox', (-2, -2, 4), 450, 3, (0, 0, 0.3))
    area('Rim softbox', (2, 1, 3), 260, 2, (0, 0, 0.4))
    camera_data = bpy.data.cameras.new('Product camera')
    camera = bpy.data.objects.new('Product camera', camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (1.8, -2.6, 1.65)
    aim(camera, (0, 0, 0.33))
    camera_data.lens = 70
    bpy.context.scene.camera = camera
    bpy.context.scene.render.resolution_x = 2048
    bpy.context.scene.render.resolution_y = 1024
    bpy.context.scene.render.filepath = str(output / 'original-coffee-studio.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(output / 'original-coffee-studio.blend'))
    bpy.ops.render.render(write_still=True)

def main():
    args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assets', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--samples', type=int, default=64)
    opts = parser.parse_args(args)
    if not 1 <= opts.samples <= 256:
        raise ValueError('Samples must be between 1 and 256')
    for brand in BRANDS:
        if not (opts.assets / f'{brand}.gltf').is_file():
            raise FileNotFoundError(f'Missing {brand}.gltf: run the Node exporter first')
    output = opts.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = opts.samples
    scene.cycles.use_denoising = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.3, 0.4, 0.48, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0.4
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    stone = material('Authored warm plaster', (0.63, 0.58, 0.49, 1), 0.91)
    asphalt = material('Asphalt', (0.08, 0.095, 0.10, 1), 0.94)
    for index, brand in enumerate(BRANDS):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str((opts.assets / f'{brand}.gltf').resolve()))
        imported = set(bpy.data.objects) - before
        for obj in imported:
            if obj.parent not in imported:
                obj.location.x += index * 7
        cube(f'{brand} example wall — not Tirana survey', (index*7, 0.18, 3.5), (6.7, 0.35, 7), stone)
    cube('Pavement', (10.5, -2, -0.12), (40, 12, 0.2), asphalt)
    area('Courtyard sky', (8, -6, 14), 3500, 10, (10, 0, 4))
    camera_data = bpy.data.cameras.new('Shopfront camera')
    camera = bpy.data.objects.new('Shopfront camera', camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (13.5, -27, 10)
    aim(camera, (10.5, 0, 3.4))
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 31
    scene.camera = camera
    scene.render.resolution_x, scene.render.resolution_y = 2560, 1440
    scene.render.filepath = str(output / 'original-shopfront-gallery.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(output / 'original-shopfronts.blend'))
    bpy.ops.render.render(write_still=True)
    product_scene(output)

if __name__ == '__main__':
    main()
