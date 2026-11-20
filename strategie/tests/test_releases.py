"""Run with: python -m unittest discover -s strategie/tests -p 'test_*.py'."""
import importlib.util
from pathlib import Path
import shutil
import tempfile
import unittest
import sys


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release', ROOT / 'tools' / 'release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
sys.path.insert(0, str(ROOT / 'tools'))
from build_site import build


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in (*release.game_files_for_html((ROOT / 'play.html').read_text(encoding='utf-8')), 'play.html', 'versions.js'):
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
        for name in release.game_files_for_html(html):
            self.assertEqual((target / name).read_bytes(), (self.root / name).read_bytes())
        for name, contents in old.items():
            if name != 'versions.js':
                self.assertEqual((self.root / name).read_bytes(), contents, name)
        self.assertEqual(release.read_releases(self.root)[-1]['id'], expected)

    def test_archive_optional_script_is_required_if_referenced(self):
        newest = self.root / 'versions' / '1.6.0'
        self.assertIn('atmosphere.js', release.game_files_for_html((newest / 'index.html').read_text()))
        self.assertTrue((newest / 'atmosphere.js').is_file())
        self.assertNotIn('atmosphere.js', release.game_files_for_html(
            (self.root / 'versions' / '1.0.1' / 'index.html').read_text()))

    def test_new_frontier_module_is_published_only_when_referenced(self):
        latest = self.root / 'versions' / '1.7.0'
        self.assertIn('frontier.js', release.game_files_for_html(
            (latest / 'index.html').read_text(encoding='utf-8')))
        self.assertTrue((latest / 'frontier.js').is_file())
        old = self.root / 'versions' / '1.6.0'
        self.assertNotIn('frontier.js', release.game_files_for_html(
            (old / 'index.html').read_text(encoding='utf-8')))

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

    def test_web_build_contains_every_release_and_no_development_files(self):
        for name in ('index.html', 'version-picker.js', 'version-picker.css'):
            shutil.copyfile(ROOT / name, self.root / name)
        output = self.root / 'site'
        ids = build(self.root, output)
        for version in ids:
            archived_html = (self.root / 'versions' / version / 'index.html').read_text(encoding='utf-8')
            for name in ('index.html', *release.game_files_for_html(archived_html)):
                self.assertEqual((output / 'versions' / version / name).read_bytes(),
                                 (self.root / 'versions' / version / name).read_bytes())
        self.assertTrue((output / 'release-info.json').is_file())
        self.assertFalse((output / 'play.html').exists())
        self.assertFalse((output / 'tests').exists())
        before = self.snapshot()
        with self.assertRaises(ValueError):
            build(self.root, output)
        self.assertEqual(self.snapshot(), before)


if __name__ == '__main__':
    unittest.main()
