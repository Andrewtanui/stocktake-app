# Claude instructions — IBKY Stock Take (counter app)

The project plan for both apps lives in **`../PLAN.md`**
(`C:\Users\user\Desktop\ibky-stocktake-code-app\PLAN.md`).

- **Start of session:** read `../PLAN.md` and continue from its "Next actions".
- **End of every session:** update `../PLAN.md` in place — header (last updated,
  current stage, progress %), checklist, progress table, next actions, known
  limitations, session log. Never create a second plan file.
- Work step by step; after each step report a checkpoint and wait for the user's
  go-ahead.
- Never git-commit; the user commits.
- XBS data is read-only: XBS/Comtras rows are create-only snapshots.
- Sibling repo: `../stock take management app` (management app, Dataverse scripts,
  schema docs). Keep `src/shared/` identical in both (`npm run check:shared`).
