"""Import shared original glTF assets into editable Blender collections.
Run Node exporter first, then:
blender --background --python build_tirana_civic_dajti.py -- ASSET_DIR OUTPUT.blend
This script does not acquire Google geometry, human models or terrain measurements.
"""
import sys
from pathlib import Path
import bpy
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(args) != 2:
    raise SystemExit('Expected ASSET_DIR OUTPUT.blend after --')
source, destination = Path(args[0]).resolve(), Path(args[1]).resolve()
names = ['culture-bay', 'bank-bay', 'civic-bay', 'gondola', 'station', 'belvedere']
missing = [str(source / (name + '.gltf')) for name in names if not (source / (name + '.gltf')).is_file()]
if missing:
    raise SystemExit('Missing original glTF assets: ' + ', '.join(missing))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system = 'METRIC'
for index, name in enumerate(names):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(source / (name + '.gltf')))
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    for obj in set(bpy.data.objects) - before:
        for previous in list(obj.users_collection):
            previous.objects.unlink(obj)
        collection.objects.link(obj)
    collection['provenance'] = 'Original authored approximation. Not photogrammetry.'
# Asset coordinates are retained, not arranged into a fictional city layout.
destination.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(destination))
print('Saved editable collections to', destination)
