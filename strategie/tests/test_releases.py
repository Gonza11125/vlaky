"""Run with: python -m unittest discover -s strategie/tests -p 'test_*.py'."""
import importlib.util
from pathlib import Path
import shutil
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release', ROOT / 'tools' / 'release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in (*release.GAME_FILES, 'play.html', 'versions.js'):
            shutil.copyfile(ROOT / name, self.root / name)
        shutil.copytree(ROOT / 'versions', self.root / 'versions')

    def snapshot(self):
        return {str(p.relative_to(self.root)): p.read_bytes()
                for p in self.root.rglob('*') if p.is_file()}

    def test_next_patch_copies_all_game_files_and_preserves_existing_releases(self):
        old = self.snapshot()
        highest = max(release.version_tuple(r['id']) for r in release.read_releases(self.root))
        expected = '.'.join(map(str, (*highest[:2], highest[2] + 1)))
        self.assertEqual(release.publish(self.root), expected)
        target = self.root / 'versions' / expected
        html = (target / 'index.html').read_text()
        self.assertIn('data-version="' + expected + '"', html)
        self.assertIn('src="../../version-picker.js"', html)
        self.assertIn('src="../../versions.js"', html)
        for name in release.GAME_FILES:
            self.assertEqual((target / name).read_bytes(), (self.root / name).read_bytes())
        for name, contents in old.items():
            if name != 'versions.js':
                self.assertEqual((self.root / name).read_bytes(), contents, name)
        self.assertEqual(release.read_releases(self.root)[-1]['id'], expected)

    def test_version_numbers_compare_numerically(self):
        major = max(release.version_tuple(r['id'])[0] for r in release.read_releases(self.root)) + 1
        release.publish(self.root, str(major) + '.0.9')
        release.publish(self.root, str(major) + '.0.10')
        self.assertEqual(release.publish(self.root), str(major) + '.0.11')

    def test_older_duplicate_and_invalid_versions_do_not_change_any_files(self):
        before = self.snapshot()
        for version in ('1.0.1', '1.0.0', '../2', '1.02.3', '2.0', '1.0.2-beta'):
            with self.subTest(version=version), self.assertRaises(ValueError):
                release.publish(self.root, version)
            self.assertEqual(self.snapshot(), before)

    def test_missing_source_cannot_register_an_incomplete_release(self):
        (self.root / 'ui.js').unlink()
        before = self.snapshot()
        with self.assertRaises(OSError):
            release.publish(self.root)
        self.assertEqual(self.snapshot(), before)

    def test_existing_unregistered_directory_cannot_be_overwritten(self):
        target = self.root / 'versions' / '2.0.0'
        target.mkdir()
        (target / 'keep.txt').write_text('keep')
        before = self.snapshot()
        with self.assertRaises(ValueError):
            release.publish(self.root, '2.0.0')
        self.assertEqual(self.snapshot(), before)


if __name__ == '__main__':
    unittest.main()
