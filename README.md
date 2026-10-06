# Steam Production Roadmap

A one-screen roadmap for producing and releasing a game on Steam. Every milestone from concept to post-launch sits on a single timeline. Valve's rules and your studio's rules are enforced as you drag things around.

It is a static website with no build step, server or account. It runs on GitHub Pages, or straight from `index.html`.

The pipeline, milestones and rules come from [`pipeline-steam-doc.md`](pipeline-steam-doc.md).

## What it does

- **One-screen timeline.** Milestones are grouped into Gates, Production, Steam admin, Marketing and Release. Steam events (Next Fest editions, seasonal sales) and today's date are shown across the top.
- **Several projects.** Switch between them from the top bar. **All projects** stacks every game's key dates (page live, demo, production, Next Fest, launch) on one shared timeline, so overlaps are easy to spot.
- **Rules are always enforced** (unless you turn enforcement off):
  - Drag a milestone and the milestones that depend on it are pushed along, by the smallest amount that keeps every rule true.
  - Next Fest dates are fixed by Valve, and locked milestones never move. If the chain can't fit around them, the drag stops at the last valid date and tells you which rule stopped it.
  - Bars keep their length when pushed. Drag a bar's edges to resize it.
- **Enforcement toggle.** With enforcement off, moves are free and broken rules are highlighted in red. Turning it back on repairs the plan, or tells you why it can't.
- **Editable rules per project.** Turn rules on or off, and change their minimum and maximum gaps and units (days, business days, weeks, months).
- **Steam events calendar**, shared by all projects. Next Fest editions, with registration and demo deadlines, and seasonal sales. Dates come from Valve's Steamworks docs, each with a source link. Add editions as Valve announces them.
- **Lock** a milestone that already happened or can't change. The rules will never move it.
- **Undo and redo** (Ctrl+Z / Ctrl+Y), plus JSON export and import for backups and sharing.

## Using it

| Action | How |
|---|---|
| New project | **+ New project** → name, start date (M1), Next Fest edition, target launch. The other milestones are spread evenly, then adjusted to satisfy every rule. |
| Move a milestone or bar | Drag it. The tooltip shows the new date, how many milestones it pushes, and what stopped it. |
| Resize a phase | Drag the bar's left or right edge. For M13, drag the launch flag. |
| Exact dates, lock, notes | Click a milestone or its name. |
| Zoom | **− / Fit / +** in the top-left corner of the timeline, or Ctrl + mouse wheel (trackpad pinch) to zoom around the cursor. **Fit** shows the whole project in the window. |
| Pan to earlier / later dates | When zoomed in or in a narrow window, drag empty timeline space, use the mouse wheel, or the scrollbar. Dragging a milestone to the window edge scrolls the view along with it. |
| Keyboard | Focus a milestone (Tab), then ← / → moves it by 1 day, Shift for 7 days, Alt to resize the end, Enter for details. |
| Change Next Fest edition | **Next Fest** selector in the top bar. The plan is re-fitted around the new dates. |
| Edit rules | **Rules** button, or the red "rules broken" counter in the status bar. |
| Add Steam dates | **Steam events**. Entries without a Valve source link are marked *unconfirmed*. |
| Backup / share | **⋯ → Export JSON** / **Import JSON**. Importing adds projects, and projects with the same id are replaced. |

### Where your data lives

Projects are saved in **your browser's local storage**, separately on each browser and computer. Nothing is sent anywhere. Use **Export JSON** to back up or move your plans, and **Import JSON** to load them elsewhere. Clearing site data in the browser deletes them.

## Default rules

All values can be changed per project in the **Rules** panel.

