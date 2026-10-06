/* Persistence: browser localStorage + JSON export/import.
   In memory, dates are day numbers; on disk they are ISO strings (YYYY-MM-DD). */
(function (root) {
  'use strict';
  const SR = (root.SR = root.SR || {});
  const D = SR.dates;
  const T = SR.template;

  const KEY = 'steam-production-roadmap/v1';
  const APP = 'steam-production-roadmap';
  const VERSION = 1;
  const EVENT_DATE_FIELDS = ['start', 'end', 'registration', 'demoPress', 'demoFinal', 'pressPreview'];
  const DATE_KEYS = ['date', 'start', 'end'];

  function newId(prefix) {
    return `${prefix || 'id'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  // ---------- events ----------

  function eventToMem(e) {
    const o = Object.assign({}, e);
    EVENT_DATE_FIELDS.forEach((k) => {
      if (typeof o[k] === 'string') o[k] = D.parse(o[k]);
      if (o[k] == null || Number.isNaN(o[k])) delete o[k];
    });
    return o;
  }

  function eventToJson(e) {
    const o = Object.assign({}, e);
    EVENT_DATE_FIELDS.forEach((k) => { if (typeof o[k] === 'number') o[k] = D.toIso(o[k]); });
    return o;
  }

  function validEvent(e) {
    if (!e || typeof e.id !== 'string' || !['nextfest', 'sale', 'fest'].includes(e.type)) return false;
    if (e.start == null || e.end == null || e.end < e.start) return false;
    if (e.type === 'nextfest') return ['registration', 'demoPress', 'demoFinal', 'pressPreview'].every((k) => e[k] != null);
    return true;
  }

  function sortEvents(events) {
    return events.sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));
  }

  function defaultEvents() {
    return SR.defaultEvents.map(eventToMem);
  }

  // ---------- projects ----------

  function projectToMem(p) {
    const dates = {};
    Object.keys(p.dates || {}).forEach((id) => {
      const src = p.dates[id];
      const d = {};
      DATE_KEYS.forEach((k) => {
        if (typeof src[k] === 'string') d[k] = D.parse(src[k]);
        else if (typeof src[k] === 'number') d[k] = src[k];
      });
      dates[id] = d;
    });
    return {
      id: p.id || newId('p'),
      name: String(p.name || 'Untitled game'),
      nextFestId: p.nextFestId || null,
      enforce: p.enforce !== false,
      locked: Object.assign({}, p.locked),
      notes: Object.assign({}, p.notes),
      rules: JSON.parse(JSON.stringify(p.rules || {})),
      dates,
      createdAt: p.createdAt || new Date().toISOString(),
    };
  }

  function projectToJson(p) {
    const dates = {};
    Object.keys(p.dates).forEach((id) => {
      const d = {};
      DATE_KEYS.forEach((k) => { if (p.dates[id][k] != null) d[k] = D.toIso(p.dates[id][k]); });
      dates[id] = d;
    });
    return {
      id: p.id,
      name: p.name,
      nextFestId: p.nextFestId,
      enforce: p.enforce,
      locked: p.locked,
      notes: p.notes,
      rules: p.rules,
      dates,
      createdAt: p.createdAt,
    };
  }

  // A project is usable when every dated milestone has valid dates.
  function validProject(p) {
    return T.items.every((it) => {
      if (it.kind === 'nextfest') return true;
      const d = p.dates[it.id];
      if (!d) return false;
      if (it.kind === 'point') return Number.isFinite(d.date);
      if (!Number.isFinite(d.start)) return false;
      return it.openEnded || (Number.isFinite(d.end) && d.end >= d.start);
    });
  }

  // ---------- state ----------

  function emptyState() {
    return {
      projects: [],
      events: sortEvents(defaultEvents()),
      deletedEventIds: [],
      ui: { activeId: null, view: 'project', showFests: false },
    };
  }

  // Add default events that are new in the code and were never deleted by the user.
  function mergeDefaultEvents(state) {
    const have = new Set(state.events.map((e) => e.id));
    const deleted = new Set(state.deletedEventIds);
    defaultEvents().forEach((e) => {
      if (!have.has(e.id) && !deleted.has(e.id)) state.events.push(e);
    });
    sortEvents(state.events);
  }

  function fromJson(obj) {
    const state = emptyState();
    if (!obj || typeof obj !== 'object') return state;
    if (Array.isArray(obj.events)) state.events = obj.events.map(eventToMem).filter(validEvent);
    if (Array.isArray(obj.deletedEventIds)) state.deletedEventIds = obj.deletedEventIds.slice();
    if (Array.isArray(obj.projects)) state.projects = obj.projects.map(projectToMem).filter(validProject);
    if (obj.ui) Object.assign(state.ui, obj.ui);
    mergeDefaultEvents(state);
    return state;
  }

  function toJson(state) {
    return {
      app: APP,
      version: VERSION,
      savedAt: new Date().toISOString(),
      projects: state.projects.map(projectToJson),
      events: state.events.map(eventToJson),
      deletedEventIds: state.deletedEventIds,
      ui: state.ui,
    };
  }

  function load() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(KEY);
      if (raw) return fromJson(JSON.parse(raw));
    } catch (e) {
      /* storage blocked or corrupted: start empty */
    }
    return emptyState();
  }

  function save(state) {
    try {
      if (root.localStorage) root.localStorage.setItem(KEY, JSON.stringify(toJson(state)));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- export / import ----------

  function exportText(state) {
    const data = toJson(state);
    delete data.ui;
    return JSON.stringify(data, null, 2);
  }

  /* Merge an exported file into the state. Projects with the same id are replaced,
     events are merged by id. Returns { added, replaced, events, skipped }. */
  function importText(state, text) {
    let obj;
    try {
      obj = JSON.parse(text);
    } catch (e) {
      throw new Error('This file is not valid JSON.');
    }
    if (!obj || obj.app !== APP || !Array.isArray(obj.projects)) {
      throw new Error('This file is not a Steam Production Roadmap export.');
    }
    const report = { added: 0, replaced: 0, events: 0, skipped: 0 };

    (obj.events || []).map(eventToMem).filter(validEvent).forEach((e) => {
      const i = state.events.findIndex((x) => x.id === e.id);
      if (i >= 0) state.events[i] = e;
      else state.events.push(e);
      state.deletedEventIds = state.deletedEventIds.filter((id) => id !== e.id);
      report.events++;
    });
    sortEvents(state.events);

    obj.projects.map(projectToMem).forEach((p) => {
      if (!validProject(p)) { report.skipped++; return; }
      const i = state.projects.findIndex((x) => x.id === p.id);
      if (i >= 0) { state.projects[i] = p; report.replaced++; }
      else { state.projects.push(p); report.added++; }
    });
    return report;
  }

  SR.store = {
    newId,
    load,
    save,
    exportText,
    importText,
    fromJson,
    toJson,
    eventToMem,
    eventToJson,
    validEvent,
    sortEvents,
    defaultEvents,
    projectToMem,
    projectToJson,
    validProject,
    emptyState,
  };
})(typeof window !== 'undefined' ? window : globalThis);
