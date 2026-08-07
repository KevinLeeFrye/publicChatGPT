import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOCK,
  decodeClock,
  enumerateBoundaries,
  countEventTypes,
  advanceProjection,
  computePressure,
  oneDayProof,
} from '../lab/bay-02/model.mjs';

test('clock constants preserve the exact 1,440-minute hierarchy', () => {
  assert.equal(CLOCK.DAY_MINUTES, 1440);
  assert.equal(CLOCK.UNITS_PER_DAY, 36);
  assert.equal(CLOCK.DAY_MINUTES / CLOCK.UNIT_MINUTES, 36);
  assert.equal(CLOCK.UNIT_MINUTES / CLOCK.PHASE_MINUTES, 4);
  assert.equal(CLOCK.DAY_MINUTES / CLOCK.QUADRANT_MINUTES, 4);
  assert.equal(CLOCK.DAY_MINUTES / CLOCK.FIELD_MINUTES, 12);
  assert.equal(CLOCK.DAY_MINUTES / CLOCK.PETAL_MINUTES, 6);
});

test('minute zero decodes to the first unit, phase, quadrant, field, and petal', () => {
  const state = decodeClock(0);
  assert.equal(state.unit, 1);
  assert.equal(state.phase.name, 'SPARK');
  assert.equal(state.phase.alias, 'ENTRY');
  assert.equal(state.quadrant, 'DAWN');
  assert.equal(state.field, 'ARIES');
  assert.equal(state.petal, 'EARTH');
  assert.equal(state.nextGate, 3);
});

test('the last minute of the day decodes to unit 36 and Release phase', () => {
  const state = decodeClock(1439.999);
  assert.equal(state.unit, 36);
  assert.equal(state.phase.name, 'RELEASE');
  assert.equal(state.quadrant, 'NIGHT');
  assert.equal(state.field, 'PISCES');
  assert.equal(state.petal, 'SHADOW');
  assert.equal(state.nextGate, 9);
});

test('one full day emits every exact boundary count with zero duplicates', () => {
  const events = enumerateBoundaries(0, CLOCK.DAY_MINUTES, 'PROJECTED');
  const counts = countEventTypes(events);
  assert.deepEqual(counts, {
    PhaseChanged: 144,
    UnitChanged: 36,
    Gate3: 4,
    FieldChanged: 12,
    Gate6: 4,
    PetalChanged: 6,
    Gate9: 4,
    QuadrantChanged: 4,
    DayReset: 1,
  });
  assert.equal(events.length, 215);
  assert.equal(new Set(events.map((event) => event.identity)).size, 215);
});

test('the day edge preserves canonical same-minute priority', () => {
  const types = enumerateBoundaries(1430, 1440, 'PROJECTED').map((event) => event.type);
  assert.deepEqual(types, [
    'Gate9',
    'DayReset',
    'QuadrantChanged',
    'PetalChanged',
    'FieldChanged',
    'UnitChanged',
    'PhaseChanged',
  ]);
});

test('direct and irregular stepped replay produce the same event stream', () => {
  const proof = oneDayProof();
  assert.equal(proof.totalEvents, 215);
  assert.equal(proof.duplicates, 0);
  assert.equal(proof.eventStreamsMatch, true);
  assert.equal(proof.directFingerprint, proof.steppedFingerprint);
  assert.deepEqual(proof.dayBoundaryOrder, [
    'Gate9',
    'DayReset',
    'QuadrantChanged',
    'PetalChanged',
    'FieldChanged',
    'UnitChanged',
    'PhaseChanged',
  ]);
});

test('Session can continue while Projected time is frozen', () => {
  const frozen = advanceProjection(225, 90, 'freeze');
  assert.equal(frozen.minute, 225);
  assert.deepEqual(frozen.segments, []);
});

test('Release Ten loop recoils before the next Unit boundary', () => {
  const looped = advanceProjection(35, 12, 'release-loop');
  assert.ok(looped.minute >= 30 && looped.minute < 40);
  assert.equal(looped.recoils, 1);
  assert.equal(looped.segments.some(([, to]) => to >= 40), false);
});

test('pressure changes band deterministically', () => {
  assert.equal(computePressure(0, 0).band, 'CYAN');
  assert.equal(computePressure(1000, 30).band, 'CRIMSON');
});
