/* Rule engine.

   A project's dates live in `project.dates` (day numbers):
     point → { date }    phase → { start, end }    open-ended phase → { start }
   Next Fest dates come from the chosen edition and never move.

   With enforcement ON, every change goes through `relax`, which pushes the chain.
   Every gap rule has the form "B is at least / at most N after A", and such rules
   are monotone: moving a date later can only force other dates later, never
   earlier. So a move later is repaired by pushing later only, and a move earlier
   by pushing earlier only. This gives the smallest shift that satisfies every
   rule, or proves there is none.

   Bars keep their length when pushed (sub-milestones ride along), except that a
   sub-milestone pushing its parent's edge stretches the parent. Fixed dates (Next
   Fest), locked milestones and the milestone being dragged never move; if a rule
   can only be repaired by moving one of them, the change is infeasible and a drag
   stops at the last valid date. */
(function (root) {
  'use strict';
  const SR = (root.SR = root.SR || {});
  const D = SR.dates;
  const T = SR.template;

  const MAX_PASSES = 80;

  // ---------- context ----------

  function cloneDates(dates) {
    const out = {};
    for (const id in dates) out[id] = Object.assign({}, dates[id]);
    return out;
  }

  function resolvedRules(project) {
    const params = project.rules || {};
    return T.rules.map((t) => Object.assign({}, t, { enabled: true }, params[t.id] || {}));
  }

  function findEdition(events, id) {
    return events.find((e) => e.id === id && e.type === 'nextfest') || null;
  }

  function makeCtx(project, events, overrides) {
    const o = overrides || {};
    return {
      dates: cloneDates(project.dates),
      nf: findEdition(events, o.nextFestId || project.nextFestId),
      sales: events.filter((e) => e.type === 'sale'),
      rules: o.rules || resolvedRules(project),
    };
  }

  function cloneCtx(ctx) {
    return { dates: cloneDates(ctx.dates), nf: ctx.nf, sales: ctx.sales, rules: ctx.rules };
  }

  function getEP(ctx, ref) {
    const it = T.itemById[ref.item];
    if (!it) return null;
    if (it.kind === 'nextfest') return ctx.nf && ctx.nf[ref.at] != null ? ctx.nf[ref.at] : null;
    const d = ctx.dates[ref.item];
    return d && d[ref.at] != null ? d[ref.at] : null;
  }

  // ---------- checking ----------

  function checkRule(ctx, r) {
    if (!r.enabled) return null;
    if (r.type === 'gap') {
      const A = getEP(ctx, r.a);
      const B = getEP(ctx, r.b);
      if (A == null || B == null) return null;
      if (r.min != null && B < D.offset(A, r.min, r.unit)) return { rule: r, side: 'min', A, B };
      if (r.max != null && B > D.offset(A, r.max, r.unit)) return { rule: r, side: 'max', A, B };
      return null;
    }
    if (r.type === 'avoidSales') {
      const X = getEP(ctx, r.b);
      if (X == null) return null;
      const buf = r.buffer || 0;
      for (const s of ctx.sales) {
        if (X >= s.start - buf && X <= s.end + buf) return { rule: r, side: 'sale', sale: s, X };
      }
    }
    return null;
  }

  function violations(ctx) {
    const out = [];
    for (const r of ctx.rules) {
      const v = checkRule(ctx, r);
      if (v) out.push(v);
    }
    return out;
  }

  function ruleItems(r) {
    return r.type === 'gap' ? [r.a.item, r.b.item] : [r.b.item];
  }

  // Violations of a stored project, plus a lookup of broken rules per item.
  function evaluate(project, events) {
    const ctx = makeCtx(project, events);
    const list = violations(ctx);
    const byItem = {};
    list.forEach((v) => {
      ruleItems(v.rule).forEach((id) => { (byItem[id] = byItem[id] || []).push(v.rule.id); });
    });
    return { list, byItem, rules: ctx.rules, nf: ctx.nf };
  }

  // ---------- resolving ----------

  function isFixed(id) {
    const it = T.itemById[id];
    return !it || it.kind === 'nextfest';
  }

  function pinnedSet(project, extra) {
    const set = new Set(T.items.filter((it) => it.kind === 'nextfest').map((it) => it.id));
    const locked = project.locked || {};
    Object.keys(locked).forEach((id) => { if (locked[id]) set.add(id); });
    (extra || []).forEach((id) => set.add(id));
    return set;
  }

  function shift(ctx, st, id, delta) {
    const d = ctx.dates[id];
    if (!d || !delta) return;
    if (d.date != null) d.date += delta;
    else {
      d.start += delta;
      if (d.end != null) d.end += delta;
    }
    st.moved.add(id);
    (T.children[id] || []).forEach((c) => {
      if (!st.pinned.has(c)) shift(ctx, st, c, delta);
    });
  }

  // Total distance moved, used to pick the gentlest repair.
  function movement(before, after) {
    let sum = 0;
    Object.keys(after).forEach((id) => {
      ['date', 'start', 'end'].forEach((k) => {
        if (after[id][k] != null && before[id] && before[id][k] != null) sum += Math.abs(after[id][k] - before[id][k]);
      });
    });
    return sum;
  }

  function setEndpoint(ctx, st, ref, target, causeId) {
    const id = ref.item;
    const it = T.itemById[id];
    const d = ctx.dates[id];
    const delta = target - d[ref.at];
    if (!delta) return;
    if (it.kind === 'point') {
      d.date = target;
      st.moved.add(id);
      return;
    }
    // A sub-milestone pushing its parent's edge stretches the parent instead of shifting it.
    const fromChild = causeId && T.itemById[causeId] && T.itemById[causeId].parent === id;
    if (fromChild && ref.at === 'start' && target <= d.end) { d.start = target; st.moved.add(id); return; }
    if (fromChild && ref.at === 'end' && target >= d.start) { d.end = target; st.moved.add(id); return; }
    shift(ctx, st, id, delta);
  }

  /* Repair one broken rule by moving dates in direction `dir` only
     (+1 later, -1 earlier). Returns 'moved' or 'blocked'. */
  function fixDir(ctx, v, dir, st) {
    const r = v.rule;
    const movable = (id) => !isFixed(id) && !st.pinned.has(id);

    if (r.type === 'avoidSales') {
      if (!movable(r.b.item)) return 'blocked';
      const buf = r.buffer || 0;
      setEndpoint(ctx, st, r.b, dir > 0 ? v.sale.end + buf + 1 : v.sale.start - buf - 1, null);
      return 'moved';
    }

    const { a, b } = r;
    if (a.item === b.item) {
      // Duration of a phase: move the edge that goes in the right direction.
      if (!movable(a.item)) return 'blocked';
      const d = ctx.dates[a.item];
      if (v.side === 'min') {
        if (dir > 0) d[b.at] = D.offset(v.A, r.min, r.unit);
        else d[a.at] = D.latestBefore(v.B, r.min, r.unit);
      } else if (dir > 0) d[a.at] = D.earliestAfter(v.B, r.max, r.unit);
      else d[b.at] = D.offset(v.A, r.max, r.unit);
      st.moved.add(a.item);
      return 'moved';
    }

    // "B too early" is repaired by pushing B later or A earlier;
    // "B too late" by pushing A later or B earlier.
    let ref;
    let target;
    let cause;
    if (v.side === 'min') {
      if (dir > 0) { ref = b; target = D.offset(v.A, r.min, r.unit); cause = a.item; }
      else { ref = a; target = D.latestBefore(v.B, r.min, r.unit); cause = b.item; }
    } else if (dir > 0) { ref = a; target = D.earliestAfter(v.B, r.max, r.unit); cause = b.item; }
    else { ref = b; target = D.offset(v.A, r.max, r.unit); cause = a.item; }
    if (!movable(ref.item)) return 'blocked';
    setEndpoint(ctx, st, ref, target, cause);
    return 'moved';
  }

  /* Push dates in one direction until every rule holds.
     strict: stop at the first rule that would need a pinned date to move.
     lenient: skip such rules (a pass in the other direction may fix them). */
  function relax(ctx, pinned, dir, lenient, moved) {
    const st = { pinned, moved: moved || new Set() };
    let blocked = null;
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let changed = false;
      for (const r of ctx.rules) {
        const v = checkRule(ctx, r);
        if (!v) continue;
        if (fixDir(ctx, v, dir, st) === 'blocked') {
          if (!lenient) return { ok: false, rule: r, moved: st.moved };
          blocked = blocked || r;
          continue;
        }
        changed = true;
      }
      if (!changed) break;
    }
    const left = violations(ctx);
    return { ok: !left.length, rule: left.length ? (blocked || left[0].rule) : null, moved: st.moved };
  }

  /* Repair a plan whose broken rules may need moves in both directions.
     Tries one-direction pushes first, then alternating lenient passes,
     and keeps the feasible result that moves the least. */
  function repair(ctx, pinned, preferDir) {
    const order = preferDir < 0 ? [-1, 1] : [1, -1];
    const candidates = [];
    let firstFail = null;
    order.forEach((dir) => {
      const c = cloneCtx(ctx);
      const res = relax(c, pinned, dir, false);
      if (res.ok) candidates.push({ c, res });
      else firstFail = firstFail || res.rule;
    });
    if (!candidates.length) {
      order.forEach((dir) => {
        const c = cloneCtx(ctx);
        const moved = new Set();
        let res = null;
        for (let round = 0; round < 8; round++) {
          res = relax(c, pinned, round % 2 ? -dir : dir, true, moved);
          if (res.ok) break;
        }
        if (res.ok) candidates.push({ c, res });
        else firstFail = firstFail || res.rule;
      });
    }
    if (!candidates.length) return { ok: false, rule: firstFail, moved: new Set(), dates: ctx.dates };
    candidates.sort((x, y) => movement(ctx.dates, x.c.dates) - movement(ctx.dates, y.c.dates));
    const best = candidates[0];
    return { ok: true, rule: null, moved: best.res.moved, dates: best.c.dates };
  }

  // ---------- user operations ----------

  function applyUserMove(ctx, id, mode, delta) {
    const d = ctx.dates[id];
    const st = { pinned: new Set(), moved: new Set() };
    if (mode === 'move') shift(ctx, st, id, delta);
    else if (mode === 'start') d.start = Math.min(d.start + delta, d.end);
    else if (mode === 'end') d.end = Math.max(d.end + delta, d.start);
  }

  /* Move an item (mode 'move'), or one edge of a phase ('start' / 'end'), by `delta` days.
     Returns { delta (achieved), dates, moved, blocked (rule or null) }. */
  function tryMove(project, events, id, mode, delta) {
    const base = makeCtx(project, events);
    const enforce = project.enforce !== false;
    const pinned = pinnedSet(project, [id]);

    const attempt = (dl) => {
      const ctx = cloneCtx(base);
      applyUserMove(ctx, id, mode, dl);
      if (!enforce) return { ok: true, ctx, moved: new Set([id]) };
      const res = relax(ctx, pinned, dl > 0 ? 1 : -1, false);
      return Object.assign(res, { ctx });
    };

    if (!delta) return { delta: 0, dates: base.dates, moved: new Set(), blocked: null };
    const full = attempt(delta);
    if (full.ok) return { delta, dates: full.ctx.dates, moved: full.moved, blocked: null };

    // Infeasible: find the furthest feasible step between 0 and delta.
    let lo = 0;
    let hi = delta;
    let blocked = full.rule;
    while (Math.abs(hi - lo) > 1) {
      const mid = lo + Math.trunc((hi - lo) / 2);
      const r = attempt(mid);
      if (r.ok) lo = mid;
      else { hi = mid; blocked = r.rule; }
    }
    if (lo === 0) return { delta: 0, dates: base.dates, moved: new Set(), blocked };
    const best = attempt(lo);
    return { delta: lo, dates: best.ctx.dates, moved: best.moved, blocked };
  }

  // Set a single endpoint to an absolute day (from a date input).
  function trySetDate(project, events, id, at, day) {
    const d = project.dates[id];
    if (!d) return null;
    const it = T.itemById[id];
    if (it.kind === 'point') return tryMove(project, events, id, 'move', day - d.date);
    if (at === 'start' && it.openEnded) return tryMove(project, events, id, 'move', day - d.start);
    return tryMove(project, events, id, at, day - d[at]);
  }

  // Switch Next Fest edition, pushing the chain around the new fixed dates.
  function tryChangeEdition(project, events, nextFestId) {
    const ctx = makeCtx(project, events, { nextFestId });
    if (project.enforce === false || !ctx.nf) return { ok: true, dates: ctx.dates, moved: new Set() };
    const old = findEdition(events, project.nextFestId);
    return repair(ctx, pinnedSet(project), old && ctx.nf.start < old.start ? -1 : 1);
  }

  // Repair all broken rules (used when turning enforcement on or editing a rule).
  function tryNormalize(project, events, rulesOverride) {
    const ctx = makeCtx(project, events, rulesOverride ? { rules: rulesOverride } : null);
    return repair(ctx, pinnedSet(project), 1);
  }

  // ---------- new project auto-fill ----------

  // Main chain spread evenly between the project start and the start of Next Fest.
  const SPREAD = [
    ['M1', 'date'], ['M2', 'date'], ['M3', 'date'], ['M4', 'start'], ['M4', 'end'],
    ['M5', 'date'], ['M6', 'date'], ['M7', 'start'], ['M7', 'end'], ['M8', 'date'],
    ['M9', 'start'], ['M9', 'end'], ['M10', 'date'], ['M11', 'start'], ['M11a', 'date'],
    ['M11b', 'date'], ['M11', 'end'],
  ];

  function blankDates() {
    const dates = {};
    T.items.forEach((it) => {
      if (it.kind === 'point') dates[it.id] = { date: 0 };
      else if (it.kind === 'phase') dates[it.id] = it.openEnded ? { start: 0 } : { start: 0, end: 0 };
    });
    return dates;
  }

  // Launch window allowed by the rules for an edition (null bounds when a rule is off).
  function launchWindow(events, nextFestId, rulesParams) {
    const nf = findEdition(events, nextFestId);
    if (!nf) return null;
    const rules = resolvedRules({ rules: rulesParams || {} });
    let lo = nf.end;
    let hi = null;
    rules.forEach((r) => {
      if (!r.enabled || r.type !== 'gap' || r.a.item !== 'M12' || r.a.at !== 'end') return;
      if (r.b.item !== 'M13' || r.b.at !== 'end') return;
      if (r.min != null) lo = Math.max(lo, D.offset(nf.end, r.min, r.unit));
      if (r.max != null) hi = hi == null ? D.offset(nf.end, r.max, r.unit) : Math.min(hi, D.offset(nf.end, r.max, r.unit));
    });
    return { from: lo, to: hi };
  }

  function saleAt(events, day, rulesParams) {
    const rules = resolvedRules({ rules: rulesParams || {} });
    const r = rules.find((x) => x.type === 'avoidSales' && x.enabled);
    if (!r) return null;
    const buf = r.buffer || 0;
    return events.find((e) => e.type === 'sale' && day >= e.start - buf && day <= e.end + buf) || null;
  }

  function earliestLaunch(events, nextFestId, rulesParams) {
    const w = launchWindow(events, nextFestId, rulesParams);
    if (!w) return null;
    let day = w.from;
    for (let i = 0; i < 400; i++) {
      if (w.to != null && day > w.to) return null;
      if (!saleAt(events, day, rulesParams)) return day;
      day++;
    }
    return null;
  }

  /* Build the dates of a new project from three key dates.
     Returns { ok, dates } or { ok: false, error, rule }. */
  function autofill(opts, events) {
    const { start, nextFestId, launch } = opts;
    const rulesParams = opts.rules || {};
    const nf = findEdition(events, nextFestId);
    if (!nf) return { ok: false, error: 'Pick a Next Fest edition.' };
    if (start == null || launch == null) return { ok: false, error: 'Fill in the start and launch dates.' };
    if (start >= nf.start) return { ok: false, error: 'The project must start before the Next Fest edition.' };

    const dates = blankDates();
    const n = SPREAD.length - 1;
    const span = nf.start - start;
    SPREAD.forEach(([id, at], i) => { dates[id][at] = start + Math.round((span * i) / n); });

    // Steam admin works back from the page going live.
    dates.S3.date = dates.M5.date - 7;
    dates.S2.end = dates.S3.date;
    dates.S2.start = D.addBusinessDays(dates.S2.end, -15);
    dates.S1.date = dates.S2.start;

    dates.M13.end = launch;
    dates.M13.start = dates.M11.end + Math.round((launch - dates.M11.end) / 2);
    dates.M14.start = launch;

    const project = { nextFestId, enforce: true, rules: rulesParams, dates, locked: {} };
    const ctx = makeCtx(project, events);
    const res = repair(ctx, pinnedSet(project, ['M1', 'M13']), -1);
    if (!res.ok) {
      return {
        ok: false,
        rule: res.rule,
        error: 'Not enough time between the start and the launch for every rule to hold'
          + (res.rule ? ` (first conflict: "${describeRule(res.rule)}").` : '.')
          + ' Pick a later Next Fest edition or an earlier start.',
      };
    }
    return { ok: true, dates: res.dates };
  }

  // ---------- describing rules ----------

  function amount(n, unit) {
    return D.formatAmount(n, unit);
  }

  function relation(r) {
    const { min, max, unit } = r;
    const word = r.phrase === 'before' ? 'before' : 'after';
    if (min != null && max != null) {
      if (min === 0 && max === 0) return 'on the same day as';
      if (min === max) return `exactly ${amount(min, unit)} ${word}`;
      return `${min}–${max} ${D.unitLabel(max, unit)} ${word}`;
    }
    if (min != null && min > 0) return `at least ${amount(min, unit)} ${word}`;
    if (max != null) return `at most ${amount(max, unit)} ${word}`;
    return word === 'before' ? 'on or before' : 'on or after';
  }

  function describeRule(r) {
    const L = T.endpointLabel;
    if (r.type === 'avoidSales') {
      const buf = r.buffer ? ` (± ${amount(r.buffer, 'd')})` : '';
      return `${L(r.b)} outside Steam seasonal sales${buf}`;
    }
    if (r.a.item === r.b.item) {
      const it = T.itemById[r.a.item];
      const { min, max, unit } = r;
      let len = 'any length';
      if (min != null && max != null) len = `${min}–${max} ${D.unitLabel(max, unit)}`;
      else if (min != null) len = `at least ${amount(min, unit)}`;
      else if (max != null) len = `at most ${amount(max, unit)}`;
      return `${it.code} ${it.name} lasts ${len}`;
    }
    if (r.phrase === 'before') return `${L(r.a)} ${relation(r)} ${L(r.b)}`;
    return `${L(r.b)} ${relation(r)} ${L(r.a)}`;
  }

  SR.engine = {
    resolvedRules,
    findEdition,
    makeCtx,
    getEP,
    checkRule,
    evaluate,
    ruleItems,
    tryMove,
    trySetDate,
    tryChangeEdition,
    tryNormalize,
    autofill,
    launchWindow,
    earliestLaunch,
    saleAt,
    describeRule,
    blankDates,
  };
})(typeof window !== 'undefined' ? window : globalThis);
