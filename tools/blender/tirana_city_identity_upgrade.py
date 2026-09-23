"""Import the baked, textured runtime meshes as editable Blender projects.

Run after `node webapp/scripts/build-tirana-identity-models.mjs`:
  blender --background --python tools/blender/tirana_city_identity_upgrade.py
Optional: append `-- --only otp` to export a single identity.

Models remain authored approximations. Operator artwork stays embedded and
retains its original colors; no text substitution or invented school crests.
"""
import argparse
import json
from pathlib import Path
import sys
import bpy

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'webapp/public/assets/tirana-streets/city-identity'
OUTPUT = ROOT / 'assets-source/tirana-identity/blender'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--only')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    manifest = json.loads((SOURCE / 'manifest.json').read_text())
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for key, model in manifest['models'].items():
        if args.only and key != args.only:
            continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(SOURCE / model['file']))
        scene = bpy.context.scene
        scene.unit_settings.system = 'METRIC'
        scene['identity_source'] = model.get('source', '')
        scene['accuracy'] = model.get('accuracy', 'Authored relief and dimensions; original operator artwork')
        # Images are embedded into each editable source, avoiding missing paths.
        for image in bpy.data.images:
            if image.has_data:
                image.pack()
        bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / f'{key}.blend'), compress=True)
        print(f'Saved {key}.blend ({model["triangles"]} runtime triangles)')
    if args.only and args.only not in manifest['models']:
        raise ValueError(f'Unknown identity: {args.only}')

if __name__ == '__main__':
    main()
