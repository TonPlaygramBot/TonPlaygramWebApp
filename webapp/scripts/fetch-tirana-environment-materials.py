"""Acquire CC0 Poly Haven PBR maps and produce bounded, local 1K JPEGs."""
import concurrent.futures
import hashlib
import io
import json
import urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/tirana-streets/environment'
OUT.mkdir(parents=True, exist_ok=True)
ASSETS = ['concrete_pavement', 'rough_concrete', 'weathered_brown_planks', 'asphalt_02']

def download(item):
    asset, channel = item
    url = f'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/{asset}/{asset}_{channel}_1k.jpg'
    data = urllib.request.urlopen(url, timeout=40).read()
    image = Image.open(io.BytesIO(data)).convert('RGB')
    image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    name = f'{asset}-{channel}.jpg'
    quality = 88 if channel == 'diff' else 92
    image.save(OUT / name, quality=quality, optimize=True)
    while (OUT / name).stat().st_size >= 600000 and quality > 72:
        quality -= 4
        image.save(OUT / name, quality=quality, optimize=True)
    output = (OUT / name).read_bytes()
    return {'file': name, 'asset': asset, 'source': f'https://polyhaven.com/a/{asset}',
            'download': url, 'license': 'CC0-1.0', 'channel': channel,
            'size': list(image.size), 'sourceSha256': hashlib.sha256(data).hexdigest(),
            'sha256': hashlib.sha256(output).hexdigest(), 'bytes': len(output)}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    records = list(executor.map(download, [(a, c) for a in ASSETS for c in ['diff', 'nor_gl', 'rough']]))
(OUT / 'sources.json').write_text(json.dumps(records, indent=2) + '\n')
print(json.dumps({'maps': len(records), 'bytes': sum(r['bytes'] for r in records)}))
