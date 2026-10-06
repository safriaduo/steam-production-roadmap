# Steam Development & Release Pipeline — Deep Monolith Studios

*Version 1 — October 2026*

Reference document for taking a game from concept to post-launch on Steam. It covers production, marketing and Steamworks admin, because the three tracks share the same milestones.

**Source legend**
- **[doc]**: rule or fact documented by Valve/Steamworks, or published and verifiable data.
- **[survey data]**: self-reported developer data (e.g. Chris Zukowski's surveys). Useful as orders of magnitude, not as ground truth.
- **[heuristic]**: common practice or reasoned opinion, not proven.
- **[studio rule]**: internal Deep Monolith decision, non-negotiable for this pipeline.

---

## 1. Studio rules

1. **The Steam page must be live at least 6 months before launch.** [studio rule]
   Valve's minimum is much lower: 2 weeks of Coming Soon [doc]. The 6 months exist to accumulate wishlists.
2. **Every game must do a Next Fest before launch.** [studio rule]
3. **North Star Metric: demo playtime.** [studio rule] See section 5.
4. **Every phase closes with an explicit gate.** If the gate fails: iterate, pivot, or kill the project. A direct application of the "Evidence before ambition" value. [studio rule]

---

## 2. Steam constraints to know before planning

### Next Fest [doc]
- Held **3 times a year: February, June, October**.
- **One Next Fest per game**, ever. If the launch slips, you cannot do it again.
- The **base game store page must be published and public** at registration.
- A **publicly playable demo** is required by the start of the fest.
- The game **cannot release before the fest ends**. After that, no release-date constraints.
- Prologues or short-form versions of an already released game are not allowed.
- Typical workback timeline (from the start of the fest):
  - **~7 weeks before**: registration closes (e.g. June 2027: April 25). Store page, trailer and tags must be up to date by then, because Valve uses them to pick games for the official trailer.
  - **5 weeks before**: demo submitted for build review if you want it live for the Press Preview.
  - **3 weeks before**: final deadline to submit the demo for review.
  - **11 days before**: Press Preview begins.
- Reference edition: **June 2027, June 14–21**.
- Valve advises against running a Steam Playtest during the fest: it splits players between two builds.

### Demo [doc]
- The **demo-release email to wishlisters can be sent only once**, within 14 days of the demo launch. It does not repeat for Next Fest. Treat it as a one-shot asset.
- Valve's build review only checks that the game runs and has the promised features. **It is not QA** and does not look for bugs: QA is on us.

### Onboarding and release [doc]
- Tax verification via a third-party service: **10–15 business days**.
- **Steam Direct fee: $100 per game**, recouped after $1,000 in adjusted gross revenue.
- **21-day waiting period** between paying the fee and being able to release.
- **Public Coming Soon page for at least 2 weeks** before release.
- Store page review: typically **3–5 business days**; Valve recommends submitting **at least 7 days before** you want it live.
- The store page must be submitted for review before the build.
- Release is not automatic: you press the "Release App" button manually.
- **Steam does not accept blockchain applications that issue or allow the exchange of cryptocurrencies or NFTs.** Relevant for any game born in the Dawnshard ecosystem.

### Steam Playtest [doc]
- A **child appID**, separate from the main game: it does not affect the main game's reviews, wishlists, refunds or achievements.
- It has no page of its own: sign-up happens **on the base game's store page**, so traffic still lands on the wishlist button.
- **Playtest keys can be distributed even before the store page is public**.
- **Not confidential**: testers sign no NDA. Valve recommends announcing the game before running external playtests.

---

## 3. Milestones

Overview:

| # | Milestone | Type |
|---|---|---|
| 1 | Valid concept | Gate |
| 2 | Playtest announcement | Production + community |
| 3 | Validated prototype | Gate |
| 4 | Pre-production / vertical slice | Production |
| 5 | Steam page live | Marketing + admin |
| 6 | Wishlist gate #1 | Gate |
| 7 | itch.io demo / Steam Playtest | Production |
| 8 | Steam demo | Production + marketing |
| 9 | Marketing push | Marketing |
| 10 | Wishlist gate #2 (before full production) | Gate |
| 11 | Production: feature complete → content complete → polish | Production |
| 12 | Next Fest | Marketing |
| 13 | Release candidate and launch | Production + admin |
| 14 | Post-release | Support |

---

### M1 — Valid concept (gate)
**Meaning:** the concept works market-wise, at least potentially, and is reasonably clear.

**Exit criteria:** a genre that sells on Steam (verified with Gamalytic), an identified market gap, competitors catalogued. The concept can be explained in one sentence.

---

### M2 — Playtest announcement
**When:** a decent prototype exists.

**What happens:**
- Collect playtesters via a form and book sessions.
- **Open owned community channels**: Discord and newsletter. The playtest form is the first collection point. [heuristic]
- **Privacy notice (GDPR) on the form**: emails are collected and the company is Italian. [legal requirement]

---

### M3 — Validated prototype (gate)
**Meaning:** playtests have been run and the core loop works.

**Exit criteria:** defined per game, separating universal criteria from genre-dependent ones.

---

### M4 — Pre-production / vertical slice *(new)*
**Why it exists:** the Steam page needs a capsule and trailer with near-final art. So a vertical slice is needed before the page, even if it isn't called that. [heuristic]

**What happens:**
- **Art direction locked.** The capsule is the most-seen asset: the style must be decided before making it.
- **Vertical slice**: a slice of the game with art, audio and feel close to final quality.
- **Scope lock**: content plan (how many levels, cards, enemies, etc.) and time budget. The main antidote to scope creep for a small team. [heuristic]
- **Languages**: decide which languages to support. The Steam page must be localized too, so the choice belongs here. Priorities to be checked against the Steam Hardware & Software Survey. [heuristic]
- **Pricing hypothesis** and regional pricing (to be confirmed before store page review). [heuristic]
- **Legal checks**: game name clear of trademarks, licenses for assets, fonts and music. [heuristic]

---

### M5 — Steam page live
**What's needed:** trailer, capsule, tags, description, screenshots and other marketing assets.

**Admin to start early** (see section 2):
- Steamworks onboarding and tax verification completed (10–15 business days).
- Steam Direct fee paid.
- Store page in review at least 7 days before the target date.
- Content survey completed.

**Workback planning:** as soon as the page is live, pick **the specific Next Fest edition** and the target launch date. Every later deadline is computed back from there (see section 4).

**From here on, marketing is continuous**, not a single event. Start looking for third-party festivals and Steam themed fests, and build the press kit and creator list. [heuristic]

---

### M6 — Wishlist gate #1 *(new)*
**When:** a few weeks after the page goes live.

**What to measure:** total wishlists, daily velocity, visit → wishlist conversion (data in Steamworks).

**Decision:** continue, rework the page and assets (capsule, trailer, tags), or stop.

**Thresholds:** to be set per game. Reference: Zukowski's tiers for wishlists earned during Next Fest — Bronze (0–999), Silver (1,000–6,999), Gold (7,000–9,999), Diamond (10,000+). [survey data]

---

### M7 — itch.io demo / Steam Playtest
**Meaning:** the prototype with integrated art. Its purpose is to validate how the game works; it does not need to be perfectly balanced.

**Decision taken: Steam page first, then itch or Steam Playtest.** [heuristic]
- With the 6-month rule, every week without a page is lost wishlists.
- Steam Playtest does almost everything itch does, but sends traffic to the page with the wishlist button.
- itch remains useful for rough playtests **before** the announcement.

**Build requirements:**
- **A "feedback" button in the main menu** leading to Discord, a form or a forum. Suggested by Valve itself. [doc]
- **Minimum telemetry**: playtime (North Star), drop-off point, completed runs. [heuristic]

---

### M8 — Steam demo
**Meaning:** the "vertical slice on steroids" of the itch demo. Higher quality and more bug fixing, because it converts into wishlists.

**Timing:** **months before Next Fest, not during it.**
- In the February 2026 survey, demos launched months before the fest earned about **2.5×** the median wishlists of demos launched during the fest. [survey data]
- Zukowski explicitly advises against debuting the demo at Next Fest. [survey data / expert opinion]

**Checklist:**
- Use the demo email to wishlisters (once only, within 14 days). [doc]
- Our own QA: Valve's build review does not catch bugs. [doc]
- Test on low-end hardware and, if possible, Steam Deck and controller. [heuristic]

---

### M9 — Marketing push
**When:** the Steam demo is live and publicly playable.

**What happens:** reach out to content creators and press, distribute keys, apply to festivals.

**Note:** this is the peak of a marketing effort that must have started at M5. The press kit and creator list should be prepared months in advance, not at push time. [heuristic]

---

### M10 — Wishlist gate #2 *(new)*
**When:** after the Steam demo and marketing push, **before committing to full production**.

**Why:** the wishlist level you enter Next Fest with predicts the level you leave with. Next Fest multiplies, it does not generate. [survey data]
- Correlation between pre-fest wishlists and wishlists earned during the fest: r = 0.825 (February 2026).
- Median wishlists earned during the fest: ~800 per Zukowski's survey (806). GameDiscoverCo estimates ~200 across all 3,500+ demos. The gap shows how much self-reported data overestimates. [survey data]

**Decision:** full production, repositioning (page, demo, hook), or kill.

**Possible fork:** with numbers in hand, evaluate self-publishing vs a publisher or grants. [heuristic]

---

### M11 — Production *(new: sub-milestones)*
This was the biggest gap in the pipeline: the longest phase with no checkpoints. [heuristic]

| Sub-milestone | Definition |
|---|---|
| **Feature complete** | All mechanics implemented. No new features from here on. |
| **Content complete** | All content from the scope lock is in the game. |
| **Polish and bug fixing** | Balancing, QA on varied hardware, Steam Deck, controller, saves and cloud, localization tested. |

**Steamworks integrations** to do here: achievements, cloud saves, Steam Input. [heuristic]

---

### M12 — Next Fest
**Meaning:** the game is complete or nearly so, ready for launch. It's the launch springboard.

**Checklist** (exact dates on the Steamworks page for the chosen edition) [doc]:
- Register by the deadline (~7 weeks before).
- Store page, trailer and tags updated by registration (for the official trailer).
- Demo in review by 5 weeks before (Press Preview) or 3 weeks before (hard limit).
- Tags checked against the Developer Preview categories.
- No Steam Playtest running during the fest.
- Livestream on the store page: optional.

---

### M13 — Release candidate and launch
**What's needed:**
- Build in review with all features promised on the store page. [doc]
- Price, launch discount and regional pricing defined. [heuristic]
- Launch date chosen relative to Next Fest and Steam seasonal sales.

**Launch window after Next Fest:** sources disagree. Some advise not launching immediately and waiting a few weeks; others note that the best converters launch weeks, not months, after their fest. Proposed reading: **a window of weeks**, avoiding overlaps with Steam seasonal sales. [heuristic, mixed evidence]

---

### M14 — Post-release
- Bug fixing and patches.
- **Update and sales calendar** for the first year. [heuristic]
- **Data-driven postmortem**: wishlists, conversion, playtime, refunds, reviews. Feeds back into this document. [heuristic]

---

## 4. Workback planning: example

*Illustrative example with a July 2027 target launch and the June 2027 Next Fest.*

| When | What | Source |
|---|---|---|
| By January 2027 | Steam page public (≥6 months before launch) | [studio rule] |
| ~2 weeks before the page | Page in review; onboarding and tax verification already done | [doc] |
| Winter–spring 2027 | Steam demo live, marketing push, festivals | [survey data] |
| April 25, 2027 | Next Fest registration closes; page and trailer updated | [doc] |
| May 17, 2027 | Demo in review for the Press Preview | [doc] |
| May 31, 2027 | Final deadline for demo review | [doc] |
| June 3, 2027 | Press Preview begins | [doc] |
| June 14–21, 2027 | Next Fest | [doc] |
| July 2027 | Launch | [heuristic] |

---

## 5. North Star Metric: demo playtime

[studio rule]

**Definition:** for every public build (demo or release), the primary metric is **how much time players spend in the demo**.

**Why it makes sense:** it directly measures whether the core loop retains players. It is available early, from the first playtest, while sales and reviews only arrive at launch.

**Operational notes** [heuristic]:
- Look at the **median**, not the mean: a few very long sessions inflate it.
- Measure it with in-build telemetry, in addition to Steamworks data.
- Pair it with a guardrail metric, such as **demo player → wishlist conversion**. A long demo that doesn't convert may be giving away too much of the game.

---

## 6. Advice (outside the plan)

### Task prioritization with RICE
A method for ranking tasks within each milestone. Introduced by Intercom ([source](https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/)).

**Score = (Reach × Impact × Confidence) / Effort**

- **Reach**: how many players or situations the task affects in a defined period.
- **Impact**: how much it moves the metric (typical scale: 3 massive, 2 high, 1 medium, 0.5 low, 0.25 minimal).
- **Confidence**: how sure we are of the estimates (100%, 80%, 50%).
- **Effort**: time required, in person-weeks.

**Proposed application:** measure "Impact" against the North Star (demo playtime), so task priority stays tied to a single metric. [heuristic]

---

## References

**Steamworks (Valve)**
- [Steam Next Fest — general page](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest)
- [Steam Next Fest: June 2027](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/june_2027)
- [Release Process](https://partner.steamgames.com/doc/store/releasing)
- [Onboarding](https://partner.steamgames.com/doc/gettingstarted/onboarding)
- [Steam Direct Fee](https://partner.steamgames.com/doc/gettingstarted/appfee)
- [Steam Playtest](https://partner.steamgames.com/doc/features/playtest)

**Next Fest data and analysis**
- [Steam Next Fest 2026: What the Data Actually Says (Ziva)](https://ziva.sh/blogs/steam-next-fest-2026)
- [Analyzing Next Fest Results (presskit.gg)](https://presskit.gg/field-guides/analyzing-next-fest-results)
- [After Steam Next Fest (Steam Page Analyzer)](https://www.steampageanalyzer.com/blog/after-steam-next-fest)
- [Steam Next Fest Strategy in 2026 (Cinevva)](https://app.cinevva.com/guides/steam-next-fest-strategy-gamedeveloper)
- [5 pro tips for succeeding at Steam Next Fest (Unity, interview with Chris Zukowski)](https://unity.com/en/blog/steam-next-fest-developer-tips-unity)
- [How To Market A Game — Chris Zukowski](https://howtomarketagame.com)

**Prioritization**
- [RICE: Simple prioritization for product managers (Intercom)](https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/)
