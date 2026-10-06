/* Timeline (Gantt) rendering. Produces HTML strings; interaction lives in app.js. */
(function (root) {
  'use strict';
  const SR = (root.SR = root.SR || {});
  const D = SR.dates;
  const T = SR.template;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- range & scale ----------

  function endOfMonth(day) {
    const { y, m } = D.ymd(day);
    return D.fromYmd(y, m + 1, 0);
  }

  // Visible range: whole months around every date of the project(s).
  function rangeFor(days, padAfter) {
    const valid = days.filter((d) => Number.isFinite(d));
    if (!valid.length) {
      const t = D.today();
      return { start: D.startOfMonth(t), end: endOfMonth(D.addMonths(t, 11)) + 1 };
    }
    const lo = Math.min.apply(null, valid);
    const hi = Math.max.apply(null, valid);
    return { start: D.startOfMonth(lo - 7), end: endOfMonth(hi + (padAfter || 30)) + 1 };
  }

  function projectDays(project, nf) {
    const out = [];
    Object.keys(project.dates).forEach((id) => {
      const d = project.dates[id];
      ['date', 'start', 'end'].forEach((k) => { if (d[k] != null) out.push(d[k]); });
    });
    if (nf) SR.nextFestFields.forEach((f) => { if (nf[f.key] != null) out.push(nf[f.key]); });
    return out;
  }

  // Zoomed timelines get an explicit width; at "fit" the timeline fills the window.
  function widthStyle(opts) {
    return opts.tlWidth ? ` style="width:${opts.tlWidth}px"` : '';
  }

  function makeX(range) {
    const span = range.end - range.start;
    return (day) => ((day - range.start) / span) * 100;
  }

  function scaleHtml(range, laneWidth, today) {
    const x = makeX(range);
    const pxPerDay = laneWidth / (range.end - range.start);
    let years = '';
    let months = '';
    let day = range.start;
    let yearStart = day;
    let curYear = D.ymd(day).y;
    while (day < range.end) {
      const { y, m } = D.ymd(day);
      const next = Math.min(D.addMonths(day, 1), range.end);
      if (y !== curYear) {
        years += `<div class="sc-year" style="left:${x(yearStart)}%;width:${x(day) - x(yearStart)}%"><span>${curYear}</span></div>`;
        yearStart = day;
        curYear = y;
      }
      const w = (next - day) * pxPerDay;
      const label = w >= 30 ? D.MONTHS[m] : w >= 12 ? D.MONTHS[m][0] : '';
      months += `<div class="sc-month${m === 0 ? ' jan' : ''}" style="left:${x(day)}%;width:${x(next) - x(day)}%">${label}</div>`;
      day = next;
    }
    years += `<div class="sc-year" style="left:${x(yearStart)}%;width:${x(range.end) - x(yearStart)}%"><span>${curYear}</span></div>`;
    const todayMark = today >= range.start && today < range.end
      ? `<div class="sc-today" style="left:${x(today + 0.5)}%">Today</div>` : '';
    return `<div class="sc-years">${years}</div><div class="sc-months">${months}${todayMark}</div>`;
  }

  // Month lines, sale bands, chosen Next Fest band and today line, spanning all rows.
  function overlayHtml(range, events, nf, today) {
    const x = makeX(range);
    let html = '';
    let day = D.startOfMonth(range.start);
    while (day < range.end) {
      if (day > range.start) html += `<div class="ov-line${D.ymd(day).m === 0 ? ' jan' : ''}" style="left:${x(day)}%"></div>`;
      day = D.addMonths(day, 1);
    }
    events.forEach((e) => {
      if (e.type !== 'sale' || e.end < range.start || e.start >= range.end) return;
      html += `<div class="ov-sale" style="left:${x(e.start)}%;width:${x(e.end + 1) - x(e.start)}%"></div>`;
    });
    if (nf) html += `<div class="ov-nf" style="left:${x(nf.start)}%;width:${x(nf.end + 1) - x(nf.start)}%"></div>`;
    if (today >= range.start && today < range.end) html += `<div class="ov-today" style="left:${x(today + 0.5)}%"></div>`;
    return `<div class="overlay">${html}</div>`;
  }

  function eventsRowHtml(range, events, chosenId, showFests) {
    const x = makeX(range);
    let top = '';
    let bottom = '';
    events.forEach((e) => {
      if (e.end < range.start || e.start >= range.end) return;
      if (e.type === 'fest' && !showFests) return;
      const left = Math.max(0, x(e.start));
      const width = Math.max(0.15, Math.min(100, x(e.end + 1)) - left);
      const when = D.formatRange(e.start, e.end);
      const unconfirmed = e.source ? '' : ' · unconfirmed';
      const tip = esc(`${e.name} · ${when}${unconfirmed}`);
      if (e.type === 'nextfest') {
        const cls = e.id === chosenId ? 'ev ev-nf chosen' : 'ev ev-nf';
        top += `<div class="${cls}" style="left:${left}%;width:${width}%" data-tip="${tip}"><span>NF</span></div>`;
      } else if (e.type === 'sale') {
        bottom += `<div class="ev ev-sale" style="left:${left}%;width:${width}%" data-tip="${tip}"><span>${esc(e.name.replace(/ Sale.*/, ''))}</span></div>`;
      } else {
        bottom += `<div class="ev ev-fest" style="left:${left}%;width:${width}%" data-tip="${tip}"></div>`;
      }
    });
    return `<div class="ev-line">${top}</div><div class="ev-line">${bottom}</div>`;
  }

  // ---------- project rows ----------

  function itemState(id, ctx) {
    const cls = [];
    if (ctx.broken[id]) cls.push('bad');
    if (ctx.moved && ctx.moved.has(id)) cls.push('pushed');
    if (ctx.locked[id]) cls.push('locked');
    if (ctx.dragId === id) cls.push('dragging');
    if (ctx.selectedId === id) cls.push('selected');
    return cls.join(' ');
  }

  function ghostHtml(it, base, cur, x) {
    if (!base || !cur) return '';
    if (it.kind === 'point') {
      if (base.date === cur.date) return '';
      return `<div class="ghost pt ${it.shape || 'dot'}" style="left:${x(base.date + 0.5)}%"></div>`;
    }
    if (base.start === cur.start && base.end === cur.end) return '';
    if (it.openEnded) return `<div class="ghost pt dot" style="left:${x(base.start + 0.5)}%"></div>`;
    return `<div class="ghost bar" style="left:${x(base.start)}%;width:${x(base.end + 1) - x(base.start)}%"></div>`;
  }

  function textSide(xpos) {
    return xpos > 82 ? 'left' : 'right';
  }

  function itemMarkers(it, ctx) {
    const x = ctx.x;
    const d = ctx.dates[it.id];
    const state = itemState(it.id, ctx);
    const label = `${it.code} ${it.name}`;
    let html = ghostHtml(it, ctx.baseDates && ctx.baseDates[it.id], d, x);

    if (it.kind === 'nextfest') {
      const nf = ctx.nf;
      if (!nf) return `<span class="mk-text missing" style="left:1%">No Next Fest edition chosen</span>`;
      const left = x(nf.start);
      const right = x(nf.end + 1);
      html += `<div class="mk bar fixed nf ${state}" data-id="M12" tabindex="0" style="left:${left}%;width:${right - left}%" aria-label="Next Fest, fixed by Valve, ${esc(D.formatRange(nf.start, nf.end))}"></div>`;
      SR.nextFestFields.forEach((f) => {
        if (f.key === 'start' || f.key === 'end' || nf[f.key] == null) return;
        html += `<span class="nf-tick" style="left:${x(nf[f.key] + 0.5)}%" data-tip="${esc(`${f.label} · ${D.format(nf[f.key])}`)}"></span>`;
      });
      html += `<span class="mk-text ${textSide(right)}" style="left:${textSide(right) === 'left' ? left : right}%">${esc(D.formatRange(nf.start, nf.end))}</span>`;
      return html;
    }

    if (it.kind === 'point') {
      const px = x(d.date + 0.5);
      html += `<div class="mk pt ${it.shape || 'dot'} ${state}" data-id="${it.id}" data-mode="move" tabindex="0" style="left:${px}%" aria-label="${esc(label)}, ${esc(D.format(d.date))}"></div>`;
      html += `<span class="mk-text ${textSide(px)}" style="left:${px}%">${esc(D.format(d.date, { short: true }))}</span>`;
      return html;
    }

    // phase
    if (it.openEnded) {
      const left = x(d.start);
      html += `<div class="mk bar open ${state}" data-id="${it.id}" data-mode="move" tabindex="0" style="left:${left}%;right:0" aria-label="${esc(label)}, from ${esc(D.format(d.start))}"></div>`;
      html += `<span class="mk-text inside" style="left:${left}%">from ${esc(D.format(d.start, { short: true }))}</span>`;
      return html;
    }
    const left = x(d.start);
    const right = x(d.end + 1);
    const handles = ctx.locked[it.id] ? '' : '<span class="hd hd-l" data-mode="start"></span><span class="hd hd-r" data-mode="end"></span>';
    html += `<div class="mk bar ${state}" data-id="${it.id}" data-mode="move" tabindex="0" style="left:${left}%;width:${right - left}%" aria-label="${esc(label)}, ${esc(D.formatRange(d.start, d.end))}">${handles}</div>`;

    // sub-milestones drawn on this bar
    (T.children[it.id] || []).forEach((cid) => {
      const c = T.itemById[cid];
      const cd = ctx.dates[cid];
      html += ghostHtml(c, ctx.baseDates && ctx.baseDates[cid], cd, x);
      html += `<div class="mk sub ${itemState(cid, ctx)}" data-id="${cid}" data-mode="move" tabindex="0" style="left:${x(cd.date + 0.5)}%" aria-label="${esc(c.name)}, ${esc(D.format(cd.date))}">${esc(c.code)}</div>`;
    });

    if (it.endShape === 'flag') {
      html += `<div class="mk flag ${state}" data-id="${it.id}" data-mode="end" tabindex="-1" style="left:${right}%" aria-hidden="true"></div>`;
      const side = textSide(right);
      html += `<span class="mk-text strong ${side}" style="left:${side === 'left' ? left : right}%">Launch ${esc(D.format(d.end, { short: true }))}</span>`;
    } else {
      const side = textSide(right);
      html += `<span class="mk-text ${side}" style="left:${side === 'left' ? left : right}%">${esc(D.format(d.start, { short: true }))} → ${esc(D.format(d.end, { short: true }))}</span>`;
    }
    return html;
  }

  function labelHtml(it, ctx) {
    const broken = ctx.broken[it.id] || 0;
    const lock = ctx.locked[it.id] ? '<span class="lbl-lock" title="Locked: never moved by the rules">🔒</span>' : '';
    const bad = broken ? `<span class="lbl-bad" title="${broken} broken rule${broken > 1 ? 's' : ''}">${broken}</span>` : '';
    const fixed = it.kind === 'nextfest' ? '<span class="lbl-fixed" title="Dates fixed by Valve">fixed</span>' : '';
    return `<button class="label-cell" data-open="${it.id}"><span class="code">${esc(it.code)}</span><span class="name">${esc(it.name)}</span>${fixed}${lock}${bad}</button>`;
  }

  /* opts: { project, events, evaluation, range, laneWidth, today, showFests,
             preview: { dates, moved, dragId } | null, selectedId } */
  function renderProject(opts) {
    const { project, events, evaluation, range } = opts;
    const nf = evaluation.nf;
    const x = makeX(range);
    const broken = {};
    Object.keys(evaluation.byItem).forEach((id) => {
      const target = T.itemById[id] && T.itemById[id].row ? T.itemById[id].row : id;
      broken[id] = evaluation.byItem[id].length;
      if (target !== id) broken[target] = (broken[target] || 0) + evaluation.byItem[id].length;
    });
    const ctx = {
      x,
      nf,
      dates: opts.preview ? opts.preview.dates : project.dates,
      baseDates: opts.preview ? project.dates : null,
      moved: opts.preview ? opts.preview.moved : null,
      dragId: opts.preview ? opts.preview.dragId : null,
      selectedId: opts.selectedId,
      broken,
      locked: project.locked || {},
    };

    let rows = '';
    T.rows.forEach((group) => {
      rows += `<div class="row track-row" data-track="${group.track.id}"><div class="label-cell track-title">${esc(group.track.name)}</div><div class="lane"></div></div>`;
      group.items.forEach((id) => {
        const it = T.itemById[id];
        rows += `<div class="row item-row" data-track="${it.track}" data-row="${id}">${labelHtml(it, ctx)}<div class="lane">${itemMarkers(it, ctx)}</div></div>`;
      });
    });

    return `
      <div class="tl" data-range="${range.start},${range.end}"${widthStyle(opts)}>
        <div class="row head-row">
          <div class="label-cell head-title">${opts.cornerHtml || ''}</div>
          <div class="lane scale">${scaleHtml(range, opts.laneWidth, opts.today)}</div>
        </div>
        <div class="tl-body">
          ${overlayHtml(range, events, nf, opts.today)}
          <div class="row events-row">
            <div class="label-cell track-title">Steam events</div>
            <div class="lane">${eventsRowHtml(range, events, project.nextFestId, opts.showFests)}</div>
          </div>
          ${rows}
        </div>
      </div>`;
  }

  // ---------- overview (all projects) ----------

  function renderOverview(opts) {
    const { projects, events, range } = opts;
    const x = makeX(range);
    let rows = '';
    projects.forEach((p) => {
      const nf = SR.engine.findEdition(events, p.nextFestId);
      const d = p.dates;
      const ev = SR.engine.evaluate(p, events);
      const launch = d.M13.end;
      let lane = '';
      lane += `<div class="ov-span" style="left:${x(d.M1.date)}%;width:${x(launch + 1) - x(d.M1.date)}%"></div>`;
      lane += `<div class="mk bar ov-prod" style="left:${x(d.M11.start)}%;width:${x(d.M11.end + 1) - x(d.M11.start)}%" data-tip="${esc(`Production · ${D.formatRange(d.M11.start, d.M11.end)}`)}"></div>`;
      lane += `<div class="mk pt dot ov-page" style="left:${x(d.M5.date + 0.5)}%" data-tip="${esc(`Steam page live · ${D.format(d.M5.date)}`)}"></div>`;
      lane += `<div class="mk pt dot ov-demo" style="left:${x(d.M8.date + 0.5)}%" data-tip="${esc(`Steam demo · ${D.format(d.M8.date)}`)}"></div>`;
      if (nf) lane += `<div class="mk bar fixed nf" style="left:${x(nf.start)}%;width:${x(nf.end + 1) - x(nf.start)}%" data-tip="${esc(`${nf.name} · ${D.formatRange(nf.start, nf.end)}`)}"></div>`;
      lane += `<div class="mk flag ov-launch" style="left:${x(launch + 1)}%" data-tip="${esc(`Launch · ${D.format(launch)}`)}"></div>`;
      const bad = ev.list.length ? `<span class="lbl-bad" title="${ev.list.length} broken rules">${ev.list.length}</span>` : '';
      rows += `<div class="row item-row overview-row" data-project="${esc(p.id)}">
        <button class="label-cell" data-open-project="${esc(p.id)}"><span class="ov-name"><span class="name">${esc(p.name)}</span><span class="sub">Launch ${esc(D.format(launch))}${nf ? ` · ${esc(nf.name.replace('Next Fest · ', 'NF '))}` : ' · no Next Fest'}</span></span>${bad}</button>
        <div class="lane">${lane}</div></div>`;
    });

    return `
      <div class="tl overview"${widthStyle(opts)}>
        <div class="row head-row">
          <div class="label-cell head-title">${opts.cornerHtml || ''}</div>
          <div class="lane scale">${scaleHtml(range, opts.laneWidth, opts.today)}</div>
        </div>
        <div class="tl-body">
          ${overlayHtml(range, events, null, opts.today)}
          <div class="row events-row">
            <div class="label-cell track-title">Steam events</div>
            <div class="lane">${eventsRowHtml(range, events, null, opts.showFests)}</div>
          </div>
          <div class="row track-row"><div class="label-cell track-title">Projects</div><div class="lane"></div></div>
          ${rows}
        </div>
      </div>`;
  }

  SR.timeline = { esc, rangeFor, projectDays, renderProject, renderOverview, makeX };
})(typeof window !== 'undefined' ? window : globalThis);
