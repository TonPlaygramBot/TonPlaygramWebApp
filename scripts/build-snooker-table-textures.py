"""Encode the original MesXwi table maps at their native 4096 × 4096.

Usage: python scripts/build-snooker-table-textures.py snooker-table.zip /path/to/basisu
Requires Pillow and the Basis Universal command-line encoder.
"""
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile
import argparse
import subprocess

from PIL import Image

OUTPUT = Path(__file__).resolve().parents[1] / 'webapp/public/assets/snooker-royal/mesxwi/4k'
SURFACES = {
    'legs': ('Legs', True),
    'leg-holders': ('Leg_holders', False),
    'cushion': ('cushion', True),
    'baize': ('Baize', True),
    'corner-pocket': ('Pot_corner', True),
    'side-pocket': ('Pot_middle', True),
}


def prepare_surface(archive, name, metallic, intermediate):
    with ZipFile(archive) as source:
        def read_map(channel):
            path = f'textures/snooker_table_{name}_{channel}.png'
            with Image.open(BytesIO(source.read(path))) as image:
                if image.size != (4096, 4096):
                    raise ValueError(f'Unexpected source dimensions for {path}: {image.size}')
                return image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)

        base = read_map('BaseColor')
        # The pocket textures carry the authored net cutouts in their alpha.
        base = base.convert('RGBA' if name.startswith('Pot_') else 'RGB')
        base.save(intermediate / 'color.png')
        read_map('Normal').convert('RGB').save(intermediate / 'normal.png')
        roughness = read_map('Roughness').convert('L')
        metalness = read_map('Metallic').convert('L') if metallic else Image.new('L', roughness.size)
        Image.merge('RGB', (Image.new('L', roughness.size, 255), roughness, metalness)).save(
            intermediate / 'metal-rough.png'
        )


def encode_surface(args, surface, name, metallic):
    with TemporaryDirectory() as temp:
        intermediate = Path(temp)
        prepare_surface(args.archive, name, metallic, intermediate)
        for role, options in (
            ('color', []),
            ('normal', ['-normal_map', '-mip_renorm']),
            ('metal-rough', ['-linear']),
        ):
            dest = OUTPUT / f'{surface}-{role}.ktx2'
            result = subprocess.run([
                str(args.encoder), '-ktx2', '-q', '192', '-comp_level', '0',
                '-mipmap', '-max_threads', '2', *options,
                '-file', str(intermediate / f'{role}.png'), '-output_file', str(dest),
            ], capture_output=True, text=True)
            if result.returncode:
                raise RuntimeError(result.stdout + result.stderr)
            print(f'{dest.name}: {dest.stat().st_size:,} bytes', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('encoder', type=lambda path: Path(path).resolve())
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=3) as executor:
        tasks = [
            executor.submit(encode_surface, args, surface, *source)
            for surface, source in SURFACES.items()
        ]
        for task in tasks:
            task.result()


if __name__ == '__main__':
    main()
