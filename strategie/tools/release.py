#!/usr/bin/env python3
"""Freeze the working game as a new, selectable release. No build dependencies."""
import argparse
import json
from pathlib import Path
import re
import shutil
import tempfile


ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'window.VEK_RELEASES = '
GAME_FILES = ('data.js', 'world.js', 'game.js', 'net.js', 'ui.js')


def version_tuple(version):
    if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version):
        raise ValueError('Verze musí mít tvar 1.0.2 (tři celá čísla bez úvodních nul).')
    return tuple(map(int, version.split('.')))


def read_releases(root):
    text = (root / 'versions.js').read_text(encoding='utf-8').strip()
    if not text.startswith(PREFIX) or not text.endswith(';'):
        raise ValueError('Neplatný seznam versions.js.')
    releases = json.loads(text[len(PREFIX):-1])
    for release in releases:
        version_tuple(release['id'])
    return releases


def publish(root, version=None, description='Nové vydání Věku pokroku.'):
    releases = read_releases(root)
    highest = max((version_tuple(r['id']) for r in releases), default=(1, 0, 0))
    if version is None:
        version = '.'.join(map(str, (*highest[:2], highest[2] + 1)))
    if version_tuple(version) <= highest:
        raise ValueError('Nové vydání musí mít vyšší číslo než všechna dosavadní vydání.')
    target = root / 'versions' / version
    if target.exists():
        raise ValueError('Složka vydání již existuje. Vydané verze se nepřepisují.')
    html = (root / 'play.html').read_text(encoding='utf-8')
    marker = 'data-version="development"'
    if html.count(marker) != 1:
        raise ValueError('V play.html chybí jednoznačné označení vývojové verze.')
    html = html.replace(marker, 'data-version="' + version + '"')
    for name in ('versions.js', 'version-picker.js'):
        html = html.replace('src="' + name + '"', 'src="../../' + name + '"')
    releases.append({'id': version, 'description': description})
    registry = PREFIX + json.dumps(releases, ensure_ascii=False, indent=2) + ';\n'
    target.parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.release-', dir=target.parent) as temp:
        staged = Path(temp) / version
        staged.mkdir()
        (staged / 'index.html').write_text(html, encoding='utf-8')
        for name in GAME_FILES:
            shutil.copyfile(root / name, staged / name)
        staged.rename(target)
    # Replace the registry only once the complete release exists on disk.
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=root,
                                     prefix='.versions-', delete=False) as out:
        out.write(registry)
        registry_temp = Path(out.name)
    registry_temp.replace(root / 'versions.js')
    return version


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('version', nargs='?', help='e.g. 1.0.2; default: next patch version')
    parser.add_argument('--description', default='Nové vydání Věku pokroku.')
    args = parser.parse_args()
    try:
        result = publish(ROOT, args.version, args.description)
    except (ValueError, OSError) as error:
        parser.exit(1, str(error) + '\n')
    print('Připraveno vydání ' + result + '. Přidej versions.js a versions/' + result + ' do stejného commitu.')
