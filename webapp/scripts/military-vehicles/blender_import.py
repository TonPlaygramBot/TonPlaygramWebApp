"""Import one editable game GLB and save a Blender project.

blender --background --python webapp/scripts/military-vehicles/blender_import.py -- shota
Blender's normal glTF importer converts Y-up to Blender Z-up; keep its transforms.
"""
from pathlib import Path
import sys
import bpy

vehicle = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'shota'
if vehicle not in {'shota', 'brabus-g', 'defender', 'brabus-s65'}:
    raise ValueError('Choose shota, brabus-g, defender or brabus-s65')
asset_dir = Path(__file__).resolve().parents[2] / 'public/assets/kart-royale/military'
asset = asset_dir / f'{vehicle}.glb'
if not asset.is_file():
    raise FileNotFoundError(asset)
scene = bpy.data.scenes.new(f'{vehicle} editable model')
if bpy.context.window:
    bpy.context.window.scene = scene
with bpy.context.temp_override(scene=scene):
    bpy.ops.import_scene.gltf(filepath=str(asset))
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
scene['accuracy'] = 'Original visual reconstruction; estimated proportions, not factory CAD.'
scene['interior'] = 'Custom game seating, dashboard and driving position.'
bpy.ops.wm.save_as_mainfile(filepath=str(asset_dir / f'{vehicle}.blend'))
