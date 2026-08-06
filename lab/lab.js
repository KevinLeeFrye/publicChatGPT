(() => {
  const DAY = 86400;
  const QUADRANT = 21600;
  const UNIT = 2400;
  const PHASE = 600;
  const PHASE_NAMES = ['SPARK', 'SURGE', 'CREST', 'RELEASE'];
  const PRIORITY = { Gate3: 10, Gate6: 11, Gate9: 12, DayReset: 20, QuadrantChanged: 30, UnitChanged: 40, PhaseChanged: 50 };
  let session = 0, projected = 0, sequence = 0, eventTotal = 0;

  const els = {
    step: document.getElementById('stepSize'), stepLabel: document.getElementById('stepLabel'),
    session: document.getElementById('sessionValue'), projected: document.getElementById('projectedValue'),
    unit: document.getElementById('unitValue'), phase: document.getElementById('phaseValue'),
    log: document.getElementById('consoleLog'), count: document.getElementById('eventCount'),
    advance: document.getElementById('advanceButton'), day: document.getElementById('dayButton'), reset: document.getElementById('resetButton')
  };

  const eventAt = (tick, kind) => ({ tick, kind, priority: PRIORITY[kind], sequence: sequence++ });

  function collectEvents(from, to) {
    const events = [];
    const firstBoundary = Math.floor(from / PHASE + 1) * PHASE;
    for (let tick = firstBoundary; tick <= to; tick += PHASE) {
      const daySecond = tick % DAY;
      const globalUnit = Math.floor(tick / UNIT);
      const localUnit = globalUnit % 9;
      if (tick % UNIT === 0) {
        if (localUnit === 3) events.push(eventAt(tick, 'Gate3'));
        if (localUnit === 6) events.push(eventAt(tick, 'Gate6'));
        if (localUnit === 0) events.push(eventAt(tick, 'Gate9'));
        if (daySecond === 0) events.push(eventAt(tick, 'DayReset'));
        if (tick % QUADRANT === 0) events.push(eventAt(tick, 'QuadrantChanged'));
        events.push(eventAt(tick, 'UnitChanged'));
      }
      events.push(eventAt(tick, 'PhaseChanged'));
    }
    return events.sort((a, b) => a.tick - b.tick || a.priority - b.priority || a.sequence - b.sequence);
  }

  function appendLine(event) {
    const row = document.createElement('div');
    row.className = 'log-line';
    const kindClass = event.kind.startsWith('Gate') ? 'gate' : event.kind === 'DayReset' ? 'reset' : event.kind === 'PhaseChanged' ? 'phase' : '';
    row.innerHTML = `<span class="log-tick">${String(event.tick).padStart(6, '0')}</span><span class="log-event ${kindClass}">${event.kind}</span>`;
    els.log.appendChild(row);
    els.log.scrollTop = els.log.scrollHeight;
  }

  function render() {
    const daySecond = projected % DAY;
    els.session.textContent = String(session);
    els.projected.textContent = String(projected);
    els.unit.textContent = String(Math.floor(daySecond / UNIT) + 1);
    els.phase.textContent = PHASE_NAMES[Math.floor((daySecond % UNIT) / PHASE)];
    els.count.textContent = `${eventTotal} EVENT${eventTotal === 1 ? '' : 'S'}`;
  }

  function advance(delta) {
    const events = collectEvents(projected, projected + delta);
    session += delta;
    projected += delta;
    events.forEach(appendLine);
    eventTotal += events.length;
    render();
  }

  function reset() {
    session = projected = sequence = eventTotal = 0;
    els.log.innerHTML = '';
    appendLine({ tick: 0, kind: 'MOVEMENT_READY' });
    render();
  }

  els.step.addEventListener('input', () => { els.stepLabel.textContent = `${Number(els.step.value).toLocaleString()} seconds`; });
  els.advance.addEventListener('click', () => advance(Number(els.step.value)));
  els.day.addEventListener('click', () => advance(Math.floor(projected / DAY + 1) * DAY - projected));
  els.reset.addEventListener('click', reset);
  reset();
})();
