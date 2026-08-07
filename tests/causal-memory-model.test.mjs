import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOSTILITY_BANDS,
  createWorld,
  hostilityBand,
  effectiveHalfLife,
  analyticalGrudge,
  currentFactionState,
  projectedEnvironment,
  advanceWorld,
  applyIncident,
  setPressure,
  serializeWorld,
  hydrateWorld,
  snapshotFingerprint,
  canonicalEventStream,
  replayFingerprint,
  runScript,
  publicProof,
} from '../lab/bay-03/model.mjs';

const almostEqual = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

test('four hostility bands preserve exact thresholds', () => {
  assert.deepEqual(HOSTILITY_BANDS.map((band) => band.name), ['IDLE', 'SUSPICIOUS', 'HOSTILE', 'OPEN WAR']);
  assert.equal(hostilityBand(0.199999), 'IDLE');
  assert.equal(hostilityBand(0.2), 'SUSPICIOUS');
  assert.equal(hostilityBand(0.5), 'HOSTILE');
  assert.equal(hostilityBand(0.8), 'OPEN WAR');
});

test('pressure deterministically lengthens the analytical half-life', () => {
  assert.equal(effectiveHalfLife(600, 0), 600);
  assert.equal(effectiveHalfLife(600, 0.5), 1200);
  assert.equal(effectiveHalfLife(600, 1), 1800);
});

test('analytical decay reaches one half-life exactly above its floor', () => {
  const world = createWorld({
    pressure: 0,
    factions: [{ id: 'a', name: 'A', grudge: 0.9, floor: 0.1, baseHalfLifeMinutes: 600 }],
  });
  const faction = world.factions[0];
  almostEqual(analyticalGrudge(faction, 600, 0), 0.5);
});

test('Session time advances while Projected time remains frozen', () => {
  const world = advanceWorld(createWorld(), 240, 0);
  assert.equal(world.sessionMinutes, 240);
  assert.equal(world.projectedMinutes, 0);
  assert.equal(projectedEnvironment(world.projectedMinutes).quadrant, 'DAWN');
});

test('an incident emits every upward hostility edge exactly once', () => {
  let world = createWorld({
    factions: [{ id: 'a', name: 'A', grudge: 0.1, floor: 0.02, baseHalfLifeMinutes: 600 }],
  });
  world = applyIncident(world, 'a', 0.85, 'Public test breach');
  const transitions = world.events.filter((event) => event.type === 'HostilityBandChanged');
  assert.deepEqual(transitions.map((event) => event.detail.to), ['SUSPICIOUS', 'HOSTILE', 'OPEN WAR']);
  assert.equal(new Set(transitions.map((event) => event.identity)).size, 3);
});

test('analytical decay emits downward edges once even across a long jump', () => {
  let world = createWorld({
    pressure: 0,
    factions: [{ id: 'a', name: 'A', grudge: 0.95, floor: 0.01, baseHalfLifeMinutes: 120 }],
  });
  world = advanceWorld(world, 1200, 0);
  const transitions = world.events.filter((event) => event.type === 'HostilityBandChanged');
  assert.deepEqual(transitions.map((event) => event.detail.to), ['HOSTILE', 'SUSPICIOUS', 'IDLE']);
  assert.ok(transitions[0].scheduledSessionMinute < transitions[1].scheduledSessionMinute);
  assert.ok(transitions[1].scheduledSessionMinute < transitions[2].scheduledSessionMinute);
});

test('stable queue ordering resolves simultaneous faction edges by faction order', () => {
  let world = createWorld({
    pressure: 0,
    factions: [
      { id: 'first', name: 'First', grudge: 0.9, floor: 0.1, baseHalfLifeMinutes: 100 },
      { id: 'second', name: 'Second', grudge: 0.9, floor: 0.1, baseHalfLifeMinutes: 100 },
    ],
  });
  world = advanceWorld(world, 1000, 0);
  const firstPair = world.events.filter((event) => event.type === 'HostilityBandChanged').slice(0, 2);
  assert.deepEqual(firstPair.map((event) => event.factionId), ['first', 'second']);
  assert.ok(firstPair[0].sequence < firstPair[1].sequence);
});