| # | Rule | Source |
|---|---|---|
| r01 | M2 Playtest announcement on or after M1 Valid concept | Pipeline |
| r02 | M3 Validated prototype on or after M2 Playtest announcement | Pipeline |
| r03 | M4 Pre-production starts on or after M3 Validated prototype | Pipeline |
| r04 | M4 Vertical slice done on or before S3 Store page in review | Heuristic |
| r05 | S2 Tax verification starts on or after S1 Steam Direct fee paid | Valve |
| r06 | S2 Tax & identity verification lasts 10–15 business days | Valve |
| r07 | S2 Tax verification done on or before S3 Store page in review | Valve |
| r08 | S3 Store page in review at least 7 days before M5 Steam page live | Valve |
| r09 | M6 Wishlist gate #1 4–8 weeks after M5 Steam page live | Studio |
| r10 | M7 Playtest opens on or after M5 Steam page live | Studio |
| r11 | M8 Steam demo on or after M7 Playtest ends | Pipeline |
| r12 | M9 Marketing push starts on or after M8 Steam demo | Pipeline |
| r13 | M10 Wishlist gate #2 on or after M9 Marketing push ends | Pipeline |
| r14 | M11 Production starts on or after M10 Wishlist gate #2 | Pipeline |
| r15 | FC Feature complete on or after M11 Production starts | Pipeline |
| r16 | CC Content complete on or after FC Feature complete | Pipeline |
| r17 | CC Content complete on or before M11 Polish done | Pipeline |
| r18 | M11 Polish done on or before M12 Next Fest starts | Studio |
| r19 | M8 Steam demo at least 2 months before M12 Next Fest starts | Studio |
| r20 | M8 Steam demo on or before M12 Next Fest starts | Valve |
| r21 | M5 Steam page live on or before M12 Next Fest registration closes | Valve |
| r22 | M7 Playtest ends on or before M12 Next Fest starts | Valve |
| r23 | M13 Launch on or after M12 Next Fest ends | Valve |
| r24 | M13 Launch 3–8 weeks after M12 Next Fest ends | Studio |
| r25 | M5 Steam page live at least 6 months before M13 Launch | Studio |
| r26 | M5 Steam page live at least 14 days before M13 Launch | Valve |
| r27 | S1 Steam Direct fee paid at least 21 days before M13 Launch | Valve |
| r28 | M13 Release candidate in review on or after M11 Polish done | Pipeline |
| r29 | M13 Release candidate in review on or after S3 Store page in review | Valve |
| r30 | M13 Launch outside Steam seasonal sales | Heuristic |
| r31 | M14 Post-release starts on the same day as M13 Launch | Pipeline |

**Source labels.** *Valve* rules are documented by Valve / Steamworks. *Studio* rules are studio decisions. *Heuristic* rules are common practice. *Pipeline* rules follow the milestone order in the pipeline document.

**One Next Fest per game** is built in: each project has exactly one edition.

> **Note on r27:** Valve's two pages disagree on this waiting period. The [onboarding doc](https://partner.steamgames.com/doc/gettingstarted/onboarding) says 21 days between paying the app fee and releasing, but the public [Steam Direct page](https://partner.steamgames.com/steamdirect) says 30 days. The default follows the pipeline document (21). Change it in the Rules panel if you want the safer value.

## Run locally

Double-click `index.html`, or serve the folder:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Tests

The rule engine has unit tests (Node 18+, no dependencies):

```bash
node --test
```

## Publish on GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, then branch `main` and folder `/ (root)`.
3. After a minute the site is live at `https://<your-username>.github.io/<repository-name>/`.

Each visitor's projects stay in their own browser. To show your roadmap to others, export it as JSON and share the file.

## Project structure

```
index.html            page shell
css/styles.css        styles (light and dark)
js/dates.js           day-number date helpers (months, business days)
js/steam-events.js    default Steam events with Valve source links
js/template.js        milestones, tracks and default rules
js/engine.js          rule checking, chain pushing, auto-fill
js/store.js           localStorage, JSON export/import
js/timeline.js        timeline and overview rendering
js/app.js             UI state and interactions
tests/                engine tests (node --test)
```

To change the default pipeline, edit `js/template.js`: items are the milestones and rules are the constraints. To ship new Steam dates to everyone, edit `js/steam-events.js`.
