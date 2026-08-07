# Settings Page — Spec (KM/BP AKM/ABP)

_Status: **BUILT** 2026-07-28 (all 7 sections). Spec kept as the design record._

## As built — resolved open questions
- **No per-step length.** The edge duration IS the next step's span: `TS(next) = TE(prev)`, `TE(next) = TS(next) + edgeDays`.
- **All durations in days.** 1 month = 30, 2 weeks = 15 → 1.5 months = 45, "2 months + 2 weeks" = 75.
- **Anchors** = Step 1 TS/TE + Step 2 TS/TE (asked at project creation; the 1 → 2 arrow carries no duration).
- **Merge rule at step 8** (two incoming arrows, KM and BP branches run in parallel):
  `TS = earliest predecessor TE`, `TE = max(predecessorTE + edgeDays)` — the slowest incoming branch governs.
- **Dashboard pills show days** ("45 days") and read the live BU template, so settings and dashboard cannot drift.
- Self-check: `index.html?selfcheck=1` asserts the cascade in the console.

## Decisions (from grill)
- Template edits are **forward-only**: apply to newly created projects; existing projects change via Project Settings.
- Duration template **auto-computes** TS/TE from a Step-1 start date at project creation; per-step target dates remain manually adjustable afterward.
- Roles: **System Admin / PPD Admin / PPD User / External User / EW Management**. Permissions are **placeholder UI only** (not enforced).
- Entry point: **header gear** opens one settings surface with two tabs — Global | Project (Project tab enabled only when a project is selected; shows project name).

## Constraints
- Static demo: all settings in-memory (seeded in `data.js`), reset on reload — same as the rest of the app.
- Reuse existing UI idioms: step-board gear popover (agency N/A), card layout, pill buttons.

---

## Global tab

### G1. Region / BU / Project management
- Tree view mirroring `DATA` (Region ▸ BU ▸ Project) with:
  - **Add Region** (name, unique).
  - **Add BU** under a region (name, unique within region).
  - **Add Project** under a BU: name + Step-1 target start date → project is created with:
    - steps TS/TE cascaded from the BU **duration template** (G4),
    - agency board seeded from the BU **agency template** (G2),
    - all steps `status:"upcoming"`, blank AS/AE.
  - Rename region/BU/project. Delete only when empty (BU with no projects; region with no BUs). No project delete (archive later if needed).
- New project appears immediately in the header cascade + quick search.

### G2. Agency template per BU — **rebuilt as a BU-column table**
- One self-contained column per BU (`.ag-bu`), scoped to a region, configured BUs first. Columns are independent: the same role is a different authority per state, so rows are NOT aligned across columns and row counts differ.
- Per row: editable **name**, editable **code**, **KM** tick, **BP** tick, delete. Groups: Internal / External departments. `+ Add agency` per group.
- **BU creation lives here** (trailing "Add Business Unit" card: region + name → new column seeded with OSC only). Removed from G1.
- `OSC` is seeded into every BU's internal list and is toggleable/removable like any other row.
- **Codes are the identity key** and must be unique within a BU — a duplicate rename is refused with an inline reason, and `setSelfCheck` asserts uniqueness across seeded templates.
- Both ticks off → Not Applicable (data preserved), not removal.
- Seeded from the user's spreadsheet: Eco Grandeur 23 rows, Eco Sun 24. Codes resolved with the user: Jabatan Perancangan Pembangunan = `JPP`, Jabatan Kesihatan = `JKN`, Jabatan Pelesenan = `JP`, Jabatan Kejuruteraan = `JK`, Jabatan Perkhidmatan Perbandaran = `JPP-khid`.
- Forward-only: stamped onto projects at creation. Existing projects unaffected.

### G3. Access permission — placeholder
- Role × capability matrix, checkboxes editable, banner: "Preview — permissions are not enforced in this demo".
- Roles (rows): System Admin, PPD Admin, PPD User, External User, EW Management.
- Capabilities (columns): View dashboards · Edit step data · Approve (HOD/CDO/AP actions) · Manage project settings · Manage global settings.
- Sensible defaults pre-ticked (System Admin = all; External User = view only; EW Management = view dashboards).

### G4. Target duration template per BU
- BU picker → 12 edge rows matching the dashboard flow (`DASH_CONN`): 1→2, 2→3, 3→4, 4→5, 5→6-KM, 5→6-BP, 6-KM→7, 7→8, 6-BP→8, 8→9, 9→10, 10→11.
- Each row: number + unit (`weeks` / `months`), blank allowed (1→2 currently blank).
- Drives: (a) TS/TE cascade at project creation — TS(next) = TE(prev) + edge duration, TE(step) = TS(step) + step's own duration (see open Q1); (b) dashboard duration pills (replaces hard-coded values in `DASH_CONN`).
- Forward-only.

---

## Project tab (requires selected project)

