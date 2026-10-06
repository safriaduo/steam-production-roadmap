/* Application: state, rendering, interactions. */
(function () {
  'use strict';
  const SR = window.SR;
  const D = SR.dates;
  const E = SR.engine;
  const T = SR.template;
  const S = SR.store;
  const TL = SR.timeline;
  const esc = TL.esc;

  const $ = (sel, el) => (el || document).querySelector(sel);
  const main = $('#main');
  const drawerEl = $('#drawer');
  const tipEl = $('#tooltip');
  const toastEl = $('#toast');
  const dialogEl = $('#dialog');

  const UNIT_OPTIONS = [['d', 'days'], ['bd', 'business days'], ['w', 'weeks'], ['m', 'months']];

  let state = S.load();
  const history = { undo: [], redo: [] };
  let drag = null;
  let drawer = { kind: null, id: null, filter: 'all', editEvent: null };
  let lastRange = null;
  let lastViewKey = null;
  let pan = null;
  let saveWarned = false;

  // ---------- state helpers ----------

  function project() {
    return state.projects.find((p) => p.id === state.ui.activeId) || state.projects[0] || null;
  }

  function editions() {
    return state.events.filter((e) => e.type === 'nextfest');
  }

  function snapshot() {
    const json = S.toJson(state);
    delete json.ui;
    return JSON.stringify(json);
  }

  function persist() {
    if (!S.save(state) && !saveWarned) {
      saveWarned = true;
      toast('This browser is blocking storage, so changes are not saved. Use ⋯ → Export JSON to keep your work.', 'warn');
    }
  }

  // Apply a change with undo support.
  function change(fn) {
    const before = snapshot();
    fn();
    history.undo.push(before);
    if (history.undo.length > 100) history.undo.shift();
    history.redo = [];
    persist();
    render();
  }

  function restore(snap) {
    const ui = state.ui;
    state = S.fromJson(Object.assign(JSON.parse(snap), { ui }));
    persist();
    render();
  }

  function undo() {
    if (!history.undo.length) return;
    history.redo.push(snapshot());
    restore(history.undo.pop());
    toast('Undone');
  }

  function redo() {
    if (!history.redo.length) return;
    history.undo.push(snapshot());
    restore(history.redo.pop());
    toast('Redone');
  }

  function setUi(patch) {
    Object.assign(state.ui, patch);
    persist();
    render();
  }

  // Repair projects after events or rules changed underneath them.
  function revalidate(projects) {
    const notes = [];
    projects.forEach((p) => {
      if (p.enforce === false) return;
      if (!E.evaluate(p, state.events).list.length) return;
      const res = E.tryNormalize(p, state.events);
      if (res.ok) {
        p.dates = res.dates;
        notes.push(`${p.name}: ${res.moved.size} milestone${res.moved.size === 1 ? '' : 's'} moved to respect the rules.`);
      } else {
        p.enforce = false;
        notes.push(`${p.name}: enforcement turned off, "${E.describeRule(res.rule)}" can't be satisfied.`);
      }
    });
    return notes;
  }

  function movedCount(moved, exceptId) {
    let n = 0;
    moved.forEach((id) => {
      if (id === exceptId) return;
      const it = T.itemById[id];
      if (it && it.parent === exceptId) return;
      n++;
    });
    return n;
  }

  // ---------- toast & tooltip ----------

  let toastTimer = null;
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = `toast ${kind || ''}`;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, kind === 'error' || kind === 'warn' ? 6500 : 3500);
  }

  function showTip(html, x, y) {
    tipEl.innerHTML = html;
    tipEl.hidden = false;
    const r = tipEl.getBoundingClientRect();
    const left = Math.min(window.innerWidth - r.width - 8, x + 14);
    const top = y + 18 + r.height > window.innerHeight ? y - r.height - 12 : y + 18;
    tipEl.style.left = `${Math.max(8, left)}px`;
    tipEl.style.top = `${Math.max(8, top)}px`;
  }

  function hideTip() {
    tipEl.hidden = true;
  }

  function itemDatesText(it, d) {
    if (it.kind === 'point') return D.format(d.date);
    if (it.openEnded) return `from ${D.format(d.start)}`;
    if (it.endShape === 'flag') return `${D.format(d.start)} → launch ${D.format(d.end)}`;
    return `${D.formatRange(d.start, d.end)} · ${D.formatSpan(d.end - d.start + 1)}`;
  }

  function itemTip(p, id) {
    const it = T.itemById[id];
    const ev = E.evaluate(p, state.events);
    let when;
    if (it.kind === 'nextfest') when = ev.nf ? `${D.formatRange(ev.nf.start, ev.nf.end)} · fixed by Valve` : 'No edition chosen';
    else when = itemDatesText(it, p.dates[id]);
    const bad = (ev.byItem[id] || []).length;
    const extra = bad ? `<div class="tip-bad">${bad} broken rule${bad > 1 ? 's' : ''}</div>` : '';
    const lock = p.locked && p.locked[id] ? '<div class="tip-muted">Locked</div>' : '';
    return `<strong>${esc(it.code)} ${esc(it.name)}</strong><div>${esc(when)}</div>${lock}${extra}`;
  }

  // ---------- rendering ----------

  // Narrowest timeline before the window scrolls instead of squeezing further.
  const MIN_TIMELINE_W = 640;
  const ZOOM_MAX = 8;

  function zoomLevel() {
    const z = Number(state.ui.zoom);
    return Number.isFinite(z) ? Math.min(ZOOM_MAX, Math.max(1, z)) : 1;
  }

  function labelWidth() {
    return window.innerWidth < 900 ? 180 : 240;
  }

  function layoutVars() {
    const labelW = labelWidth();
    document.documentElement.style.setProperty('--label-w', `${labelW}px`);
    // Fit every row on screen: header 42 + events row 45 + track titles 26 each + bottom padding.
    const itemRows = T.rows.reduce((n, g) => n + g.items.length, 0);
    const avail = main.clientHeight - 42 - 45 - T.rows.length * 26 - 8;
    const rowH = Math.max(20, Math.min(34, Math.floor(avail / itemRows)));
    main.style.setProperty('--row-h', `${rowH}px`);
    // Zoom 1 fits the whole range in the window; higher zoom widens the lanes and the view pans.
    const zoom = zoomLevel();
    const fitLane = Math.max(MIN_TIMELINE_W, main.clientWidth) - labelW;
    const laneWidth = Math.round(fitLane * zoom);
    return { labelW, laneWidth, tlWidth: zoom > 1 ? labelW + laneWidth : null };
  }

  function zoomControlsHtml() {
    const z = zoomLevel();
    return `<div class="zoom" role="group" aria-label="Zoom">
      <button type="button" data-zoom="out" title="Zoom out (Ctrl + mouse wheel)" aria-label="Zoom out" ${z <= 1 ? 'disabled' : ''}>−</button>
      <button type="button" data-zoom="fit" class="${z <= 1 ? 'active' : ''}" title="Fit the whole timeline in the window">Fit</button>
      <button type="button" data-zoom="in" title="Zoom in (Ctrl + mouse wheel)" aria-label="Zoom in" ${z >= ZOOM_MAX ? 'disabled' : ''}>+</button>
    </div>`;
  }

  function render() {
    renderTopbar();
    renderStatus(); // before main: the row height is fitted to the space left between the bars
    renderMain();
    renderDrawer();
  }

  function renderTopbar() {
    const p = project();
    const view = p ? state.ui.view : 'empty';
    document.body.dataset.screen = view;

    document.querySelectorAll('.seg [data-view]').forEach((b) => {
      b.classList.toggle('active', b.dataset.view === state.ui.view);
      b.disabled = !p;
    });

    const sel = $('#projectSelect');
    sel.innerHTML = state.projects.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
    if (p) sel.value = p.id;
    sel.disabled = !p;

    const nfSel = $('#nfSelect');
    if (p) {
      const opts = editions().map((e) => `<option value="${esc(e.id)}">${esc(e.name.replace('Next Fest · ', ''))}${e.source ? '' : ' (unconfirmed)'}</option>`);
      if (!E.findEdition(state.events, p.nextFestId)) opts.unshift('<option value="">— choose —</option>');
      nfSel.innerHTML = opts.join('');
      nfSel.value = E.findEdition(state.events, p.nextFestId) ? p.nextFestId : '';
      $('#enforceToggle').checked = p.enforce !== false;
      const ev = E.evaluate(p, state.events);
      const badge = $('#rulesBadge');
      badge.textContent = ev.list.length;
      badge.hidden = !ev.list.length;
    }
    $('#undoBtn').disabled = !history.undo.length;
    $('#redoBtn').disabled = !history.redo.length;
    $('#showFestsToggle').checked = !!state.ui.showFests;
  }

  function renderMain(preview) {
    const p = project();
    if (!p) {
      main.innerHTML = `
        <div class="empty">
          <div class="empty-card">
            <div class="empty-mark" aria-hidden="true"></div>
            <h1>Plan a Steam release on one screen</h1>
            <p>Every milestone from concept to post-launch on one timeline, with Valve's rules and your studio rules enforced as you move things around.</p>
            <div class="empty-actions">
              <button class="btn primary" data-action="new">New project</button>
              <button class="btn" data-action="example">Load an example</button>
              <button class="btn" data-action="import">Import JSON</button>
            </div>
          </div>
        </div>`;
      return;
    }
    const { laneWidth, tlWidth } = layoutVars();
    const today = D.today();
    const cornerHtml = zoomControlsHtml();

    // Keep the scroll position across re-renders; start at the left edge when the screen changes.
    const viewKey = `${state.ui.view}:${p.id}`;
    const keep = viewKey === lastViewKey;
    const scroll = { left: keep ? main.scrollLeft : 0, top: keep ? main.scrollTop : 0 };
    lastViewKey = viewKey;

    if (state.ui.view === 'overview') {
      let days = [];
      state.projects.forEach((x) => { days = days.concat(TL.projectDays(x, E.findEdition(state.events, x.nextFestId))); });
      const range = TL.rangeFor(days, 30);
      lastRange = range;
      main.innerHTML = TL.renderOverview({ projects: state.projects, events: state.events, range, laneWidth, tlWidth, cornerHtml, today, showFests: state.ui.showFests });
    } else {
      const evalProject = preview ? Object.assign({}, p, { dates: preview.dates }) : p;
      const evaluation = E.evaluate(evalProject, state.events);
      const range = drag && drag.range ? drag.range : TL.rangeFor(TL.projectDays(p, evaluation.nf), 45);
      lastRange = range;
      main.innerHTML = TL.renderProject({
        project: p,
        events: state.events,
        evaluation,
        range,
        laneWidth,
        tlWidth,
        cornerHtml,
        today,
        showFests: state.ui.showFests,
        preview: preview || null,
        selectedId: drawer.kind === 'item' ? drawer.id : null,
      });
    }
    main.scrollLeft = scroll.left;
    main.scrollTop = scroll.top;
    const pannable = main.scrollWidth > main.clientWidth + 1 || main.scrollHeight > main.clientHeight + 1;
    main.classList.toggle('can-pan', pannable);
    document.body.classList.toggle('can-pan', pannable);
  }

  function renderStatus() {
    const p = project();
    const bar = $('#statusbar');
    if (!p) { bar.innerHTML = ''; return; }
    const ev = E.evaluate(p, state.events);
    const enabled = ev.rules.filter((r) => r.enabled).length;
    const enforce = p.enforce !== false;
    const rulesBtn = ev.list.length
      ? `<button class="sb-rules bad" data-action="rules-broken">✕ ${ev.list.length} rule${ev.list.length > 1 ? 's' : ''} broken</button>`
      : `<button class="sb-rules ok" data-action="rules">✓ All ${enabled} rules respected</button>`;
    const mode = state.ui.view === 'overview'
      ? 'All projects · click a name to open it'
      : enforce
        ? '<b>Rules enforced</b> · drag to move, drag bar edges to resize, click for details'
        : '<b>Enforcement off</b> · moves are free, broken rules show in red';
    const legend = state.ui.view === 'overview'
      ? `<span><i class="lg-dot page"></i>Steam page live</span>
        <span><i class="lg-dot demo"></i>Steam demo</span>
        <span><i class="lg-bar prod"></i>Production</span>`
      : `<span><i class="lg-gate"></i>Gate</span>
        <span><i class="lg-dot"></i>Milestone</span>
        <span><i class="lg-bar"></i>Phase</span>`;
    bar.innerHTML = `
      <div class="sb-mode">${mode}<span class="sb-pan"> · drag empty space to scroll</span></div>
      ${state.ui.view === 'overview' ? '' : rulesBtn}
      <div class="legend" aria-hidden="true">
        ${legend}
        <span><i class="lg-flag"></i>Launch</span>
        <span><i class="lg-nf"></i>Next Fest (fixed)</span>
        <span><i class="lg-sale"></i>Seasonal sale</span>
        <span><i class="lg-today"></i>Today</span>
      </div>`;
  }

  // ---------- drawer ----------

  function openDrawer(kind, id, extra) {
    drawer = Object.assign({ kind, id: id || null, filter: 'all', editEvent: null }, extra || {});
    render();
  }

  function closeDrawer() {
    drawer = { kind: null, id: null, filter: 'all', editEvent: null };
    render();
  }

  function renderDrawer() {
    const p = project();
    if (!drawer.kind || (!p && drawer.kind !== 'events')) {
      drawerEl.hidden = true;
      drawerEl.innerHTML = '';
      return;
    }
    let html = '';
    if (drawer.kind === 'item') html = itemDrawerHtml(p, drawer.id);
    else if (drawer.kind === 'rules') html = rulesDrawerHtml(p);
    else if (drawer.kind === 'events') html = eventsDrawerHtml();
    drawerEl.innerHTML = html;
    drawerEl.hidden = false;
  }

  function tagHtml(tag) {
    const t = T.tags[tag] || { label: tag, title: '' };
    return `<span class="tag tag-${esc(tag)}" title="${esc(t.title)}">${esc(t.label)}</span>`;
  }

  function dateInput(label, at, value, disabled) {
    return `<label class="field"><span>${esc(label)}</span><input type="date" data-date="${at}" value="${D.toIso(value)}" ${disabled ? 'disabled' : ''}></label>`;
  }

  function itemDrawerHtml(p, id) {
    const it = T.itemById[id];
    if (!it) return '';
    const ev = E.evaluate(p, state.events);
    const brokenIds = new Set(ev.list.map((v) => v.rule.id));
    const track = T.tracks.find((t) => t.id === it.track);
    const kind = it.kind === 'point' ? (it.shape === 'gate' ? 'Gate' : 'Milestone') : it.kind === 'nextfest' ? 'Fixed event' : 'Phase';
    const locked = !!(p.locked && p.locked[id]);

    let dates = '';
    if (it.kind === 'nextfest') {
      const nf = ev.nf;
      const opts = editions().map((e) => `<option value="${esc(e.id)}" ${e.id === p.nextFestId ? 'selected' : ''}>${esc(e.name)}</option>`).join('');
      dates = `<label class="field"><span>Edition</span><select data-nf-select>${E.findEdition(state.events, p.nextFestId) ? '' : '<option value="">— choose —</option>'}${opts}</select></label>`;
      if (nf) {
        dates += '<dl class="kv">' + SR.nextFestFields.map((f) => `<dt>${esc(f.label)}</dt><dd>${esc(D.format(nf[f.key]))}</dd>`).join('') + '</dl>';
        dates += nf.source ? `<p class="small"><a href="${esc(nf.source)}" target="_blank" rel="noopener">Valve's page for this edition ↗</a></p>` : '<p class="small warn-text">Unconfirmed dates: not from a Valve page.</p>';
      }
    } else {
      const d = p.dates[id];
      if (it.kind === 'point') dates = dateInput('Date', 'date', d.date, locked);
      else if (it.openEnded) dates = dateInput(it.ends.start, 'start', d.start, locked);
      else {
        dates = `<div class="field-pair">${dateInput(it.ends.start, 'start', d.start, locked)}${dateInput(it.ends.end, 'end', d.end, locked)}</div>`;
        dates += `<p class="small muted">Duration: ${esc(D.formatSpan(d.end - d.start + 1))}</p>`;
      }
      dates += `
        <label class="switch-row">
          <span class="switch"><input type="checkbox" data-lock ${locked ? 'checked' : ''}><span class="switch-track"></span></span>
          <span><b>Lock this ${it.kind === 'phase' ? 'phase' : 'milestone'}</b><br><span class="muted small">The rules never move a locked date. Use it for dates that already happened or can't change.</span></span>
        </label>`;
    }

    const related = ev.rules.filter((r) => E.ruleItems(r).includes(id));
    const rulesHtml = related.map((r) => {
      const bad = brokenIds.has(r.id);
      const st = !r.enabled ? '<span class="st off">off</span>' : bad ? '<span class="st bad">✕</span>' : '<span class="st ok">✓</span>';
      return `<li class="${bad ? 'bad' : ''} ${r.enabled ? '' : 'off'}">${st}<div>${tagHtml(r.tag)} ${esc(E.describeRule(r))}</div></li>`;
    }).join('');

    return `
      <header class="dr-head">
        <span class="code-pill" data-track="${it.track}">${esc(it.code)}</span>
        <h2>${esc(it.name)}</h2>
        <button class="btn icon ghost" data-action="close-drawer" aria-label="Close">✕</button>
      </header>
      <p class="muted small">${esc(track ? track.name : '')} · ${kind}</p>
      <section class="dr-sec">${dates}</section>
      <section class="dr-sec">
        <p>${esc(it.desc || '')}</p>
        ${it.exit ? `<p><b>Exit criteria.</b> ${esc(it.exit)}</p>` : ''}
      </section>
      <section class="dr-sec">
        <h3>Rules (${related.length})</h3>
        <ul class="mini-rules">${rulesHtml || '<li class="muted">No rules on this milestone.</li>'}</ul>
        <button class="link" data-action="rules">Edit rules →</button>
      </section>
      ${it.kind === 'nextfest' ? '' : `<section class="dr-sec">
        <h3>Notes</h3>
        <textarea data-notes rows="4" placeholder="Notes for this milestone…">${esc((p.notes && p.notes[id]) || '')}</textarea>
      </section>`}`;
  }

  function rulesDrawerHtml(p) {
    const ev = E.evaluate(p, state.events);
    const brokenIds = new Set(ev.list.map((v) => v.rule.id));
    const filters = [['all', 'All'], ['broken', `Broken (${brokenIds.size})`], ['valve', 'Valve'], ['studio', 'Studio'], ['heuristic', 'Heuristic'], ['order', 'Pipeline']];
    const f = drawer.filter || 'all';
    const list = ev.rules.filter((r) => f === 'all' || (f === 'broken' ? brokenIds.has(r.id) : r.tag === f));
    const modified = Object.keys(p.rules || {}).length;

    const rows = list.map((r) => {
      const bad = brokenIds.has(r.id);
      const st = !r.enabled ? '<span class="st off">off</span>' : bad ? '<span class="st bad">✕</span>' : '<span class="st ok">✓</span>';
      let params;
      if (r.type === 'avoidSales') {
        params = `<label>Buffer <input type="number" min="0" step="1" data-param="buffer" value="${r.buffer || 0}"> days</label>`;
      } else {
        const unit = UNIT_OPTIONS.map(([v, l]) => `<option value="${v}" ${v === r.unit ? 'selected' : ''}>${l}</option>`).join('');
        params = `<label>Min <input type="number" min="0" step="1" data-param="min" value="${r.min == null ? '' : r.min}" placeholder="–"></label>
          <label>Max <input type="number" min="0" step="1" data-param="max" value="${r.max == null ? '' : r.max}" placeholder="–"></label>
          <select data-param="unit" aria-label="Unit">${unit}</select>`;
      }
      return `
        <div class="rule ${bad ? 'bad' : ''} ${r.enabled ? '' : 'off'}" data-rule="${r.id}">
          <span class="switch sm"><input type="checkbox" data-rule-enabled ${r.enabled ? 'checked' : ''} aria-label="Rule on/off"><span class="switch-track"></span></span>
          <div class="rule-main">
            <div class="rule-text">${tagHtml(r.tag)} ${esc(E.describeRule(r))}</div>
            <div class="rule-why">${esc(r.why || '')}</div>
            <div class="rule-params">${params}</div>
          </div>
          ${st}
        </div>`;
    }).join('');

    return `
      <header class="dr-head">
        <h2>Rules</h2>
        <button class="btn icon ghost" data-action="close-drawer" aria-label="Close">✕</button>
      </header>
      <p class="muted small">${esc(p.name)} · values are per project. Leave Min or Max empty for no limit.</p>
      <label class="switch-row card">
        <span class="switch"><input type="checkbox" data-enforce ${p.enforce !== false ? 'checked' : ''}><span class="switch-track"></span></span>
        <span><b>Enforce rules</b><br><span class="muted small">On: every move pushes dependent milestones so all rules hold, and a drag stops at the last valid date. Off: free movement, broken rules shown in red.</span></span>
      </label>
      <div class="chips">${filters.map(([k, l]) => `<button class="chip ${k === f ? 'active' : ''}" data-filter="${k}">${esc(l)}</button>`).join('')}</div>
      <div class="rules">${rows || '<p class="muted">No rules here.</p>'}</div>
      <div class="dr-foot">
        <button class="btn" data-action="reset-rules" ${modified ? '' : 'disabled'}>Reset all rules to defaults</button>
      </div>`;
  }

  const EVENT_TYPES = [
    { type: 'nextfest', title: 'Next Fest editions', add: 'Add Next Fest edition' },
    { type: 'sale', title: 'Seasonal sales', add: 'Add seasonal sale', note: 'Launch must avoid these dates.' },
    { type: 'fest', title: 'Themed fests', add: 'Add themed fest', note: 'Context only, not used by the rules.' },
  ];

  function eventFormHtml(e) {
    const isNf = e.type === 'nextfest';
    const field = (key, label, type) => `<label class="field"><span>${label}</span><input type="${type || 'date'}" name="${key}" value="${type === 'text' || type === 'url' ? esc(e[key] || '') : e[key] != null ? D.toIso(e[key]) : ''}" ${key === 'source' ? '' : 'required'}></label>`;
    let html = `<form class="ev-form" data-event-form="${esc(e.id || '')}" data-type="${e.type}">`;
    html += field('name', 'Name', 'text');
    html += `<div class="field-pair">${field('start', isNf ? 'Fest starts' : 'Starts')}${field('end', isNf ? 'Fest ends' : 'Ends')}</div>`;
    if (isNf) {
      html += `<div class="field-pair">${field('registration', 'Registration closes')}${field('demoPress', 'Demo review (Press Preview)')}</div>`;
      html += `<div class="field-pair">${field('demoFinal', 'Final demo review')}${field('pressPreview', 'Press Preview starts')}</div>`;
    }
    html += field('source', 'Source URL (Valve page)', 'url');
    html += '<div class="form-actions"><button type="button" class="btn" data-action="cancel-event">Cancel</button><button type="submit" class="btn primary">Save</button></div></form>';
    return html;
  }

  function eventsDrawerHtml() {
    const used = {};
    state.projects.forEach((p) => { if (p.nextFestId) (used[p.nextFestId] = used[p.nextFestId] || []).push(p.name); });
    const editing = drawer.editEvent;

    const sections = EVENT_TYPES.map((t) => {
      const list = state.events.filter((e) => e.type === t.type);
      const rows = list.map((e) => {
        if (editing && editing.id === e.id) return `<li class="ev-row editing">${eventFormHtml(editing)}</li>`;
        const src = e.source ? `<a href="${esc(e.source)}" target="_blank" rel="noopener" title="Source">source ↗</a>` : '<span class="unconfirmed">unconfirmed</span>';
        const usedBy = used[e.id] ? `<span class="muted small">· used by ${esc(used[e.id].join(', '))}</span>` : '';
        return `<li class="ev-row" data-event="${esc(e.id)}">
          <div><b>${esc(e.name)}</b> <span class="muted">${esc(D.formatRange(e.start, e.end))}</span><br>${src} ${usedBy}</div>
          <div class="ev-actions"><button class="btn sm" data-action="edit-event">Edit</button><button class="btn sm" data-action="delete-event">Delete</button></div>
        </li>`;
      }).join('');
      const adding = editing && !editing.id && editing.type === t.type ? `<li class="ev-row editing">${eventFormHtml(editing)}</li>` : '';
      const toggle = t.type === 'fest'
        ? `<label class="inline-check"><input type="checkbox" data-show-fests ${state.ui.showFests ? 'checked' : ''}> show on timeline</label>` : '';
      return `<section class="dr-sec">
        <h3>${esc(t.title)} ${toggle}</h3>
        ${t.note ? `<p class="muted small">${esc(t.note)}</p>` : ''}
        <ul class="ev-list">${rows}${adding}</ul>
        <button class="link" data-action="add-event" data-type="${t.type}">+ ${esc(t.add)}</button>
      </section>`;
    }).join('');

    return `
      <header class="dr-head">
        <h2>Steam events</h2>
        <button class="btn icon ghost" data-action="close-drawer" aria-label="Close">✕</button>
      </header>
      <p class="muted small">Shared by all projects. Default dates come from Valve's Steamworks docs (checked 6 Oct 2026). Add editions and sales as Valve announces them. Entries without a source link are marked unconfirmed.</p>
      ${sections}`;
  }

  // ---------- dialogs ----------

  function openDialog(html, onSubmit, onInput) {
    dialogEl.innerHTML = html;
    const form = dialogEl.querySelector('form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (e.submitter && e.submitter.value === 'cancel') { dialogEl.close(); return; }
      if (onSubmit(form) !== false) dialogEl.close();
    });
    form.querySelectorAll('[value="cancel"]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); dialogEl.close(); }));
    if (onInput) {
      form.addEventListener('input', () => onInput(form));
      form.addEventListener('change', () => onInput(form));
      onInput(form);
    }
    dialogEl.showModal();
    const first = form.querySelector('input, select');
    if (first) first.focus();
  }

  function confirmDialog(title, text, okLabel, onOk) {
    openDialog(`
      <form class="dlg">
        <h2>${esc(title)}</h2>
        <p>${esc(text)}</p>
        <div class="form-actions"><button class="btn" value="cancel">Cancel</button><button class="btn danger" value="ok">${esc(okLabel)}</button></div>
      </form>`, () => { onOk(); });
  }

  function newProjectDialog() {
    const today = D.today();
    const eds = editions();
    openDialog(`
      <form class="dlg">
        <h2>New project</h2>
        <label class="field"><span>Game name</span><input name="name" required placeholder="My game"></label>
        <label class="field"><span>Project start <small>(M1 Valid concept)</small></span><input type="date" name="start" value="${D.toIso(today)}" required></label>
        <label class="field"><span>Next Fest edition</span><select name="nf">${eds.map((e) => `<option value="${esc(e.id)}">${esc(e.name)}${e.source ? '' : ' (unconfirmed)'}</option>`).join('')}</select></label>
        <label class="field"><span>Target launch</span><input type="date" name="launch" required></label>
        <p class="small muted" data-hint></p>
        <p class="small error-text" data-error></p>
        <p class="small muted">The other milestones are spread evenly between the start and Next Fest, then adjusted to respect every rule. You can drag everything afterwards.</p>
        <div class="form-actions"><button class="btn" value="cancel">Cancel</button><button class="btn primary" value="ok" data-ok>Create project</button></div>
      </form>`,
    (form) => {
      const res = planFromForm(form);
      if (!res.ok) return false;
      const p = S.projectToMem({ id: S.newId('p'), name: form.name.value.trim() || 'Untitled game', nextFestId: form.nf.value, enforce: true, dates: {} });
      p.dates = res.dates;
      change(() => {
        state.projects.push(p);
        state.ui.activeId = p.id;
        state.ui.view = 'project';
      });
      toast(`${p.name} created`);
      return true;
    },
    (form) => {
      // Editions that can't fit the rules from this start date are disabled; pick the first one that fits.
      const start = D.parse(form.start.value);
      Array.from(form.nf.options).forEach((o) => {
        const e = E.findEdition(state.events, o.value);
        const launch = e ? E.earliestLaunch(state.events, e.id, {}) : null;
        const fits = start != null && e && launch != null && E.autofill({ start, nextFestId: e.id, launch }, state.events).ok;
        o.disabled = !fits;
        o.textContent = `${e ? e.name : o.value}${e && !e.source ? ' (unconfirmed)' : ''}${fits ? '' : ' (too soon)'}`;
      });
      if (form.nf.selectedOptions[0] && form.nf.selectedOptions[0].disabled) {
        const firstOk = Array.from(form.nf.options).find((o) => !o.disabled);
        if (firstOk) form.nf.value = firstOk.value;
      }
      if (form.dataset.nf !== form.nf.value) {
        form.dataset.nf = form.nf.value;
        const l = E.earliestLaunch(state.events, form.nf.value, {});
        if (l != null) form.launch.value = D.toIso(l);
      }
      const w = E.launchWindow(state.events, form.nf.value, {});
      form.querySelector('[data-hint]').textContent = w
        ? `Allowed launch: ${D.format(w.from)}${w.to != null ? ` → ${D.format(w.to)}` : ' or later'}, outside seasonal sales.`
        : '';
      const res = planFromForm(form);
      form.querySelector('[data-error]').textContent = res.ok ? '' : res.error;
      form.querySelector('[data-ok]').disabled = !res.ok;
    });
  }

  function planFromForm(form) {
    const start = D.parse(form.start.value);
    const launch = D.parse(form.launch.value);
    const nextFestId = form.nf.value;
    if (start == null) return { ok: false, error: 'Pick a start date.' };
    if (launch == null) return { ok: false, error: 'Pick a launch date.' };
    const w = E.launchWindow(state.events, nextFestId, {});
    if (w && (launch < w.from || (w.to != null && launch > w.to))) {
      return { ok: false, error: 'The launch is outside the window allowed after this Next Fest.' };
    }
    const sale = E.saleAt(state.events, launch, {});
    if (sale) return { ok: false, error: `The launch falls in the ${sale.name} (${D.formatRange(sale.start, sale.end)}).` };
    return E.autofill({ start, nextFestId, launch }, state.events);
  }

  function renameDialog() {
    const p = project();
    if (!p) return;
    openDialog(`
      <form class="dlg">
        <h2>Rename project</h2>
        <label class="field"><span>Game name</span><input name="name" required value="${esc(p.name)}"></label>
        <div class="form-actions"><button class="btn" value="cancel">Cancel</button><button class="btn primary" value="ok">Rename</button></div>
      </form>`, (form) => {
      const name = form.name.value.trim();
      if (!name) return false;
      change(() => { p.name = name; });
      return true;
    });
  }

  function loadExample() {
    const today = D.today();
    for (const e of editions()) {
      if (e.start <= today) continue;
      const launch = E.earliestLaunch(state.events, e.id, {});
      if (launch == null) continue;
      const res = E.autofill({ start: today, nextFestId: e.id, launch }, state.events);
      if (!res.ok) continue;
      const p = S.projectToMem({ id: S.newId('p'), name: 'Example game', nextFestId: e.id, enforce: true, dates: {} });
      p.dates = res.dates;
      change(() => {
        state.projects.push(p);
        state.ui.activeId = p.id;
        state.ui.view = 'project';
      });
      toast(`Example created for ${e.name}`);
      return;
    }
    toast('No Next Fest edition is far enough away for an example. Add one in Steam events.', 'warn');
  }

  // ---------- actions ----------

  function setEnforce(on) {
    const p = project();
    if (!p) return;
    if (!on) {
      change(() => { p.enforce = false; });
      return;
    }
    const res = E.tryNormalize(Object.assign({}, p, { enforce: true }), state.events);
    if (!res.ok) {
      toast(`Can't turn enforcement on: "${E.describeRule(res.rule)}" can't be satisfied with the current fixed and locked dates. Move things by hand first.`, 'error');
      render();
      return;
    }
    const n = res.moved.size;
    change(() => { p.enforce = true; p.dates = res.dates; });
    toast(n ? `Rules enforced. ${n} milestone${n > 1 ? 's' : ''} moved to respect them (Ctrl+Z to undo).` : 'Rules enforced.');
  }

  function setEdition(id) {
    const p = project();
    if (!p || !id || id === p.nextFestId) { render(); return; }
    const res = E.tryChangeEdition(p, state.events, id);
    const ed = E.findEdition(state.events, id);
    if (!res.ok) {
      toast(`Can't switch to ${ed ? ed.name : 'that edition'}: "${E.describeRule(res.rule)}" can't be satisfied.`, 'error');
      render();
      return;
    }
    change(() => { p.nextFestId = id; p.dates = res.dates; });
    const n = res.moved.size;
    toast(`${ed.name} selected${n ? `. ${n} milestone${n > 1 ? 's' : ''} moved.` : '.'}`);
  }

  function updateRule(ruleId, patch) {
    const p = project();
    const tmpl = T.rules.find((r) => r.id === ruleId);
    const current = Object.assign({}, p.rules[ruleId] || {});
    const next = Object.assign(current, patch);
    const merged = Object.assign({}, tmpl, { enabled: true }, next);
    if (merged.min != null && merged.max != null && merged.min > merged.max) {
      toast('Min must be smaller than or equal to Max.', 'error');
      render();
      return;
    }
    const rules = Object.assign({}, p.rules, { [ruleId]: next });
    const trial = Object.assign({}, p, { rules });
    if (p.enforce !== false) {
      const res = E.tryNormalize(trial, state.events);
      if (!res.ok) {
        toast(`Can't apply: "${E.describeRule(res.rule)}" can't be satisfied with this change. Turn enforcement off to apply it anyway.`, 'error');
        render();
        return;
      }
      change(() => { p.rules = rules; p.dates = res.dates; });
      if (res.moved.size) toast(`${res.moved.size} milestone${res.moved.size > 1 ? 's' : ''} moved to respect the new value.`);
    } else {
      change(() => { p.rules = rules; });
    }
  }

  function resetRules() {
    const p = project();
    const trial = Object.assign({}, p, { rules: {} });
    if (p.enforce !== false) {
      const res = E.tryNormalize(trial, state.events);
      if (!res.ok) {
        toast(`Can't reset: "${E.describeRule(res.rule)}" can't be satisfied. Turn enforcement off first.`, 'error');
        return;
      }
      change(() => { p.rules = {}; p.dates = res.dates; });
    } else change(() => { p.rules = {}; });
    toast('Rules reset to defaults');
  }

  function applyMoveResult(p, id, res, requested) {
    if (res.delta) change(() => { p.dates = res.dates; });
    if (res.blocked && res.delta !== requested) {
      toast(`${res.delta ? 'Moved as far as the rules allow' : "Can't move further"}. Stopped by: ${E.describeRule(res.blocked)}`, 'warn');
    }
  }

  function setItemDate(id, at, iso) {
    const p = project();
    const day = D.parse(iso);
    if (day == null) { render(); return; }
    const d = p.dates[id];
    const cur = at === 'date' ? d.date : d[at];
    const res = E.trySetDate(p, state.events, id, at, day);
    if (!res) return;
    applyMoveResult(p, id, res, day - cur);
    if (!res.delta) render();
  }

  function saveEvent(form) {
    const type = form.dataset.type;
    const oldId = form.dataset.eventForm;
    const f = (k) => (form[k] ? form[k].value.trim() : '');
    const e = { id: oldId || S.newId(type === 'nextfest' ? 'nf' : type), type, name: f('name'), source: f('source') || '' };
    ['start', 'end', 'registration', 'demoPress', 'demoFinal', 'pressPreview'].forEach((k) => {
      if (form[k]) e[k] = D.parse(form[k].value);
    });
    if (!e.name) { toast('Give the event a name.', 'error'); return; }
    if (e.source && !/^https?:\/\//i.test(e.source)) { toast('The source must be a web address (https://…).', 'error'); return; }
    if (!S.validEvent(e)) { toast('Fill in every date, with the end on or after the start.', 'error'); return; }
    let notes = [];
    change(() => {
      const i = state.events.findIndex((x) => x.id === e.id);
      if (i >= 0) state.events[i] = e;
      else state.events.push(e);
      S.sortEvents(state.events);
      notes = revalidate(state.projects);
      drawer.editEvent = null;
    });
    toast(notes.length ? notes.join(' ') : 'Event saved', notes.length ? 'warn' : '');
  }

  function deleteEvent(id) {
    const e = state.events.find((x) => x.id === id);
    if (!e) return;
    const users = state.projects.filter((p) => p.nextFestId === id);
    if (users.length) {
      toast(`${e.name} is used by ${users.map((p) => p.name).join(', ')}. Switch those projects to another edition first.`, 'error');
      return;
    }
    confirmDialog('Delete event', `Delete "${e.name}"? Projects stop using its dates in the rules.`, 'Delete', () => {
      let notes = [];
      change(() => {
        state.events = state.events.filter((x) => x.id !== id);
        if (SR.defaultEvents.some((x) => x.id === id)) state.deletedEventIds.push(id);
        notes = revalidate(state.projects);
      });
      if (notes.length) toast(notes.join(' '), 'warn');
    });
  }

  function exportJson() {
    const blob = new Blob([S.exportText(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `steam-roadmap-${D.toIso(D.today())}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        let report;
        let notes = [];
        const before = snapshot();
        report = S.importText(state, String(reader.result));
        notes = revalidate(state.projects);
        if (!state.ui.activeId && state.projects.length) state.ui.activeId = state.projects[0].id;
        history.undo.push(before);
        history.redo = [];
        persist();
        render();
        const parts = [`Imported ${report.added} new project${report.added === 1 ? '' : 's'}`];
        if (report.replaced) parts.push(`${report.replaced} replaced`);
        if (report.skipped) parts.push(`${report.skipped} skipped (incomplete)`);
        toast(`${parts.join(', ')}. ${notes.join(' ')}`, notes.length || report.skipped ? 'warn' : '');
      } catch (err) {
        toast(err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  function duplicateProject() {
    const p = project();
    if (!p) return;
    const copy = S.projectToMem(S.projectToJson(p));
    copy.id = S.newId('p');
    copy.name = `${p.name} (copy)`;
    copy.createdAt = new Date().toISOString();
    change(() => {
      state.projects.push(copy);
      state.ui.activeId = copy.id;
    });
  }

  function deleteProject() {
    const p = project();
    if (!p) return;
    confirmDialog('Delete project', `Delete "${p.name}"? You can undo this with Ctrl+Z until you reload the page.`, 'Delete project', () => {
      change(() => {
        state.projects = state.projects.filter((x) => x.id !== p.id);
        state.ui.activeId = state.projects.length ? state.projects[0].id : null;
        if (!state.projects.length) state.ui.view = 'project';
      });
      drawer = { kind: null, id: null, filter: 'all', editEvent: null };
      render();
    });
  }

  // ---------- drag & keyboard on the timeline ----------

  function pxPerDayFor(el) {
    const lane = el.closest('.lane');
    const w = lane.getBoundingClientRect().width;
    return w / (lastRange.end - lastRange.start);
  }

  function dragTipHtml(p, id, res) {
    const it = T.itemById[id];
    const cur = res.dates[id];
    const base = p.dates[id];
    const delta = res.delta;
    const sign = delta > 0 ? '+' : '';
    let html = `<strong>${esc(it.code)} ${esc(it.name)}</strong><div>${esc(itemDatesText(it, cur))}</div>`;
    if (delta) html += `<div class="tip-muted">${sign}${delta} day${Math.abs(delta) === 1 ? '' : 's'} from ${esc(it.kind === 'point' ? D.format(base.date, { short: true }) : D.format(base.start, { short: true }))}</div>`;
    const n = movedCount(res.moved, id);
    if (n) html += `<div>Pushes ${n} milestone${n > 1 ? 's' : ''}</div>`;
    if (res.blocked) html += `<div class="tip-bad">Stopped by: ${esc(E.describeRule(res.blocked))}</div>`;
    return html;
  }

  // Empty timeline space (not a milestone, a name or a control) pans the view.
  function isPanTarget(e) {
    if (!e.target.closest('.tl')) return false;
    if (e.target.closest('.label-cell, .zoom, button, input, select, a')) return false;
    if (state.ui.view === 'project' && e.target.closest('.mk[data-id]')) return false;
    return true;
  }

  function canPan() {
    return main.scrollWidth > main.clientWidth + 1 || main.scrollHeight > main.clientHeight + 1;
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    if (isPanTarget(e)) {
      // Touch screens scroll natively; mouse and pen drag the view.
      if (e.pointerType === 'touch' || !canPan()) return;
      pan = { x0: e.clientX, y0: e.clientY, left: main.scrollLeft, top: main.scrollTop };
      hideTip();
      e.preventDefault();
      document.body.classList.add('panning');
      window.addEventListener('pointermove', onPanMove);
      window.addEventListener('pointerup', endPan);
      window.addEventListener('pointercancel', endPan);
      return;
    }
    if (state.ui.view !== 'project') return;
    const mk = e.target.closest('.mk[data-id]');
    if (!mk || !main.contains(mk)) return;
    const p = project();
    const id = mk.dataset.id;
    const it = T.itemById[id];
    const handle = e.target.closest('.hd');
    const mode = handle ? handle.dataset.mode : mk.dataset.mode;
    const canDrag = !!mode && it.kind !== 'nextfest' && !(p.locked && p.locked[id]);
    drag = {
      id, mode, canDrag, x0: e.clientX, scroll0: main.scrollLeft, started: false, delta: 0, result: null,
      range: lastRange, pxPerDay: pxPerDayFor(mk), cache: new Map(), last: null, timer: 0,
    };
    hideTip();
    e.preventDefault();
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', cancelDrag);
    if (canDrag) drag.timer = setInterval(autoScroll, 16);
  }

  function onPanMove(e) {
    if (!pan) return;
    main.scrollLeft = pan.left - (e.clientX - pan.x0);
    main.scrollTop = pan.top - (e.clientY - pan.y0);
  }

  function endPan() {
    pan = null;
    document.body.classList.remove('panning');
    window.removeEventListener('pointermove', onPanMove);
    window.removeEventListener('pointerup', endPan);
    window.removeEventListener('pointercancel', endPan);
  }

  function onPointerMove(e) {
    if (!drag) return;
    drag.last = { clientX: e.clientX, clientY: e.clientY };
    updateDrag(drag.last);
  }

  // Pointer offset plus however far the view has scrolled since the drag began.
  function updateDrag(pt) {
    const dx = pt.clientX - drag.x0 + (main.scrollLeft - drag.scroll0);
    if (!drag.started && Math.abs(dx) < 4) return;
    drag.started = true;
    const p = project();
    if (!drag.canDrag) {
      const it = T.itemById[drag.id];
      showTip(it.kind === 'nextfest' ? 'Next Fest dates are fixed by Valve. Change the edition from the top bar.' : 'Locked. Unlock it in its details to move it.', pt.clientX, pt.clientY);
      return;
    }
    document.body.classList.add('dragging');
    const delta = Math.round(dx / drag.pxPerDay);
    if (delta !== drag.delta || !drag.result) {
      drag.delta = delta;
      let res = drag.cache.get(delta);
      if (!res) {
        res = E.tryMove(p, state.events, drag.id, drag.mode, delta);
        drag.cache.set(delta, res);
      }
      drag.result = res;
      renderMain({ dates: res.dates, moved: res.moved, dragId: drag.id });
    }
    showTip(dragTipHtml(p, drag.id, drag.result), pt.clientX, pt.clientY);
  }

  // While dragging a milestone near the left or right edge, scroll the view to follow it.
  function autoScroll() {
    if (!drag || !drag.started || !drag.last) return;
    const r = main.getBoundingClientRect();
    const zone = 48;
    const leftEdge = r.left + labelWidth();
    const x = drag.last.clientX;
    let speed = 0;
    if (x > r.right - zone) speed = (x - (r.right - zone)) / zone;
    else if (x < leftEdge + zone) speed = -(leftEdge + zone - x) / zone;
    if (!speed) return;
    const before = main.scrollLeft;
    main.scrollLeft += Math.max(-1, Math.min(1, speed)) * 18;
    if (main.scrollLeft !== before) updateDrag(drag.last);
  }

  function endDrag() {
    if (drag && drag.timer) clearInterval(drag.timer);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', cancelDrag);
    document.body.classList.remove('dragging');
    hideTip();
  }

  function onPointerUp() {
    const d = drag;
    endDrag();
    drag = null;
    if (!d) return;
    if (!d.started) {
      openDrawer('item', d.id);
      return;
    }
    const p = project();
    if (d.result && d.result.delta) {
      applyMoveResult(p, d.id, d.result, d.delta);
    } else {
      render();
      if (d.result && d.result.blocked) toast(`Can't move: ${E.describeRule(d.result.blocked)}`, 'warn');
    }
  }

  function cancelDrag() {
    if (!drag) return;
    endDrag();
    drag = null;
    render();
  }

  // ---------- zoom ----------

  /* Change zoom keeping the date under `anchorX` (a viewport x) in place.
     Without an anchor, the middle of the visible lanes stays put. */
  function setZoom(z, anchorX) {
    const next = Math.min(ZOOM_MAX, Math.max(1, z));
    if (Math.abs(next - zoomLevel()) < 0.001) return;
    const r = main.getBoundingClientRect();
    const labelW = labelWidth();
    const ax = anchorX == null ? r.left + labelW + (main.clientWidth - labelW) / 2 : anchorX;
    const laneBefore = main.querySelector('.head-row .lane');
    let frac = null;
    if (laneBefore) {
      const lr = laneBefore.getBoundingClientRect();
      frac = Math.min(1, Math.max(0, (ax - lr.left) / lr.width));
    }
    state.ui.zoom = next;
    persist();
    renderMain();
    const laneAfter = main.querySelector('.head-row .lane');
    if (frac != null && laneAfter) {
      const lr = laneAfter.getBoundingClientRect();
      const contentX = lr.left - r.left + main.scrollLeft + frac * lr.width;
      main.scrollLeft = contentX - (ax - r.left);
    }
    main.classList.toggle('can-pan', canPan());
    document.body.classList.toggle('can-pan', canPan());
  }

  // Ctrl + wheel (and trackpad pinch) zooms; batch the events into one render per ~frame.
  let zoomQueued = null;
  function queueZoom(z, anchorX) {
    const first = !zoomQueued;
    zoomQueued = { z: Math.min(ZOOM_MAX, Math.max(1, z)), anchorX };
    if (first) {
      setTimeout(() => {
        const q = zoomQueued;
        zoomQueued = null;
        setZoom(q.z, q.anchorX);
      }, 16);
    }
  }

  function onWheel(e) {
    if (!project() || drag || !e.target.closest('.tl')) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const base = zoomQueued ? zoomQueued.z : zoomLevel();
      queueZoom(base * Math.exp(-e.deltaY * 0.0025), e.clientX);
      return;
    }
    // A plain wheel scrolls sideways when there is nothing to scroll vertically.
    const vertical = Math.abs(e.deltaY) > Math.abs(e.deltaX);
    if (vertical && main.scrollHeight <= main.clientHeight + 1 && main.scrollWidth > main.clientWidth + 1) {
      e.preventDefault();
      main.scrollLeft += e.deltaY;
    }
  }

  function onTimelineKey(e) {
    const mk = e.target.closest && e.target.closest('.mk[data-id]');
    if (!mk || state.ui.view !== 'project') return;
    const id = mk.dataset.id;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDrawer('item', id);
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const p = project();
    const it = T.itemById[id];
    if (it.kind === 'nextfest' || (p.locked && p.locked[id])) return;
    e.preventDefault();
    const step = (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 7 : 1);
    const mode = e.altKey && it.kind === 'phase' && !it.openEnded ? 'end' : 'move';
    const res = E.tryMove(p, state.events, id, mode, step);
    applyMoveResult(p, id, res, step);
    const again = main.querySelector(`.mk[data-id="${id}"][data-mode]`);
    if (again) again.focus();
  }

  // ---------- event wiring ----------

  main.addEventListener('pointerdown', onPointerDown);
  main.addEventListener('keydown', onTimelineKey);
  main.addEventListener('wheel', onWheel, { passive: false });

  main.addEventListener('click', (e) => {
    const zoom = e.target.closest('[data-zoom]');
    if (zoom) {
      const z = zoomLevel();
      if (zoom.dataset.zoom === 'in') setZoom(z * 1.5);
      else if (zoom.dataset.zoom === 'out') setZoom(z / 1.5);
      else setZoom(1);
      return;
    }
    const open = e.target.closest('[data-open]');
    if (open) { openDrawer('item', open.dataset.open); return; }
    const openProject = e.target.closest('[data-open-project]');
    if (openProject) { setUi({ activeId: openProject.dataset.openProject, view: 'project' }); return; }
    const act = e.target.closest('[data-action]');
    if (!act) return;
    if (act.dataset.action === 'new') newProjectDialog();
    else if (act.dataset.action === 'example') loadExample();
    else if (act.dataset.action === 'import') $('#importFile').click();
  });

  // Hover tooltips (not while dragging).
  document.addEventListener('mouseover', (e) => {
    if (drag) return;
    const tipTarget = e.target.closest('[data-tip]');
    if (tipTarget) { showTip(esc(tipTarget.dataset.tip), e.clientX, e.clientY); return; }
    const mk = e.target.closest('#main .mk[data-id]');
    if (mk && state.ui.view === 'project') { showTip(itemTip(project(), mk.dataset.id), e.clientX, e.clientY); return; }
    hideTip();
  });
  document.addEventListener('mousemove', (e) => {
    if (drag || tipEl.hidden) return;
    const r = tipEl.getBoundingClientRect();
    const left = Math.min(window.innerWidth - r.width - 8, e.clientX + 14);
    const top = e.clientY + 18 + r.height > window.innerHeight ? e.clientY - r.height - 12 : e.clientY + 18;
    tipEl.style.left = `${Math.max(8, left)}px`;
    tipEl.style.top = `${Math.max(8, top)}px`;
  });
  main.addEventListener('mouseleave', () => { if (!drag) hideTip(); });

  // Top bar.
  document.querySelectorAll('.seg [data-view]').forEach((b) => b.addEventListener('click', () => setUi({ view: b.dataset.view })));
  $('#projectSelect').addEventListener('change', (e) => setUi({ activeId: e.target.value }));
  $('#newProjectBtn').addEventListener('click', newProjectDialog);
  $('#nfSelect').addEventListener('change', (e) => setEdition(e.target.value));
  $('#enforceToggle').addEventListener('change', (e) => setEnforce(e.target.checked));
  $('#rulesBtn').addEventListener('click', () => (drawer.kind === 'rules' ? closeDrawer() : openDrawer('rules')));
  $('#eventsBtn').addEventListener('click', () => (drawer.kind === 'events' ? closeDrawer() : openDrawer('events')));
  $('#undoBtn').addEventListener('click', undo);
  $('#redoBtn').addEventListener('click', redo);

  const menuBtn = $('#moreBtn');
  const menu = $('#moreMenu');
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    menuBtn.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !menu.contains(e.target)) { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); }
  });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-menu]');
    if (!b) return;
    const a = b.dataset.menu;
    if (a !== 'fests') menu.hidden = true;
    if (a === 'rename') renameDialog();
    else if (a === 'duplicate') duplicateProject();
    else if (a === 'delete') deleteProject();
    else if (a === 'export') exportJson();
    else if (a === 'import') $('#importFile').click();
  });
  $('#showFestsToggle').addEventListener('change', (e) => setUi({ showFests: e.target.checked }));
  $('#importFile').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) importJson(file);
    e.target.value = '';
  });

  // Status bar.
  $('#statusbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    if (b.dataset.action === 'rules') openDrawer('rules');
    if (b.dataset.action === 'rules-broken') openDrawer('rules', null, { filter: 'broken' });
  });

  // Drawer.
  drawerEl.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (chip) { drawer.filter = chip.dataset.filter; renderDrawer(); return; }
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const a = b.dataset.action;
    if (a === 'close-drawer') closeDrawer();
    else if (a === 'rules') openDrawer('rules');
    else if (a === 'reset-rules') resetRules();
    else if (a === 'add-event') { drawer.editEvent = { id: '', type: b.dataset.type }; renderDrawer(); }
    else if (a === 'cancel-event') { drawer.editEvent = null; renderDrawer(); }
    else if (a === 'edit-event') {
      const id = b.closest('[data-event]').dataset.event;
      drawer.editEvent = Object.assign({}, state.events.find((x) => x.id === id));
      renderDrawer();
    } else if (a === 'delete-event') deleteEvent(b.closest('[data-event]').dataset.event);
  });

  drawerEl.addEventListener('change', (e) => {
    const t = e.target;
    const p = project();
    if (t.matches('[data-date]')) setItemDate(drawer.id, t.dataset.date, t.value);
    else if (t.matches('[data-lock]')) change(() => { p.locked = Object.assign({}, p.locked, { [drawer.id]: t.checked }); if (!t.checked) delete p.locked[drawer.id]; });
    else if (t.matches('[data-notes]')) change(() => { p.notes = Object.assign({}, p.notes, { [drawer.id]: t.value }); });
    else if (t.matches('[data-nf-select]')) setEdition(t.value);
    else if (t.matches('[data-enforce]')) setEnforce(t.checked);
    else if (t.matches('[data-show-fests]')) setUi({ showFests: t.checked });
    else if (t.matches('[data-rule-enabled]')) updateRule(t.closest('[data-rule]').dataset.rule, { enabled: t.checked });
    else if (t.matches('[data-param]')) {
      const key = t.dataset.param;
      let value;
      if (key === 'unit') value = t.value;
      else if (t.value.trim() === '') value = key === 'buffer' ? 0 : null;
      else {
        value = Math.round(Number(t.value));
        if (!Number.isFinite(value) || value < 0) { toast('Use a whole number of 0 or more.', 'error'); render(); return; }
      }
      updateRule(t.closest('[data-rule]').dataset.rule, { [key]: value });
    }
  });

  drawerEl.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-event-form]');
    if (!form) return;
    e.preventDefault();
    saveEvent(form);
  });

  // Keyboard shortcuts.
  document.addEventListener('keydown', (e) => {
    const typing = e.target.matches && e.target.matches('input, textarea, select');
    if (e.key === 'Escape') {
      if (drag) { cancelDrag(); return; }
      if (dialogEl.open) return;
      if (!menu.hidden) { menu.hidden = true; return; }
      if (drawer.kind) closeDrawer();
      return;
    }
    if (typing) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (!drag) render(); }, 80);
  });

  // ---------- boot ----------

  const notes = revalidate(state.projects);
  if (notes.length) persist();
  if (!state.ui.activeId && state.projects.length) state.ui.activeId = state.projects[0].id;
  render();
  if (notes.length) toast(notes.join(' '), 'warn');
})();
