"""Run with CITYLIFE_V2_ARCHIVE set to the exact delivered V2-Revised ZIP."""
import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('v2import', ROOT / 'scripts/import-racing-citylife-v2.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
ARCHIVE = os.environ.get('CITYLIFE_V2_ARCHIVE')


@unittest.skipUnless(ARCHIVE, 'Set CITYLIFE_V2_ARCHIVE to test the binary importer')
class ImporterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / 'repo'
        self.root.mkdir()
        for rel in (mod.LOCK, mod.STATUS):
            dest = self.root / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / rel, dest)
        self.git('init', '-q', '-b', 'review/racing-royal-citylife-v2')
        self.git('config', 'user.name', 'CityLife Import Test')
        self.git('config', 'user.email', 'citylife-test@example.invalid')
        self.git('add', '.')
        self.git('commit', '-qm', 'Test fixture')

    def tearDown(self):
        self.temp.cleanup()

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, text=True).strip()

    def test_check_has_no_writes(self):
        m = mod.import_pack(Path(ARCHIVE), self.root)
        self.assertEqual(len(m['assets']), 11)
        self.assertEqual(self.git('status', '--porcelain'), '')
        self.assertFalse((self.root / mod.ASSETS).exists())

    def test_apply_copies_exact_assets_notices_sources_then_enables(self):
        m = mod.import_pack(Path(ARCHIVE), self.root, True)
        self.assertEqual((self.root / mod.STATUS).read_text(), mod.ENABLED)
        for a in m['assets']:
            self.assertEqual(mod.digest_file(self.root / mod.ASSETS / a['file']), a['sha256'])
        for name in mod.NOTICES:
            self.assertTrue((self.root / mod.ASSETS / name).exists())
        self.assertTrue((self.root / mod.SOURCE / 'source/rebuild_v2.py').exists())
        self.assertEqual(len(list((self.root / mod.ASSETS).glob('*.glb'))), 11)

    def test_main_is_never_modified(self):
        self.git('branch', '-m', 'main')
        with self.assertRaisesRegex(ValueError, 'review branch'):
            mod.import_pack(Path(ARCHIVE), self.root, True)
        self.assertEqual(self.git('status', '--porcelain'), '')

    def test_dirty_checkout_is_refused(self):
        (self.root / 'unrelated.txt').write_text('do not touch')
        with self.assertRaisesRegex(ValueError, 'clean checkout'):
            mod.import_pack(Path(ARCHIVE), self.root, True)
        self.assertEqual((self.root / 'unrelated.txt').read_text(), 'do not touch')
        self.assertFalse((self.root / mod.ASSETS).exists())

    def test_wrong_archive_is_refused_without_writes(self):
        wrong = Path(self.temp.name) / 'wrong.zip'
        wrong.write_bytes(b'not the right V2 pack')
        with self.assertRaisesRegex(ValueError, 'exact V2'):
            mod.import_pack(wrong, self.root, True)
        self.assertEqual(self.git('status', '--porcelain'), '')

    def test_existing_assets_are_never_overwritten(self):
        dest = self.root / mod.ASSETS
        dest.mkdir(parents=True)
        (dest / 'keep.txt').write_text('original')
        with self.assertRaisesRegex(ValueError, 'Destination exists'):
            mod.import_pack(Path(ARCHIVE), self.root, True)
        self.assertEqual((dest / 'keep.txt').read_text(), 'original')

    def test_symlink_destination_is_refused(self):
        outside = Path(self.temp.name) / 'outside'
        outside.mkdir()
        p = self.root / 'webapp/public'
        p.symlink_to(outside, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'symlink'):
            mod.import_pack(Path(ARCHIVE), self.root, True)
        self.assertEqual(list(outside.iterdir()), [])


if __name__ == '__main__':
    unittest.main()
