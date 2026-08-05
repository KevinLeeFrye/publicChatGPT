# FRYE OS Clean Core Contract

## Frozen authority

`FRYE_OS_INSTALL_VERIFIED_v0.1.1` is represented here as the clean immutable core baseline.

- `versions/FRYE_OS_v0.1.0` is the preserved parent.
- `descendants/FRYE_OS_v0.1.1` is the frozen active descendant.
- Neither directory may be modified by optional systems.

## Allowed attachment surfaces

- `optional/capabilities/<capability-id>/`
- `optional/workspaces/<workspace-id>/`
- a new versioned descendant under `descendants/`

## Forbidden root contamination

Do not place World Clock, Golden Ascension, Living Seed Engine, games, simulations,
research dumps, investor materials, or arbitrary project files in the root, parent,
or frozen descendant.

## Promotion law

clone parent -> test against cloned shared state -> record manifest -> atomic active pointer swap

No blind overwrite is permitted.