### P1. Target date setting
- Table: 12 rows (11 steps; step 6 split into 6-KM and 6-BP — BP dates live in `steps[5].bp`).
- Editable TS / TE per row (date inputs). AS/AE stay on the working pages (actuals, not settings).
- **Duration (days) column, two-way** (`setSpanDays` / `data-set-span`): reads TE − TS; typing a value sets TE = TS + N. Either edit flags the row manual. Disabled when the row has no TS. The BU template (G4) deliberately has no date column — durations there, dates here.
- **Global (days) column**, read-only (`setGlobalDays`): the largest incoming arrow in the project's BU duration template — largest because every parallel branch must complete. Blank for steps 1 and 2 (the anchor pair). Amber when the project's own duration differs, tooltip naming the arrow.
- **No negative durations.** Editing a target start shifts its target end by the same number of days, so the step keeps its length; pulling an end before its start, or typing a negative duration, is refused with an inline message. Fixed a real bug where moving a start past the end showed −498 days.
- **Recompute re-chains every start.** `cascadeDates` now sets `TS` from the predecessor's `TE` on every row including manual ones, so the timeline is continuous afterwards. Manual rows keep their own duration; clean rows take the template's. The checkbox is "Also reset manual durations to Global".
- **Recompute from Step-1 start**: button cascades all TS/TE from BU durations; rows the user has hand-edited are flagged (dot) and skipped unless "overwrite manual edits" is ticked.
- Project-level `targetDate` (countdown driver) also editable here.

### P2. Agency setting (internal & external)
- Mirrors G2's shape: two read-only-name columns (Step 2 board, Step 6 clearance) with **KM / BP** ticks per agency, seeded from the project's stamped BU template.
- Unticking both marks the row Not Applicable — dimmed, `N/A` badge, data preserved, excluded from completion. This writes the same `applicable` flag the step-board gear popover uses, so the two entry points stay in agreement.
- Verified: turning both off for TNB dropped the KM matrix 22 → 21 and BP 12 → 11, and rendered TNB as the only N/A chip on the Step 6 board.

### P3. Access permission setting — placeholder
- Member list: rows of {name (free text), role (dropdown of the 5 roles)}; add/remove.
- Non-enforcing; same preview banner.

---

## Data model additions (`data.js`)
```js
const SETTINGS_SEED = {
  buTemplates: {          // keyed by BU; fallback "_default"
    "_default": {
      agencies: { internal: [...], external: [...] },   // from AGENCY_SEED
      durations: [null, {n:1.5,u:"month"}, ...]          // 12 edges, DASH_CONN order
    }
  },
  roles: ["System Admin","PPD Admin","PPD User","External User","EW Management"],
  matrix: { "System Admin": ["view","edit","approve","proj","global"], ... }
};
// per project:
PROJECT_DETAILS[p].members = [{ name, role }];
```
- Runtime project creation mutates `DATA` + `PROJECT_DETAILS` in memory.
- Date math: parse/format the existing "05 Feb 25" display strings via one helper; inputs use `<input type="date">`, stored ISO, rendered short.

## Build phases
1. **Phase 1** — settings shell (gear → tabbed overlay), G1, G4, P1 (the data-driven core: create project + cascaded dates).
2. **Phase 2** — G2 + P2 (agency templates / central N/A editing).
3. **Phase 3** — G3 + P3 (permission placeholders).

## Where the code lives (`app.js`, one IIFE)
- `SET_NODE` / `SET_ORDER` / `SET_ROWS` — node map, cascade order, project-tab row labels.
- `DASH_CONN` — now the single source of truth for the flow graph (`from`/`to` per arrow); durations live in the BU template, not here.
- `cascadeDates(steps, durations, overwriteManual)` — the merge rule above; skips rows with `manual: true` unless overwriting.
- `setCreateProject` · `setRefreshNav` · `setRefreshProject` — project creation and view refresh.
- `agencyTemplateFor` / `agencyBoardSeed` — the one place Step 2 (`step.pc`) and Step 6 (`cl6DefaultState`) now get their agency list, so a BU template reaches both boards.
- `openSettings` / `renderSettings` / `onSettingsClick` / `onSettingsChange` — modal shell, full re-render on structural change, live save on field change.
- `setSelfCheck` — cascade assertion, runs on `?selfcheck=1`.

## Apply / Cancel (added later)
- Each field-editing section carries its own **Apply** and **Cancel**, hidden until that section is edited. Sections: Global 2/3/4, Project 1/2/3. Global 1 is excluded — Add Region and Create Project are one-shot actions.
- Edits buffer in `setDraft[key]`; the render path reads the draft when dirty and live state otherwise (`setAgView`, `setPermView`, `setDurView`, `setDatesView`, `setProjAgFlags`, `setMembersView`). Nothing touches the app until Apply.
- The bar is rendered hidden and revealed by `setDirty(key)` mutating `hidden` directly — no re-render, so a half-typed agency name keeps focus and caret.
- Apply refreshes the views only where it matters: `g4`, `p1`, `p2`. `g2` is forward-only and `g3` is a placeholder.
- Scroll position (`.set-body` vertical, `.ag-scroll` horizontal) is captured and restored around every re-render.
- Closing with pending edits confirms and names the dirty sections; declining keeps the modal open.

## Deliberately skipped
- **Rename / delete** of region, BU, project — only "add" was asked for; state resets on reload anyway. Add when the demo needs to undo a typo.
- **No persistence** — "Save to survive reload" was considered and dropped; Apply commits to the in-memory app only, so a refresh still resets everything.
- Permission sections are UI only, as agreed.
