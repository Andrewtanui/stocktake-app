# IBKY Stock Take: code app (UI demo)

A redesigned stock-take app for Ibero Kenya, built as a **Power Apps code app**
(React + TypeScript + Vite, using the `@microsoft/power-apps` SDK).

This is a **UI/UX demo**. Every screen is clickable, and inputs and buttons
respond, but nothing is saved. Expected stock comes from the real XBS
"Current Stock" snapshot of 2 Mar 2026. Variances, counter names, progress and
the Comtras figures are scripted samples.

## Screens

| Area | What it shows |
|---|---|
| **Count** | Home with the counter's next stack and progress for every site |
| Floor map | Ibero rows A–G × bays 1–14, coloured by count status. Tap a bay to see its stacks |
| Stack | Expected outturns at one stack, with Warehouse and Blocked-for-Processing stock combined |
| Count a lot | Tag check against the expected list, a units tally drawn in tiers of ten, bags + pockets → kg vs XBS, split-lot prompt |
| Third-party site | No locations in XBS, so counters record stacks as they go; searchable list of expected lots |
| **Review** | Supervisor queue: suggested root cause (advisory), recount / accept / raise a ticket |
| **Live** | Count-day board: coverage by site with the 6,000-bag ceiling, bags per hour, counter pace |
| **Checks** | Pre-count exceptions computed from the snapshot (stuffed-not-posted, cancelled contracts, ageing >21 days, bad warrants…) |
| **Sign-off** | Stepped approval chain, three-way reconciliation by primary basket, net variance vs ±0.10% |

Scripted demo paths worth showing:
- **Count → Start counting** opens stack D-05-1.
- **Floor map → D-03 → D-03/04-1 → 14SM0009** shows a split lot (68 bags here, 1 at AGL).
- **Floor map → A-03 → A-03-2 → 12KN0015** shows a misread tag (12KP0015) and the suggested correction.

## Run it

```bash
npm install
npm run dev              # http://localhost:3000 in a normal browser
```

For a Power Apps code app, initialize the app in the project root so the Vite
plugin can create the required `power.config.json` file:

```bash
npm install
pa app init --display-name "Stock Take" --environment-id <environment-id>
npm run dev
```

Open the **Local Play** URL printed by the Vite plugin, in the same browser
profile you use for Power Apps. If the browser asks to let the Power Apps site
access your local network, allow it; without that permission, the host can't
load the app from `localhost`. If the request was previously denied, enable
local network access for the Power Apps site in browser site permissions and
reload Local Play.

To publish the app, build and push it with the Power Apps CLI:

```bash
npm run build
pa app push
```

`npm run build:preview` makes `preview/index.html`, a single file with
everything inlined, for sharing the demo outside Power Apps.

## How it's put together

```
src/
  PowerProvider.tsx   gets the signed-in user from the Power Apps host; falls back to a demo user in a plain browser
  App.tsx             shell, navigation (left rail on desktop, bottom tabs on phone)
  data/
    types.ts          the shapes every screen works with
    repository.ts     the only place screens get data from (mock today)
    xbs-2026-03-02.json  both XBS stock reports, 1,750 rows
  screens/            one file per screen
  ui/kit.tsx          shared pieces: chips, progress, the bag-tier tally, stats
  theme.css           semantic brand and layout tokens
  styles.css          shared component and responsive styles
```

## Wiring real data later

Screens only call functions in `data/repository.ts`. To go live, replace each
function body with a call to a generated service from the Power Apps CLI or a
Dataverse connector. Use the Power Apps CLI to add your data source and keep the
repository as the single integration boundary.

Suggested tables: `stk_countcycle`, `stk_countline` (one row per outturn per
stack per counter), `stk_variance`, `stk_stacklocation` (for third-party
sites), `stk_signoff`. Expected stock comes from the XBS extract and the
Comtras/BRIC extract loaded by the dataflows in Phase 1.

The app uses the system font stack defined by `--font-sans` in `src/theme.css`.
