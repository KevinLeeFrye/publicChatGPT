# F.R.Y.E. OS — Clean Core Preview

**A local-first, zero-dependency personal operating layer for Windows.**

F.R.Y.E. OS is an experimental Python runtime built around a simple idea: local memory and identity should survive software evolution, while code changes should be tested as new descendants instead of overwriting the last working system.

## Why this preview exists

This public preview is here to see whether the architecture resonates with local-first developers, Windows power users, agent builders, and people interested in inspectable self-evolving software.

The preview is deliberately small and clean. It does **not** contain the World Clock, Golden Ascension, games, simulators, investor material, or unrelated research.

## Core architecture

- **Stable root bootstrap** — `frye.py` stays outside versioned runtimes and launches the active descendant.
- **Frozen parent lineage** — v0.1.0 remains preserved while v0.1.1 is the active verified descendant.
- **Durable shared state** — Markdown memory and append-only JSONL ledgers live outside versioned code.
- **Descendant evolution** — changes are cloned, tested, and promoted by an atomic active-pointer swap.
- **Workshop staging** — external Python is copied, hashed, and syntax-checked before execution.
- **Proportionate authority** — routine actions can run automatically; higher-consequence actions become explicit pending approvals.
- **Swappable providers** — offline Echo plus OpenAI-compatible local endpoints using only the Python standard library.
- **Loopback dashboard** — a local control panel served at `127.0.0.1:8765`.

## Verified clean baseline

- Parent runtime v0.1.0: **8/8 tests passed**
- Active descendant v0.1.1: **9/9 tests passed**
- Bootstrap self-check: **passed**
- Dashboard status API: **passed**
- Parent preservation: **passed**
- Forbidden-content purity scan: **passed**
- Third-party Python dependencies: **none**

See [`INSTALL_VERIFICATION_REPORT.md`](INSTALL_VERIFICATION_REPORT.md) and [`SOURCE_PROVENANCE.md`](SOURCE_PROVENANCE.md) for the exact truth boundary.

## What is public right now

This repository currently publishes the architecture, clean-core contract, verification evidence, Windows wrappers, immutable bootstrap, and clean-core verifier. The complete frozen runtime package has been prepared separately and will be attached as an official release after a native Windows verification pass.

## Intended Windows workflow

Requirements: Windows 10/11 and Python 3.10+.

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\setup.ps1 -CreateDesktopShortcut
.\frye.ps1 selfcheck
.\frye.ps1 status
.\frye.ps1 serve --open-browser
```

Dashboard: `http://127.0.0.1:8765/`

> Keep the dashboard on loopback. This preview is not designed to be exposed directly to a LAN or the public internet.

## Clean-core law

`versions/FRYE_OS_v0.1.0` and `descendants/FRYE_OS_v0.1.1` are frozen baselines. New systems attach under:

```text
optional/capabilities/<capability-id>/
optional/workspaces/<workspace-id>/
```

—or arrive as a new descendant. No blind overwrite is permitted.

## Status

This is a **pre-1.0 experimental public architecture preview** and a fresh reconstruction of the documented install-verified v0.1.1 lineage. It is not presented as a byte-for-byte recovery of an earlier unavailable archive.

## Feedback wanted

The most useful feedback is architectural:

- Does the immutable-bootstrap + descendant model make sense?
- Is a standard-library-only Windows runtime useful?
- Which part would you test first: memory, Workshop, providers, rollback, or dashboard?
- What would make you star, fork, or actually install it?

Open an issue with what you would test, what feels unclear, or what you would build on top of it.
