# IBKY Stock Take: counter app (UI demo)

The **Stock Take app** used by counters on the warehouse floor at Ibero Kenya,
built as a **Power Apps code app** (React + TypeScript + Vite, using the
`@microsoft/power-apps` SDK).

This repo is the counter app only. Admin set-up, XBS import, dashboards,
reconciliation and the approval chain belong to the separate **Stock
Management app**. The earlier mixed demo (Review, Live board, Checks, Sign-off
screens) is in commit `014e632` if any of it is needed there.

This is a **UI/UX demo**. Every screen works on a phone, and counts are kept in
memory while the tab is open, but nothing is saved to SharePoint or Dataverse.
Expected stock comes from the real XBS "Current Stock" snapshot of 2 Mar 2026.
Names, recounts, supervisor decisions and problem reports are samples.

## Screens

| Screen | What the counter does there |
|---|---|
| **Count (home)** | Sees their assignment (Ibero rows D–E), the next stack, progress, and any recounts waiting |
| Floor map | Ibero rows A–G × bays 1–14 coloured by status. "Go to a location" reads `D-05`, `D5` or the 100%-count grid code `D005` |
| Third-party site | No XBS locations: records a stack with a landmark, then counts lots picked from the XBS list. Manual outturn entry is off (`IsThirdPartyLocation`) |
| Stack | Lots expected on the stack, counted / matches / variance / counted by a teammate, split-lot flags, submit with a comment |
| Count a lot | Packing type (60 kg / 50 kg, defaulted from grade), full bags, pocket bags, pocket weight → units, kg and 60 kg equivalents. Plain-language comparison with XBS and a reason when it differs. Duplicate-count and split-lot prompts. "Save and next lot" |
| Add a lot | Outturn dropdown search across XBS; manual entry at Ibero with a closest-match suggestion for misread tags; unknown lots saved as found stock |
| Other stock | Sweepings, loose bags, disputed, direct purchase (with contract / delivery note), ex-office |
| **My counts** | Every stack counted, with In progress / Submitted / Approved / Sent back, and anything still on the phone |
| **Recounts** | Supervisor recount requests, done blind (expected figures hidden) |
| **Report a problem** | Complaints and feedback log: category, site, screen, description, photo; status and replies |

The cloud button in the top bar switches the demo between online and offline.
Offline counts are marked "On phone" and send when you switch back.

### Demo paths

- **Count D-05-1 → KCS7342**: Brian K. already counted it here → duplicate-count warning.
- **Count D-05-1 → KGT2605**, enter 118 bags, 1 pocket bag, 19 kg → "3 bags fewer than XBS" and the reason list.
- **Count D-05-1 → Add a lot that isn't listed**, type `KCS7231` → "Did you mean KCS7213?"
- **Recounts → 16EC0009** blind recount; the stack D-04-3 goes back to the supervisor.
- **Floor map**, type `e002` → row E, bay 2, with both location formats.
- **AGL → Site 2 · Stack 1 → Add a lot from the XBS list** (typing is locked).
- Tap the cloud, save a count, check **My counts**, tap the cloud again.

## Count rules

Kept in [src/data/calc.ts](src/data/calc.ts) so every screen calculates the same way:

- units = full bags + pocket bags
- weight = full bags × pack kg + pocket kg (60 kg jute, or 50 kg for light coffee; XBS weighs LIGHTS at 50 kg)
- 60 kg bag equivalents = weight ÷ 60
- each pocket must weigh less than a full bag

Pack sizes live in one settings table (`PACK_TYPES` in the repository), to be
shared with XBS.

## Run it

```bash
npm install
npm run dev              # http://localhost:3000 in a normal browser
```

For a Power Apps code app, initialize the app in the project root so the Vite
plugin can create the required `power.config.json` file:

```bash
pa app init --display-name "Stock Take" --environment-id <environment-id>
npm run dev
```

Open the **Local Play** URL printed by the Vite plugin, in the same browser
profile you use for Power Apps. Allow the Power Apps site to access your local
network if asked.

To publish: `npm run build` then `pa app push`. `npm run build:preview` makes
`preview/index.html`, a single file with everything inlined, for sharing.

## How it's put together

```
src/
  PowerProvider.tsx   signed-in user from the Power Apps host; demo user in a plain browser
  App.tsx             top bar, routes, bottom tabs
  data/
    types.ts          shapes the screens work with
    repository.ts     the only place screens get reference data from (mock today)
    store.tsx         in-memory counts, submissions, offline queue, problem reports
    calc.ts           units / weight / variance arithmetic and messages
    xbs-2026-03-02.json  both XBS stock reports, 1,750 rows
  screens/            one file per screen
  ui/kit.tsx          shared pieces: stepper, chips, bag tiers, bottom sheet
  theme.css           NKG brand tokens
  styles.css          phone-first layout
```

## Wiring real data later

Screens call `repository.ts` for reference data and `store.tsx` for counts.
To go live, swap each for generated Power Apps data services:

- XBS expected stock → the Dataverse staging table filled by the Stock Management import
- sites, `IsThirdPartyLocation`, manual-entry switch, pack types → `NKG_config`
- counts, stack submissions, recounts → the Count Sheets / Stock Takes lists
- problem reports → a complaints list read by the Stock Management app
