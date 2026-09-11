"""Build source-footprint Tirana buildings and reusable street fronts in Blender.
Run from repo root: blender -b --python tools/blender/tirana_neighbourhood.py
OSM positions/levels are sourced. Unmeasured dimensions and generic facades are
authored interpretations; see docs/tirana-ali-demi-neighbourhood.md.
"""
import bpy
import math
import json
import hashlib
from pathlib import Path

ROOT = Path.cwd()
SOURCE = ROOT / 'assets-source/tirana-neighbourhood'
OUTPUT = ROOT / 'webapp/public/assets/tirana-streets/neighbourhood'
OUTPUT.mkdir(parents=True, exist_ok=True)
ASSETS = ROOT / 'webapp/public/assets/tirana-streets'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for collection in list(bpy.data.collections):
    if collection.name != 'Collection':
        bpy.data.collections.remove(collection)
bpy.context.scene.unit_settings.system = 'METRIC'


def material(name, color, rough=.75, metallic=0, plaster=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = rough
    shader.inputs['Metallic'].default_value = metallic
    mat.diffuse_color = (*color, 1)
    if plaster:
        registry = {r['file']: r for r in json.loads((ASSETS / 'materials/sources.json').read_text())}
        for suffix, socket in [('diff','Base Color'), ('rough','Roughness'), ('nor_gl','Normal')]:
            relative = 'materials/plastered_wall_02-' + suffix + '.jpg'
            path = ASSETS / relative
            assert hashlib.sha256(path.read_bytes()).hexdigest() == registry[relative]['sha256']
            texture = mat.node_tree.nodes.new('ShaderNodeTexImage')
            texture.image = bpy.data.images.load(str(path), check_existing=True)
            texture.image.colorspace_settings.name = 'sRGB' if suffix == 'diff' else 'Non-Color'
            if suffix == 'nor_gl':
                normal = mat.node_tree.nodes.new('ShaderNodeNormalMap')
                normal.inputs['Strength'].default_value = .32
                mat.node_tree.links.new(texture.outputs['Color'], normal.inputs['Color'])
                mat.node_tree.links.new(normal.outputs['Normal'], shader.inputs[socket])
            else:
                mat.node_tree.links.new(texture.outputs['Color'], shader.inputs[socket])
        mat['source'] = 'https://polyhaven.com/a/plastered_wall_02'
        mat['license'] = 'CC0-1.0'
    return mat


M = {
 'plaster': material('PolyHaven plaster',(.83,.81,.75),plaster=True),
 'cream': material('Warm limestone trim',(.76,.70,.53)),
 'yellow': material('Municipality yellow',(.86,.68,.36)),
 'green': material('Grand pale green bands',(.65,.75,.53)),
 'pink': material('Grand pink surrounds',(.65,.33,.43)),
 'white': material('Painted white trim',(.88,.9,.86)),
 'metal': material('Dark steel',(.06,.085,.09),.45,.65),
 'glass': material('Window glazing',(.10,.19,.23),.18,.4),
 'red': material('Red canvas',(.65,.035,.045)),
 'wood': material('Timber slats',(.32,.17,.07)),
 'pharmacy': material('Pharmacy green',(.025,.44,.2),.5),
 'blue': material('Clinic blue',(.03,.22,.45)),
 'fruit-red': material('Tomatoes',(.8,.06,.025),.45),
 'fruit-green': material('Apples',(.37,.57,.05),.5),
 'fruit-orange': material('Oranges',(.96,.4,.025),.6)
}


class Builder:
    def __init__(self, name, origin=(0,0), extras=None):
        self.name, self.origin = name, origin
        self.parts = {}
        self.collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(self.collection)
        self.root = bpy.data.objects.new(name, None)
        self.collection.objects.link(self.root)
        self.root.location = (origin[0], -origin[1], 0)
        self.root['sourceMetadata'] = json.dumps(extras or {},ensure_ascii=False)
    def mesh(self, mat, vertices, faces):
        data = self.parts.setdefault(mat, [[], []])
        offset = len(data[0])
        # Input is game x east, y up, z south. Blender x east/y north/z up.
        data[0].extend((x,-z,y) for x,y,z in vertices)
        data[1].extend(tuple(offset+i for i in f) for f in faces)
    def box(self, mat, x,y,z,w,h,d,yaw=0):
        c,s=math.cos(yaw),math.sin(yaw)
        vertices=[]
        for px,py,pz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]:
            px,pz=px*w/2,pz*d/2
            vertices.append((x+c*px+s*pz,y+py*h/2,z-s*px+c*pz))
        self.mesh(mat,vertices,[(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(0,1,5,4),(3,7,6,2)])
    def cylinder(self,mat,x,y,z,r,h,segments=10):
        vertices=[(x+math.cos(i*2*math.pi/segments)*r,y+dy,z+math.sin(i*2*math.pi/segments)*r) for dy in [-h/2,h/2] for i in range(segments)]
        faces=[(i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments)]
        faces.extend([tuple(range(segments)),tuple(range(segments*2-1,segments-1,-1))])
        self.mesh(mat,vertices,faces)
    def text(self, value, x,y,z, size=.2, color='white',yaw=0):
        curve=bpy.data.curves.new(self.name+' lettering','FONT')
        curve.body=value;curve.align_x='CENTER';curve.size=size;curve.extrude=.002
        obj=bpy.data.objects.new(value,curve);self.collection.objects.link(obj);obj.parent=self.root
        obj.location=(x,-z,y);obj.rotation_euler=(math.pi/2,0,-yaw)
        curve.materials.append(M[color])
    def finish(self):
        for key,(vertices,faces) in self.parts.items():
            mesh=bpy.data.meshes.new(self.name+' '+key);mesh.from_pydata(vertices,[],faces);mesh.update()
            # Metric box/planar projection for every face, including vertical
            # walls; avoid the old x/z UV projection collapsing vertical facades.
            uv=mesh.uv_layers.new(name='UVMap')
            for face in mesh.polygons:
                normal=face.normal;axes=(0,1) if abs(normal.z)>.7 else (1,2) if abs(normal.x)>.7 else (0,2)
                for loop in face.loop_indices:
                    p=mesh.vertices[mesh.loops[loop].vertex_index].co
                    uv.data[loop].uv=(p[axes[0]]/4,p[axes[1]]/4)
            obj=bpy.data.objects.new(self.name+' '+key,mesh);self.collection.objects.link(obj)
            obj.parent=self.root;mesh.materials.append(M[key])
        bpy.ops.object.select_all(action='DESELECT')
        self.root.select_set(True)
        for obj in self.collection.objects:obj.select_set(True)
        position=self.root.location.copy();self.root.location=(0,0,0)
        bpy.ops.export_scene.gltf(filepath=str(OUTPUT/(self.name+'.glb')),export_format='GLB',use_selection=True,
            export_yup=True,export_extras=True,export_texcoords=True,export_normals=True,export_materials='EXPORT')
        self.root.location=position
        return {'asset':self.name,'origin':self.origin,'file':self.name+'.glb','triangles':sum(max(0,len(f)-2) for _,faces in self.parts.values() for f in faces)}


def frontage(b,kind):
    accent={'pharmacy':'pharmacy','clinic':'blue','civic':'yellow','barber':'metal','produce':'green','market':'green','cafe':'red'}[kind]
    b.box('plaster',0,1.5,-.08,4,3,.12)
    b.box('metal',0,1.5,.025,3.7,2.85,.09)
    b.box('glass',-.72,1.5,.09,2.05,2.62,.06)
    b.box('glass',1.04,1.46,.09,1.17,2.55,.06)
    for x in [-1.82,.36,1.67]:b.box('metal',x,1.5,.15,.07,2.8,.08)
    b.box('white',.55,1.3,.22,.025,.55,.04)
    b.box(accent,0,3.21,.13,4,.48,.2)
    b.box('cream',0,.07,.21,4,.14,.35)
    if kind=='cafe':
        b.box('red',0,2.82,.81,4,.07,1.45)
        b.box('red',0,2.70,1.51,4,.23,.045)
        for x in [-1.7,1.7]:b.box('metal',x,2.8,.8,.03,.04,1.5)
    if kind=='pharmacy':
        for w,h in [(.8,.22),(.22,.8)]:b.box('pharmacy',-2.17,2.5,.32,w,h,.12)
        for y in [.65,1.15,1.65]:
            b.box('white',-.8,y,.16,1.7,.04,.09)
            for i in range(7):b.box('white' if i%2 else 'pharmacy',-1.52+i*.23,y+.14,.17,.12,.25,.08)
    if kind=='barber':
        for i in range(12):b.cylinder('red' if i%3==0 else 'blue' if i%3==1 else 'white',-1.98,1.66+i*.055,.25,.09,.055)
        for y in [1.63,2.34]:b.cylinder('metal',-1.98,y,.25,.13,.08)
    if kind in ['market','produce']:
        for i in range(4):
            x=-1.5+i
            b.box('wood',x,.45,.62,.85,.14,.62)
            for side in [-1,1]:b.box('wood',x+side*.4,.6,.62,.055,.3,.62)
            for z in [.33,.91]:b.box('wood',x,.6,z,.85,.3,.045)
            if kind=='produce':
                for j in range(12):b.cylinder(['fruit-red','fruit-green','fruit-orange'][i%3],x-.27+(j%4)*.18,.58+(j//4)*.025,.43+(j//4)*.18,.085,.12,7)
            else:
                for j in range(4):b.box('cream' if j%2 else 'green',x-.25+j*.16,.67,.63,.12,.28,.18)
    if kind=='civic':
        for x in [-1.5,1.5]:
            for i in range(8):b.box('white',x-.4+i*.115,1.6,.27,.025,2.5,.04)
        b.box('yellow',-2.1,1.1,.35,.7,2.2,.5)
        b.box('metal',-2.1,1.26,.62,.48,.64,.04)
        b.text('ATM',-2.1,1.8,.65,.18)
    if kind=='clinic':
        for w,h in [(.72,.2),(.2,.72)]:b.box('blue',-1.55,2.25,.22,w,h,.055)


def building(data,asset):
    assert not data.get('holes'), 'A newly introduced courtyard requires hole-aware hero mesh authoring'
    p=data['p'];cx=sum(x for x,z in p)/len(p);cz=sum(z for x,z in p)/len(p)
    p=[(x-cx,z-cz) for x,z in p]
    if sum(p[i][0]*p[(i+1)%len(p)][1]-p[(i+1)%len(p)][0]*p[i][1] for i in range(len(p)))>0:p.reverse()
    height=data['h'];builder=Builder(asset,(cx,cz),dict(osmWay=data['id'],source=data['source'],heightBasis=data['heightBasis'],accuracy='OSM footprint; unsurveyed facade interpretation'))
    vertices=[(x,y,z) for y in [0,height] for x,z in p];count=len(p)
    faces=[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    faces.extend([tuple(range(count-1,-1,-1)),tuple(range(count,count*2))])
    builder.mesh('yellow' if asset=='njesia-2' else 'plaster',vertices,faces)
    for i,a in enumerate(p):
        other=p[(i+1)%count];dx,dz=other[0]-a[0],other[1]-a[1];length=math.hypot(dx,dz)
        if length<.01:continue
        ux,uz=dx/length,dz/length;nx,nz=-uz,ux;yaw=math.atan2(nx,nz)
        def wall(mat,u,y,w,h,d=.1,offset=.08):builder.box(mat,a[0]+ux*u+nx*offset,y,a[1]+uz*u+nz*offset,w,h,d,yaw)
        wall('green' if asset=='grand' else 'cream',length/2,height-.12,length,.24,.28)
        if length<2.8:continue
        bays=max(1,int(length/3.8));step=3.2 if asset!='njesia-2' else 3.5
        for floor in range(max(1,int(height/step))):
            y=1.65+floor*step
            if asset=='grand':wall('green',length/2,y-1.15,length,.3,.22)
            for j in range(bays):
                u=(j+.5)*length/bays;width=min(1.6,length/bays-.6)
                wall('pink' if asset=='grand' else 'white',u,y,width+.26,1.9,.14)
                wall('glass',u,y,width,1.65,.05,.18)
                wall('white',u,y,.055,1.65,.07,.23)
                wall('cream',u,y-.9,width+.3,.12,.34,.22)
                if asset=='njesia-2':
                    for k in range(7):wall('white',u-width*.44+k*width*.88/6,y,.025,1.85,.03,.26)
                    for h in [-.58,.58]:wall('white',u,y+h,width,.025,.03,.26)
                elif asset=='grand' and floor>0 and j%3!=0:
                    wall('cream',u,y-.93,width+.5,.13,.85,.42)
                    wall('metal',u,y-.38,width+.5,.04,.05,.83)
                    for k in range(5):wall('metal',u-width/2+k*width/4,y-.62,.028,.5,.04,.83)
        if asset=='grand' and length>8:
            for k in range(int(length/1.5)):wall('wood',.7+k*1.5,height+.32,.09,.13,1.7,.6)
    return builder.finish()


manifest=[]
inputs=json.loads((SOURCE/'building-input.json').read_text())
names={'1227869701':'njesia-2','682723386':'britaniku','548100908':'grand','548098442':'amavita'}
for data in inputs:manifest.append(building(data,names[data['id']]))
for index,kind in enumerate(['market','pharmacy','barber','produce','cafe','civic','clinic']):
    model=Builder(kind,(-700,index*8),{'accuracy':'Original generic street-front kit; mapped names and frontage positions supplied by runtime'})
    frontage(model,kind);manifest.append(model.finish())
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'neighbourhood.blend'),compress=True)
(OUTPUT/'manifest.json').write_text(json.dumps({'blender':bpy.app.version_string,'models':manifest,'geometryLicense':'CC0-1.0 for original detailing; OSM-derived footprints ODbL-1.0','materials':'Poly Haven plastered_wall_02 CC0; other surfaces authored PBR colors'},indent=2))
print('EXPORTED',len(manifest),'Blender/glTF models',sum(m['triangles'] for m in manifest),'triangles')
