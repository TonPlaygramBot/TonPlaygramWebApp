"""Create editable Blender source and GLBs from the SAME game asset recipes.

Run (Blender 4.2+):
  node webapp/scripts/export-tirana-detail-recipes.mjs /tmp/tirana-recipes.json
  blender --background --python webapp/scripts/blender/build_tirana_details.py -- \
    /tmp/tirana-recipes.json /tmp/tirana-detail-assets

No third-party meshes, map imagery, fonts or dependencies are downloaded.
"""
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix


def linear(value):
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(args) != 2:
        raise SystemExit('Expected recipe JSON and output directory after --')
    source, output = Path(args[0]), Path(args[1])
    data = json.loads(source.read_text())
    if data.get('schemaVersion') != 1 or data.get('coordinateSystem') != 'three-y-up':
        raise ValueError('Unsupported recipe schema')
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1
    materials = {}
    for name, params in data['palette'].items():
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        node = material.node_tree.nodes.get('Principled BSDF')
        color = params['color']
        rgb = [linear(((color >> shift) & 255) / 255) for shift in (16, 8, 0)]
        node.inputs['Base Color'].default_value = (*rgb, 1)
        node.inputs['Roughness'].default_value = params['roughness']
        node.inputs['Metallic'].default_value = params['metalness']
        materials[name] = material
    # Coordinate conversion preserves the same appearance after glTF's Y-up export.
    basis = Matrix.Rotation(math.pi / 2, 4, 'X')
    records = []
    for asset_id, asset in data['assets'].items():
        collection = bpy.data.collections.new(asset_id)
        bpy.context.scene.collection.children.link(collection)
        objects = []
        for index, part in enumerate(asset['parts']):
            if part['kind'] == 'box':
                bpy.ops.mesh.primitive_cube_add(size=1)
                primitive = Matrix.Diagonal((*part['s'], 1))
            elif part['kind'] == 'cylinder':
                bpy.ops.mesh.primitive_cone_add(vertices=part['segments'], radius1=part['radius'], radius2=part['top'], depth=part['height'])
                primitive = Matrix.Rotation(-math.pi / 2, 4, 'X')
            else:
                raise ValueError('Unknown primitive kind')
            obj = bpy.context.object
            obj.name = f'{asset_id}:{index:03d}'
            for old in list(obj.users_collection):
                old.objects.unlink(obj)
            collection.objects.link(obj)
            rotation = Matrix.Identity(4)
            for axis, angle in zip('XYZ', part['r']):
                rotation = rotation @ Matrix.Rotation(angle, 4, axis)
            obj.matrix_world = basis @ Matrix.Translation(part['p']) @ rotation @ primitive
            obj.data.materials.append(materials[part['m']])
            obj['source'] = 'Original TonPlaygram urban-detail recipe'
            obj['accuracy'] = 'Artistic module, not a surveyed fixture'
            objects.append(obj)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.hide_set(False)
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.export_scene.gltf(filepath=str(output / f'{asset_id}.glb'), export_format='GLB', use_selection=True, export_yup=True, export_extras=True)
        records.append({'id': asset_id, 'category': asset['category'], 'parts': len(objects)})
        # Collections are isolated in the editable file, not translated into a grid.
        for obj in objects:
            obj.hide_set(True)
    if records:
        for obj in bpy.data.collections[records[0]['id']].objects:
            obj.hide_set(False)
    bpy.ops.wm.save_as_mainfile(filepath=str(output / 'tirana-urban-details.blend'))
    (output / 'blender-export-manifest.json').write_text(json.dumps({'blender': bpy.app.version_string, 'assets': records}, indent=2))


if __name__ == '__main__':
    main()
