import {
  createWorld,
  worldView,
  currentFactionState,
  advanceWorld,
  applyIncident,
  setPressure,
  serializeWorld,
  hydrateWorld,
  snapshotFingerprint,
  replayFingerprint,
  runScript,
  publicProof,
} from './model.mjs';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  dialCard: $('#dialCard'),
  flipDialButton: $('#flipDialButton'),
  flipSmallButton: $('#flipSmallButton'),
  dialSideLabel: $('#dialSideLabel'),
  downloadButton: $('#downloadButton'),
  sessionHand: $('#sessionHand'),
  projectedHand: $('#projectedHand'),
  sessionClock: $('#sessionClock'),
  projectedClock: $('#projectedClock'),
  environmentName: $('#environmentName'),
  environmentNote: $('#environmentNote'),
  activeFactionName: $('#activeFactionName'),
  activeGrudge: $('#activeGrudge'),
  activeBand: $('#activeBand'),
  grudgeNeedle: $('#grudgeNeedle'),
  pressureHalo: $('#pressureHalo'),
  sessionMinute: $('#sessionMinute'),
  projectedMinute: $('#projectedMinute'),
  pressureValue: $('#pressureValue'),
  pressureBand: $('#pressureBand'),
  environmentQuadrant: $('#environmentQuadrant'),
  environmentExposure: $('#environmentExposure'),
  projectionModeLabel: $('#projectionModeLabel'),
  advanceSize: $('#advanceSize'),
  projectionMode: $('#projectionMode'),
  advanceButton: $('#advanceButton'),
  advanceProjectedButton: $('#advanceProjectedButton'),
  resetButton: $('#resetButton'),
  pressureSlider: $('#pressureSlider'),
  pressurePending: $('#pressurePending'),
  applyPressureButton: $('#applyPressureButton'),
  factionGrid: $('#factionGrid'),
  factionSelect: $('#factionSelect'),
  saveButton: $('#saveButton'),
  restoreButton: $('#restoreButton'),
  parityButton: $('#parityButton'),
  parityResult: $('#parityResult'),
  snapshotFingerprint: $('#snapshotFingerprint'),
  eventFilter: $('#eventFilter'),
  eventCount: $('#eventCount'),
  eventLedger: $('#eventLedger'),
  statusLamp: $('#statusLamp'),
  proofEvents: $('#proofEvents'),
  proofDuplicates: $('#proofDuplicates'),
  proofReplay: $('#proofReplay'),
  proofFingerprint: $('#proofFingerprint'),
};

let world = createWorld();
let activeFactionId = world.factions[0].id;
let savedSnapshot = null;
let backsideVisible = false;
const proof = publicProof();

function bandColor(band) {
  if (band === 'OPEN WAR') return '#ff5e68';
  if (band === 'HOSTILE') return '#ef8c4b';
  if (band === 'SUSPICIOUS') return '#f2b85b';
  return '#69e4ee';
}

function pressureBand(value) {
  if (value >= 0.9) return { name: 'CRIMSON', color: '#ff5e68' };
  if (value >= 0.5) return { name: 'AMBER', color: '#f2b85b' };
  return { name: 'CYAN', color: '#69e4ee' };
}

