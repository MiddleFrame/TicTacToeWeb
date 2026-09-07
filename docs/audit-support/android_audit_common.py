import hashlib
import json
import pathlib


def reject_private(path):
    for candidate in (path.absolute(), path.resolve()):
        parts = [part.casefold() for part in candidate.parts]
        if any(parts[index:index + 2] == ['android-config', 'private'] for index in range(len(parts) - 1)):
            raise ValueError('Reading or writing android-config/private is forbidden')
    return path.resolve()


def repository_root(explicit=None):
    starts = [pathlib.Path(explicit)] if explicit else [pathlib.Path(__file__).parent, pathlib.Path.cwd()]
    for start in starts:
        for candidate in [start.resolve(), *start.resolve().parents]:
            if (candidate / 'package.json').is_file() and (candidate / 'app/game/player-progress.ts').is_file():
                return candidate
    raise ValueError('Could not find the standalone TicTacToeWeb checkout')


def input_path(root, value):
    candidate = pathlib.Path(value)
    return reject_private(candidate if candidate.is_absolute() else root / candidate)


def work_output(root, value):
    target = input_path(root, value)
    work = (root / 'work').resolve()
    if not target.is_relative_to(work) or target == work:
        raise ValueError('Output must be inside this checkout\'s ignored work directory')
    return target


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
