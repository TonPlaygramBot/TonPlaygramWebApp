#!/usr/bin/env python3
"""Import only the exact latest V2-Revised pack. No downloads, commit, push or deploy."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import stat
import struct
import subprocess
import tempfile
import zipfile

ARCHIVE_SHA = '6a6226f87b15efc25a2140515b4bda9396971309fce841f9e6f3f44d9a779038'
PREFIX = 'Tirana-CityLife-V2/'
STATUS = 'webapp/src/games/kartroyale/citylife-v2/asset-status.mjs'
DISABLED = '/** Set true only by the verified V2 importer after all binary assets are present. */\nexport const V2_ASSETS_READY = false;\n'
ENABLED = DISABLED.replace('false;', 'true;')
LOCK = 'assets-source/racing-citylife-v2/archive-manifest.json'
ASSETS = 'webapp/public/assets/racing-royal/citylife-v2'
SOURCE = 'assets-source/racing-citylife-v2/package-source'
NOTICES = ('ATTRIBUTION.md', 'ORIGINAL_REFERENCE_ATTRIBUTION.md', 'APACHE-2.0.txt', 'REFERENCES.md')


def digest_file(path):
    with open(path, 'rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def inspect_archive(archive, lock):
    if digest_file(archive) != ARCHIVE_SHA:
        raise ValueError('Not the exact V2-Revised archive. The earlier V2 and V1 packs are rejected.')
    with zipfile.ZipFile(archive) as z:
        names = set()
        total = 0
        for i in z.infolist():
            path = PurePosixPath(i.filename)
            total += i.file_size
            if (not i.filename.startswith(PREFIX) or path.is_absolute() or '..' in path.parts
                    or '\\' in i.filename or stat.S_ISLNK(i.external_attr >> 16)
                    or i.filename in names or total > 250_000_000):
                raise ValueError('Unsafe or unexpected archive layout')
            names.add(i.filename)
        manifest_bytes = z.read(PREFIX + 'assets/manifest.json')
        if manifest_bytes != lock.read_bytes():
            raise ValueError('Committed V2 manifest does not match the archive')
        manifest = json.loads(manifest_bytes)
        expected = {PREFIX + 'assets/' + a['file'] for a in manifest['assets']}
        if len(expected) != 11 or manifest['version'] != 2:
            raise ValueError('Expected the latest 11-model V2 revision')
        if {n for n in names if n.endswith('.glb')} != expected:
            raise ValueError('Unexpected/missing GLBs or mixed old LODs')
        for a in manifest['assets']:
            b = z.read(PREFIX + 'assets/' + a['file'])
            if len(b) != a['bytes'] or hashlib.sha256(b).hexdigest() != a['sha256']:
                raise ValueError('Model checksum mismatch: ' + a['id'])
            if len(b) < 20 or struct.unpack_from('<III', b) != (0x46546C67, 2, len(b)):
                raise ValueError('Invalid GLB header: ' + a['id'])
            size, kind = struct.unpack_from('<II', b, 12)
            if kind != 0x4E4F534A or 20 + size > len(b):
                raise ValueError('Invalid GLB JSON range')
            doc = json.loads(b[20:20 + size])
            if any('uri' in r for k in ('buffers', 'images') for r in doc.get(k, [])):
                raise ValueError('External GLB dependency is not allowed')
        for name in NOTICES:
            if not z.read(PREFIX + name):
                raise ValueError('Missing license or attribution notice')
    return manifest


def no_symlink_ancestors(root, dest):
    for part in (dest, *dest.parents):
        if part == root:
            return
        if part.is_symlink():
            raise ValueError('Refusing a symlink destination: ' + str(part))
    raise ValueError('Destination is outside repository')


def import_pack(archive, repo, apply=False):
    repo = repo.resolve()
    manifest = inspect_archive(archive, repo / LOCK)
    if (repo / STATUS).read_text() != DISABLED:
        raise ValueError('Asset gate changed or import already applied; reconcile manually')
    for name in (ASSETS, SOURCE, STATUS):
        no_symlink_ancestors(repo, repo / name)
    for name in (ASSETS, SOURCE):
        if (repo / name).exists():
            raise ValueError('Destination exists; existing assets are never overwritten: ' + name)
    if (repo / (STATUS + '.tmp')).exists() or (repo / (STATUS + '.tmp')).is_symlink():
        raise ValueError('Activation temporary file exists; reconcile manually')
    if not apply:
        return manifest
    def git(*args):
        return subprocess.check_output(['git', *args], cwd=repo, text=True).strip()
    branch = git('branch', '--show-current')
    if not branch or branch in ('main', 'master'):
        raise ValueError('Use a review branch, not main/master or detached HEAD')
    if git('status', '--porcelain', '--untracked-files=all'):
        raise ValueError('Use a clean checkout of the PR branch')
    published = []
    with tempfile.TemporaryDirectory(prefix='.racing-v2-', dir=repo) as work:
        stage = Path(work)
        assets = stage / 'assets'
        source = stage / 'source'
        assets.mkdir()
        source.mkdir()
        try:
            with zipfile.ZipFile(archive) as z:
                for i in z.infolist():
                    rel = PurePosixPath(i.filename[len(PREFIX):])
                    if i.is_dir() or not rel.parts:
                        continue
                    dest = (assets / Path(*rel.parts[1:])) if rel.parts[0] == 'assets' else (source / Path(*rel.parts))
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    with z.open(i) as f, open(dest, 'xb') as out:
                        shutil.copyfileobj(f, out)
            for name in NOTICES:
                shutil.copyfile(source / name, assets / name)
            for a in manifest['assets']:
                if digest_file(assets / a['file']) != a['sha256']:
                    raise ValueError('Staged GLB failed verification')
            for staged, rel in ((assets, ASSETS), (source, SOURCE)):
                target = repo / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                staged.rename(target)
                published.append(target)
            # Activation is the final write. The game cannot request absent models.
            status_tmp = repo / (STATUS + '.tmp')
            with status_tmp.open('x') as f:
                f.write(ENABLED)
            status_tmp.replace(repo / STATUS)
        except BaseException:
            for target in reversed(published):
                shutil.rmtree(target)
            (repo / (STATUS + '.tmp')).unlink(missing_ok=True)
            (repo / STATUS).write_text(DISABLED)
            raise
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parent.parent)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--apply', action='store_true')
    mode.add_argument('--check', action='store_true')
    args = parser.parse_args()
    manifest = import_pack(args.archive.resolve(), args.repo, args.apply)
    print(f"Verified {len(manifest['assets'])} exact V2 GLBs. " + ('Imported locally and enabled for review; nothing pushed.' if args.apply else 'No files changed.'))


if __name__ == '__main__':
    main()
