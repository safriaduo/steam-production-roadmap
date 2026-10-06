/* Date helpers. All dates are integer "day numbers" (days since 1970-01-01, UTC),
   so comparisons and arithmetic are plain integer math. */
(function (root) {
  'use strict';
  const SR = (root.SR = root.SR || {});

  const MS_PER_DAY = 86400000;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const UNITS = {
    d: { one: 'day', many: 'days' },
    bd: { one: 'business day', many: 'business days' },
    w: { one: 'week', many: 'weeks' },
    m: { one: 'month', many: 'months' },
  };

  function fromYmd(y, m, d) {
    return Math.round(Date.UTC(y, m, d) / MS_PER_DAY);
  }

  function ymd(day) {
    const dt = new Date(day * MS_PER_DAY);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() };
  }

  function parse(iso) {
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return fromYmd(y, m - 1, d);
  }

  function toIso(day) {
    return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
  }

  function today() {
    const now = new Date();
    return fromYmd(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function daysInMonth(y, m) {
    return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  }

  // 1970-01-01 was a Thursday.
  function weekday(day) {
    return (((day + 4) % 7) + 7) % 7; // 0 = Sunday … 6 = Saturday
  }

  function isWeekend(day) {
    const w = weekday(day);
    return w === 0 || w === 6;
  }

  function addMonths(day, n) {
    const { y, m, d } = ymd(day);
    const t = m + n;
    const ny = y + Math.floor(t / 12);
    const nm = ((t % 12) + 12) % 12;
    return fromYmd(ny, nm, Math.min(d, daysInMonth(ny, nm)));
  }

  function addBusinessDays(day, n) {
    const step = n >= 0 ? 1 : -1;
    let left = Math.abs(n);
    let d = day;
    while (left > 0) {
      d += step;
      if (!isWeekend(d)) left--;
    }
    return d;
  }

  /* day + n units. Monotonic non-decreasing in `day` for every unit,
     which is what the inverse helpers below rely on. */
  function offset(day, n, unit) {
    switch (unit) {
      case 'w': return day + 7 * n;
      case 'm': return addMonths(day, n);
      case 'bd': return addBusinessDays(day, n);
      default: return day + n;
    }
  }

  // Largest a such that offset(a, n, unit) <= b.
  function latestBefore(b, n, unit) {
    let a = offset(b, -n, unit);
    while (offset(a, n, unit) > b) a--;
    while (offset(a + 1, n, unit) <= b) a++;
    return a;
  }

  // Smallest a such that offset(a, n, unit) >= b.
  function earliestAfter(b, n, unit) {
    let a = offset(b, -n, unit);
    while (offset(a, n, unit) < b) a++;
    while (offset(a - 1, n, unit) >= b) a--;
    return a;
  }

  function startOfMonth(day) {
    const { y, m } = ymd(day);
    return fromYmd(y, m, 1);
  }

  function format(day, opts) {
    if (day == null) return '—';
    const { y, m, d } = ymd(day);
    if (opts && opts.short) return `${d} ${MONTHS[m]}`;
    return `${d} ${MONTHS[m]} ${y}`;
  }

  function formatRange(a, b) {
    if (a == null || b == null) return '—';
    const A = ymd(a);
    const B = ymd(b);
    if (A.y === B.y) return `${A.d} ${MONTHS[A.m]} → ${B.d} ${MONTHS[B.m]} ${B.y}`;
    return `${format(a)} → ${format(b)}`;
  }

  function unitLabel(n, unit) {
    const u = UNITS[unit] || UNITS.d;
    return n === 1 ? u.one : u.many;
  }

  function formatAmount(n, unit) {
    return `${n} ${unitLabel(n, unit)}`;
  }

  // Human-friendly distance between two days ("3 weeks", "5 months").
  function formatSpan(days) {
    const abs = Math.abs(days);
    if (abs < 14) return `${days} ${abs === 1 ? 'day' : 'days'}`;
    if (abs < 63) return `${Math.round(days / 7)} weeks`;
    return `${Math.round(days / 30.44)} months`;
  }

  SR.dates = {
    MONTHS,
    UNITS,
    fromYmd,
    ymd,
    parse,
    toIso,
    today,
    daysInMonth,
    weekday,
    isWeekend,
    addMonths,
    addBusinessDays,
    offset,
    latestBefore,
    earliestAfter,
    startOfMonth,
    format,
    formatRange,
    unitLabel,
    formatAmount,
    formatSpan,
  };
})(typeof window !== 'undefined' ? window : globalThis);
