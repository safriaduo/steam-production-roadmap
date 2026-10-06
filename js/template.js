/* Default pipeline template, derived from pipeline-steam-doc.md.
   Milestones (items) are fixed; every rule's values can be edited per project. */
(function (root) {
  'use strict';
  const SR = (root.SR = root.SR || {});

  const tracks = [
    { id: 'gates', name: 'Gates' },
    { id: 'production', name: 'Production' },
    { id: 'admin', name: 'Steam admin' },
    { id: 'marketing', name: 'Marketing' },
    { id: 'release', name: 'Release' },
  ];

  /* kind:  point    → one date            { date }
            phase    → a date range        { start, end }   (openEnded: start only)
            nextfest → dates come from the chosen Next Fest edition; fixed by Valve
     shape: gate (◆), dot (●), flag (launch)
     row:   items with `row` are drawn on another item's row (sub-milestones)
     parent: moving the parent bar carries the child along */
  const items = [
    {
      id: 'M1', code: 'M1', name: 'Valid concept', track: 'gates', kind: 'point', shape: 'gate',
      desc: 'The concept works market-wise, at least potentially, and can be explained in one sentence.',
      exit: 'A genre that sells on Steam (checked with Gamalytic), an identified market gap, competitors catalogued.',
    },
    {
      id: 'M3', code: 'M3', name: 'Validated prototype', track: 'gates', kind: 'point', shape: 'gate',
      desc: 'Playtests have been run and the core loop works.',
      exit: 'Defined per game, separating universal criteria from genre-dependent ones.',
    },
    {
      id: 'M6', code: 'M6', name: 'Wishlist gate #1', track: 'gates', kind: 'point', shape: 'gate',
      desc: 'Measure total wishlists, daily velocity and visit → wishlist conversion (Steamworks data).',
      exit: 'Continue, rework the page and assets (capsule, trailer, tags), or stop. Thresholds set per game.',
    },
    {
      id: 'M10', code: 'M10', name: 'Wishlist gate #2', track: 'gates', kind: 'point', shape: 'gate',
      desc: 'After the Steam demo and marketing push, before committing to full production. Next Fest multiplies wishlists, it does not generate them.',
      exit: 'Full production, repositioning (page, demo, hook), or kill. Possible fork: self-publishing vs publisher or grants.',
    },

    {
      id: 'M2', code: 'M2', name: 'Playtest announcement', track: 'production', kind: 'point', shape: 'dot',
      desc: 'A decent prototype exists. Collect playtesters via a form and book sessions. Open Discord and newsletter. GDPR privacy notice on the form.',
    },
    {
      id: 'M4', code: 'M4', name: 'Pre-production / vertical slice', track: 'production', kind: 'phase',
      ends: { start: 'Pre-production starts', end: 'Vertical slice done' },
      desc: 'Art direction locked, vertical slice at near-final quality, scope lock, languages, pricing hypothesis, legal checks (trademarks, asset licenses).',
    },
    {
      id: 'M7', code: 'M7', name: 'itch.io demo / Steam Playtest', track: 'production', kind: 'phase',
      ends: { start: 'Playtest opens', end: 'Playtest ends' },
      desc: 'The prototype with integrated art, to validate how the game works. Needs a feedback button in the main menu and minimum telemetry (playtime, drop-off, completed runs).',
    },
    {
      id: 'M11', code: 'M11', name: 'Production', track: 'production', kind: 'phase',
      ends: { start: 'Production starts', end: 'Polish done' },
      desc: 'Feature complete → content complete → polish and bug fixing. Steamworks integrations: achievements, cloud saves, Steam Input. The bar ends at "polish done".',
    },
    {
      id: 'M11a', code: 'FC', name: 'Feature complete', track: 'production', kind: 'point', shape: 'dot', row: 'M11', parent: 'M11',
      desc: 'All mechanics implemented. No new features from here on.',
    },
    {
      id: 'M11b', code: 'CC', name: 'Content complete', track: 'production', kind: 'point', shape: 'dot', row: 'M11', parent: 'M11',
      desc: 'All content from the scope lock is in the game.',
    },

    {
      id: 'S1', code: 'S1', name: 'Steam Direct fee paid', track: 'admin', kind: 'point', shape: 'dot',
      desc: '$100 per game, recouped after $1,000 in adjusted gross revenue. Starts the waiting period before release.',
    },
    {
      id: 'S2', code: 'S2', name: 'Tax & identity verification', track: 'admin', kind: 'phase',
      ends: { start: 'Tax verification starts', end: 'Tax verification done' },
      desc: 'Third-party verification during Steamworks onboarding, after the fee payment. Takes 10–15 business days.',
    },
    {
      id: 'S3', code: 'S3', name: 'Store page in review', track: 'admin', kind: 'point', shape: 'dot',
      desc: 'Store page submitted for review (typically 3–5 business days). Content survey completed. The store page is reviewed before the build.',
    },

    {
      id: 'M5', code: 'M5', name: 'Steam page live', track: 'marketing', kind: 'point', shape: 'dot',
      desc: 'Trailer, capsule, tags, description, screenshots. Pick the Next Fest edition and target launch now. Marketing is continuous from here: festivals, press kit, creator list.',
    },
    {
      id: 'M8', code: 'M8', name: 'Steam demo', track: 'marketing', kind: 'point', shape: 'dot',
      desc: 'Higher quality than the Playtest, because it converts into wishlists. Launch it months before Next Fest. Demo email to wishlisters (once only, within 14 days). Own QA: Valve review is not QA.',
    },
    {
      id: 'M9', code: 'M9', name: 'Marketing push', track: 'marketing', kind: 'phase',
      ends: { start: 'Marketing push starts', end: 'Marketing push ends' },
      desc: 'Reach out to content creators and press, distribute keys, apply to festivals.',
    },
    {
      id: 'M12', code: 'M12', name: 'Next Fest', track: 'marketing', kind: 'nextfest',
      ends: {
        start: 'Next Fest starts', end: 'Next Fest ends', registration: 'Next Fest registration closes',
        demoPress: 'Next Fest demo review (Press Preview)', demoFinal: 'Next Fest final demo review', pressPreview: 'Next Fest Press Preview',
      },
      desc: 'Dates are fixed by Valve: change the edition from the top bar. One Next Fest per game, ever. Store page, trailer and tags must be up to date at registration. No Steam Playtest during the fest.',
    },

    {
      id: 'M13', code: 'M13', name: 'Release candidate → launch', track: 'release', kind: 'phase', endShape: 'flag',
      ends: { start: 'Release candidate in review', end: 'Launch' },
      desc: 'Build in review with every feature promised on the store page. Price, launch discount and regional pricing defined. Release is manual (the "Release App" button).',
    },
    {
      id: 'M14', code: 'M14', name: 'Post-release', track: 'release', kind: 'phase', openEnded: true,
      ends: { start: 'Post-release starts' },
      desc: 'Bug fixing and patches. Update and sales calendar for the first year. Data-driven postmortem: wishlists, conversion, playtime, refunds, reviews.',
    },
  ];

  /* Rules.
     gap:        b must fall between (a + min) and (a + max). min/max may be null.
                 When a and b are the same item, the rule constrains that phase's duration.
     avoidSales: endpoint b must not fall inside a Steam seasonal sale (± buffer days).
     phrase:     how the relation reads: 'after' → "b … after a", 'before' → "a … before b".
     tag:        valve | studio | heuristic | order (sequence of the pipeline doc). */
  const rules = [
    { id: 'r01', tag: 'order', type: 'gap', a: { item: 'M1', at: 'date' }, b: { item: 'M2', at: 'date' }, min: 0, max: null, unit: 'd', phrase: 'after',
      why: 'Playtests are announced once a decent prototype of the validated concept exists.' },
    { id: 'r02', tag: 'order', type: 'gap', a: { item: 'M2', at: 'date' }, b: { item: 'M3', at: 'date' }, min: 0, max: null, unit: 'd', phrase: 'after',
      why: 'The prototype is validated by the playtests collected at M2.' },
    { id: 'r03', tag: 'order', type: 'gap', a: { item: 'M3', at: 'date' }, b: { item: 'M4', at: 'start' }, min: 0, max: null, unit: 'd', phrase: 'after',
      why: 'Pre-production starts from a validated prototype.' },
    { id: 'r04', tag: 'heuristic', type: 'gap', a: { item: 'M4', at: 'end' }, b: { item: 'S3', at: 'date' }, min: 0, max: null, unit: 'd', phrase: 'before',
      why: 'The store page needs a capsule and trailer with near-final art, which come from the vertical slice.' },
    { id: 'r05', tag: 'valve', type: 'gap', a: { item: 'S1', at: 'date' }, b: { item: 'S2', at: 'start' }, min: 0, max: null, unit: 'd', phrase: 'after',
      why: 'Steamworks onboarding order: pay the fee, then provide bank, tax and identity information.' },
    { id: 'r06', tag: 'valve', type: 'gap', a: { item: 'S2', at: 'start' }, b: { item: 'S2', at: 'end' }, min: 10, max: 15, unit: 'bd',
      why: 'Tax verification via a third-party service takes 10–15 business days.' },
    { id: 'r07', tag: 'valve', type: 'gap', a: { item: 'S2', at: 'end' }, b: { item: 'S3', at: 'date' }, min: 0, max: null, unit: 'd', phrase: 'before',
      why: 'Onboarding and tax verification must be completed before the store page review.' },
    { id: 'r08', tag: 'valve', type: 'gap', a: { item: 'S3', at: 'date' }, b: { item: 'M5', at: 'date' }, min: 7, max: null, unit: 'd', phrase: 'before',
      why: 'Store page review typically takes 3–5 business days. Valve recommends submitting at least 7 days before you want it live.' },
    { id: 'r09', tag: 'studio', type: 'gap', a: { item: 'M5', at: 'date' }, b: { item: 'M6', at: 'date' }, min: 4, max: 8, unit: 'w', phrase: 'after',
      why: 'Wishlist gate #1 comes a few weeks after the page goes live (window set by the studio).' },
    { id: 'r10', tag: 'studio', type: 'gap', a: { item: 'M5', at: 'date' }, b: { item: 'M7', at: 'start' }, min: 0, max: null, unit: 'd', phrase: 'after',
      why: 'Decision taken: Steam page first, then itch.io or Steam Playtest. Every week without a page is lost wishlists.' },
    { id: 'r11', tag: 'order', type: 'gap', a: { item: 'M7', at: 'end' }, b: { item: 'M8', at: 'date' }, min: 0, max: null, unit: 'd', phrase: 'after',
      why: 'The Steam demo is the "vertical slice on steroids" of the itch.io demo / Playtest.' },
    { id: 'r12', tag: 'order', type: 'gap', a: { item: 'M8', at: 'date' }, b: { item: 'M9', at: 'start' }, min: 0, max: null, unit: 'd', phrase: 'after',
      why: 'The marketing push starts when the Steam demo is live and publicly playable.' },
    { id: 'r13', tag: 'order', type: 'gap', a: { item: 'M9', at: 'end' }, b: { item: 'M10', at: 'date' }, min: 0, max: null, unit: 'd', phrase: 'after',
      why: 'Wishlist gate #2 measures the result of the Steam demo and the marketing push.' },
    { id: 'r14', tag: 'order', type: 'gap', a: { item: 'M10', at: 'date' }, b: { item: 'M11', at: 'start' }, min: 0, max: null, unit: 'd', phrase: 'after',
      why: 'Commit to full production only after Wishlist gate #2.' },
    { id: 'r15', tag: 'order', type: 'gap', a: { item: 'M11', at: 'start' }, b: { item: 'M11a', at: 'date' }, min: 0, max: null, unit: 'd', phrase: 'after',
      why: 'Feature complete is a production sub-milestone.' },
    { id: 'r16', tag: 'order', type: 'gap', a: { item: 'M11a', at: 'date' }, b: { item: 'M11b', at: 'date' }, min: 0, max: null, unit: 'd', phrase: 'after',
      why: 'Production order: feature complete → content complete → polish.' },
    { id: 'r17', tag: 'order', type: 'gap', a: { item: 'M11b', at: 'date' }, b: { item: 'M11', at: 'end' }, min: 0, max: null, unit: 'd', phrase: 'before',
      why: 'Polish and bug fixing come after content complete.' },
    { id: 'r18', tag: 'studio', type: 'gap', a: { item: 'M11', at: 'end' }, b: { item: 'M12', at: 'start' }, min: 0, max: null, unit: 'd', phrase: 'before',
      why: 'The game must be finished (polish done) before Next Fest, the launch springboard.' },
    { id: 'r19', tag: 'studio', type: 'gap', a: { item: 'M8', at: 'date' }, b: { item: 'M12', at: 'start' }, min: 2, max: null, unit: 'm', phrase: 'before',
      why: 'Demos launched months before the fest earned ~2.5× the median wishlists of demos launched during it (Feb 2026 survey).' },
    { id: 'r20', tag: 'valve', type: 'gap', a: { item: 'M8', at: 'date' }, b: { item: 'M12', at: 'start' }, min: 0, max: null, unit: 'd', phrase: 'before',
      why: 'A publicly playable demo is required by the start of the fest.' },
    { id: 'r21', tag: 'valve', type: 'gap', a: { item: 'M5', at: 'date' }, b: { item: 'M12', at: 'registration' }, min: 0, max: null, unit: 'd', phrase: 'before',
      why: 'The base game store page must be published and public at Next Fest registration (and page, trailer and tags up to date).' },
    { id: 'r22', tag: 'valve', type: 'gap', a: { item: 'M7', at: 'end' }, b: { item: 'M12', at: 'start' }, min: 0, max: null, unit: 'd', phrase: 'before',
      why: 'Valve advises against running a Steam Playtest during the fest: it splits players between two builds.' },
    { id: 'r23', tag: 'valve', type: 'gap', a: { item: 'M12', at: 'end' }, b: { item: 'M13', at: 'end' }, min: 0, max: null, unit: 'd', phrase: 'after',
      why: 'The game cannot release before the fest ends.' },
    { id: 'r24', tag: 'studio', type: 'gap', a: { item: 'M12', at: 'end' }, b: { item: 'M13', at: 'end' }, min: 3, max: 8, unit: 'w', phrase: 'after',
      why: 'Launch in a window of weeks after the fest (window set by the studio).' },
    { id: 'r25', tag: 'studio', type: 'gap', a: { item: 'M5', at: 'date' }, b: { item: 'M13', at: 'end' }, min: 6, max: null, unit: 'm', phrase: 'before',
      why: 'Studio rule #1: the Steam page must be live at least 6 months before launch, to accumulate wishlists.' },
    { id: 'r26', tag: 'valve', type: 'gap', a: { item: 'M5', at: 'date' }, b: { item: 'M13', at: 'end' }, min: 14, max: null, unit: 'd', phrase: 'before',
      why: 'The Coming Soon page must be public for at least 2 weeks before release.' },
    { id: 'r27', tag: 'valve', type: 'gap', a: { item: 'S1', at: 'date' }, b: { item: 'M13', at: 'end' }, min: 21, max: null, unit: 'd', phrase: 'before',
      why: 'Waiting period between paying the app fee and releasing. Valve\'s onboarding doc says 21 days; the public Steam Direct page says 30 days.' },
    { id: 'r28', tag: 'order', type: 'gap', a: { item: 'M11', at: 'end' }, b: { item: 'M13', at: 'start' }, min: 0, max: null, unit: 'd', phrase: 'after',
      why: 'The release candidate is the polished game.' },
    { id: 'r29', tag: 'valve', type: 'gap', a: { item: 'S3', at: 'date' }, b: { item: 'M13', at: 'start' }, min: 0, max: null, unit: 'd', phrase: 'after',
      why: 'The store page must be submitted for review before the build.' },
    { id: 'r30', tag: 'heuristic', type: 'avoidSales', b: { item: 'M13', at: 'end' }, buffer: 0,
      why: 'Launch in a window that avoids overlaps with Steam seasonal sales.' },
    { id: 'r31', tag: 'order', type: 'gap', a: { item: 'M13', at: 'end' }, b: { item: 'M14', at: 'start' }, min: 0, max: 0, unit: 'd', phrase: 'after',
      why: 'Post-release support starts on launch day.' },
  ];

  const tags = {
    valve: { label: 'Valve', title: 'Rule documented by Valve / Steamworks' },
    studio: { label: 'Studio', title: 'Studio rule or value set by the studio' },
    heuristic: { label: 'Heuristic', title: 'Common practice or reasoned opinion' },
    order: { label: 'Pipeline', title: 'Milestone order from the pipeline document' },
  };

  const itemById = {};
  items.forEach((it) => { itemById[it.id] = it; });

  const children = {};
  items.forEach((it) => {
    if (it.parent) (children[it.parent] = children[it.parent] || []).push(it.id);
  });

  // Display rows: one per item, grouped by track; sub-milestones share their parent's row.
  const rows = tracks.map((t) => ({
    track: t,
    items: items.filter((it) => it.track === t.id && !it.row).map((it) => it.id),
  }));

  // Items whose dates are stored in the project (everything except Next Fest).
  const datedItems = items.filter((it) => it.kind !== 'nextfest').map((it) => it.id);

  function endpointLabel(ref) {
    const it = itemById[ref.item];
    if (!it) return ref.item;
    if (it.kind === 'point') return `${it.code} ${it.name}`;
    const end = it.ends && it.ends[ref.at];
    return `${it.code} ${end || it.name}`;
  }

  SR.template = {
    tracks,
    items,
    rules,
    tags,
    itemById,
    children,
    rows,
    datedItems,
    endpointLabel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
