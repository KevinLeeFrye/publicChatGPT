from __future__ import annotations
import json, os, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run(runtime: Path) -> bool:
    env = {**os.environ, 'FRYE_OS_ROOT': str(ROOT), 'FRYE_OS_RUNTIME': str(runtime)}
    return subprocess.run(
        [sys.executable, str(runtime / 'tests' / 'run_tests.py')],
        cwd=ROOT,
        env=env,
    ).returncode == 0


def main() -> int:
    parent = ROOT / 'versions' / 'FRYE_OS_v0.1.0'
    child = ROOT / 'descendants' / 'FRYE_OS_v0.1.1'
    results = {
        'parent_tests': run(parent),
        'descendant_tests': run(child),
    }
    env = {**os.environ, 'FRYE_OS_ROOT': str(ROOT), 'FRYE_OS_RUNTIME': str(child)}
    selfcheck = subprocess.run(
        [sys.executable, str(ROOT / 'frye.py'), 'selfcheck', '--quiet'],
        cwd=ROOT,
        env=env,
    )
    results['bootstrap_selfcheck'] = selfcheck.returncode == 0
    results['parent_preserved'] = (parent / 'app.py').exists()
    results['optional_bays'] = (
        (ROOT / 'optional' / 'capabilities').is_dir()
        and (ROOT / 'optional' / 'workspaces').is_dir()
    )
    forbidden = ['golden', 'ascension', 'world_clock', 'living_seed', 'game']
    names = [str(path.relative_to(ROOT)).lower() for path in ROOT.rglob('*')]
    results['purity'] = not any(any(term in name for term in forbidden) for name in names)
    print(json.dumps(results, indent=2, sort_keys=True))
    return 0 if all(results.values()) else 1


if __name__ == '__main__':
    raise SystemExit(main())
