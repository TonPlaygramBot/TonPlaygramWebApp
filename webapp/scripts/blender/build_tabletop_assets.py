"""Original TonPlaygram pieces. Blender 4.2: blender -b -t 2 --python this_file.py
Outputs an editable .blend and a shared GLB used by all five games.
"""
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[2]/'public/assets/tabletop'
ROOT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
mat=bpy.data.materials.new('Porcelain · tint in game');mat.diffuse_color=(.9,.9,.9,1);mat.use_nodes=True
node=mat.node_tree.nodes.get('Principled BSDF');node.inputs['Roughness'].default_value=.28;node.inputs['Metallic'].default_value=.18

def cube(size,loc):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);obj=bpy.context.object;obj.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bevel=obj.modifiers.new('Soft edges','BEVEL');bevel.width=.018;bevel.segments=2;bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=bevel.name);return obj

def cone(r1,r2,h,z,vertices=16):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r1,radius2=r2,depth=h,location=(0,0,z));return bpy.context.object

def finish(name,parts):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:obj.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();obj=bpy.context.object;obj.name=name
    bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');obj.data.materials.clear();obj.data.materials.append(mat)
    return obj
finish('tile',[cube((1,1,.07),(0,0,.035))])
finish('token',[cone(.115,.115,.035,.0175),cone(.085,.055,.16,.11),cone(.075,.015,.10,.24)])
finish('house',[cube((.24,.22,.24),(0,0,.12)),cone(.19,0,.15,.30,4)])
finish('tower',[cube((.22,.22,.40),(0,0,.20)),cube((.26,.26,.04),(0,0,.40)),cone(.09,.06,.10,.46)])
finish('gem',[cone(.10,.15,.08,.04,6),cone(.15,.06,.12,.14,6)])
finish('train',[cube((.30,.14,.10),(0,0,.09)),cube((.13,.14,.12),(-.07,0,.17)),cone(.035,.035,.1,.22,8)])
# Mesh origins are shared intentionally: asset instances are positioned by the game.
SOURCE=Path(__file__).resolve().parents[3]/'assets-source/tabletop'
SOURCE.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'tabletop-pieces.blend'), compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'tabletop-pieces.glb'),export_format='GLB',export_yup=True,export_materials='EXPORT')
print('Exported original tabletop set:',ROOT)
