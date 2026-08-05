from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
POINTER = ROOT / 'active' / 'active_version.json'


def load_pointer() -> dict:
    try:
        return json.loads(POINTER.read_text(encoding='utf-8'))
    except Exception:
        return {}


def healthy(runtime: Path) -> bool:
    app = runtime / 'app.py'
    if not app.is_file():
        return False
    try:
        result = subprocess.run(
            [sys.executable, str(app), 'selfcheck', '--quiet'],
            cwd=ROOT,
            env={**os.environ, 'FRYE_OS_ROOT': str(ROOT)},
            capture_output=True,
            text=True,
            timeout=8,
        )
        return result.returncode == 0
    except Exception:
        return False


def resolve_runtime() -> Path:
    pointer = load_pointer()
    candidates = [
        pointer.get('active_path'),
        pointer.get('last_known_good_path'),
        pointer.get('parent_path'),
        'descendants/FRYE_OS_v0.1.1',
        'versions/FRYE_OS_v0.1.0',
    ]
    seen = set()
    for rel in candidates:
        if not rel or rel in seen:
            continue
        seen.add(rel)
        runtime = (ROOT / rel).resolve()
        try:
            runtime.relative_to(ROOT)
        except ValueError:
            continue
        if healthy(runtime):
            return runtime
    raise SystemExit('FRYE OS: no healthy runtime found.')


def main() -> int:
    runtime = resolve_runtime()
    app = runtime / 'app.py'
    env = {**os.environ, 'FRYE_OS_ROOT': str(ROOT), 'FRYE_OS_RUNTIME': str(runtime)}
    return subprocess.call([sys.executable, str(app), *sys.argv[1:]], cwd=ROOT, env=env)


if __name__ == '__main__':
    raise SystemExit(main())
