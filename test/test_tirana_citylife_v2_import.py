"""Standard-library importer tests; set CITYLIFE_V2_ARCHIVE for real-pack tests."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
REPO = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('citylife_import', REPO / 'scripts/import-tirana-citylife-v2.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
LOCK = json.loads(mod.LOCK.read_text())
ARCHIVE = os.environ.get('CITYLIFE_V2_ARCHIVE')


def git(repo, *args):
    return subprocess.check_output(['git', *args], cwd=repo, stderr=subprocess.DEVNULL, text=True).strip()


class ImportSafety(unittest.TestCase):
    def test_wrong_archive_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            wrong = Path(folder) / 'wrong.zip'
            wrong.write_bytes(b'not the V2 archive')
            with self.assertRaisesRegex(ValueError, 'Archive mismatch'):
                mod.verify_archive(wrong, LOCK)

    def test_existing_destination_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / mod.RUNTIME).mkdir(parents=True)
            with self.assertRaisesRegex(ValueError, 'already exists'):
                mod.check_destination(root, mod.RUNTIME)

    def test_symlink_destination_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'outside').mkdir()
            (root / 'webapp').symlink_to(root / 'outside', target_is_directory=True)
            with self.assertRaisesRegex(ValueError, 'symlink'):
                mod.check_destination(root, mod.RUNTIME)


@unittest.skipUnless(ARCHIVE, 'Set CITYLIFE_V2_ARCHIVE to test the delivered binary archive')
class RealArchive(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = mod.verify_archive(Path(ARCHIVE), LOCK)

    def checkout(self, folder):
        repo = Path(folder)
        git(repo, 'init', '-b', 'review/tirana-citylife-v2-revised')
        git(repo, 'config', 'user.name', 'CityLife importer tests')
        git(repo, 'config', 'user.email', 'citylife-test@example.invalid')
        git(repo, 'remote', 'add', 'origin', 'https://github.com/TonPlaygramBot/TonPlaygramWebApp.git')
        (repo / 'keep.txt').write_text('Existing game must remain unchanged.\n')
        git(repo, 'add', 'keep.txt')
        git(repo, 'commit', '-m', 'test fixture')
        return repo

    def test_real_manifest_has_eleven_revised_models(self):
        self.assertEqual(self.manifest['version'], 2)
        self.assertEqual(len(self.manifest['assets']), 11)

    def test_import_preserves_exact_assets_and_notices_only_in_scoped_paths(self):
        with tempfile.TemporaryDirectory() as folder:
            repo = self.checkout(folder)
            head = git(repo, 'rev-parse', 'HEAD')
            installed = mod.apply_archive(Path(ARCHIVE), repo)
            self.assertEqual(len(installed), 2)
            for asset in LOCK['assets']:
                self.assertEqual(mod.digest_file(repo / mod.RUNTIME / asset['file']), asset['sha256'])
            for name in ('APACHE-2.0.txt', 'ATTRIBUTION.md', 'ORIGINAL_REFERENCE_ATTRIBUTION.md'):
                self.assertTrue((repo / mod.RUNTIME / name).is_file())
            self.assertTrue((repo / mod.AUTHORING / 'source/rebuild_v2.py').is_file())
            self.assertTrue((repo / mod.AUTHORING / 'viewer/Preview.tsx').is_file())
            for changed in git(repo, 'ls-files', '--others', '--exclude-standard').splitlines():
                self.assertTrue(changed.startswith(str(mod.RUNTIME) + '/') or changed.startswith(str(mod.AUTHORING) + '/'))
            self.assertEqual(git(repo, 'rev-parse', 'HEAD'), head)
            self.assertEqual(git(repo, 'diff'), '')
            self.assertEqual((repo / 'keep.txt').read_text(), 'Existing game must remain unchanged.\n')

    def test_main_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            repo = self.checkout(folder)
            git(repo, 'branch', '-m', 'main')
            with self.assertRaisesRegex(ValueError, 'review branch'):
                mod.apply_archive(Path(ARCHIVE), repo)

    def test_dirty_checkout_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            repo = self.checkout(folder)
            (repo / 'keep.txt').write_text('uncommitted work')
            with self.assertRaisesRegex(ValueError, 'clean'):
                mod.apply_archive(Path(ARCHIVE), repo)

    def test_wrong_repository_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            repo = self.checkout(folder)
            git(repo, 'remote', 'set-url', 'origin', 'https://github.com/example/other.git')
            with self.assertRaisesRegex(ValueError, 'origin'):
                mod.apply_archive(Path(ARCHIVE), repo)

    def test_install_failure_rolls_back_the_first_directory(self):
        with tempfile.TemporaryDirectory() as folder:
            repo = self.checkout(folder)
            real_replace = os.replace
            count = 0
            def replace(src, dst):
                nonlocal count
                count += 1
                if count == 2:
                    raise OSError('test failure on second install')
                return real_replace(src, dst)
            with patch.object(mod.os, 'replace', side_effect=replace):
                with self.assertRaisesRegex(OSError, 'second install'):
                    mod.apply_archive(Path(ARCHIVE), repo)
            self.assertFalse((repo / mod.RUNTIME).exists())
            self.assertFalse((repo / mod.AUTHORING).exists())
            self.assertEqual(git(repo, 'status', '--porcelain'), '')


if __name__ == '__main__':
    unittest.main()
