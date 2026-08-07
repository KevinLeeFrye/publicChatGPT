import {
  CLOCK,
  decodeClock,
  enumerateBoundaries,
  advanceProjection,
  computePressure,
  canonicalEventStream,
  fnv1a64,
  oneDayProof,
} from './model.mjs';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  runButton: $('#runButton'),
  resetButton: $('#resetButton'),
  downloadButton: $('#downloadButton'),
  speedSelect: $('#speedSelect'),
  projectionMode: $('#projectionMode'),
  eventFilter: $('#eventFilter'),
  eventLog: $('#eventLog'),
  eventCount: $('#eventCount'),
  sessionMinute: $('#sessionMinute'),
  sessionDay: $('#sessionDay'),
  projectedMinute: $('#projectedMinute'),
  driftValue: $('#driftValue'),
  unitValue: $('#unitValue'),
  phaseValue: $('#phaseValue'),
  phaseAlias: $('#phaseAlias'),
  quadrantValue: $('#quadrantValue'),
  fieldValue: $('#fieldValue'),
  petalValue: $('#petalValue'),
  gateValue: $('#gateValue'),
  gateCountdown: $('#gateCountdown'),
  pressureValue: $('#pressureValue'),
  pressureBand: $('#pressureBand'),
  pressureFill: $('#pressureFill'),
  pressureGlow: $('#pressureGlow'),
  sessionHand: $('#sessionHand'),
  projectedHand: $('#projectedHand'),
  unitHand: $('#unitHand'),
  dialMinute: $('#dialMinute'),
  statusText: $('#statusText'),
  proofText: $('#proofText'),
  unitTicks: $('#unitTicks'),
  fieldTicks: $('#fieldTicks'),
  petalLabels: $('#petalLabels'),
};

const state = {
  sessionMinutes: 0,
  projectedMinutes: 0,
  playing: false,
  speed: Number(elements.speedSelect?.value ?? 10),
  projectionMode: elements.projectionMode?.value ?? 'follow',
  events: [],
  sequence: 0,
  loopCount: 0,
  lastFrame: performance.now(),
};

