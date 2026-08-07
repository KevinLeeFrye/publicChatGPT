export const CLOCK = Object.freeze({
  DAY_MINUTES: 1440,
  UNIT_MINUTES: 40,
  PHASE_MINUTES: 10,
  QUADRANT_MINUTES: 360,
  FIELD_MINUTES: 120,
  PETAL_MINUTES: 240,
  UNITS_PER_DAY: 36,
  PHASES_PER_UNIT: 4,
  QUADRANTS_PER_DAY: 4,
  FIELDS_PER_DAY: 12,
  PETALS_PER_DAY: 6,
});

export const PHASES = Object.freeze([
  Object.freeze({ name: 'SPARK', alias: 'ENTRY' }),
  Object.freeze({ name: 'SURGE', alias: 'BUILD' }),
  Object.freeze({ name: 'CREST', alias: 'PEAK' }),
  Object.freeze({ name: 'RELEASE', alias: 'RELEASE' }),
]);

export const QUADRANTS = Object.freeze(['DAWN', 'DAY', 'DUSK', 'NIGHT']);
export const FIELDS = Object.freeze([
  'ARIES', 'TAURUS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO',
  'LIBRA', 'SCORPIO', 'SAGITTARIUS', 'CAPRICORN', 'AQUARIUS', 'PISCES',
]);
export const PETALS = Object.freeze(['EARTH', 'WATER', 'AIR', 'FIRE', 'LIGHT', 'SHADOW']);

export const EVENT_PRIORITY = Object.freeze({
  Gate3: 10,
  Gate6: 10,
  Gate9: 10,
  DayReset: 20,
  QuadrantChanged: 30,
  PetalChanged: 40,
  FieldChanged: 50,
  UnitChanged: 60,
  PhaseChanged: 70,
});

const EPSILON = 1e-9;

export function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function decodeClock(totalMinutes) {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
    throw new RangeError('totalMinutes must be a finite non-negative number');
  }

  const dayIndex = Math.floor(totalMinutes / CLOCK.DAY_MINUTES);
  const minuteOfDay = positiveModulo(totalMinutes, CLOCK.DAY_MINUTES);
  const unitIndex = Math.floor(minuteOfDay / CLOCK.UNIT_MINUTES);
  const minuteOfUnit = positiveModulo(minuteOfDay, CLOCK.UNIT_MINUTES);
  const phaseIndex = Math.floor(minuteOfUnit / CLOCK.PHASE_MINUTES);
  const quadrantIndex = Math.floor(minuteOfDay / CLOCK.QUADRANT_MINUTES);
  const fieldIndex = Math.floor(minuteOfDay / CLOCK.FIELD_MINUTES);
  const petalIndex = Math.floor(minuteOfDay / CLOCK.PETAL_MINUTES);
  const gateSlot = Math.floor(minuteOfDay / CLOCK.FIELD_MINUTES) % 3;
  const nextGate = [3, 6, 9][gateSlot];
  const nextGateMinuteOfDay = Math.min(
    CLOCK.DAY_MINUTES,
    (Math.floor(minuteOfDay / CLOCK.FIELD_MINUTES) + 1) * CLOCK.FIELD_MINUTES,
  );

  return Object.freeze({
    totalMinutes,
    dayIndex,
    minuteOfDay,
    degree: minuteOfDay / 4,
    unitIndex,
    unit: unitIndex + 1,
    minuteOfUnit,
    phaseIndex,
    phase: PHASES[phaseIndex],
    quadrantIndex,
    quadrant: QUADRANTS[quadrantIndex],
    fieldIndex,
    field: FIELDS[fieldIndex],
    petalIndex,
    petal: PETALS[petalIndex],
    nextGate,
    nextGateMinuteOfDay,
    minutesUntilGate: nextGateMinuteOfDay - minuteOfDay,
  });
}

function gateTypeAtBoundary(boundaryMinute) {
  const gateIndex = Math.floor((boundaryMinute - EPSILON) / CLOCK.FIELD_MINUTES) % 3;
  return `Gate${[3, 6, 9][gateIndex]}`;
}

function createEvent(clock, tickMinute, type, sequence) {
  const decoded = decodeClock(tickMinute);
  return Object.freeze({
    clock,
    tickMinute,
    tickSecond: Math.round(tickMinute * 60),
    priority: EVENT_PRIORITY[type],
    sequence,
    type,
    identity: `${clock}:${tickMinute.toFixed(6)}:${type}`,
    state: Object.freeze({
      day: decoded.dayIndex,
      minuteOfDay: decoded.minuteOfDay,
      unit: decoded.unit,
      phase: decoded.phase.name,
      quadrant: decoded.quadrant,
      field: decoded.field,
      petal: decoded.petal,
    }),
  });
}

export function enumerateBoundaries(fromExclusive, toInclusive, clock = 'PROJECTED') {
  if (!Number.isFinite(fromExclusive) || !Number.isFinite(toInclusive)) {
    throw new TypeError('Boundary range must be finite');
  }
  if (toInclusive < fromExclusive) {
    throw new RangeError('toInclusive must be greater than or equal to fromExclusive');
  }
  if (fromExclusive < 0) {
    throw new RangeError('fromExclusive must be non-negative');
  }

  const events = [];
  let sequence = 0;
  let boundary = (Math.floor(fromExclusive / CLOCK.PHASE_MINUTES) + 1) * CLOCK.PHASE_MINUTES;

  while (boundary <= toInclusive + EPSILON) {
    const types = [];
    if (boundary % CLOCK.FIELD_MINUTES === 0) types.push(gateTypeAtBoundary(boundary));
    if (boundary % CLOCK.DAY_MINUTES === 0) types.push('DayReset');
    if (boundary % CLOCK.QUADRANT_MINUTES === 0) types.push('QuadrantChanged');
    if (boundary % CLOCK.PETAL_MINUTES === 0) types.push('PetalChanged');
    if (boundary % CLOCK.FIELD_MINUTES === 0) types.push('FieldChanged');
    if (boundary % CLOCK.UNIT_MINUTES === 0) types.push('UnitChanged');
    types.push('PhaseChanged');

    for (const type of types) {
      events.push(createEvent(clock, boundary, type, sequence));
      sequence += 1;
    }
    boundary += CLOCK.PHASE_MINUTES;
  }

  return events;
}