test('Projected environment changes are driven only by Projected time', () => {
  let world = createWorld({ sessionMinutes: 350, projectedMinutes: 350 });
  world = advanceWorld(world, 20, 0);
  assert.equal(world.events.some((event) => event.type === 'ProjectedEnvironmentChanged'), false);
  world = advanceWorld(world, 20, 20);
  const event = world.events.find((candidate) => candidate.type === 'ProjectedEnvironmentChanged');
  assert.equal(event.detail.quadrant, 'DAY');
  assert.equal(event.projectedMinute, 360);
});

test('changing pressure preserves current grudge by re-anchoring', () => {
  let world = createWorld({
    pressure: 0.2,
    factions: [{ id: 'a', name: 'A', grudge: 0.8, floor: 0.1, baseHalfLifeMinutes: 600 }],
  });
  world = advanceWorld(world, 300, 0);
  const before = currentFactionState(world, 'a').grudge;
  world = setPressure(world, 0.9);
  const after = currentFactionState(world, 'a').grudge;
  almostEqual(after, before);
  assert.equal(world.events.at(-1).type, 'PressureChanged');
});

test('save and hydrate preserve exact state without firing duplicate events', () => {
  let world = createWorld();
  world = applyIncident(world, 'river-wardens', 0.35, 'Boundary test');
  world = advanceWorld(world, 480, 120);
  const serialized = serializeWorld(world);
  const restored = hydrateWorld(serialized);
  assert.equal(serializeWorld(restored), serialized);
  assert.equal(restored.events.length, world.events.length);
  assert.equal(snapshotFingerprint(restored), snapshotFingerprint(world));
});

test('continued execution after hydrate matches uninterrupted execution', () => {
  const actionsBeforeSave = [
    { type: 'incident', factionId: 'brass-accord', amount: 0.22, label: 'Public breach' },
    { type: 'advance', sessionDelta: 720, projectedDelta: 360 },
    { type: 'pressure', value: 0.8 },
  ];
  const actionsAfterSave = [
    { type: 'advance', sessionDelta: 1440, projectedDelta: 720 },
    { type: 'incident', factionId: 'night-cartographers', amount: 0.4, label: 'Memory shock' },
    { type: 'advance', sessionDelta: 360, projectedDelta: 0 },
  ];
  const before = runScript(createWorld(), actionsBeforeSave);
  const uninterrupted = runScript(before, actionsAfterSave);
  const restored = hydrateWorld(serializeWorld(before));
  const resumed = runScript(restored, actionsAfterSave);
  assert.equal(serializeWorld(resumed), serializeWorld(uninterrupted));
  assert.equal(replayFingerprint(resumed.events), replayFingerprint(uninterrupted.events));
});

test('direct and stepped replay produce identical causal event streams', () => {
  const initial = createWorld({
    pressure: 0.55,
    factions: [{ id: 'a', name: 'A', grudge: 0.96, floor: 0.04, baseHalfLifeMinutes: 360 }],
  });
  const direct = advanceWorld(initial, 2880, 1440);
  let stepped = initial;
  let remainingSession = 2880;
  let remainingProjected = 1440;
  const pattern = [17, 61, 5, 113, 37, 241, 19];
  let index = 0;
  while (remainingSession > 1e-9) {
    const sessionDelta = Math.min(remainingSession, pattern[index % pattern.length]);
    const projectedDelta = remainingSession <= sessionDelta
      ? remainingProjected
      : (sessionDelta / remainingSession) * remainingProjected;
    stepped = advanceWorld(stepped, sessionDelta, projectedDelta);
    remainingSession -= sessionDelta;
    remainingProjected -= projectedDelta;
    index += 1;
  }
  assert.equal(canonicalEventStream(stepped.events), canonicalEventStream(direct.events));
  assert.equal(replayFingerprint(stepped.events), replayFingerprint(direct.events));
});

test('public proof is deterministic and duplicate-free', () => {
  const proof = publicProof();
  assert.equal(proof.streamsMatch, true);
  assert.equal(proof.directFingerprint, proof.steppedFingerprint);
  assert.equal(proof.duplicateIdentities, 0);
  assert.ok(proof.eventCount > 0);
  assert.equal(proof.finalBand, 'IDLE');
});
