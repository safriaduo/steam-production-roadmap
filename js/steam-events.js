/* Default Steam events calendar.
   Every date below was copied from Valve's Steamworks documentation on 2026-10-06
   (https://partner.steamgames.com/doc/marketing/upcoming_events) and links to its source page.
   Editions Valve has not announced yet are not included: add them from the "Steam events"
   panel once they are published. */
(function (root) {
  'use strict';
  const SR = (root.SR = root.SR || {});

  const UPCOMING = 'https://partner.steamgames.com/doc/marketing/upcoming_events';

  SR.defaultEvents = [
    // Steam Next Fest: fest window plus the Valve deadlines that the rules use.
    {
      id: 'nf-2026-10',
      type: 'nextfest',
      name: 'Next Fest · October 2026',
      start: '2026-10-19',
      end: '2026-10-26',
      registration: '2026-08-31',
      demoPress: '2026-09-14',
      demoFinal: '2026-09-28',
      pressPreview: '2026-10-08',
      source: 'https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/2026october',
    },
    {
      id: 'nf-2027-02',
      type: 'nextfest',
      name: 'Next Fest · February 2027',
      start: '2027-02-22',
      end: '2027-03-01',
      registration: '2027-01-10',
      demoPress: '2027-01-25',
      demoFinal: '2027-02-08',
      pressPreview: '2027-02-11',
      source: 'https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027',
    },
    {
      id: 'nf-2027-06',
      type: 'nextfest',
      name: 'Next Fest · June 2027',
      start: '2027-06-14',
      end: '2027-06-21',
      registration: '2027-04-25',
      demoPress: '2027-05-17',
      demoFinal: '2027-05-31',
      pressPreview: '2027-06-03',
      source: 'https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/june_2027',
    },

    // Seasonal sales: launch must avoid these.
    { id: 'sale-2026-autumn', type: 'sale', name: 'Autumn Sale 2026', start: '2026-10-01', end: '2026-10-08', source: 'https://partner.steamgames.com/doc/marketing/upcoming_events/2026_autumn_sale' },
    { id: 'sale-2026-winter', type: 'sale', name: 'Winter Sale 2026', start: '2026-12-17', end: '2027-01-04', source: UPCOMING },
    { id: 'sale-2027-spring', type: 'sale', name: 'Spring Sale 2027', start: '2027-03-18', end: '2027-03-25', source: UPCOMING },
    { id: 'sale-2027-summer', type: 'sale', name: 'Summer Sale 2027', start: '2027-06-24', end: '2027-07-08', source: UPCOMING },

    // Themed fests: context only, never used by the rules. Hidden by default.
    { id: 'fest-2026-cooking', type: 'fest', name: 'Cooking Fest', start: '2026-10-12', end: '2026-10-19', source: 'https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/cooking_2026' },
    { id: 'fest-2026-scream', type: 'fest', name: 'Steam Scream V', start: '2026-10-26', end: '2026-11-02', source: 'https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/steam_halloween_2026' },
    { id: 'fest-2026-autobattler', type: 'fest', name: 'Auto-Battler RPG Fest', start: '2026-11-16', end: '2026-11-23', source: 'https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/auto_battler_rpg_2026' },
    { id: 'fest-2027-desktop', type: 'fest', name: 'Desktop Companion Fest', start: '2027-01-14', end: '2027-01-18', source: 'https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/desktop_companion_2027' },
    { id: 'fest-2027-shopkeep', type: 'fest', name: 'Shop Keeper Fest', start: '2027-01-25', end: '2027-02-01', source: 'https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/shop_keep_2027' },
    { id: 'fest-2027-sheep', type: 'fest', name: 'Sheep Fest', start: '2027-02-04', end: '2027-02-08', source: 'https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/sheep_2027' },
    { id: 'fest-2027-couchcoop', type: 'fest', name: 'Couch Co-Op Fest', start: '2027-02-08', end: '2027-02-15', source: 'https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/couch_coop_2027' },
    { id: 'fest-2027-rhythm', type: 'fest', name: 'Rhythm Fest', start: '2027-03-08', end: '2027-03-15', source: 'https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/rhythm_2027' },
    { id: 'fest-2027-dinos', type: 'fest', name: 'Dinos vs. Robots Fest', start: '2027-03-29', end: '2027-04-05', source: 'https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/dinos_robots_2027' },
    { id: 'fest-2027-racing', type: 'fest', name: 'Racing Fest', start: '2027-04-12', end: '2027-04-19', source: 'https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/racing_2027' },
    { id: 'fest-2027-witch', type: 'fest', name: 'Witch Fest', start: '2027-04-22', end: '2027-04-26', source: 'https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/witch_2027' },
    { id: 'fest-2027-fighting', type: 'fest', name: 'Fighting Fest', start: '2027-04-26', end: '2027-05-03', source: 'https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/fighting_2027' },
    { id: 'fest-2027-rts', type: 'fest', name: 'Real-Time Strategy Fest', start: '2027-05-10', end: '2027-05-17', source: 'https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/rts_2027' },
    { id: 'fest-2027-mountain', type: 'fest', name: 'Mountaineering Fest', start: '2027-05-31', end: '2027-06-03', source: 'https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/mountaineering_2027' },
  ];

  // Fields of a Next Fest edition, in timeline order, with display labels.
  SR.nextFestFields = [
    { key: 'registration', label: 'Registration closes' },
    { key: 'demoPress', label: 'Demo in review (for Press Preview)' },
    { key: 'demoFinal', label: 'Final demo review deadline' },
    { key: 'pressPreview', label: 'Press Preview starts' },
    { key: 'start', label: 'Fest starts' },
    { key: 'end', label: 'Fest ends' },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
