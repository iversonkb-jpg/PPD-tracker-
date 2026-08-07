# EcoWorld Tracker — Handoff

_Last updated: 2026-07-27_

Static front-end demo (plain HTML/CSS/JS, no build, no backend). All state is in-memory (`data.js` + runtime) and resets on reload. Continue from here in a new conversation.

## Run it
- Dev server is `python -m http.server 5502` via `.claude/launch.json` (name `tracker`, `autoPort: false`, pinned to **5502** — 5501 was taken by another chat's server). Start with `preview_start {name:"tracker"}`.
- Open `http://localhost:5502`. `content/*.html` partials are `fetch()`ed, so it must be served over HTTP (not `file://`).
- **Cache-busting is manual.** `index.html` versions assets with `?v=N` (currently **v=93**). Bump ALL THREE (`styles.css`, `data.js`, `app.js`) whenever you edit them, or the browser serves stale copies. When verifying in the in-app browser, load `http://localhost:5502/index.html?cb=<n>` (a fresh doc-URL) — plain reload/navigate serves cached `index.html`.

## Files
```
index.html     shell: header, project header + step liner, #projectDashboard, #stepDetail (#stepBody)
styles.css     all styles
data.js        DATA (Region▸BU▸Project), STEP_NAMES (11), AGENCY_SEED, GENERAL_DOCS_SEED,
               KM_CHECKLIST_SEED, PROJECT_DETAILS[project].steps[] (ts/as/te/ae; step 6 also has a `bp:{}` date set)
app.js         all logic (one IIFE)
content/step-01.html … step-11.html   per-step body partials (fetched, cached in partialCache)
content/step-dashboard.html            NEW: project dashboard shell (hooks filled by app.js)
Reference/     this handoff + authority-grouping xlsx
design.md, README.md
```

## One status colour across all three surfaces
The **step liner, the step-detail badge and the dashboard** all colour from the same date-based state (`dashNodeState`). `stepStateClass(steps, i)` maps it to the liner's CSS class, so the liner no longer reads `step.status` directly — `setStepStatus` repaints via `renderTimeline` instead of swapping classes.

| State | Fill | Border | Meaning |
|---|---|---|---|
| `completed` | `--status-green` `#1a7a3c` | same | done within target |
| `completed late` | `#1a7a3c` | red ring `#c62828` | done, past target |
| `delayed` | `--status-red` `#c62828` | same | past target, not done |
| `alarming` | `--status-orange` **`#d9730d`** | `--status-orange-dark` **`#8a4f06`** solid | ≤1 week to target |
| `in-progress` | `--status-yellow` `#e0a416` | same | started |
| `upcoming` | white | `--line` | not started |

- The alarming orange was **deepened from `#e8890c` to `#d9730d`** with a darker solid border, so it separates from the in-progress yellow at video scale. Changed in three places that must stay in step: `DASH_SVG_STYLE.alarming` (app.js), `.dash-nd.nd-o` and `.dd-o` (styles.css). Small legend/department dots take the fill only — a border is unreadable at 10px.
- Step labels and the connector line follow the node colour.
- **Step 6 takes the worse of 6-KM and 6-BP** on the liner (`STEP_STATE_RANK`), since one node can't show two truths. Ranked worst-first: delayed › alarming › in-progress › **upcoming** › completed-late › completed — "upcoming" deliberately outranks the completed states, or a half-finished step 6 would show green. Verified: KM grey + BP overdue ⇒ liner step 6 red.

## Question numbering — standardised `<step>.<n>`
Every step numbers its questions `<step>.<n>`, flat across the whole step (not restarting per card), with **no trailing dot**. The old a/b/c/d lettering is gone from steps 2, 3, 4, 5 and 11.

**The numbering also drives the state keys.** In steps 4, 5 and 11 the letters were internal keys, not just labels; they are now `q<N>` matching the visible `<step>.<N>`:
- Step 4 `hc`: `q1 q2 q3 q5 q6` — **no `q4`**: 4.4 "Raise PRF" is a static placeholder with no state, and the gap is deliberate so `qN` always equals 4.N. Paths stay dotted for the KM/BP side (`q6.km`), because `hcNodeByPath` splits on `.` — never put a dot inside a key name.
- Step 5 `osc`: `q1 q2 q3`.
- Steps 2 and 3 needed no key changes — their state already used named fields (`preDate`, `kb.km`).
- Step 6 keeps its Roman numerals (i, ii, iv — iii was removed deliberately) by decision; only its trailing dots were dropped.

Verified after the rename: step 4 and step 5 still save and send, and `deriveActuals` still resolves through the new keys (step 4 AE from `hc.q6`, step 5 AE from `osc.q3`).

## Steps 7 and 8 share ONE endorsement module
`content/step-07.html` (KM) and `content/step-08.html` (BP) are the same workflow — target dates, review rounds, acknowledged copy, approval letter, x.4.1 verify — and both drive the **same** code in app.js. Only the wording differs: KM ↔ BP, 7.x ↔ 8.x.
- The module was renamed `km7*` → `endorse*` (was misleading once step 8 shared it): `#endorseRoot`, `#endorseRounds`, `data-endorse-*`, state `activeSteps[i].endorse`, `initEndorseApproval` / `renderEndorseApproval`.
- **State is per step**, so `steps[6].endorse` and `steps[7].endorse` are separate objects and never collide — verified by setting a date on each and confirming the other was untouched.
- `injectStepBody` dispatches on `#endorseRoot` and passes the step index, so both partials are served with no branching.
- Edit the behaviour once and both steps change. If BP ever needs to diverge, branch on the step index inside the module rather than forking the file.

## Agency status is a DATE overlay, not a stored value
Step 2's and Step 6's boards colour each agency the same way the dashboard colours nodes. `agDateState(index, agency, status, kind)` in app.js returns `"" | "delayed" | "alarming" | "late"` and **every surface reads it** — chips, the right-hand status pill, and the dashboard's dept dots (`dashDeptDotClass`).

| Situation | Chip / pill | Dept dot |
|---|---|---|
| Past target end, unfinished | `st-delayed` | `dd-r` |
| ≤1 week to target, unfinished | `st-alarming` | `dd-o` |
| Finished after target | own class + `ag-late` (red border) | `dd-g ring-r` |

- **`kind` matters.** Pass `"km"`/`"bp"` on a surface showing ONE branch (the dashboard matrices) — it judges that branch alone. Omit it on Step 6's combined chip board, where an agency takes the nearest target end of the sides it affects (`agAffectsKind`). BOMBA is BP-only and must never read its deadline off the KM branch.
- **Late needs a completion date**, and the two boards keep it in different places: `agDoneAt` takes Step 6's `approvedAt`, or for Step 2 the `decidedAt` of the accepted round. No record ⇒ no late claim.
- `.ag-late` must stay **below** the `.st-*` rules in styles.css to win the border, and uses `border-color` not `box-shadow` so it can't fight `.agency-chip.selected`'s blue ring.
- ⚠️ **"Pending PPD Acceptance" was removed** (status, CSS and both legends) — nothing ever assigned it. Don't add a legend entry without a code path that can reach it.
- Consequence: **Utopia South's Step 2 board renders entirely red** — its target end is Aug 2024 and nothing is started. Correct, but startling in a demo.

## Record vs verdict — two deliberately different treatments
- A **record** (`.saved-stamp`) is a system fact: a green **dot**, the action in bold, the timestamp greyed back. No pill, no tick. Built by `stampHtml(label, when, extraCls)` or `stampInner(label, when)` — the latter for partials that ship an empty `<span class="saved-stamp" data-saved-stamp>` to fill. **17 call sites route through these two helpers**; the markup used to be concatenated by hand at each one.
- A **verdict** (`.round-meta.accepted` / `.rejected`) is a tinted pill, green or red.
- ⚠️ **The tick is reserved for verdicts.** `STAMP_DOT_SVG` is for stamps; `CHECK_SVG` stays on the Confirm buttons (`gen-confirm-btn`). Don't put a tick back on a stamp — that's what made a timestamp look like an approval.
- Still open: "Approved" and "Verified" are genuine verdicts but currently render as records. Moving them onto the pill would finish the split.

## Round outcome pills (`.round-meta.accepted` / `.round-meta.rejected`)
Accepted / rejected outcomes render as tinted pills — green `--brand-green-light` on `--brand-green-dark`, red `#fdecec` on `--status-red-dark`, both with a 1px border and a 20px radius. They are `display:block; width:fit-content`, so consecutive outcomes (several CDO revision lines) stack and each hugs its own text.

⚠️ **These must be compound selectors.** Both classes sit on one element (`class="round-meta accepted"`). The original CSS used the descendant form `.round-meta .accepted`, which matched nothing — the green/bold styling never applied at all until this was fixed. Eight render sites share these classes: Step 2 and Step 7 submission rounds, the Step 6 CDO decision lines, and the Step 6 PPD approval gate.

## Step auto-completion
Steps 3, 4 and 5 share one shape — `recomputeStep3` / `recomputeStep4` / `recomputeStep5`, each called at the end of that step's render. When every tracked field is sent the step goes green and `selectStep(index + 1)` opens the next one; partial activity marks it in-progress. The `status !== "completed"` guard means re-opening a finished step doesn't re-navigate.
- **Step 3** completes on question (a) alone — both the KM and BP rows sent. "Raise PR" is a static placeholder with no state, so it is excluded. `recomputeStep3` owns step 3's status; the send handler no longer sets it.

## Derived actual dates (AS / AE) — `deriveActuals()` in app.js
Actuals are **never seeded or typed in**; they fall out of the working pages. `deriveActuals()` runs at the top of `renderTimeline` and `dashSvg`, and a delegated `input`/`change`/`click` listener on `stepBody` repaints the timeline so edits show immediately. Each step starts when the previous ended; an unanswered source question yields `—`, never a guess.

| Step | Actual start | Actual end |
|---|---|---|
| 1 | `steps[0].basePlanDate` (1.1, from Product Planning) | `confirmedAt` (Confirm stamp) |
| 2 | earliest question (a) `preDate` across **applicable** agencies | `greenAt` — stamped by `setStepStatus` when a step first goes completed |
| 3 | step 2 AE | later of (a) `kb.km.date` / `kb.bp.date` |
| 4 | step 3 AE | later of (f) `hc.f.km.date` / `hc.f.bp.date` |
| 5 | step 4 AE | (c) `osc.c.date` |
| 6-KM | step 5 AE | latest `approvedAt` or attempt `ackDate` over **KM-affecting** applicable agencies |
| 6-BP | step 5 AE | same over **BP-affecting** agencies (resolves independently) |
| 7 | **6-KM** AE | `km7.letter.verifiedAt`, only once `verified === "accepted"` |

- Steps 8–11 are not derived yet.
- **Step 4's question (f) gained KM/BP date fields** (`data-hc-date="f.km"`/`"f.bp"`) — it previously had uploads only, so there was no date to derive from. Its shape now matches question (e).
- **1.1's base plan date is per-project data** (`steps[0].basePlanDate`), rendered into `[data-base-plan]`; it used to be hardcoded in `step-01.html`.
- `toDate` is deliberately tolerant: `<input type="date">` values, ISO timestamps, and the `"05 Feb 26"` display format all parse.
- `renderProjectHeader` assigns `activeSteps` **before** `renderTimeline`, or the derivation reads the previously selected project. `renderTimeline` also re-applies the `selected` class so any repaint keeps the highlight.

## Architecture notes
- Selecting a project → `renderProjectHeader` → `showDashboard()` (dashboard is the DEFAULT view). Clicking a step opens `#stepDetail` and fetches its partial via `loadStepBody`.
- Per-step state lives on `activeSteps[i]` (which points into `PROJECT_DETAILS[project].steps`), so it survives navigation within a session. Each step's init runs when its partial loads (see `injectStepBody`): Step 2 `#pcRoot`/`#genDocs`/`#kmChecklist`/`#bpChecklist`, Step 4 `#hcRoot`, Step 5 `#oscRoot`, Step 6 `#cl6Root` → `initClearance`, Step 7 `#km7Root`, Step 11 `#ap11Root`.
- Projects with seed data: **Utopia South** (2024, nothing started), **Irama** (clean, starts 01 Aug 2026) and **Sample**.
- **Sample is the mid-flight demo project** (Eco Grandeur, 2026 timeline): 1/3/4/5 completed, 2 completed-with-delay, 6-KM alarming, 6-BP in progress. `data.js` holds only its dates and the fields `deriveActuals` reads (`basePlanDate`, `confirmedAt`, `greenAt`); every working page behind a completed step is built by **`seedSample()` in app.js** from `agencyBoardSeed` / `cl6DefaultState` / the seed constants — deliberately NOT a hand-written state tree, which would rot on the next shape change. Its 6-BP row is `manual: true` (stretched to 05 Sep) — that is what keeps it yellow while 6-KM goes orange. Step 6 must never have every applicable dept approved, or `recomputeClearance` greens the step.
- **Irama is a clean, not-yet-started project starting 01 Aug 2026**, running to 04 Jun 2027 (countdown ≈ 309 days). Every step is `upcoming`, every actual is `—`, and no progress of any kind is seeded — not even step 1's `basePlanDate`. All 12 dashboard nodes render grey. Utopia South is still 2024.
- Steps 1 and 2 are the anchor pair (the 1 → 2 arrow has no duration); **steps 3–11 in the seed are exactly what `cascadeDates` produces** from the Eco Sun template, verified by a Recompute-with-overwrite being a byte-for-byte no-op. If you move the anchors, re-run that check.
- **Management deck**: `EcoWorld-KMBP-Tracker-Update.pptx` in the repo root (untracked). Its screenshots were captured from an earlier *mid-flight* seed showing all six status colours, so the deck deliberately no longer matches the live app. To reproduce that state, seed steps 1–3 with `basePlanDate` / `confirmedAt` / `greenAt` / `kb` rows and set statuses to completed — see git history for the exact block.

## Project dashboard (`content/step-dashboard.html` + app.js `showDashboard`/`renderDashboard`/`dashSvg`)
- Default view per project; **step liner hidden** here (`timelineWrap.hidden`), returns on a step page.
- Branched **SVG** flowchart (NOT Mermaid — Mermaid can't put labels below a circle): circle nodes (number inside) with step name + `TS <d> · AS <d>` / `TE <d> · AE <d>` below. Routing: 1‑5 linear → **6‑KM + 6‑BP** (each own dates; BP from `steps[5].bp`) → 6‑KM→7→8, 6‑BP→8, 8→9→10→11.
- **Date-based colours** (`dashNodeState` vs today): within target = green, past target = red (delayed), ≤1 wk = orange (alarming), in-progress = yellow, else grey; completed-late = green + red ring; appeal ring = blue (dept dots). NOTE: seed dates are 2025 and today is later, so everything currently renders RED — expected, not a bug.
- **Branch connectors are right-angle elbows, not curves.** Both branches out of step 5 share a vertical stem at `x=609`; both branches into step 8 share one at `x=849`, so the split and the merge each read as a single spine. Duration pills for those branches sit clear of the stems — if you move an elbow, re-check pill placement (a script measuring pill rects against node circles caught a 4-unit overlap that was invisible by eye).
- Each expanded clearance matrix carries an **open-in-new icon button top right** (`.dash-matrix-open`, `OPEN_SVG`) instead of the old full-width green button; it keeps `data-dash-step="5"` so the existing delegated handler opens Step 6.
- Node click → opens that step page. **6‑KM / 6‑BP toggle independent dept matrices** (KM box ABOVE the flow, BP box BELOW, both centred on step 6, both can be open at once). Matrices come from Step 6 `cl6` state; each has an "Open Step 6 working page" button. Legend + TS/AS/TE/AE key below.
- Entry points wired: clicking the `KM/BP DASHBOARD` title (`#phDashboard`) or the `KM/BP AKM/ABP` pill (`#pillDashboard`) → `showDashboard()`.

## Settings page (header gear) — see `Reference/SETTINGS_SPEC.md`
- One modal, two tabs. **Global**: 1 Region + Project · 2 agency template as one column per BU (BU creation lives here) · 3 role permission matrix (placeholder) · 4 per-BU duration template in days. **Project** (needs a selected project): target dates · agency applicability · members (placeholder).
- ⚠️ **`Reference/…Authority Grouping List…xlsx` is SUPERSEDED — do not re-sync from it.** Eco Grandeur was corrected on 2026-08-02 from a newer list that disagrees with that file on 14 rows: MPKS and LLM removed, BOMBA added (BP only), and most external agencies changed from KM+BP to KM only. **Eco Sun is still seeded from the stale spreadsheet and needs verifying against the same newer source.**
- `OSC` is **KM only** by default (`OSC_ROW`), applied to every BU including Eco Sun and `_default`.
- **`AGENCY_TEMPLATES` (data.js) is per-BU and independent** — the same role is a different authority per state (MPKS in Selangor, MBSP in Penang), so lists are NOT aligned row-for-row. Row format `"CODE|Name|km|bp"`. Eco Grandeur (23 rows) and Eco Sun (24) are seeded from the user's authority spreadsheet; every other BU starts from `_default` = OSC only.
- **`code` is the identity key** on every agency board (chips, `cl6ByCode`, `data-code`), so it must be unique within a BU. Section 2 refuses a duplicate rename and says why; `setSelfCheck` also asserts uniqueness across all seeded templates.
- **km / bp flags** decide which clearance board and dashboard matrix an agency appears on. `agAffects` (either flag) gates `applicable`; `agAffectsKind` filters `dashDeptMatrix`. Both flags off → renders Not Applicable, data preserved, so a project override can switch it back on. Note the BP matrix now includes **external** agencies (PBA/TNB/IWK/JPS for Eco Sun) — it previously showed internal only.
- Section 2 is scoped to one region with configured BUs sorted first; showing all 22 BUs at once meant scrolling past a dozen OSC-only columns.
- **Apply / Cancel per section** (`setDraft`, `setApply`, `setCancel`). Field edits go into a per-section draft — nothing reaches the app until Apply, Cancel drops it. Drafted sections: `g2 g3 g4 p1 p2 p3`. Global section 1 is deliberately NOT drafted (Add Region / Create Project are one-shot). The bar renders hidden and `setDirty(key)` un-hides it **in place, without a re-render**, so typing never loses focus. `p1`'s draft is a steps-shaped mirror of just ts/te/manual so `setNodeSrc` and `cascadeDates` work on it unchanged; Apply copies fields onto the existing step objects rather than replacing the array (`activeSteps` points at it, and every step's `pc`/`cl6` state hangs off it).
- `renderSettings` preserves `.set-body` scrollTop and each `.ag-scroll` scrollLeft, so Apply never throws the panel back to the top.
- Closing with un-applied edits confirms first, naming the dirty sections. `onProjectChange` clears p1/p2/p3 drafts so they can never be applied to a different project.
- Durations are **days** (1 month = 30, 2 weeks = 15). Dashboard duration pills read the live BU template — `DASH_CONN` holds only geometry + the `from`/`to` flow graph.
- Creating a project asks for Step 1 + Step 2 target dates, then cascades steps 3–11: `TS(next) = TE(prev)`, `TE(next) = TS + edgeDays`. Step 8 merges two branches: `TS` = earliest predecessor end, `TE` = latest `predEnd + edgeDays`.
- **`7 → 8` is 30 days** (user-corrected from the flowchart's "2 weeks"), which makes both routes into step 8 total 75 days — KM via 45 + 30, BP direct 75 — so the parallel branches are designed to finish together and neither alone governs.
- **`cascadeDates` re-chains every target start** onto its predecessor's end, manual rows included, so a recompute always leaves a continuous timeline. A manual (•) row keeps its own duration; a clean row takes the template duration. The checkbox ("Also reset manual durations to Global") clears the manual flag too.
- **Durations can never go negative.** Editing a target start shifts its target end by the same delta, preserving the step's length; pulling a target end before its start, or typing a negative duration, is refused with an inline message (`setMsg.p1`). This was a live bug — moving a start past the end produced −498 days.
- Project tab dates carry a read-only **Global (days)** column (`setGlobalDays`): the largest incoming arrow in the BU template, blank for the two anchor steps, amber when the project differs from it.
- BU templates are **forward-only** — they stamp a project at creation (`PROJECT_DETAILS[p].agencyTemplate`) and never rewrite existing projects. Editing a date by hand sets `manual: true`, which "Recompute steps 3–11" respects unless you tick overwrite.
- Project tab · target dates has a **two-way Duration (days) column** (`setSpanDays`, `data-set-span`): change either date and the duration follows; type a duration and target end moves to start + N. Either edit flags the row manual. Disabled while a row has no target start. Section 4 (BU template) stays day-counts-only — no date column there.
- Agency seeding for Step 2 (`step.pc`) and Step 6 (`cl6`) both route through `agencyBoardSeed` / `agencyTemplateFor` — one place, both boards.
- Cascade self-check: open `localhost:5502/index.html?selfcheck=1` and read the console.

## Step 6 — Clearance (the most-reworked step; `cl6` in app.js, `content/step-06.html`)
Reuses Step 2's 16-agency board (internal+external). Right side = **3 cards**:
1. **6.1** — letter type (Tiada Halangan/Approval, Tiada Halang w/ New Condition, Ulasan/Comment, Rejection), doc upload + date + ref no + "Condition & Comment by Authority" (comment types only) + Send1. Approval letter → Approve button → green. `data-cl6-card1`.
2. **Classification & Appeal (PPD Internal Usage Only)** — attempt tabs + 6.2 (Appeal/Compliance + time-impact). Sub-questions reveal the moment BOTH dropdowns are filled (no 6.2 Send). If time impact ≠ "No time & no cost impact" → i/ii/iv HOD/CDO section shows (both Appeal AND Compliance). `data-cl6-card2`.
   - **iii was removed** (numbering now i, ii, iv — intentional).
   - ii "meeting with CDO": if "No meeting required" → hide its date; iv heading = "iv. CDO to review for approval:". If "Meeting required" → iv heading = "iv. PPD-HOD to update meeting outcome:".
   - iv buttons: **Approve by CDO / To revise (with remarks) / Reject (to comply)** [Compliance] or **Reject (to appeal)** [Appeal]. CDO comment has no send button.
3. **Authority Resubmission** — `data-cl6-card3`, shown only at resubmit stage. Holds the R0/R1 upload rounds AND the **PPD Approval** gate (renamed from "Authority"): PPD Comment + Not Ok / Ok. Ok → acknowledged-copy upload → green. Reject spawns next round / next attempt tab.
- **Agency settings popover** (gear on the board, shared with Step 2): untick an agency → **Not Applicable** (grey, disabled, excluded from completion), data preserved. Independent per step. In Step 2 it also greys matching KM/BP checklist rows (codes that overlap: JK, JL, TNB, IWK, JPS, JKR).

## Git / backup status ⚠️
- Branch: `docs/update-readme-v25`. Last commit: `d3bc144` ("Step 6 rework … agency N/A settings").
- **Uncommitted** (everything since the dashboard + step-6 UI iterations): `app.js`, `content/step-06.html`, `data.js`, `index.html`, `styles.css`, `.claude/launch.json`, and untracked `content/step-dashboard.html`, `Reference/`.
- Remote: `https://github.com/ptstwy/ecoworld-tracker.git`. Do NOT commit `.agents/`, `.claude/skills/`, `skills-lock.json` (local tooling).
- **README changelog is behind** — not updated since the Step 6 rework / dashboard. Update it when committing.

## Suggested next steps
1. Commit + push the uncommitted work; update README changelog (dashboard, Step 6 rework, dual-6 dates, agency N/A settings, duration pills, settings page).
2. Optional polish: prune dead dashboard CSS (`.dash-nw/.dash-nd/.dash-cn/.dash-splitcol` — replaced by the SVG); curved branch geometry is fine as-is.
3. Build out remaining placeholder steps (8, 9, 10) — currently minimal stubs.

## Working-style notes for the user
- Prefers being asked clarifying questions before building, and a widget mockup shown before large visual builds.
- Uses `/anthropic-skills:caveman` (terse "caveman" prose) and often types `/anthropic-skills:grill-me` (not an installed skill — treat as "ask me questions first").
