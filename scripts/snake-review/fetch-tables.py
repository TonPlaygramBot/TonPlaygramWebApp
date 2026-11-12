"""Download the exact Poly Haven table meshes and 1k textures for local WebGL review."""
import concurrent.futures, json, re, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'webapp/public/assets/snake-table-review'
source=(ROOT/'webapp/src/config/murlanThemes.js').read_text().split('const POLYHAVEN_TABLE_THEMES = [')[1].split('].map')[0]
ids=re.findall(r"id: '([^']+)'",source)
def get(url, dest):
    if dest.exists(): return
    dest.parent.mkdir(parents=True,exist_ok=True)
    temporary = dest.with_suffix(dest.suffix + '.part')
    subprocess.run(['curl','-fL','--retry','2','--max-time','40','-sS',url,'-o',str(temporary)],check=True)
    temporary.replace(dest)
def download(asset):
    root=DEST/asset
    root.mkdir(parents=True,exist_ok=True)
    get('https://api.polyhaven.com/files/'+asset,root/'files.json')
    data=json.loads((root/'files.json').read_text())['gltf']['1k']['gltf']
    get(data['url'], root/'scene.gltf')
    for name, item in data['include'].items(): get(item['url'],root/name)
    return {'id':asset,'url':'/assets/snake-table-review/'+asset+'/scene.gltf'}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    result=list(pool.map(download,ids))
get('https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb',DEST/'chair.glb')

for fabric in ['hessian_230', 'denim_fabric']:
    for channel in ['diff', 'nor_gl', 'rough']:
        name=f'{fabric}_{channel}_1k.jpg'
        get(f'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/{fabric}/{name}',DEST/'fabric'/name)
(DEST/'manifest.json').write_text(json.dumps(result))
print('Fetched',len(result),'tables and the production default chair')
