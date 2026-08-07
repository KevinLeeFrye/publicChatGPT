export const CLOCK = Object.freeze({
  DAY_MINUTES: 1440,
  UNIT_MINUTES: 40,
  PHASE_MINUTES: 10,
  QUADRANT_MINUTES: 360,
  FIELD_MINUTES: 120,
  PETAL_MINUTES: 240,
  UNITS_PER_DAY: 36,
});

export const QUADRANTS = Object.freeze(['DAWN', 'DAY', 'DUSK', 'NIGHT']);

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

export function decodeClock(totalMinutes) {
  finiteNonNegative(totalMinutes, 'totalMinutes');
  const minuteOfDay = positiveModulo(totalMinutes, CLOCK.DAY_MINUTES);
  const quadrantIndex = Math.floor(minuteOfDay / CLOCK.QUADRANT_MINUTES);
  return Object.freeze({
    totalMinutes,
    dayIndex: Math.floor(totalMinutes / CLOCK.DAY_MINUTES),
    minuteOfDay,
    quadrantIndex,
    quadrant: QUADRANTS[quadrantIndex],
  });
}

export function fnv1a64(text) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  const bytes = new TextEncoder().encode(text);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

export const MEMORY_SCHEMA = 'KFU.PublicCausalMemory.v1';
export const HOSTILITY_BANDS = Object.freeze([
  Object.freeze({ name: 'IDLE', min: 0, max: 0.2 }),
  Object.freeze({ name: 'SUSPICIOUS', min: 0.2, max: 0.5 }),
  Object.freeze({ name: 'HOSTILE', min: 0.5, max: 0.8 }),
  Object.freeze({ name: 'OPEN WAR', min: 0.8, max: 1.0000001 }),
]);

export const EVENT_PRIORITY = Object.freeze({
  MemoryIncident: 10,
  PressureChanged: 20,
  HostilityBandChanged: 30,
  ProjectedEnvironmentChanged: 40,
});

const BAND_THRESHOLDS = Object.freeze([0.2, 0.5, 0.8]);
const EPSILON = 1e-9;

const ENVIRONMENTS = Object.freeze({
  DAWN: Object.freeze({ name: 'MISTED DAWN', exposure: 'LOW', note: 'Soft visibility and cautious approach.' }),
  DAY: Object.freeze({ name: 'OPEN DAY', exposure: 'HIGH', note: 'Long sightlines and public consequence.' }),
  DUSK: Object.freeze({ name: 'BRASS DUSK', exposure: 'MEDIUM', note: 'Signals blur and memories sharpen.' }),
  NIGHT: Object.freeze({ name: 'HIDDEN NIGHT', exposure: 'LOW', note: 'Quiet routes, permanent causal memory.' }),
});

