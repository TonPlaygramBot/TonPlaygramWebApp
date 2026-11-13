"""Download original CC0 inputs with receipt hash verification.
Usage: python download.py DESTINATION_DIR
"""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import sys
import urllib.request

receipt = Path(__file__).resolve().parents[2] / 'webapp/public/assets/tirana-streets/city-realism/provenance.json'
files = json.loads(receipt.read_text())['originalFiles']
destination = Path(sys.argv[1])

def download(item):
    name, record = item
    path = destination / name
    path.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(record['url'], headers={'User-Agent': 'TonPlaygram CC0 asset integration'})
    with urllib.request.urlopen(request, timeout=90) as response:
        data = response.read()
    if hashlib.md5(data).hexdigest() != record['md5']:
        raise ValueError(f'Source hash mismatch: {name}')
    path.write_bytes(data)
    return name

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
    for name in executor.map(download, files.items()):
        print(name)
