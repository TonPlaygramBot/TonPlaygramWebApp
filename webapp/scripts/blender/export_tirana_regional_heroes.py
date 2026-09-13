"""Re-export the reviewed, packed Blender source. Follow with pack-tirana-regional-heroes.py."""
import bpy
from pathlib import Path
ROOT=Path.cwd(); SOURCE=ROOT/'assets-source/tirana-neighbourhood/regional-heroes.blend'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
for name in ['grand','njesia-2']:
 root=bpy.data.objects[name];position=root.location.copy();root.location=(0,0,0)
 bpy.ops.object.select_all(action='DESELECT')
 for o in [root,*root.children_recursive]:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'webapp/public/assets/tirana-streets/neighbourhood'/f'{name}.glb'),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_texcoords=True,export_normals=True,export_materials='EXPORT')
 root.location=position
