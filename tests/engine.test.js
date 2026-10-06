/* Engine tests. Run with: node --test tests/ */
const test = require('node:test');
const assert = require('node:assert/strict');

require('../js/dates.js');
require('../js/steam-events.js');
require('../js/template.js');
require('../js/engine.js');
require('../js/store.js');

const { dates: D, engine: E, store: S, template: T } = globalThis.SR;
const events = S.defaultEvents();
const day = D.parse;

function newProject(startIso, nfId, launchIso, extra) {
  const launch = launchIso ? day(launchIso) : E.earliestLaunch(events, nfId, {});
  const res = E.autofill({ start: day(startIso), nextFestId: nfId, launch }, events);
  assert.ok(res.ok, res.error);
  return Object.assign({ id: 'p', name: 'Test', nextFestId: nfId, enforce: true, locked: {}, notes: {}, rules: {}, dates: res.dates }, extra);
}

function commit(project, result) {
  return Object.assign({}, project, { dates: result.dates });
}

function broken(project) {
  return E.evaluate(project, events).list.map((v) => v.rule.id);
}

test('date arithmetic', () => {
  assert.equal(D.toIso(D.addMonths(day('2027-01-31'), 1)), '2027-02-28');
  assert.equal(D.toIso(D.addMonths(day('2027-03-15'), -6)), '2026-09-15');
  assert.equal(D.toIso(D.addBusinessDays(day('2026-10-09'), 1)), '2026-10-12'); // Fri → Mon
  assert.equal(D.toIso(D.addBusinessDays(day('2026-10-05'), 10)), '2026-10-19');
  const b = day('2027-03-31');
  const a = D.latestBefore(b, 1, 'm');
  assert.ok(D.addMonths(a, 1) <= b && D.addMonths(a + 1, 1) > b);
  const c = D.earliestAfter(b, 1, 'm');
  assert.ok(D.addMonths(c, 1) >= b && D.addMonths(c - 1, 1) < b);
});

test('every rule references existing items and endpoints', () => {
  T.rules.forEach((r) => {
    const refs = r.type === 'gap' ? [r.a, r.b] : [r.b];
    refs.forEach((ref) => assert.ok(T.itemById[ref.item], `${r.id}: unknown item ${ref.item}`));
  });
});

test('earliest launch for June 2027 respects the window and the Summer Sale', () => {
  const l = E.earliestLaunch(events, 'nf-2027-06', {});
  assert.equal(D.toIso(l), '2027-07-12'); // fest ends 21 Jun + 3 weeks, after the Summer Sale (ends 8 Jul)
  const w = E.launchWindow(events, 'nf-2027-06', {});
  assert.equal(D.toIso(w.to), '2027-08-16');
});

test('auto-fill produces a plan with no broken rules', () => {
  const p = newProject('2026-10-06', 'nf-2027-06');
  assert.deepEqual(broken(p), []);
  assert.equal(D.toIso(p.dates.M1.date), '2026-10-06');
  assert.equal(D.toIso(p.dates.M13.end), '2027-07-12');
  assert.equal(p.dates.M14.start, p.dates.M13.end);
});

test('auto-fill reports an impossible plan', () => {
  // Feb 2027 fest → launch ≥ 22 Mar 2027 → page live ≤ Sep 2026, before the start.
  const launch = E.earliestLaunch(events, 'nf-2027-02', {});
  const res = E.autofill({ start: day('2026-10-06'), nextFestId: 'nf-2027-02', launch }, events);
  assert.equal(res.ok, false);
  assert.ok(res.error);
});

test('dragging the page live later pushes the chain and stops at the last valid date', () => {
  const p = newProject('2026-10-06', 'nf-2027-06');
  const res = E.tryMove(p, events, 'M5', 'move', 120);
  assert.ok(res.blocked, 'should be blocked by a fixed date');
  assert.ok(res.delta > 0 && res.delta < 120);
  const q = commit(p, res);
  assert.deepEqual(broken(q), []);
  assert.ok(q.dates.M6.date >= D.offset(q.dates.M5.date, 4, 'w'));
  // one more day must be impossible
  const more = E.tryMove(q, events, 'M5', 'move', 1);
  assert.equal(more.delta, 0);
});

