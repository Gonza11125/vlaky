#!/usr/bin/env python3
"""Build a minimal GitHub Pages directory containing all published game versions."""
import argparse
import json
from pathlib import Path
import shutil

from release import ROOT, GAME_FILES, read_releases, version_tuple


def build(root, output):
    releases = read_releases(root)
    if not releases:
        raise ValueError('Neexistuje žádné vydání k publikování.')
    if output.exists() and any(output.iterdir()):
        raise ValueError('Cílová složka musí být prázdná; existující soubory se nemažou.')
    files = [(root / name, Path(name)) for name in ('index.html', 'versions.js', 'version-picker.js', 'version-picker.css')]
    for release in releases:
        folder = Path('versions') / release['id']
        files.extend((root / folder / name, folder / name) for name in ('index.html', *GAME_FILES))
    for source, _ in files:
        if not source.is_file() or source.is_symlink():
            raise ValueError('Chybějící nebo nepovolený soubor vydání: ' + str(source))
    output.mkdir(parents=True, exist_ok=True)
    for source, relative in files:
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    (output / '.nojekyll').write_text('', encoding='utf-8')
    ids = sorted((r['id'] for r in releases), key=version_tuple)
    (output / 'release-info.json').write_text(json.dumps({'latest': ids[-1], 'versions': ids}, indent=2) + '\n', encoding='utf-8')
    return ids


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    try:
        ids = build(ROOT, args.output.resolve())
    except (ValueError, OSError) as error:
        parser.exit(1, str(error) + '\n')
    print('Připraven web s vydáními: ' + ', '.join(ids))
