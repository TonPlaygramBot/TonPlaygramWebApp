#!/usr/bin/env python3
"""Import the exact latest V2 revision on a review branch; never activate gameplay.
Usage: python3 scripts/import-tirana-citylife-v2.py /path/to/revised.zip --check
       python3 scripts/import-tirana-citylife-v2.py /path/to/revised.zip --apply
Python standard library only. No download, commit, push, merge, or deployment.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import struct
import subprocess
import tempfile
import zipfile

REPO = Path(__file__).resolve().parent.parent
LOCK = REPO / 'assets-source/tirana-citylife-v2/asset-lock.json'
RUNTIME = Path('webapp/public/assets/tirana-citylife/v2')
AUTHORING = Path('assets-source/tirana-citylife-v2/authoring')
ROOT = 'Tirana-CityLife-V2/'


def digest_file(path):
    sha = hashlib.sha256()
    with Path(path).open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            sha.update(chunk)
    return sha.hexdigest()


def verify_archive(path, lock):
    if digest_file(path) != lock['archive']['sha256']:
        raise ValueError('Archive mismatch. Use Tirana-CityLife-V2-Revised.zip, not V1 or the earlier V2 Asset Pack.')
    with zipfile.ZipFile(path) as archive:
        seen = set()
        members = archive.infolist()
        if len(members) > 1000 or sum(i.file_size for i in members) > 200 * 1024 * 1024:
            raise ValueError('Archive exceeds the review-pack limits.')
        for info in members:
            p = PurePosixPath(info.filename)
            if (info.filename in seen or p.is_absolute() or '..' in p.parts or '\\' in info.filename
                    or not info.filename.startswith(ROOT) or stat.S_ISLNK(info.external_attr >> 16)):
                raise ValueError('Unsafe or duplicate archive entry: ' + info.filename)
            seen.add(info.filename)
        manifest_bytes = archive.read(ROOT + 'assets/manifest.json')
        if hashlib.sha256(manifest_bytes).hexdigest() != lock['manifestSha256']:
            raise ValueError('Manifest mismatch.')
        manifest = json.loads(manifest_bytes)
        actual = sorted(i.filename[len(ROOT + 'assets/'):] for i in members
                        if i.filename.startswith(ROOT + 'assets/') and i.filename.endswith('.glb'))
        expected = sorted(a['file'] for a in lock['assets'])
        if manifest.get('version') != 2 or actual != expected or len(expected) != 11:
            raise ValueError('Expected exactly the 11 revised V2 masters, without V1 LODs.')
        entries = {a['id']: a for a in manifest['assets']}
        for asset in lock['assets']:
            data = archive.read(ROOT + 'assets/' + asset['file'])
            if len(data) != asset['bytes'] or hashlib.sha256(data).hexdigest() != asset['sha256']:
                raise ValueError('Model mismatch: ' + asset['file'])
            if len(data) < 20 or struct.unpack_from('<4sII', data) != (b'glTF', 2, len(data)):
                raise ValueError('Invalid GLB header: ' + asset['file'])
            entry = entries.get(asset['id'])
            if not entry or any(entry[k] != asset[k] for k in ('file', 'bytes', 'sha256', 'triangles', 'kind')):
                raise ValueError('Manifest record mismatch: ' + asset['id'])
        hdr = archive.read(ROOT + 'assets/studio_small_09_1k.hdr')
        if hashlib.sha256(hdr).hexdigest() != lock['hdrSha256']:
            raise ValueError('HDR mismatch.')
        for name in ('ATTRIBUTION.md', 'ORIGINAL_REFERENCE_ATTRIBUTION.md', 'APACHE-2.0.txt'):
            if not archive.read(ROOT + name):
                raise ValueError('Required notice is empty: ' + name)
    return manifest


def check_destination(repo, relative):
    dest = repo / relative
    for part in (dest, *dest.parents):
        if part == repo:
            break
        if part.is_symlink():
            raise ValueError('Refusing a symlink destination: ' + str(part))
    if dest.exists():
        raise ValueError('Destination already exists; reconcile instead of overwriting: ' + str(relative))


def apply_archive(path, repo):
    def git(*args):
        return subprocess.check_output(['git', *args], cwd=repo, text=True).strip()
    branch = git('branch', '--show-current')
    if not branch or branch in ('main', 'master'):
        raise ValueError('Use a review branch, not main/master or detached HEAD.')
    if git('status', '--porcelain', '--untracked-files=all'):
        raise ValueError('The review checkout must be clean before import.')
    remote = git('remote', 'get-url', 'origin').removesuffix('.git').rstrip('/')
    if remote not in ('https://github.com/TonPlaygramBot/TonPlaygramWebApp',
                       'git@github.com:TonPlaygramBot/TonPlaygramWebApp'):
        raise ValueError('The checkout origin is not TonPlaygramBot/TonPlaygramWebApp.')
    for relative in (RUNTIME, AUTHORING):
        check_destination(repo, relative)
    installed = []
    with tempfile.TemporaryDirectory(prefix='.citylife-v2-stage-', dir=repo) as temporary:
        stage = Path(temporary)
        runtime, source = stage / 'runtime', stage / 'authoring'
        runtime.mkdir()
        source.mkdir()
        with zipfile.ZipFile(path) as archive:
            for info in archive.infolist():
                if info.is_dir():
                    continue
                relative = PurePosixPath(info.filename[len(ROOT):])
                # Exact GLBs/HDR/manifest serve from versioned URLs; all source and notices stay intact.
                target = runtime.joinpath(*relative.parts[1:]) if relative.parts[0] == 'assets' else source.joinpath(*relative.parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(info) as src, target.open('wb') as dst:
                    shutil.copyfileobj(src, dst)
        for name in ('ATTRIBUTION.md', 'ORIGINAL_REFERENCE_ATTRIBUTION.md', 'APACHE-2.0.txt', 'REFERENCES.md'):
            shutil.copyfile(source / name, runtime / name)
        try:
            for staged, relative in ((runtime, RUNTIME), (source, AUTHORING)):
                check_destination(repo, relative)
                destination = repo / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                os.replace(staged, destination)
                installed.append(destination)
        except BaseException:
            for destination in reversed(installed):
                shutil.rmtree(destination)
            raise
    return installed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--check', action='store_true')
    modes.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    try:
        lock = json.loads(LOCK.read_text(encoding='utf-8'))
        manifest = verify_archive(args.archive, lock)
        if args.apply:
            apply_archive(args.archive, REPO)
            print('Imported 11 V2 GLBs, HDR, source, previews, reports and license notices locally.')
            print('No game activation, V1 overwrite, Racing Royal change, commit, push, merge or deployment occurred.')
        else:
            print('PASS: exact revised archive, 11 GLBs, manifest, HDR and notices verified. No checkout files changed.')
        print('High-detail master triangles:', sum(a['triangles'] for a in manifest['assets']))
    except (OSError, ValueError, KeyError, zipfile.BadZipFile, subprocess.CalledProcessError) as exc:
        parser.exit(1, 'CityLife V2 import refused: ' + str(exc) + '\n')


if __name__ == '__main__':
    main()