export function countEventTypes(events) {
  return events.reduce((counts, event) => {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
    return counts;
  }, {});
}

export function canonicalEventLine(event) {
  return [
    event.clock,
    event.tickMinute.toFixed(6),
    event.priority,
    event.sequence,
    event.type,
    event.state.day,
    event.state.unit,
    event.state.phase,
    event.state.quadrant,
    event.state.field,
    event.state.petal,
  ].join('|');
}

export function canonicalEventStream(events) {
  return events.map(canonicalEventLine).join('\n');
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

export function replayFingerprint(events) {
  return fnv1a64(canonicalEventStream(events));
}

export function computePressure(sessionMinutes, projectedMinutes) {
  const projected = decodeClock(projectedMinutes);
  const phaseBase = [0.18, 0.42, 0.68, 0.82][projected.phaseIndex];
  const minuteInField = positiveModulo(projected.minuteOfDay, CLOCK.FIELD_MINUTES);
  const distanceToGate = Math.min(minuteInField, CLOCK.FIELD_MINUTES - minuteInField);
  const gatePulse = Math.max(0, 1 - distanceToGate / 10) * 0.12;
  const drift = Math.min(Math.abs(sessionMinutes - projectedMinutes) / CLOCK.QUADRANT_MINUTES, 1) * 0.16;
  const value = clamp(phaseBase + gatePulse + drift, 0, 1);
  const band = value >= 0.9 ? 'CRIMSON' : value >= 0.5 ? 'AMBER' : 'CYAN';
  return Object.freeze({ value, band, gatePulse, drift, phaseBase });
}

export function advanceProjection(currentMinutes, deltaMinutes, mode = 'follow') {
  if (!Number.isFinite(currentMinutes) || currentMinutes < 0) {
    throw new RangeError('currentMinutes must be a finite non-negative number');
  }
  if (!Number.isFinite(deltaMinutes) || deltaMinutes < 0) {
    throw new RangeError('deltaMinutes must be a finite non-negative number');
  }

  if (mode === 'freeze') {
    return Object.freeze({ minute: currentMinutes, segments: [], recoils: 0, snapped: false });
  }
  if (mode === 'follow') {
    return Object.freeze({
      minute: currentMinutes + deltaMinutes,
      segments: [[currentMinutes, currentMinutes + deltaMinutes]],
      recoils: 0,
      snapped: false,
    });
  }
  if (mode !== 'release-loop') {
    throw new RangeError(`Unknown projection mode: ${mode}`);
  }

  const unitStart = Math.floor(currentMinutes / CLOCK.UNIT_MINUTES) * CLOCK.UNIT_MINUTES;
  const releaseStart = unitStart + 30;
  const unitEnd = unitStart + 40;
  let position = currentMinutes;
  let snapped = false;
  if (position < releaseStart || position >= unitEnd) {
    position = releaseStart;
    snapped = true;
  }

  let remaining = deltaMinutes;
  let recoils = 0;
  const segments = [];

  while (remaining > EPSILON) {
    const distance = unitEnd - position;
    if (remaining < distance - EPSILON) {
      segments.push([position, position + remaining]);
      position += remaining;
      remaining = 0;
    } else {
      if (distance > EPSILON) segments.push([position, unitEnd - EPSILON]);
      remaining -= distance;
      position = releaseStart;
      recoils += 1;
    }
  }

  return Object.freeze({ minute: position, segments, recoils, snapped });
}

export function oneDayProof() {
  const direct = enumerateBoundaries(0, CLOCK.DAY_MINUTES, 'PROJECTED');
  const stepped = [];
  let cursor = 0;
  const pattern = [7, 19, 43, 2, 61, 11, 37];
  let patternIndex = 0;
  while (cursor < CLOCK.DAY_MINUTES) {
    const next = Math.min(CLOCK.DAY_MINUTES, cursor + pattern[patternIndex % pattern.length]);
    stepped.push(...enumerateBoundaries(cursor, next, 'PROJECTED'));
    cursor = next;
    patternIndex += 1;
  }

  const directCanonical = canonicalEventStream(direct);
  const steppedCanonical = canonicalEventStream(stepped.map((event, index) => Object.freeze({ ...event, sequence: index })));
  const directNormalized = direct.map((event, index) => Object.freeze({ ...event, sequence: index }));

  return Object.freeze({
    counts: Object.freeze(countEventTypes(direct)),
    totalEvents: direct.length,
    duplicates: direct.length - new Set(direct.map((event) => event.identity)).size,
    directFingerprint: replayFingerprint(directNormalized),
    steppedFingerprint: replayFingerprint(stepped.map((event, index) => Object.freeze({ ...event, sequence: index }))),
    eventStreamsMatch: canonicalEventStream(directNormalized) === steppedCanonical,
    rawDirectStream: directCanonical,
    dayBoundaryOrder: direct
      .filter((event) => event.tickMinute === CLOCK.DAY_MINUTES)
      .map((event) => event.type),
  });
}