function finiteNonNegative(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and non-negative`);
  return value;
}

function finiteUnit(value, name) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError(`${name} must be between 0 and 1`);
  return value;
}

function roundMinute(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function deepFreezeFaction(faction) {
  return Object.freeze({ ...faction });
}

export function hostilityBand(grudge) {
  finiteUnit(grudge, 'grudge');
  if (grudge >= 0.8) return 'OPEN WAR';
  if (grudge >= 0.5) return 'HOSTILE';
  if (grudge >= 0.2) return 'SUSPICIOUS';
  return 'IDLE';
}

export function effectiveHalfLife(baseHalfLifeMinutes, pressure) {
  finiteNonNegative(baseHalfLifeMinutes, 'baseHalfLifeMinutes');
  if (baseHalfLifeMinutes <= 0) throw new RangeError('baseHalfLifeMinutes must be greater than zero');
  finiteUnit(pressure, 'pressure');
  return baseHalfLifeMinutes * (1 + (2 * pressure));
}

export function analyticalGrudge(faction, sessionMinute, pressure) {
  finiteNonNegative(sessionMinute, 'sessionMinute');
  finiteUnit(pressure, 'pressure');
  if (sessionMinute + EPSILON < faction.anchorSessionMinute) {
    throw new RangeError('sessionMinute cannot precede faction anchorSessionMinute');
  }
  const elapsed = Math.max(0, sessionMinute - faction.anchorSessionMinute);
  const halfLife = effectiveHalfLife(faction.baseHalfLifeMinutes, pressure);
  const decaying = (faction.anchorGrudge - faction.floor) * Math.pow(0.5, elapsed / halfLife);
  return clamp(decaying + faction.floor, faction.floor, 1);
}

export function projectedEnvironment(projectedMinutes) {
  finiteNonNegative(projectedMinutes, 'projectedMinutes');
  const decoded = decodeClock(projectedMinutes);
  return Object.freeze({
    ...ENVIRONMENTS[decoded.quadrant],
    quadrant: decoded.quadrant,
    projectedMinute: projectedMinutes,
    minuteOfDay: decoded.minuteOfDay,
  });
}

export function createWorld(options = {}) {
  const sessionMinutes = finiteNonNegative(options.sessionMinutes ?? 0, 'sessionMinutes');
  const projectedMinutes = finiteNonNegative(options.projectedMinutes ?? 0, 'projectedMinutes');
  const pressure = finiteUnit(options.pressure ?? 0.35, 'pressure');
  const factionInputs = options.factions ?? [
    { id: 'brass-accord', name: 'Brass Accord', grudge: 0.72, floor: 0.08, baseHalfLifeMinutes: 720 },
    { id: 'river-wardens', name: 'River Wardens', grudge: 0.44, floor: 0.05, baseHalfLifeMinutes: 540 },
    { id: 'night-cartographers', name: 'Night Cartographers', grudge: 0.16, floor: 0.02, baseHalfLifeMinutes: 960 },
  ];

  const seen = new Set();
  const factions = factionInputs.map((input, index) => {
    const id = String(input.id ?? `faction-${index + 1}`).trim();
    if (!id || seen.has(id)) throw new RangeError('Faction ids must be unique non-empty strings');
    seen.add(id);
    const grudge = finiteUnit(input.grudge ?? 0, `faction ${id} grudge`);
    const floor = finiteUnit(input.floor ?? 0, `faction ${id} floor`);
    if (floor > grudge) throw new RangeError(`Faction ${id} floor cannot exceed grudge`);
    const baseHalfLifeMinutes = finiteNonNegative(input.baseHalfLifeMinutes ?? 720, `faction ${id} baseHalfLifeMinutes`);
    if (baseHalfLifeMinutes <= 0) throw new RangeError(`Faction ${id} baseHalfLifeMinutes must be greater than zero`);
    return deepFreezeFaction({
      id,
      name: String(input.name ?? id),
      floor,
      baseHalfLifeMinutes,
      anchorGrudge: grudge,
      anchorSessionMinute: sessionMinutes,
      lastBand: hostilityBand(grudge),
      order: index,
    });
  });

  return Object.freeze({
    schema: MEMORY_SCHEMA,
    sessionMinutes,
    projectedMinutes,
    pressure,
    sequence: Number.isInteger(options.sequence) && options.sequence >= 0 ? options.sequence : 0,
    factions: Object.freeze(factions),
    events: Object.freeze([...(options.events ?? [])]),
  });
}

export function currentFactionState(world, factionId, atSessionMinute = world.sessionMinutes) {
  const faction = world.factions.find((candidate) => candidate.id === factionId);
  if (!faction) throw new RangeError(`Unknown faction: ${factionId}`);
  const grudge = analyticalGrudge(faction, atSessionMinute, world.pressure);
  return Object.freeze({
    ...faction,
    grudge,
    band: hostilityBand(grudge),
    effectiveHalfLifeMinutes: effectiveHalfLife(faction.baseHalfLifeMinutes, world.pressure),
  });
}

export function worldView(world) {
  return Object.freeze({
    sessionMinutes: world.sessionMinutes,
    projectedMinutes: world.projectedMinutes,
    pressure: world.pressure,
    environment: projectedEnvironment(world.projectedMinutes),
    factions: Object.freeze(world.factions.map((faction) => currentFactionState(world, faction.id))),
  });
}

function crossingTime(faction, threshold, pressure) {
  if (faction.anchorGrudge <= threshold + EPSILON || faction.floor >= threshold - EPSILON) return null;
  const ratio = (faction.anchorGrudge - faction.floor) / (threshold - faction.floor);
  if (ratio <= 1) return null;
  return faction.anchorSessionMinute + (effectiveHalfLife(faction.baseHalfLifeMinutes, pressure) * Math.log2(ratio));
}

function candidateEvent({ scheduledSessionMinute, priority, localOrder = 0, type, clock, faction = null, projectedMinute = null, detail = null }) {
  return {
    scheduledSessionMinute: roundMinute(scheduledSessionMinute),
    priority,
    localOrder,
    type,
    clock,
    factionId: faction?.id ?? null,
    factionOrder: faction?.order ?? Number.MAX_SAFE_INTEGER,
    projectedMinute: projectedMinute == null ? null : roundMinute(projectedMinute),
    detail,
  };
}

function assignEvents(world, candidates) {
  const ordered = candidates
    .map((candidate, ordinal) => ({ ...candidate, ordinal }))
    .sort((a, b) =>
      (a.scheduledSessionMinute - b.scheduledSessionMinute)
      || (a.priority - b.priority)
      || (a.factionOrder - b.factionOrder)
      || (a.localOrder - b.localOrder)
      || ((a.projectedMinute ?? Number.MAX_SAFE_INTEGER) - (b.projectedMinute ?? Number.MAX_SAFE_INTEGER))
      || (a.ordinal - b.ordinal),
    );
  let sequence = world.sequence;
  const events = ordered.map((candidate) => {
    const event = Object.freeze({
      clock: candidate.clock,
      scheduledSessionMinute: candidate.scheduledSessionMinute,
      projectedMinute: candidate.projectedMinute,
      priority: candidate.priority,
      sequence,
      type: candidate.type,
      factionId: candidate.factionId,
      detail: candidate.detail,
      identity: [
        candidate.clock,
        candidate.scheduledSessionMinute.toFixed(6),
        candidate.priority,
        sequence,
        candidate.type,
        candidate.factionId ?? '-',
        candidate.projectedMinute == null ? '-' : candidate.projectedMinute.toFixed(6),
      ].join(':'),
    });
    sequence += 1;
    return event;
  });
  return Object.freeze({ events: Object.freeze(events), sequence });
}

function appendEvents(world, assigned) {
  return Object.freeze([...world.events, ...assigned.events]);
}

function downwardCrossingCandidates(world, fromSession, toSession) {
  const candidates = [];
  for (const faction of world.factions) {
    const fromGrudge = analyticalGrudge(faction, fromSession, world.pressure);
    const toGrudge = analyticalGrudge(faction, toSession, world.pressure);
    let localOrder = 0;
    for (const threshold of [...BAND_THRESHOLDS].reverse()) {
      if (fromGrudge + EPSILON < threshold || toGrudge >= threshold - EPSILON) continue;
      const tick = crossingTime(faction, threshold, world.pressure);
      if (tick == null || tick <= fromSession + EPSILON || tick > toSession + EPSILON) continue;
      const before = hostilityBand(Math.min(1, threshold + 1e-7));
      const after = hostilityBand(Math.max(0, threshold - 1e-7));
      candidates.push(candidateEvent({
        scheduledSessionMinute: tick,
        priority: EVENT_PRIORITY.HostilityBandChanged,
        localOrder,
        type: 'HostilityBandChanged',
        clock: 'SESSION',
        faction,
        detail: Object.freeze({ direction: 'DOWN', from: before, to: after, threshold }),
      }));
      localOrder += 1;
    }
  }
  return candidates;
}

function projectedEnvironmentCandidates(fromProjected, toProjected, fromSession, toSession) {
  if (toProjected <= fromProjected + EPSILON) return [];
  const deltaProjected = toProjected - fromProjected;
  const deltaSession = toSession - fromSession;
  const candidates = [];
  let boundary = (Math.floor(fromProjected / CLOCK.QUADRANT_MINUTES) + 1) * CLOCK.QUADRANT_MINUTES;
  while (boundary <= toProjected + EPSILON) {
    const ratio = (boundary - fromProjected) / deltaProjected;
    const scheduledSessionMinute = fromSession + (ratio * deltaSession);
    const environment = projectedEnvironment(boundary);
    candidates.push(candidateEvent({
      scheduledSessionMinute,
      projectedMinute: boundary,
      priority: EVENT_PRIORITY.ProjectedEnvironmentChanged,
      type: 'ProjectedEnvironmentChanged',
      clock: 'PROJECTED',
      detail: Object.freeze({
        quadrant: environment.quadrant,
        environment: environment.name,
        exposure: environment.exposure,
      }),
    }));
    boundary += CLOCK.QUADRANT_MINUTES;
  }
  return candidates;
}

function reanchorFactions(world, atSessionMinute, nextPressure = world.pressure) {
  return Object.freeze(world.factions.map((faction) => {
    const grudge = analyticalGrudge(faction, atSessionMinute, world.pressure);
    return deepFreezeFaction({
      ...faction,
      anchorGrudge: grudge,
      anchorSessionMinute: atSessionMinute,
      lastBand: hostilityBand(grudge),
      pressureAtAnchor: nextPressure,
    });
  }));
}

export function advanceWorld(world, sessionDeltaMinutes, projectedDeltaMinutes = sessionDeltaMinutes) {
  finiteNonNegative(sessionDeltaMinutes, 'sessionDeltaMinutes');
  finiteNonNegative(projectedDeltaMinutes, 'projectedDeltaMinutes');
  const fromSession = world.sessionMinutes;
  const toSession = fromSession + sessionDeltaMinutes;
  const fromProjected = world.projectedMinutes;
  const toProjected = fromProjected + projectedDeltaMinutes;
  const candidates = [
    ...downwardCrossingCandidates(world, fromSession, toSession),
    ...projectedEnvironmentCandidates(fromProjected, toProjected, fromSession, toSession),
  ];
  const assigned = assignEvents(world, candidates);
  const factions = Object.freeze(world.factions.map((faction) => {
    const grudge = analyticalGrudge(faction, toSession, world.pressure);
    return deepFreezeFaction({ ...faction, lastBand: hostilityBand(grudge) });
  }));
  return Object.freeze({
    ...world,
    sessionMinutes: toSession,
    projectedMinutes: toProjected,
    sequence: assigned.sequence,
    factions,
    events: appendEvents(world, assigned),
  });
}

function upwardBandCandidates(world, faction, oldGrudge, newGrudge) {
  const candidates = [];
  let localOrder = 0;
  for (const threshold of BAND_THRESHOLDS) {
    if (oldGrudge >= threshold - EPSILON || newGrudge < threshold - EPSILON) continue;
    candidates.push(candidateEvent({
      scheduledSessionMinute: world.sessionMinutes,
      priority: EVENT_PRIORITY.HostilityBandChanged,
      localOrder,
      type: 'HostilityBandChanged',
      clock: 'SESSION',
      faction,
      detail: Object.freeze({
        direction: 'UP',
        from: hostilityBand(Math.max(0, threshold - 1e-7)),
        to: hostilityBand(Math.min(1, threshold + 1e-7)),
        threshold,
      }),
    }));
    localOrder += 1;
  }
  return candidates;
}

export function applyIncident(world, factionId, amount, label = 'Public demonstration incident') {
  if (!Number.isFinite(amount) || amount <= 0) throw new RangeError('amount must be finite and greater than zero');
  const factionIndex = world.factions.findIndex((candidate) => candidate.id === factionId);
  if (factionIndex < 0) throw new RangeError(`Unknown faction: ${factionId}`);
  const faction = world.factions[factionIndex];
  const oldGrudge = analyticalGrudge(faction, world.sessionMinutes, world.pressure);
  const newGrudge = clamp(oldGrudge + amount, faction.floor, 1);
  const candidates = [
    candidateEvent({
      scheduledSessionMinute: world.sessionMinutes,
      priority: EVENT_PRIORITY.MemoryIncident,
      type: 'MemoryIncident',
      clock: 'SESSION',
      faction,
      detail: Object.freeze({ label: String(label), amount, before: oldGrudge, after: newGrudge }),
    }),
    ...upwardBandCandidates(world, faction, oldGrudge, newGrudge),
  ];
  const assigned = assignEvents(world, candidates);
  const factions = [...world.factions];
  factions[factionIndex] = deepFreezeFaction({
    ...faction,
    anchorGrudge: newGrudge,
    anchorSessionMinute: world.sessionMinutes,
    lastBand: hostilityBand(newGrudge),
  });
  return Object.freeze({
    ...world,
    sequence: assigned.sequence,
    factions: Object.freeze(factions),
    events: appendEvents(world, assigned),
  });
}

export function setPressure(world, pressure) {
  finiteUnit(pressure, 'pressure');
  const oldPressure = world.pressure;
  const factions = reanchorFactions(world, world.sessionMinutes, pressure);
  const assigned = assignEvents(world, [candidateEvent({
    scheduledSessionMinute: world.sessionMinutes,
    priority: EVENT_PRIORITY.PressureChanged,
    type: 'PressureChanged',
    clock: 'SESSION',
    detail: Object.freeze({ before: oldPressure, after: pressure }),
  })]);
  return Object.freeze({
    ...world,
    pressure,
    sequence: assigned.sequence,
    factions,
    events: appendEvents(world, assigned),
  });
}

export function canonicalEventLine(event) {
  return [
    event.clock,
    event.scheduledSessionMinute.toFixed(6),
    event.projectedMinute == null ? '-' : event.projectedMinute.toFixed(6),
    event.priority,
    event.sequence,
    event.type,
    event.factionId ?? '-',
    JSON.stringify(event.detail ?? null),
  ].join('|');
}

export function canonicalEventStream(events) {
  return events.map(canonicalEventLine).join('\n');
}

export function replayFingerprint(events) {
  return fnv1a64(canonicalEventStream(events));
}

function canonicalFactionSnapshot(world, faction) {
  return {
    id: faction.id,
    name: faction.name,
    floor: faction.floor,
    baseHalfLifeMinutes: faction.baseHalfLifeMinutes,
    anchorGrudge: faction.anchorGrudge,
    anchorSessionMinute: faction.anchorSessionMinute,
    lastBand: faction.lastBand,
    order: faction.order,
  };
}

export function snapshotObject(world) {
  return {
    schema: MEMORY_SCHEMA,
    sessionMinutes: world.sessionMinutes,
    projectedMinutes: world.projectedMinutes,
    pressure: world.pressure,
    sequence: world.sequence,
    factions: world.factions.map((faction) => canonicalFactionSnapshot(world, faction)),
    events: world.events.map((event) => ({ ...event })),
  };
}

export function serializeWorld(world) {
  return JSON.stringify(snapshotObject(world));
}

export function snapshotFingerprint(world) {
  return fnv1a64(serializeWorld(world));
}

export function hydrateWorld(serialized) {
  const data = typeof serialized === 'string' ? JSON.parse(serialized) : structuredClone(serialized);
  if (data.schema !== MEMORY_SCHEMA) throw new RangeError(`Unsupported snapshot schema: ${data.schema}`);
  const world = createWorld({
    sessionMinutes: data.sessionMinutes,
    projectedMinutes: data.projectedMinutes,
    pressure: data.pressure,
    sequence: data.sequence,
    factions: data.factions.map((faction) => ({
      id: faction.id,
      name: faction.name,
      grudge: faction.anchorGrudge,
      floor: faction.floor,
      baseHalfLifeMinutes: faction.baseHalfLifeMinutes,
    })),
    events: data.events.map((event) => Object.freeze({ ...event, detail: event.detail == null ? null : Object.freeze({ ...event.detail }) })),
  });
  const factions = Object.freeze(data.factions.map((faction) => deepFreezeFaction({ ...faction })));
  return Object.freeze({ ...world, factions, events: Object.freeze([...world.events]) });
}

export function runScript(initialWorld, actions) {
  return actions.reduce((world, action) => {
    if (action.type === 'advance') return advanceWorld(world, action.sessionDelta, action.projectedDelta ?? action.sessionDelta);
    if (action.type === 'incident') return applyIncident(world, action.factionId, action.amount, action.label);
    if (action.type === 'pressure') return setPressure(world, action.value);
    throw new RangeError(`Unknown action type: ${action.type}`);
  }, initialWorld);
}

export function publicProof() {
  const initial = createWorld({
    pressure: 0.55,
    factions: [
      { id: 'proof-faction', name: 'Proof Faction', grudge: 0.96, floor: 0.04, baseHalfLifeMinutes: 360 },
    ],
  });
  const direct = runScript(initial, [
    { type: 'advance', sessionDelta: 2880, projectedDelta: 1440 },
  ]);

  let stepped = initial;
  const pattern = [17, 61, 5, 113, 37, 241, 19];
  let remainingSession = 2880;
  let remainingProjected = 1440;
  let index = 0;
  while (remainingSession > EPSILON) {
    const sessionDelta = Math.min(remainingSession, pattern[index % pattern.length]);
    const projectedDelta = remainingSession <= sessionDelta
      ? remainingProjected
      : (sessionDelta / remainingSession) * remainingProjected;
    stepped = advanceWorld(stepped, sessionDelta, projectedDelta);
    remainingSession -= sessionDelta;
    remainingProjected -= projectedDelta;
    index += 1;
  }

  return Object.freeze({
    directFingerprint: replayFingerprint(direct.events),
    steppedFingerprint: replayFingerprint(stepped.events),
    streamsMatch: canonicalEventStream(direct.events) === canonicalEventStream(stepped.events),
    eventCount: direct.events.length,
    duplicateIdentities: direct.events.length - new Set(direct.events.map((event) => event.identity)).size,
    finalGrudge: currentFactionState(direct, 'proof-faction').grudge,
    finalBand: currentFactionState(direct, 'proof-faction').band,
  });
}
