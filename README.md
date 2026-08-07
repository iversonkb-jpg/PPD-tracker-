# EcoWorld Tracker

An authority submission tracker for property development projects — Region ▸ Business Unit ▸ Project navigation, a per-project approval timeline, and an interactive agency workflow for the Pre-Consultation stage.

Static front-end demo: plain HTML/CSS/JS, no build step, no backend. All data lives in-memory (`data.js` + runtime state) and resets on page reload.

## Features

- **Region ▸ Business Unit ▸ Project** cascading selectors, plus a quick-search box that jumps straight to a project.
- **Project header** — countdown to target date, and an 11-step approval timeline (Design Approval → AP Approval) that's clickable, collapsible, and fits full width without scrolling on desktop.
- **Step body content** fetched on demand from `content/step-01.html` … `step-11.html`, shared across projects.
- **Step status model**: Upcoming (grey) → In Progress (yellow) → Completed (green), driven by user actions (filling a field, sending, or an agency workflow completing).
- **Step 2 — Pre-Consultation agency workflow**:
  - Sticky left-hand Authority & Agency Status board (Internal/External agency chips + status legend).
  - Each agency has fully independent right-panel content (dates, uploaded docs, meeting notes, submission rounds).
  - Real file picker for all uploads, with an explicit **Send/Submit** step after attaching a file ("System submitted &lt;date & time&gt;").
  - Submission rounds (R0, R1, R2…) with PPD Accept/Reject; rejection spawns the next round automatically.
  - Question (b)'s upload only appears once its "Require" checkbox is ticked, per agency.