test('launch cannot leave the window after Next Fest', () => {
  const p = newProject('2026-10-06', 'nf-2027-06');
  const res = E.tryMove(p, events, 'M13', 'move', 200);
  const q = commit(p, res);
  assert.deepEqual(broken(q), []);
  assert.ok(q.dates.M13.end <= day('2027-08-16'));
  assert.equal(res.blocked.id, 'r24');
});

test('launch cannot be dropped inside a seasonal sale', () => {
  const p = newProject('2026-10-06', 'nf-2027-06');
  // Move launch earlier, towards the Summer Sale (24 Jun – 8 Jul).
  const res = E.tryMove(p, events, 'M13', 'move', -10);
  assert.equal(res.delta, 0);
  assert.ok(res.blocked);
});

test('dragging the demo earlier pushes the earlier milestones back', () => {
  const p = newProject('2026-10-06', 'nf-2027-06');
  const res = E.tryMove(p, events, 'M8', 'move', -60);
  assert.equal(res.delta, -60);
  const q = commit(p, res);
  assert.deepEqual(broken(q), []);
  assert.ok(q.dates.M7.end <= q.dates.M8.date);
  assert.ok(res.moved.has('M7'));
});

test('locked milestones never move', () => {
  const p = newProject('2026-10-06', 'nf-2027-06', null, { locked: { M1: true } });
  const res = E.tryMove(p, events, 'M8', 'move', -200);
  assert.ok(res.blocked);
  const q = commit(p, res);
  assert.equal(q.dates.M1.date, p.dates.M1.date);
  assert.deepEqual(broken(q), []);
});

test('with enforcement off, moves are free and broken rules are reported', () => {
  const p = newProject('2026-10-06', 'nf-2027-06', null, { enforce: false });
  const res = E.tryMove(p, events, 'M5', 'move', 200);
  assert.equal(res.delta, 200);
  const q = commit(p, res);
  assert.ok(broken(q).includes('r25'));
  // turning enforcement back on pulls the page back inside the rules
  const fix = E.tryNormalize(Object.assign({}, q, { enforce: true }), events);
  assert.ok(fix.ok);
  assert.deepEqual(broken(commit(q, fix)), []);
  // …unless the page is locked there: then it is impossible
  const locked = Object.assign({}, q, { enforce: true, locked: { M5: true } });
  assert.equal(E.tryNormalize(locked, events).ok, false);
});

test('normalize repairs a plan when that is possible', () => {
  const p = newProject('2026-10-06', 'nf-2027-06', null, { enforce: false });
  const q = commit(p, E.tryMove(p, events, 'M6', 'move', 60)); // breaks the 4–8 week window
  assert.ok(broken(q).includes('r09'));
  const fix = E.tryNormalize(q, events);
  assert.ok(fix.ok);
  assert.deepEqual(broken(commit(q, fix)), []);
});

test('tax verification cannot be resized below 10 business days', () => {
  const p = newProject('2026-10-06', 'nf-2027-06');
  const res = E.tryMove(p, events, 'S2', 'end', -20);
  assert.ok(res.blocked);
  assert.equal(res.blocked.id, 'r06');
  const q = commit(p, res);
  assert.equal(q.dates.S2.end, D.addBusinessDays(q.dates.S2.start, 10));
});

test('moving production carries its sub-milestones', () => {
  const p = newProject('2026-10-06', 'nf-2027-06');
  const res = E.tryMove(p, events, 'M11', 'move', -5);
  assert.equal(res.delta, -5);
  const q = commit(p, res);
  assert.equal(q.dates.M11a.date, p.dates.M11a.date - 5);
  assert.equal(q.dates.M11b.date, p.dates.M11b.date - 5);
});

test('sub-milestone dragged before production stretches the production bar', () => {
  const p = newProject('2026-10-06', 'nf-2027-06');
  const before = p.dates.M11.start - p.dates.M10.date; // slack before production
  const res = E.tryMove(p, events, 'M11a', 'move', -(p.dates.M11a.date - p.dates.M11.start) - Math.min(3, before));
  const q = commit(p, res);
  assert.deepEqual(broken(q), []);
  assert.equal(q.dates.M11.end, p.dates.M11.end, 'production end stays');
  assert.equal(q.dates.M11.start, q.dates.M11a.date);
});