function svgElement(name, attributes = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function polarPoint(angleDegrees, radius) {
  const angle = (angleDegrees - 90) * Math.PI / 180;
  return { x: 200 + Math.cos(angle) * radius, y: 200 + Math.sin(angle) * radius };
}

function buildDial() {
  if (!elements.unitTicks || !elements.fieldTicks || !elements.petalLabels) return;

  for (let index = 0; index < CLOCK.UNITS_PER_DAY; index += 1) {
    const angle = index * 10;
    const outer = polarPoint(angle, 178);
    const inner = polarPoint(angle, index % 3 === 0 ? 160 : 169);
    elements.unitTicks.append(svgElement('line', {
      x1: inner.x,
      y1: inner.y,
      x2: outer.x,
      y2: outer.y,
      class: index % 3 === 0 ? 'unit-tick major' : 'unit-tick',
    }));
  }

  for (let index = 0; index < CLOCK.FIELDS_PER_DAY; index += 1) {
    const angle = index * 30;
    const outer = polarPoint(angle, 151);
    const inner = polarPoint(angle, 78);
    elements.fieldTicks.append(svgElement('line', {
      x1: inner.x,
      y1: inner.y,
      x2: outer.x,
      y2: outer.y,
      class: 'field-spoke',
    }));
  }

  const petalNames = ['EARTH', 'WATER', 'AIR', 'FIRE', 'LIGHT', 'SHADOW'];
  petalNames.forEach((name, index) => {
    const point = polarPoint(index * 60 + 30, 118);
    const text = svgElement('text', {
      x: point.x,
      y: point.y,
      class: 'petal-label',
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
    });
    text.textContent = name;
    elements.petalLabels.append(text);
  });
}

function formatMinute(totalMinutes) {
  const minute = ((totalMinutes % CLOCK.DAY_MINUTES) + CLOCK.DAY_MINUTES) % CLOCK.DAY_MINUTES;
  const hours = Math.floor(minute / 60);
  const minutes = Math.floor(minute % 60);
  const seconds = Math.floor((minute - Math.floor(minute)) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function addEvents(events) {
  for (const event of events) {
    state.events.push({ ...event, sequence: state.sequence });
    state.sequence += 1;
  }
  if (state.events.length > 600) state.events.splice(0, state.events.length - 600);
}

function addControlEvent(type, detail) {
  const projected = decodeClock(state.projectedMinutes);
  state.events.push({
    clock: 'CONTROL',
    tickMinute: state.sessionMinutes,
    tickSecond: Math.round(state.sessionMinutes * 60),
    priority: 5,
    sequence: state.sequence,
    type,
    identity: `CONTROL:${state.sequence}:${type}`,
    detail,
    state: {
      day: projected.dayIndex,
      unit: projected.unit,
      phase: projected.phase.name,
      quadrant: projected.quadrant,
      field: projected.field,
      petal: projected.petal,
    },
  });
  state.sequence += 1;
}

function advance(deltaMinutes) {
  if (!Number.isFinite(deltaMinutes) || deltaMinutes <= 0) return;

  const sessionFrom = state.sessionMinutes;
  const projectedFrom = state.projectedMinutes;
  state.sessionMinutes += deltaMinutes;
  addEvents(enumerateBoundaries(sessionFrom, state.sessionMinutes, 'SESSION'));

  const projection = advanceProjection(projectedFrom, deltaMinutes, state.projectionMode);
  if (projection.snapped) addControlEvent('ProjectedSnapToRelease', 'Projected clock entered the Release Ten loop.');
  for (const [from, to] of projection.segments) {
    addEvents(enumerateBoundaries(from, to, 'PROJECTED'));
  }
  for (let index = 0; index < projection.recoils; index += 1) {
    state.loopCount += 1;
    addControlEvent('LoopReleaseTenRecoil', `Release loop recoil ${state.loopCount}.`);
  }
  state.projectedMinutes = projection.minute;
  render();
}

function pressureColor(band) {
  if (band === 'CRIMSON') return '#ff5e68';
  if (band === 'AMBER') return '#f2b85b';
  return '#69e4ee';
}

function renderMetrics() {
  const session = decodeClock(state.sessionMinutes);
  const projected = decodeClock(state.projectedMinutes);
  const pressure = computePressure(state.sessionMinutes, state.projectedMinutes);
  const drift = state.sessionMinutes - state.projectedMinutes;

  elements.sessionMinute.textContent = formatMinute(state.sessionMinutes);
  elements.sessionDay.textContent = `DAY ${session.dayIndex + 1} · ${state.sessionMinutes.toFixed(2)} TOTAL MIN`;
  elements.projectedMinute.textContent = formatMinute(state.projectedMinutes);
  elements.driftValue.textContent = `${drift.toFixed(2)} MIN`;
  elements.unitValue.textContent = String(projected.unit).padStart(2, '0');
  elements.phaseValue.textContent = projected.phase.name;
  elements.phaseAlias.textContent = projected.phase.alias;
  elements.quadrantValue.textContent = `${projected.quadrantIndex + 1} · ${projected.quadrant}`;
  elements.fieldValue.textContent = `${projected.fieldIndex + 1} · ${projected.field}`;
  elements.petalValue.textContent = `${projected.petalIndex + 1} · ${projected.petal}`;
  elements.gateValue.textContent = `GATE ${projected.nextGate}`;
  elements.gateCountdown.textContent = `${projected.minutesUntilGate.toFixed(2)} MIN`;
  elements.pressureValue.textContent = `${Math.round(pressure.value * 100)}%`;
  elements.pressureBand.textContent = pressure.band;
  elements.dialMinute.textContent = formatMinute(state.projectedMinutes);

  const color = pressureColor(pressure.band);
  const circumference = 2 * Math.PI * 184;
  elements.pressureFill.style.stroke = color;
  elements.pressureFill.style.strokeDasharray = String(circumference);
  elements.pressureFill.style.strokeDashoffset = String(circumference * (1 - pressure.value));
  elements.pressureGlow.style.stroke = color;
  document.documentElement.style.setProperty('--bio-pressure', color);

  elements.sessionHand.style.transform = `rotate(${session.degree}deg)`;
  elements.projectedHand.style.transform = `rotate(${projected.degree}deg)`;
  elements.unitHand.style.transform = `rotate(${projected.unitIndex * 10 + projected.minuteOfUnit / 4}deg)`;

  $$('.phase-cell').forEach((cell, index) => {
    cell.classList.toggle('active', index === projected.phaseIndex);
  });

  const modeLabel = {
    follow: 'Projected time follows Session time.',
    freeze: 'Projected time is frozen while Session time remains monotonic.',
    'release-loop': 'Projected time loops inside Release Ten while Session time continues.',
  }[state.projectionMode];
  elements.statusText.textContent = `${state.playing ? 'RUNNING' : 'PAUSED'} · ${modeLabel}`;
}

function eventClass(event) {
  if (event.type.startsWith('Gate')) return 'gate';
  if (event.type.includes('Loop') || event.type.includes('Snap')) return 'loop';
  if (event.type === 'DayReset') return 'reset';
  if (event.type === 'PhaseChanged') return 'phase';
  return '';
}

function filteredEvents() {
  const filter = elements.eventFilter.value;
  if (filter === 'ALL') return state.events;
  if (filter === 'GATES') return state.events.filter((event) => event.type.startsWith('Gate'));
  return state.events.filter((event) => event.clock === filter);
}

function renderEvents() {
  const visible = filteredEvents().slice(-160).reverse();
  elements.eventLog.replaceChildren();

  if (visible.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-log';
    empty.textContent = 'Advance the movement to generate deterministic boundary events.';
    elements.eventLog.append(empty);
  } else {
    const fragment = document.createDocumentFragment();
    for (const event of visible) {
      const row = document.createElement('div');
      row.className = `bio-event ${eventClass(event)}`;
      const clock = document.createElement('span');
      clock.className = 'event-clock';
      clock.textContent = event.clock;
      const tick = document.createElement('span');
      tick.className = 'event-tick';
      tick.textContent = formatMinute(event.tickMinute);
      const name = document.createElement('strong');
      name.textContent = event.type;
      const stateText = document.createElement('span');
      stateText.className = 'event-state';
      stateText.textContent = event.detail ?? `U${event.state.unit} · ${event.state.phase} · ${event.state.field}`;
      row.append(clock, tick, name, stateText);
      fragment.append(row);
    }
    elements.eventLog.append(fragment);
  }
  elements.eventCount.textContent = `${state.events.length} TOTAL`;
}

function render() {
  renderMetrics();
  renderEvents();
}

async function sha256Hex(text) {
  if (!globalThis.crypto?.subtle) return `fnv1a64:${fnv1a64(text)}`;
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function downloadDiagnostic() {
  const projected = decodeClock(state.projectedMinutes);
  const session = decodeClock(state.sessionMinutes);
  const pressure = computePressure(state.sessionMinutes, state.projectedMinutes);
  const canonical = canonicalEventStream(state.events);
  const diagnostic = {
    schema: 'FRYE.PublicBioClockDiagnostic',
    version: 1,
    generatedAt: new Date().toISOString(),
    publicSafetyBoundary: 'Browser-safe model only. No private engine source, credentials, Drive records, or unreleased assets.',
    constants: CLOCK,
    controls: {
      playing: state.playing,
      speedVirtualMinutesPerSecond: state.speed,
      projectionMode: state.projectionMode,
      loopCount: state.loopCount,
    },
    session,
    projected,
    pressure,
    eventCount: state.events.length,
    eventStreamSha256: await sha256Hex(canonical),
    events: state.events.slice(-256),
    oneDayProof: oneDayProof(),
  };

  const blob = new Blob([JSON.stringify(diagnostic, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `FRYE_369_BioClock_Diagnostic_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  addControlEvent('DiagnosticDownloaded', 'Public diagnostic JSON exported.');
  renderEvents();
}

function reset() {
  state.sessionMinutes = 0;
  state.projectedMinutes = 0;
  state.playing = false;
  state.events = [];
  state.sequence = 0;
  state.loopCount = 0;
  state.lastFrame = performance.now();
  elements.runButton.textContent = 'Run movement';
  render();
}

function frame(now) {
  const elapsedSeconds = Math.min((now - state.lastFrame) / 1000, 0.25);
  state.lastFrame = now;
  if (state.playing) advance(elapsedSeconds * state.speed);
  requestAnimationFrame(frame);
}

function wireControls() {
  elements.runButton.addEventListener('click', () => {
    state.playing = !state.playing;
    state.lastFrame = performance.now();
    elements.runButton.textContent = state.playing ? 'Pause movement' : 'Run movement';
    renderMetrics();
  });
  elements.resetButton.addEventListener('click', reset);
  elements.downloadButton.addEventListener('click', downloadDiagnostic);
  elements.speedSelect.addEventListener('change', () => {
    state.speed = Number(elements.speedSelect.value);
    addControlEvent('SpeedChanged', `${state.speed} virtual minutes per real second.`);
    render();
  });
  elements.projectionMode.addEventListener('change', () => {
    state.projectionMode = elements.projectionMode.value;
    addControlEvent('ProjectionModeChanged', state.projectionMode);
    render();
  });
  elements.eventFilter.addEventListener('change', renderEvents);
  $$('[data-step]').forEach((button) => {
    button.addEventListener('click', () => advance(Number(button.dataset.step)));
  });
}

function initializeProof() {
  const proof = oneDayProof();
  elements.proofText.textContent = `${proof.totalEvents} events · ${proof.duplicates} duplicates · replay ${proof.eventStreamsMatch ? 'MATCH' : 'MISMATCH'} · ${proof.directFingerprint}`;
}

buildDial();
wireControls();
initializeProof();
render();
requestAnimationFrame(frame);
