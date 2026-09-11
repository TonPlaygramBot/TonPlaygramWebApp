"""Blender exporter for source-derived Tirana authoring tiles.

blender --background --python webapp/scripts/blender/build_tirana_region.py -- \
  blender-scene.json webapp/public/assets/tirana-streets OUTPUT_DIRECTORY

Run prepare-tirana-blender.mjs first. Output includes editable .blend collections,
glTF with shared Poly Haven PBR textures and a manifest. It remains REVIEW ONLY:
the input has no terrain datum or verified per-building facade survey.
"""
import hashlib
import json
from pathlib import Path
import sys
import bpy


def plaster_material(assets):
    registry = json.loads((assets / 'materials/sources.json').read_text())
    files = {entry['file']: entry for entry in registry}
    material = bpy.data.materials.new('Poly Haven plastered_wall_02 • generic proxy')
    material.use_nodes = True
    tree = material.node_tree
    shader = tree.nodes.get('Principled BSDF')
    for suffix, target in [('diff', 'Base Color'), ('rough', 'Roughness'), ('nor_gl', 'Normal')]:
        relative = f'materials/plastered_wall_02-{suffix}.jpg'
        entry = files[relative]
        path = assets / relative
        if entry['license'] != 'CC0-1.0' or hashlib.sha256(path.read_bytes()).hexdigest() != entry['sha256']:
            raise ValueError(f'Material provenance mismatch: {relative}')
        node = tree.nodes.new('ShaderNodeTexImage')
        node.image = bpy.data.images.load(str(path), check_existing=True)
        node.image.colorspace_settings.name = 'sRGB' if suffix == 'diff' else 'Non-Color'
        node.extension = 'REPEAT'
        if suffix == 'nor_gl':
            normal = tree.nodes.new('ShaderNodeNormalMap')
            tree.links.new(node.outputs['Color'], normal.inputs['Color'])
            tree.links.new(normal.outputs['Normal'], shader.inputs['Normal'])
        else:
            tree.links.new(node.outputs['Color'], shader.inputs[target])
    material['source'] = 'https://polyhaven.com/a/plastered_wall_02'
    material['license'] = 'CC0-1.0'
    material['accuracy'] = 'Material proxy only; not the surveyed appearance of each building'
    return material


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(args) != 3:
        raise ValueError('Expected SCENE_JSON ASSETS_DIRECTORY OUTPUT_DIRECTORY after --')
    source, assets, output = map(lambda p: Path(p).resolve(), args)
    scene = json.loads(source.read_text())
    if scene.get('stage') != 'blender-source-review' or scene.get('runtimeReady') is not False:
        raise ValueError('Expected a source review scene')
    temporary = output.with_name(output.name + '.incomplete')
    if output.exists() or temporary.exists():
        raise ValueError('Choose a fresh output directory; existing authoring work is never overwritten')
    # Check the installed exporter supports linework before writing any output.
    properties = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    if 'use_mesh_edges' not in properties:
        raise RuntimeError('This Blender glTF exporter cannot preserve source footprint/road linework')
    material = plaster_material(assets)
    temporary.mkdir(parents=True)
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1.0
    manifests = []
    for tile in scene['tiles']:
        for obj in list(bpy.data.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        for mesh in list(bpy.data.meshes):
            if mesh.users == 0:
                bpy.data.meshes.remove(mesh)
        for item in tile['objects']:
            mesh = bpy.data.meshes.new(item['name'])
            # WORLD x east/y up/z south -> Blender x east/y north/z up.
            vertices = [(x, -z, y) for x, y, z in item['vertices']]
            mesh.from_pydata(vertices, item['edges'], item['faces'])
            mesh.update()
            if mesh.polygons:
                uv = mesh.uv_layers.new(name='UVMap')
                for polygon in mesh.polygons:
                    for loop_index in polygon.loop_indices:
                        uv.data[loop_index].uv = item['uv'][mesh.loops[loop_index].vertex_index]
            obj = bpy.data.objects.new(item['name'], mesh)
            bpy.context.scene.collection.objects.link(obj)
            if item['material'] == 'plaster-proxy':
                mesh.materials.append(material)
            obj['sourceMetadata'] = json.dumps(item['extras'], ensure_ascii=False)
            obj['tileOriginXZ'] = tile['origin']
            obj['runtimeReady'] = False
        name = 'tile_' + tile['id']
        bpy.context.scene['source'] = json.dumps(scene['source'], ensure_ascii=False)
        bpy.context.scene['verticalDatum'] = scene['verticalDatum']
        # Pack a self-contained editable Blender file; glTF textures are emitted
        # separately and shared by filename between all tiles in this directory.
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=str(temporary / (name + '.blend')))
        bpy.ops.export_scene.gltf(filepath=str(temporary / (name + '.gltf')),
            export_format='GLTF_SEPARATE', export_texture_dir='textures',
            export_yup=True, export_texcoords=True, export_normals=True,
            export_materials='EXPORT', export_extras=True, use_mesh_edges=True)
        manifests.append({'id': tile['id'], 'position': [tile['origin'][0], 0, tile['origin'][1]],
                          'gltf': name + '.gltf', 'blend': name + '.blend'})
    manifest = {key: value for key, value in scene.items() if key != 'tiles'}
    manifest.update(tiles=manifests, blenderVersion=bpy.app.version_string)
    (temporary / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    temporary.rename(output)
    print(f'Exported {len(manifests)} Blender/glTF authoring tiles to {output}; REVIEW ONLY')


if __name__ == '__main__':
    main()