function formatMinute(totalMinutes) {
  const day = Math.floor(totalMinutes / 1440);
  const minute = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(minute / 60);
  const minutes = Math.floor(minute % 60);
  const seconds = Math.floor((minute - Math.floor(minute)) * 60);
  return `D${String(day + 1).padStart(2, '0')} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function setStatus(text, color = '#69e4ee') {
  elements.statusLamp.textContent = text;
  elements.statusLamp.style.color = color;
}

function renderProof() {
  elements.proofEvents.textContent = proof.eventCount;
  elements.proofDuplicates.textContent = proof.duplicateIdentities;
  elements.proofReplay.textContent = proof.streamsMatch ? 'MATCH' : 'FAIL';
  elements.proofFingerprint.textContent = proof.directFingerprint;
}

function renderDials(view, active) {
  const sessionDegree = ((view.sessionMinutes % 1440) / 1440) * 360;
  const projectedDegree = ((view.projectedMinutes % 1440) / 1440) * 360;
  elements.sessionHand.style.transform = `rotate(${sessionDegree}deg)`;
  elements.projectedHand.style.transform = `rotate(${projectedDegree}deg)`;
  elements.sessionClock.textContent = formatMinute(view.sessionMinutes);
  elements.projectedClock.textContent = formatMinute(view.projectedMinutes);
  elements.environmentName.textContent = view.environment.name;
  elements.environmentNote.textContent = view.environment.note;

  elements.activeFactionName.textContent = active.name;
  elements.activeGrudge.textContent = active.grudge.toFixed(6);
  elements.activeBand.textContent = active.band;
  elements.activeBand.style.color = bandColor(active.band);
  const needleAngle = -120 + (active.grudge * 240);
  elements.grudgeNeedle.style.transform = `rotate(${needleAngle}deg)`;

  const pressure = pressureBand(view.pressure);
  elements.pressureHalo.style.borderColor = pressure.color;
  elements.pressureHalo.style.boxShadow = `inset 0 0 30px ${pressure.color}33,0 0 34px ${pressure.color}3d`;
}

function factionCard(state) {
  const color = bandColor(state.band);
  return `<button class="faction-card ${state.id === activeFactionId ? 'active' : ''}" type="button" data-faction-id="${state.id}">
    <div class="faction-top"><strong>${state.name}</strong><span style="color:${color}">${state.band}</span></div>
    <div class="grudge-track"><div class="grudge-fill" style="width:${(state.grudge * 100).toFixed(2)}%;background:${color}"></div></div>
    <div class="faction-meta"><span>G ${state.grudge.toFixed(6)}</span><span>FLOOR ${state.floor.toFixed(2)}</span><span>H ${state.effectiveHalfLifeMinutes.toFixed(0)}m</span></div>
  </button>`;
}

function renderFactions(view) {
  elements.factionGrid.innerHTML = view.factions.map(factionCard).join('');
  elements.factionSelect.innerHTML = view.factions.map((faction) => `<option value="${faction.id}">${faction.name}</option>`).join('');
  elements.factionSelect.value = activeFactionId;
  $$('.faction-card').forEach((card) => card.addEventListener('click', () => {
    activeFactionId = card.dataset.factionId;
    elements.factionSelect.value = activeFactionId;
    render();
  }));
}

function eventDetail(event) {
  if (event.type === 'HostilityBandChanged') return `${event.factionId}: ${event.detail.from} → ${event.detail.to} · ${event.detail.direction}`;
  if (event.type === 'MemoryIncident') return `${event.factionId}: ${event.detail.label} · +${event.detail.amount.toFixed(2)}`;
  if (event.type === 'PressureChanged') return `${event.detail.before.toFixed(2)} → ${event.detail.after.toFixed(2)}`;
  if (event.type === 'ProjectedEnvironmentChanged') return `${event.detail.environment} · ${event.detail.exposure} exposure`;
  return JSON.stringify(event.detail ?? {});
}

function renderEvents() {
  const filter = elements.eventFilter.value;
  const filtered = world.events.filter((event) => filter === 'all' || event.type === filter).slice(-160).reverse();
  elements.eventCount.textContent = `${world.events.length} EVENTS`;
  if (!filtered.length) {
    elements.eventLedger.innerHTML = '<div class="empty-ledger">No events have crossed the selected edge yet.</div>';
    return;
  }
  elements.eventLedger.innerHTML = filtered.map((event) => {
    const edgeClass = event.type === 'HostilityBandChanged' ? `edge-${event.detail.direction.toLowerCase()}` : '';
    return `<div class="event-row ${edgeClass}">
      <span class="event-time">S ${event.scheduledSessionMinute.toFixed(3)}</span>
      <span class="event-clock">${event.clock} · P${event.priority} · #${event.sequence}</span>
      <span class="event-type">${event.type}</span>
      <span class="event-detail">${eventDetail(event)}</span>
    </div>`;
  }).join('');
}

function renderMetrics(view) {
  const pressure = pressureBand(view.pressure);
  elements.sessionMinute.textContent = view.sessionMinutes.toFixed(3);
  elements.projectedMinute.textContent = view.projectedMinutes.toFixed(3);
  elements.pressureValue.textContent = view.pressure.toFixed(2);
  elements.pressureBand.textContent = pressure.name;
  elements.pressureBand.style.color = pressure.color;
  elements.environmentQuadrant.textContent = view.environment.quadrant;
  elements.environmentExposure.textContent = `${view.environment.exposure} exposure`;
  elements.projectionModeLabel.textContent = elements.projectionMode.value === 'freeze' ? 'Frozen · Session continues' : 'Following Session';
}

function render() {
  const view = worldView(world);
  const active = currentFactionState(world, activeFactionId);
  renderDials(view, active);
  renderMetrics(view);
  renderFactions(view);
  renderEvents();
}

function flipDial() {
  backsideVisible = !backsideVisible;
  elements.dialCard.classList.toggle('flipped', backsideVisible);
  elements.dialSideLabel.textContent = backsideVisible ? 'BACK // PERMANENT CAUSAL MEMORY' : 'FRONT // PROJECTED PRESENTATION';
  elements.flipDialButton.textContent = backsideVisible ? 'Return to projected face' : 'Reveal backside causal dial';
}

function advance() {
  const sessionDelta = Number(elements.advanceSize.value);
  const projectedDelta = elements.projectionMode.value === 'freeze' ? 0 : sessionDelta;
  world = advanceWorld(world, sessionDelta, projectedDelta);
  setStatus(projectedDelta === 0 ? 'SESSION ADVANCED · PROJECTED FROZEN' : 'MOVEMENT ADVANCED');
  render();
}

function applyPressureChange() {
  const value = Number(elements.pressureSlider.value);
  world = setPressure(world, value);
  setStatus('PRESSURE RE-ANCHORED', pressureBand(value).color);
  render();
}

function incident(amount, label) {
  activeFactionId = elements.factionSelect.value;
  world = applyIncident(world, activeFactionId, amount, label);
  const active = currentFactionState(world, activeFactionId);
  setStatus(`${active.band} EDGE`, bandColor(active.band));
  if (!backsideVisible) flipDial();
  render();
}

function saveSnapshot() {
  savedSnapshot = serializeWorld(world);
  localStorage.setItem('kfu-public-bay-03-snapshot', savedSnapshot);
  elements.snapshotFingerprint.textContent = snapshotFingerprint(world);
  elements.restoreButton.disabled = false;
  elements.parityResult.textContent = `Saved at Session ${world.sessionMinutes.toFixed(3)} with ${world.events.length} events. No transitions were fired by saving.`;
  setStatus('SNAPSHOT SAVED');
}

function restoreSnapshot() {
  const serialized = savedSnapshot ?? localStorage.getItem('kfu-public-bay-03-snapshot');
  if (!serialized) return;
  const expectedEventCount = JSON.parse(serialized).events.length;
  world = hydrateWorld(serialized);
  activeFactionId = world.factions.some((faction) => faction.id === activeFactionId) ? activeFactionId : world.factions[0].id;
  elements.pressureSlider.value = String(world.pressure);
  elements.pressurePending.textContent = world.pressure.toFixed(2);
  elements.snapshotFingerprint.textContent = snapshotFingerprint(world);
  elements.parityResult.textContent = `Rehydrated exact snapshot with ${world.events.length} events. Restore emitted ${world.events.length - expectedEventCount} new events.`;
  setStatus('SNAPSHOT REHYDRATED');
  render();
}

function runParityDemo() {
  const beforeActions = [
    { type: 'incident', factionId: 'brass-accord', amount: 0.22, label: 'Parity breach' },
    { type: 'advance', sessionDelta: 720, projectedDelta: 360 },
    { type: 'pressure', value: 0.8 },
  ];
  const afterActions = [
    { type: 'advance', sessionDelta: 1440, projectedDelta: 720 },
    { type: 'incident', factionId: 'night-cartographers', amount: 0.4, label: 'Parity shock' },
    { type: 'advance', sessionDelta: 360, projectedDelta: 0 },
  ];
  const checkpoint = runScript(createWorld(), beforeActions);
  const uninterrupted = runScript(checkpoint, afterActions);
  const resumed = runScript(hydrateWorld(serializeWorld(checkpoint)), afterActions);
  const sameSnapshot = serializeWorld(uninterrupted) === serializeWorld(resumed);
  const sameReplay = replayFingerprint(uninterrupted.events) === replayFingerprint(resumed.events);
  elements.parityResult.textContent = `SAVE/LOAD ${sameSnapshot && sameReplay ? 'PARITY PASSED' : 'PARITY FAILED'} · snapshot ${snapshotFingerprint(resumed)} · replay ${replayFingerprint(resumed.events)}`;
  setStatus(sameSnapshot && sameReplay ? 'PARITY PASSED' : 'PARITY FAILED', sameSnapshot && sameReplay ? '#69e4ee' : '#ff5e68');
}

function downloadDiagnostic() {
  const view = worldView(world);
  const payload = {
    schema: 'KFU.PublicLabBay03.Diagnostic.v1',
    generatedAt: new Date().toISOString(),
    publicBoundary: 'Browser-safe public demonstration. No private engine source or credentials.',
    state: JSON.parse(serializeWorld(world)),
    view,
    eventFingerprint: replayFingerprint(world.events),
    snapshotFingerprint: snapshotFingerprint(world),
    proof,
  };
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `KFU_BAY_03_CAUSAL_MEMORY_SESSION_${Math.floor(world.sessionMinutes)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus('DIAGNOSTIC EXPORTED');
}

function reset() {
  world = createWorld();
  activeFactionId = world.factions[0].id;
  savedSnapshot = null;
  elements.restoreButton.disabled = true;
  elements.snapshotFingerprint.textContent = 'NO SNAPSHOT';
  elements.parityResult.textContent = 'No parity demonstration run yet.';
  elements.pressureSlider.value = String(world.pressure);
  elements.pressurePending.textContent = world.pressure.toFixed(2);
  setStatus('RESET');
  render();
}

elements.flipDialButton.addEventListener('click', flipDial);
elements.flipSmallButton.addEventListener('click', flipDial);
elements.advanceButton.addEventListener('click', advance);
elements.advanceProjectedButton.addEventListener('click', () => {
  world = advanceWorld(world, 0, 360);
  setStatus('PROJECTED ENVIRONMENT ADVANCED');
  render();
});
elements.resetButton.addEventListener('click', reset);
elements.pressureSlider.addEventListener('input', () => {
  elements.pressurePending.textContent = Number(elements.pressureSlider.value).toFixed(2);
});
elements.applyPressureButton.addEventListener('click', applyPressureChange);
elements.factionSelect.addEventListener('change', () => {
  activeFactionId = elements.factionSelect.value;
  render();
});
$$('.incident-buttons button').forEach((button) => button.addEventListener('click', () => {
  incident(Number(button.dataset.amount), button.dataset.label);
}));
elements.saveButton.addEventListener('click', saveSnapshot);
elements.restoreButton.addEventListener('click', restoreSnapshot);
elements.parityButton.addEventListener('click', runParityDemo);
elements.eventFilter.addEventListener('change', renderEvents);
elements.downloadButton.addEventListener('click', downloadDiagnostic);
elements.projectionMode.addEventListener('change', () => {
  setStatus(elements.projectionMode.value === 'freeze' ? 'PROJECTED CLOCK FROZEN' : 'PROJECTED CLOCK FOLLOWING');
  render();
});

const stored = localStorage.getItem('kfu-public-bay-03-snapshot');
if (stored) {
  savedSnapshot = stored;
  elements.restoreButton.disabled = false;
  try {
    elements.snapshotFingerprint.textContent = snapshotFingerprint(hydrateWorld(stored));
  } catch {
    localStorage.removeItem('kfu-public-bay-03-snapshot');
    savedSnapshot = null;
    elements.restoreButton.disabled = true;
  }
}

renderProof();
render();