- **Step 2 — Upload (General)**: an 11-item document checklist (a–k) with drag & drop, a real multi-file picker, per-item Send with a saved timestamp, and "Add more items" (draft items with Confirm ✓ / Delete ✗ that continue the a, b, c… lettering).
- **Step 2 — Upload (KM Checklist) / Upload (BP Checklist)**: both tabs share the same content — three sections (Authority / Internal Agency / External Agency Documents, 18 authorities total) — and the same fully-built workflow: multi-file picker or whole-card drag & drop adds files as pending, one Send bulk-flushes them into a timestamped saved history per authority (resubmitting adds another row rather than overwriting). KM and BP track fully independent progress.
- **Step 2 — per-tab status dots** (grey/yellow/green) on all four tabs; Step 2 as a whole goes In Progress on any send, and only reaches Completed (advancing to Step 3) once all four tabs are Completed.
- **Step 3 — KM & BP Online Submission**: per-authority upload + submission-date rows for KM and BP, using the same attach → Send → "System submitted" flow as Step 2. Includes a "Raise PR" button (currently a non-functional placeholder).
- **Step 4 — Hardcopy Submission**: three grouped sections (Hardcopy Signing & Consent; Payment Requisition; Receipt & Submission) covering hardcopy signing dates, authority consent date, QR code upload, official receipt upload + date, and acknowledged copy upload — all KM/BP paired where applicable, all single-file (a fresh attach or drag & drop replaces any existing file). "Raise PRF" is a non-functional placeholder. The step completes, advancing to Step 5, once all 9 tracked fields are sent.
- **Step 5 — OSC Meeting**: OSC Edaran circulation list upload + date, OSC meeting date, and OSC meeting minutes letter upload + date — same attach → Send flow, file picker restricted to PDF only. For the two upload fields, Send stays hidden until both the file and the date are filled in. All three fields are required to complete the step and advance to Step 6.
- **Step 6 — Clearance (Ext & Int Depts)**: reuses Step 2's internal/external department board (16 departments) with a per-department clearance workflow — a letter-type dropdown (Tiada Halangan/Approval, Tiada Halang with New Condition, Ulasan/Comment, Rejection, NA/Waiver), a document upload (with drag & drop), a date, and an Authority Letter Ref No. An explicit **Send** moves a department to In Progress (yellow) and locks its fields; a **PPD Approve** then sets it Approved (green, ✓). The dropdown is recorded but does **not** drive the dot colour; Delay (red) and In Review (blue) are legend-only static states. The step completes — advancing to Step 7 — once every department is Approved.
- **Step 7 — KM Approval Endorsement**: target dates (7.1), a dual PDF+CAD submission-round workflow (7.2/7.2.1) with the same round-based PPD Accept/Reject loop as Step 2 (Reject spawns R1, R2… with full history; Accept locks the round), an acknowledged-copy upload (7.3), and an approval-letter upload with a reference number field and a simpler Accept/Reject that just resets the fields for re-upload, no round history (7.4/7.4.1). The PDF slot only accepts `.pdf`; the CAD slot only accepts `.dwg`/`.dxf` — enforced on both the file picker and drag & drop. Every field must be sent/accepted to complete the step and advance to Step 8.
- **Step 11 — AP Approval**: geran/QT land-title upload (a); PDF+CAD uploads for the AP online submission (b) and the SPA set + 4th schedule (c); and a combined "Upload PDF & CAD" for the final AP approval (d). Every slot **auto-saves its upload date on attach** (no separate Send) and enforces file types (PDF slots `.pdf`, CAD slots `.dwg`/`.dxf`). A Submission Checklist with two groups: a read-only top group (a–h) whose Approved KM/BP/Sifus dots **auto-mirror Steps 7/8/9 completion** (the other five stay blank), and an interactive lower group (CTOS Report, Akuan Berkanun, Proposed Advertisement, Price List) with click-to-toggle status dots and an "Add items" control. The 4-week/2-week reminder callouts are descriptive-only. Uploading the AP approval (d) completes the step (it's the last step, so nothing auto-advances).
- **Sent dates lock.** Any date tied to a Send/submit action (Step 2 Pre-Consultation questions a and d, Step 3 KM/BP dates, Step 4, Step 5, Step 6, Step 7) becomes disabled once sent — a system-submitted date is a fixed record, same as an uploaded-and-sent file losing its remove button.

## Project structure

```
index.html          App shell — global header, project header, body container
styles.css           All styles
data.js               Region/Business Unit/Project data, step names, per-project details, agency seed data
app.js                 All application logic
content/
  step-01.html … step-11.html   Body content fetched per timeline step
design.md              Design-system reference (layout, status colors, component patterns)
```

## Running locally

`fetch()` is used to load `content/step-*.html`, which browsers block on `file://`. Serve the folder over HTTP:

```
python -m http.server
```

then open `http://localhost:8000`. (VS Code's "Live Server" extension also works.)

## Known limitations

- **No backend / no persistence.** All state (agency statuses, uploaded file names, submitted dates, confirmed steps) lives in memory and is lost on page reload. Nothing is saved to a database or `localStorage`.
- **Uploads are simulated.** The file picker reads the real selected filename, but no file is actually stored or uploaded anywhere.
- **Only Utopia South and Irama have real seed data.** Every other Business Unit/Project in `data.js` has an empty project list or blank timeline.
- **Only Steps 1–7 and 11 have a built-out workflow.** Steps 8–10 use generic placeholder content (`content/step-08.html` … `step-10.html` are minimal stubs).
- **Step 3's "Raise PR" button and Step 4's "Raise PRF" button are non-functional placeholders** — styled but not wired to any action.
- **Region ▸ Business Unit assignments are best-guesses** for every Business Unit except the two confirmed (North ▸ Eco Sun ▸ Irama, Central ▸ Eco Grandeur ▸ Utopia South) — not verified against real organizational data.
- **No authentication or roles.** Anyone with the page can act as any role (Consultant, PPD, etc.) — there's no login or permission model.
- **No automated tests.** All verification so far has been manual/browser-based during development.
- **Cache-busting is manual.** Static assets are versioned with a `?v=N` query string in `index.html` that must be bumped by hand whenever `styles.css`, `data.js`, or `app.js` changes, or browsers may serve stale cached files.

## Suggested improvements

- Persist state to `localStorage` (or a real backend) so progress survives a page reload.
- Build out Steps 8–10 with real workflows (currently just placeholder text).
- Wire up Step 3's "Raise PR" and Step 4's "Raise PRF" buttons.
- Verify and correct the Region ▸ Business Unit ▸ Project mapping in `data.js` against actual organizational data.
- Add real authentication/roles so only the right person can act as Consultant/PPD/etc.
- Replace manual `?v=N` cache-busting with an automated build step (or at least a script to bump it consistently).
- Add automated tests (the project currently has none).

## Changelog

Dates reflect the development session; granular per-change timestamps were not tracked, so entries are grouped by the version tag used for cache-busting (`?v=N` in `index.html`).

### 2026-08-03 — Elbow connectors, Sample project, date-derived agency status

- **v87/v88** — Dashboard **branch connectors redrawn as right-angle elbows** instead of curves. Both branches out of Step 5 share a vertical stem, as do both branches into Step 8, so the split and the merge each read as one spine. Duration pills were repositioned to clear the stems.
- **v88** — The "Open Step 6 working page" button became an **outlined icon pinned top-right** of each clearance matrix, replacing the full-width green button.
- **v89** — **Eco Grandeur's authority list corrected** from a newer list supplied by the user: MPKS and LLM removed, BOMBA added (BP only), and most external agencies changed from KM+BP to KM only. `OSC` is now KM-only for every BU. The spreadsheet in `Reference/` is superseded and must not be re-synced from; **Eco Sun is still seeded from it and needs verifying**.
- **v90** — Added **"Sample"**, a mid-flight demo project under Eco Grandeur on a 2026 timeline: Steps 1, 3, 4 and 5 completed, Step 2 completed with delay, 6-KM alarming, 6-BP in progress. Only the dates and source fields live in `data.js`; every working page behind a completed step is built by `seedSample()` in `app.js` from the same default-state builders the live app uses, so a shape change cannot leave a stale hand-written state tree behind.
- **v91** — Removed **"Pending PPD Acceptance"** from the Step 2 and Step 6 status legends along with its backing status and CSS — nothing ever assigned it, so it described a state no chip could reach. Added **Alarming** in its place as a real state: an unfinished agency whose target end is a week or less away, the same rule the dashboard and step liner already used. Step 6's board is KM and BP combined, so an agency is measured against the nearest target end of the sides it actually affects.
- **v92** — The dashboard's **KM/BP clearance matrix dots** pick up the same orange. Each matrix judges its own branch, so an agency on both can read at-risk on KM while its BP side is still calm.
- **v93** — **Delayed and late-finish are now derived too**, completing the overlay on both boards and the dashboard: past target end renders red, and work finished *after* its target keeps its own colour and takes a red edge (the chip form of the dashboard node's green fill + red ring). Late finishes read `approvedAt` on Step 6 and the accepted round's decision date on Step 2; no record means no claim. The `!` suffix on delayed chips was dropped — colour carries it.

### 2026-07-30 — Settings, derived dates, Step 8, numbering

- **v72** — Dashboard arrows labelled with the duration between steps, read from the Business Unit template rather than hard-coded.
- **v73** — Built the Settings page behind the header gear: one modal, two tabs. **Global** — add Region/Project, per-BU authority template, role permission matrix (preview only), per-BU target-duration template in days. **Project** — per-step target dates, agency applicability, members. Creating a project now asks only for the Step 1 and Step 2 target dates and computes Steps 3–11 from the BU's durations (`cascadeDates`). BU templates are forward-only: they stamp a project at creation and never rewrite an existing one.
- **v74** — Project target-date table gained a two-way **Duration (days)** column: edit a date and the duration follows, type a duration and the target end moves.
- **v75** — Authority agency template rebuilt as **one column per Business Unit**, each with its own list — the same role is a different authority in each state (MBSP in Penang, MPKS in Selangor). Each agency carries **KM / BP** flags controlling which clearance board and dashboard matrix it appears on; unticking both marks it Not Applicable without losing data. Agency codes are the identity key, so a duplicate rename inside a BU is refused. Eco Grandeur (23 agencies) and Eco Sun (24) seeded from the authority spreadsheet; BU creation moved into this section.
- **v76** — Each settings section gained **Apply / Cancel**, hidden until edited. Field edits buffer in a per-section draft and reach the app only on Apply; closing with pending edits warns and names the sections. Re-rendering preserves scroll position.
- **v77** — Target dates gained a read-only **Global (days)** column showing the BU standard beside the project's own, highlighted where they differ. Durations can no longer go negative — moving a target start shifts its end by the same number of days, and pulling an end before its start is refused. Recompute now re-chains every target start onto the previous target end, including hand-edited rows, which keep their own duration. `7 → 8` corrected from 15 to 30 days, so both routes into Step 8 total 75 days.
- **v78** — **Actual dates are now derived**, never typed: Step 1 from the base plan date and Confirm stamp, Step 2 from the earliest pre-consultation date and the moment the step turns green, Steps 3–5 from their own submission dates, Step 6 from the latest approval or acknowledged copy per side (KM and BP resolve independently), Step 7 from the 8.4.1-equivalent verify stamp. Step 4's question 4.6 gained KM/BP date fields to derive from.
- **v79** — The **step liner now colours from the same date-based status as the dashboard** (on track / due within a week / overdue / completed late), rather than a plain three-state flag. Step 6's single liner node takes the worse of its KM and BP sides so a delayed branch cannot hide. The alarming orange was deepened to `#d9730d` with a darker border to separate it from the in-progress yellow.
- **v80** — Step 3 completes on question 3.1 alone (both KM and BP rows sent) and opens Step 4, matching Steps 4 and 5.
- **v81/v82** — Irama re-seeded, then reset to a clean, not-yet-started project running **1 Aug 2026 → 4 Jun 2027** with every actual blank.
- **v83** — Accepted / rejected round outcomes render as **tinted green and red pills**. This also fixed a selector (`.round-meta .accepted`) that matched nothing, so the styling had never applied.
- **v84** — The "recorded" stamp redesigned: a dot, the action in bold, the timestamp greyed back — no pill and no tick, because **a tick now means a verdict**. All 14 call sites routed through two shared builders.
- **v85** — Built **Step 8 (BP Approval Endorsement)**, sharing Step 7's workflow module rather than duplicating it; state stays per step so the two never collide. The module was renamed `km7*` → `endorse*`.
- **v86** — **Question numbering standardised to `<step>.<n>`** across every step (2.1–2.4, 3.1, 4.1–4.6, 5.1–5.3, 11.1–11.4), flat within each step and with no trailing dot. In Steps 4 and 5 the old letters were also state keys, now `q<N>` matching the label. Step 6 keeps its Roman sub-items by decision.

### 2026-07-20 — Steps 11 & 6

- **v44** — Built Step 11 (AP Approval): geran/QT land-title upload (a); dual PDF+CAD uploads for the AP online submission (b) and the SPA set + 4th schedule (c); and a combined "Upload PDF & CAD" for the final AP approval (d). All slots auto-save the upload date on attach (no separate Send) with per-slot file-type enforcement (PDF `.pdf`, CAD `.dwg`/`.dxf`). Added the Submission Checklist: a read-only top group (a–h) whose Approved KM/BP/Sifus dots auto-mirror Steps 7/8/9 completion (the other five stay blank), and an interactive lower group (CTOS Report, Akuan Berkanun, Proposed Advertisement, Price List) with click-to-toggle status dots plus an "Add items" control. Reminder callouts are descriptive-only. Uploading item (d) completes the step (last step — no auto-advance).
- **v45** — Built Step 6 (Clearance, Ext & Int Depts): reused Step 2's 16-department board with a per-department lifecycle — letter-type dropdown, document upload (+ drag & drop), date, and Authority Letter Ref No; explicit Send → In Progress (yellow, fields lock), PPD Approve → Approved (green, ✓). The dropdown is recorded but does not drive the dot colour; Delay (red) and In Review (blue) are legend-only static states, and the legend renames "Rejected" to "Delay". The step completes once every department is Approved, advancing to Step 7.

### 2026-07-15 — Step 7, Pre-Consultation cleanup

- **v39** — Added a non-functional gear icon button beside Step 2 Pre-Consultation's "Authority & Agency Status" title, styled to match the header's Settings icon (placeholder — not wired to any action).
- **v40** — Removed the unused "Authority & Agency Filter" dropdown from Step 2 Pre-Consultation's sidebar (it wasn't wired to any filtering logic).
- **v41** — Step 2's per-tab status dots doubled in size (8px → 16px).
- **v42** — Built Step 7 (KM Approval Endorsement): target dates (7.1); a dual PDF+CAD submission-round workflow (7.2/7.2.1) reusing Step 2's round-based PPD Accept/Reject loop (Reject spawns a new round with full history, Accept locks it); an acknowledged-copy upload (7.3); and an approval-letter upload with a reference number field, gated behind a simpler Accept/Reject that just resets the fields for re-upload with no round history (7.4/7.4.1). Every field required to complete the step and advance to Step 8.
- **v43** — Step 7's Upload PDF slot restricted to `.pdf` files only; Upload CAD slot restricted to `.dwg`/`.dxf` only — enforced on both the file picker (`accept` attribute) and drag & drop (extension check on drop).

### 2026-07-13 — Steps 4/5, KM/BP Checklist rebuild, sent-date locking

- **v30** — Built Upload (KM Checklist) as a real workflow: three sections (Authority / Internal Agency / External Agency Documents), 18 authority/agency cards with the attach → Send → "System submitted" flow. Step 2's tab-status computation switched from the old placeholder toggle to deriving KM's status from real send state.
- **v31** — Upload (KM Checklist) upgraded to bulk upload: multi-file picker and whole-card drag & drop, pending files listed as removable chips, one Send bulk-flushes all pending files into a timestamped saved history per authority (resubmitting adds another row instead of overwriting).
- **v32** — Upload (BP Checklist) rebuilt to match Upload (KM Checklist) exactly (same 3 sections, same 18 authorities, same bulk-upload workflow) — the checklist-tab logic in `app.js` was generalized to a single implementation shared by both tabs, driven by state field + container id, so KM and BP track fully independent progress.
- **v33** — Built Step 4 (Hardcopy Submission): three grouped sections — Hardcopy Signing & Consent (a–c), Payment Requisition (d), Receipt & Submission (e–f) — reusing Step 2/3's `pc-card`/`pc-q`/`kb-row`/upload-btn/send-btn components. All uploads are single-file (a fresh attach or drag & drop replaces any existing file, never appends).
- **v34** — Rule applied app-wide: any date tied to a Send/submit action locks (becomes disabled) once sent — covers Step 2 Pre-Consultation's preDate, Step 3's KM/BP dates, and all of Step 4's date fields.
- **v35** — Step 2 Pre-Consultation question (d) (revised-drawings review date) gained the same Send button + "System submitted" stamp + date-lock as question (a), including the same effect on agency status (Not Started → In Progress).
- **v36** — Step 4's "Raise PRF" (d) simplified to a static, non-functional placeholder (matching Step 3's "Raise PR"); dropped from the step's completion requirement, which now checks the 9 remaining tracked fields.
- **v37** — Built Step 5 (OSC Meeting): OSC Edaran circulation list upload + date, OSC meeting date, and OSC meeting minutes letter upload + date, all with the standard attach → Send flow; file picker and drag & drop restricted to PDF only. All three fields required to complete the step and advance to Step 6.
- **v38** — Step 5's Send button for the two upload fields (a, c) now requires both the file attached AND the date filled before appearing (previously the file alone was enough).

### 2026-07-12 — Step 2/3 workflows & standardization

- **v15** — Fixed a jarring UX bug: clicking Confirm auto-advanced the stepper but yanked the page back up to the timeline. `selectStep()` now accepts `{ scrollToStep: false }` for auto-advances, while manual clicks still scroll as before.
- **v16** — Rebuilt Upload (General) as a full 11-item document grid (a–k) with drag & drop, a real multi-file picker, per-item Send with a saved timestamp, and an "Add more items" control.
- **v17** — Fixed saved-file names truncating in the Upload (General) grid.
- **v18** — The Send icon in Upload (General) now only appears once a document is actually uploaded (previously showed permanently, greyed out).
- **v19–v20** — "Add more items" now creates a draft with Confirm (✓) / Delete (✗) controls; confirmed items continue the a, b, c… lettering from the last item; item (a)'s sample pre-filled files were removed so every item starts empty.
- **v21** — Added per-tab status dots (Not Started/In Progress/Completed) to all four Step 2 tabs. Step 2 goes In Progress on any send, and only reaches Completed — advancing to Step 3 — once all four tabs are Completed (KM/BP tabs use a manual "Mark as complete" toggle since they remain placeholders).
- **v22** — Built Step 3 (KM & BP Online Submission): per-authority KM/BP upload + submission-date rows, plus a "Raise PR" placeholder button.
- **v23** — Standardization pass: unified the upload icon, button label ("Upload Document"), and file-chip/send-icon/"System submitted" design across Pre-Consultation, Upload (General), and Step 3; Step 3 gained the same attach → Send two-phase flow as Pre-Consultation; Upload (KM/BP Checklist) tabs restyled to match (still placeholders).
- **v24–v25** — Reverted Upload (General)'s upload button, pending-file chip, and saved-file row back to their original pre-standardization design (paperclip icon, X remove icon, merged green saved-file bar), while keeping the "System submitted" wording lowercase.

### 2026-07-12 — repository setup

- **Repository backup** — initial commit and push to GitHub (private repo).

### 2026-07-11 — build session

- **v1** — Initial single-file `index.html`: header (brand, Region/Business Unit/Project dropdowns, section tabs, sub-tab pills) matching the reference design; made full-width/edge-to-edge.
- **v1** — Region ▸ Business Unit ▸ Project cascading dropdowns wired to `DATA`; project header (title, subtitle, countdown, 11-step timeline) added and made clickable/collapsible; fixed timeline clipping and top-gap spacing issues.
- **v2** — Refactored the single file into `index.html` (shell) + `styles.css` + `data.js` + `app.js`, with step body content fetched at runtime from `content/step-01.html` … `step-11.html`.
- **v3** — Standardized typography (serif titles / sans body); rebuilt `content/step-01.html` with a reusable field/button "form kit" (linked box, date input, Confirm/Cancel).
- **v3–v4** — Made the project header and page body full width (removed the centered max-width layout); made the timeline stepper fit all 11 steps without horizontal scroll on desktop.
- **v4** — Step status model introduced (Upcoming/In Progress/Completed); filling a field marks a step In Progress, Confirm marks it Completed and advances the stepper, Cancel reverts it.
- **v5** — Confirmed dates are now saved and restored when revisiting a step; added a "Confirmed &lt;date & time&gt;" stamp beside the date field.
- **v6** — Added folder tabs to Step 2 (Pre-Consultation / Upload General / Upload KM Checklist / Upload BP Checklist) with upload dropzones and a document checklist.
- **v7** — Added the header quick-search box (jumps straight to a project); removed the Target/Actual date grid from the step detail body (kept in the timeline only).
- **v8** — Built the full Step 2 Pre-Consultation agency workflow: sticky Authority & Agency Status sidebar, titled right-hand sections, Send icons ("System submitted &lt;date & time&gt;"), and Submission Rounds (R0/R1 with PPD Accept/Reject).
- **v9** — All agencies now default to "Not Started" (previously seeded with a mix of statuses).
- **v10** — Submitting any question for an agency now flips its status from Not Started to In Progress.
- **v11** — Each agency's right-panel content (dates, uploaded docs, meeting notes, submission rounds) made fully independent — switching the active agency no longer shares state with any other agency.
- **v12** — All uploads in the Pre-Consultation tab now use a real OS file picker (actual selected filename shown); every upload requires an explicit Send/Submit click before counting as submitted; Submission Round uploads split into attach → submit.
- **v13** — Question (b)'s upload option now only appears when its "Require" checkbox is ticked (per agency); removed the "Uploaded at &lt;date & time&gt;" remark from all upload options (kept only the "System submitted" stamp).
- **v14** — Fixed a CSS specificity bug where the "Require" checkbox's `hidden` gating had no visual effect (`.pc-inline[hidden]` was being overridden by `.pc-inline { display: flex }`).
