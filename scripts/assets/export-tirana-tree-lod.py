import bpy,json,os
bpy.ops.wm.read_factory_settings(use_empty=True)
p=os.environ.get('TREE_ASSET_DIR','webapp/public/assets/tirana-streets/city-realism/')
if not p.endswith('/'):p+='/'
bpy.ops.import_scene.gltf(filepath=p+'urban-tree.glb')
for o in list(bpy.context.scene.objects):
 if o.type!='MESH':continue
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
for o in list(bpy.context.scene.objects):
 if o.type!='MESH':continue
 bpy.context.view_layer.objects.active=o
 m=o.modifiers.new('Bounded medium LOD','DECIMATE');m.ratio=.5;m.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=m.name)
 o.data.calc_loop_triangles();print('LOD',o.name,len(o.data.loop_triangles))
bpy.ops.export_scene.gltf(filepath=p+'urban-tree-lod1.glb',export_format='GLB',export_yup=True,export_apply=True)
