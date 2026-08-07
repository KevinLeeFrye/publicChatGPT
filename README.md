# KEVIN FRYE UNLIMITED

### F.R.Y.E. Unlimited Studios · Public Landing Page and Experiment Yard

> **The clockwork is the game. Time and memory are a deterministic consequence engine.**

This public repository is the front door for Kevin Frye Unlimited. It hosts selected browser experiments, public proof cards, architecture previews, test reports, and release-ready descendants without exposing private engines, credentials, unreleased intellectual property, or studio records.

## Public site

The static site lives at the repository root and is designed for GitHub Pages.

- [`index.html`](index.html) — studio landing page
- [`lab/`](lab/) — Public Lab Bay 01 deterministic boundary console
- [`lab/bay-02/`](lab/bay-02/) — interactive 369 BioClock visualization
- [`PUBLIC_RELEASE_POLICY.md`](PUBLIC_RELEASE_POLICY.md) — public/private release boundary

## Public Lab Bay 02 · 369 BioClock

Bay 02 is a browser-safe, dependency-free visualization of the exact F.R.Y.E. day hierarchy:

- 1,440 minutes per day
- 36 forty-minute Units
- four ten-minute phases per Unit
- four Quadrants
- twelve Fields
- six elemental Petals
- four Gate 3, four Gate 6, and four Gate 9 boundaries per day
- separate monotonic Session time and controllable Projected time
- deterministic pressure bands and boundary stream
- downloadable public diagnostic JSON

The model includes Node tests that compare direct and irregular stepped replay across a complete day. The expected public-model proof is **215 ordered boundary events, zero duplicate identities, and matching replay fingerprints**. The additional Field and Petal events are public visualization layers and do not replace the previously sealed Temporal Engine v0.1.0 proof.

## Current sealed engine proof

**F.R.Y.E. Temporal Engine v0.1.0** completed a private GitHub Actions verification gate:

| Gate | Result |
|---|---:|
| .NET Release build | 0 warnings, 0 errors |
| xUnit | 19 passed, 0 failed |
| One-day ordered engine events | 197 |
| Duplicate engine events | 0 |
| Replay parity | Passed |
| Static source validation | Passed |

Replay hash:

```text
a20242c18ddaa043cc0a61575f6b0b03d2ab24302394455887e5daf2108355a1
```

Canonical sealed-engine day-edge order:

```text
Gate9 → DayReset → QuadrantChanged → UnitChanged → PhaseChanged
```

Bay 02 extends the public visualization with Petal and Field change notifications. Its day edge is therefore:

```text
Gate9 → DayReset → QuadrantChanged → PetalChanged → FieldChanged → UnitChanged → PhaseChanged
```

## Public validation bench

Every push and pull request to `main` runs:

- JavaScript and module syntax checks
- deterministic BioClock Node tests
- HTML parsing
- static route smoke tests
- obvious-secret scanning

## What belongs here

- Small public demonstrations
- Testable source capsules
- Proof summaries and reproducible evidence
- Public issues and feedback
- Release candidates explicitly prepared for public distribution

The early clean-core F.R.Y.E. OS preview files remain in this repository as preserved lineage.

## What does not belong here

Credentials, private repository dumps, personal data, unreleased full engines, legal or investor records, and unsupported verification claims stay out of the public yard.

Read the full [`PUBLIC_RELEASE_POLICY.md`](PUBLIC_RELEASE_POLICY.md).

## Founder

**Kevin Lee Frye**  
Founder and Creative Director, Kevin Frye Unlimited / F.R.Y.E. Unlimited Studios

---

**Something new grew.**