test('changing Next Fest edition pushes the chain', () => {
  const p = newProject('2026-10-06', 'nf-2027-06');
  // add a later edition to move to
  const extra = events.concat([S.eventToMem({
    id: 'nf-test', type: 'nextfest', name: 'Next Fest · test', start: '2027-10-11', end: '2027-10-18',
    registration: '2027-08-23', demoPress: '2027-09-06', demoFinal: '2027-09-20', pressPreview: '2027-09-30',
  })]);
  const res = E.tryChangeEdition(p, extra, 'nf-test');
  assert.ok(res.ok, res.rule && res.rule.id);
  const q = Object.assign({}, p, { nextFestId: 'nf-test', dates: res.dates });
  assert.deepEqual(E.evaluate(q, extra).list.map((v) => v.rule.id), []);
  assert.ok(q.dates.M13.end >= D.offset(day('2027-10-18'), 3, 'w'));
});

test('switching to an earlier edition squeezes the chain backwards', () => {
  // Found in browser testing: the marketing push sits between the demo and gate #2,
  // so moving the fest earlier must push the whole chain back.
  const p = newProject('2026-06-01', 'nf-2027-06');
  const res = E.tryChangeEdition(p, events, 'nf-2027-02');
  assert.ok(res.ok, res.rule && E.describeRule(res.rule));
  const q = Object.assign({}, p, { nextFestId: 'nf-2027-02', dates: res.dates });
  assert.deepEqual(broken(q), []);
  assert.equal(q.dates.M1.date, p.dates.M1.date, 'nothing before the squeeze needs to move');
});

test('a drag later never moves anything earlier, and vice versa', () => {
  const p = newProject('2026-10-06', 'nf-2027-06');
  const ends = (d) => Object.keys(d).flatMap((id) => ['date', 'start', 'end'].filter((k) => d[id][k] != null).map((k) => [id, k]));
  const later = E.tryMove(p, events, 'M7', 'move', 20);
  ends(p.dates).forEach(([id, k]) => assert.ok(later.dates[id][k] >= p.dates[id][k], `${id}.${k} moved earlier`));
  const earlier = E.tryMove(p, events, 'M7', 'move', -20);
  ends(p.dates).forEach(([id, k]) => assert.ok(earlier.dates[id][k] <= p.dates[id][k], `${id}.${k} moved later`));
  assert.deepEqual(broken(commit(p, later)), []);
  assert.deepEqual(broken(commit(p, earlier)), []);
});

test('auto-fill works for every start that leaves enough room', () => {
  // Every start from Oct 2025 to Jan 2026 must produce a valid plan for June 2027.
  for (let s = day('2025-10-01'); s <= day('2026-01-31'); s += 9) {
    const launch = E.earliestLaunch(events, 'nf-2027-06', {});
    const res = E.autofill({ start: s, nextFestId: 'nf-2027-06', launch }, events);
    assert.ok(res.ok, `${D.toIso(s)}: ${res.error}`);
    const q = { nextFestId: 'nf-2027-06', rules: {}, dates: res.dates };
    assert.deepEqual(broken(q), [], D.toIso(s));
  }
});

test('rule descriptions read naturally', () => {
  const rules = E.resolvedRules({ rules: {} });
  const by = (id) => E.describeRule(rules.find((r) => r.id === id));
  assert.equal(by('r24'), 'M13 Launch 3–8 weeks after M12 Next Fest ends');
  assert.equal(by('r19'), 'M8 Steam demo at least 2 months before M12 Next Fest starts');
  assert.equal(by('r06'), 'S2 Tax & identity verification lasts 10–15 business days');
  assert.equal(by('r30'), 'M13 Launch outside Steam seasonal sales');
});

test('export → import round trip keeps every date', () => {
  const p = newProject('2026-10-06', 'nf-2027-06');
  const state = S.emptyState();
  state.projects.push(p);
  const text = S.exportText(state);
  const fresh = S.emptyState();
  const report = S.importText(fresh, text);
  assert.equal(report.added, 1);
  assert.deepEqual(fresh.projects[0].dates, p.dates);
});
