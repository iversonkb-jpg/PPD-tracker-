/* ============================================================
   EcoWorld Tracker — application logic
   ------------------------------------------------------------
   Depends on the globals defined in data.js:
     DATA, STEP_NAMES, PROJECT_DETAILS
   Loaded at the end of <body>, so the DOM is ready.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Element references ---------- */
  const regionSelect    = document.getElementById("regionSelect");
  const buSelect        = document.getElementById("buSelect");
  const projectSelect   = document.getElementById("projectSelect");

  const projectHeader   = document.getElementById("projectHeader");
  const timelineWrap    = document.getElementById("timelineWrap");
  const timelineToggle  = document.getElementById("timelineToggle");
  const phTimelineEl    = document.getElementById("phTimeline");

  const pagePlaceholder = document.getElementById("pagePlaceholder");
  const stepDetail      = document.getElementById("stepDetail");
  const stepBody        = document.getElementById("stepBody");
  const projectDashboard = document.getElementById("projectDashboard");

  const projectSearch   = document.getElementById("projectSearch");
  const searchResultsEl = document.getElementById("searchResults");

  /* ---------- Constants ---------- */
  const CONTENT_BASE = "content/";
  const STATUS_CLASSES = ["upcoming", "in-progress", "completed"];
  // The "recorded" stamps use a plain dot, NOT the tick — a tick is reserved
  // for a verdict (the accepted / rejected pills), so a system timestamp must
  // not wear the same mark. CHECK_SVG stays for the Confirm buttons.
  const STAMP_DOT_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/></svg>';
  const CHECK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  const DOC_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
    'stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
  const UPLOAD_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
    'stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>';
  const TRASH_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
  const SEND_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
  const PAPERCLIP_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
    'stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
  // "Open in new" — used by the clearance matrix boxes to jump to Step 6.
  const OPEN_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true"><path d="M14 3h7v7"/><path d="M21 3l-9 9"/>' +
    '<path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/></svg>';
  const CLOSE_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" ' +
    'stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  const STATUS_LABEL = {
    "upcoming": "Upcoming",
    "in-progress": "In Progress",
    "completed": "Completed"
  };

  /* ---------- State ---------- */
  let activeSteps = [];            // step data for the selected project
  let selectedStepIndex = -1;      // index currently shown in the detail panel
  const partialCache = {};         // url -> fetched HTML (avoids re-fetching)

  /* ---------- Small helpers ---------- */
  // Safe for text nodes and for quoted attribute values (user-typed
  // project/region/member names end up in value="…").
  function esc(v) {
    return String(v == null ? "—" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resetSelect(sel, placeholder) {
    sel.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = placeholder;
    opt.selected = true;
    opt.disabled = true;
    opt.hidden = true;
    sel.appendChild(opt);
  }

  function fillOptions(sel, items) {
    items.forEach(function (item) {
      const opt = document.createElement("option");
      opt.value = item;
      opt.textContent = item;
      sel.appendChild(opt);
    });
  }

  function daysLeft(targetDate) {
    if (!targetDate) return "—";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate + "T00:00:00");
    if (isNaN(target)) return "—";
    const diff = Math.ceil((target - today) / 86400000);
    return diff > 0 ? diff : 0;
  }

  /* ---------- Cascading dropdowns: Region ▸ Business Unit ▸ Project ---------- */
  function onRegionChange() {
    resetSelect(buSelect, "Select Business Unit");
    resetSelect(projectSelect, "Select Project");
    projectSelect.disabled = true;
    hideProjectHeader();

    const units = DATA[regionSelect.value];
    if (units) {
      fillOptions(buSelect, Object.keys(units));
      buSelect.disabled = false;
    } else {
      buSelect.disabled = true;
    }
  }

  function onBusinessUnitChange() {
    resetSelect(projectSelect, "Select Project");
    hideProjectHeader();

    const projects = (DATA[regionSelect.value] || {})[buSelect.value] || [];
    if (projects.length) {
      fillOptions(projectSelect, projects);
      projectSelect.disabled = false;
    } else {
      resetSelect(projectSelect, "No projects yet");
      projectSelect.disabled = true;
    }
  }

  function onProjectChange() {
    // Project-scoped settings drafts belong to the project that was selected
    // when they were made; never let them apply to a different one.
    setDraft.p1 = setDraft.p2 = setDraft.p3 = null;
    if (projectSelect.value) {
      renderProjectHeader(buSelect.value, projectSelect.value);
    } else {
      hideProjectHeader();
    }
  }

  /* ============================================================
     Derived actual dates (AS / AE)
     ------------------------------------------------------------
     Actuals are never typed in — they fall out of the working
     pages, so the timeline and dashboard always reflect what has
     really happened. Each step starts when the previous ended.

       1  AS  1.1 base plan date       AE  Confirm stamp
       2  AS  earliest 2.1 pre-consult AE  stamp when the step went green
       3  AS  step 2 AE                AE  later of 3.1 KM / BP dates
       4  AS  step 3 AE                AE  later of 4.6 KM / BP dates
       5  AS  step 4 AE                AE  5.3 minutes-letter date
       6  AS  step 5 AE                AE  latest approved-or-acknowledged
                                            date — KM and BP sides resolve
                                            separately, over the agencies
                                            that affect that side
       7  AS  6-KM AE                  AE  7.4.1 verify stamp

     Steps 8–11 are not derived yet. A step whose source question is
     unanswered shows "—" rather than a guess.
  ============================================================ */
  // Tolerant of every date shape in play: <input type="date"> values,
  // ISO timestamps, and the "05 Feb 26" display format.
  function toDate(v) {
    if (!v || v === "—") return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const d = new Date(s.slice(0, 10) + "T00:00:00");
      return isNaN(d) ? null : d;
    }
    const seed = parseSeedDate(s);
    if (seed) return seed;
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  function pickDate(list, wantLatest) {
    return list.reduce(function (best, v) {
      const d = toDate(v);
      if (!d) return best;
      if (!best) return d;
      return (wantLatest ? d > best : d < best) ? d : best;
    }, null);
  }
  function latestOf(list) { return pickDate(list, true); }
  function earliestOf(list) { return pickDate(list, false); }

  function deriveActuals() {
    if (!activeSteps.length) return;
    const s = activeSteps;
    function put(node, as, ae) {
      if (!node) return;
      node.as = as ? fmtSeedDate(as) : "—";
      node.ae = ae ? fmtSeedDate(ae) : "—";
    }

    const s1 = s[0] || {};
    const ae1 = toDate(s1.confirmedAt);
    put(s1, toDate(s1.basePlanDate), ae1);

    const s2 = s[1] || {};
    const pc = s2.pc;
    const as2 = pc ? earliestOf(pc.internal.concat(pc.external)
      .filter(function (a) { return a.applicable !== false; })
      .map(function (a) { return a.preDate; })) : null;
    const ae2 = toDate(s2.greenAt);
    put(s2, as2, ae2);

    const s3 = s[2] || {};
    const ae3 = s3.kb ? latestOf([s3.kb.km.date, s3.kb.bp.date]) : null;
    put(s3, ae2, ae3);

    const s4 = s[3] || {};
    const ae4 = s4.hc ? latestOf([s4.hc.q6.km.date, s4.hc.q6.bp.date]) : null;
    put(s4, ae3, ae4);

    const s5 = s[4] || {};
    const ae5 = s5.osc ? toDate(s5.osc.q3.date) : null;
    put(s5, ae4, ae5);

    // Step 6: an agency is done at whichever came later — its approval, or
    // the acknowledged copy for any of its attempts.
    const s6 = s[5] || {};
    const cl = s6.cl6;
    function clearedBy(kind) {
      if (!cl) return null;
      return latestOf(cl.internal.concat(cl.external)
        .filter(function (d) { return d.applicable !== false && agAffectsKind(d, kind); })
        .map(function (d) {
          const acks = (d.attempts || []).map(function (a) { return a.ackDate || a.ackSent; });
          return latestOf([d.approvedAt].concat(acks));
        }));
    }
    const ae6km = clearedBy("km"), ae6bp = clearedBy("bp");
    put(s6, ae5, ae6km);
    if (s6.bp) put(s6.bp, ae5, ae6bp);

    const s7 = s[6] || {};
    const lt = s7.endorse && s7.endorse.letter;
    put(s7, ae6km, (lt && lt.verified === "accepted") ? toDate(lt.verifiedAt) : null);
  }

  /* ---------- Project header + timeline ---------- */
  function renderProjectHeader(businessUnit, project) {
    const d = PROJECT_DETAILS[project] ||
      { dashboard: "KM/BP DASHBOARD", updated: "—", targetDate: null, steps: [] };

    document.getElementById("phTitle").textContent = (businessUnit || "").toUpperCase();
    document.getElementById("phSubtitle").textContent = project;
    document.getElementById("phDashboard").textContent = d.dashboard;
    document.getElementById("phUpdated").textContent = d.updated;
    document.getElementById("phCountdown").textContent = daysLeft(d.targetDate);

    // Must precede renderTimeline: deriveActuals() reads activeSteps, so
    // pointing it at the new project first stops the timeline deriving from
    // whichever project was selected before.
    activeSteps = d.steps || [];

    renderTimeline(d.steps);
    timelineWrap.classList.remove("collapsed");
    projectHeader.hidden = false;

    // Default view for a project is the dashboard.
    showDashboard();
  }

  function renderTimeline(steps) {
    deriveActuals();          // actuals are computed, never stored by hand
    phTimelineEl.innerHTML = STEP_NAMES.map(function (name, i) {
      const s = steps[i] || {};
      return (
        '<div class="step ' + stepStateClass(steps, i) + (i === selectedStepIndex ? " selected" : "") + '">' +
          '<div class="step-node" tabindex="0" role="button" ' +
               'aria-label="View details for step ' + (i + 1) + ': ' + esc(name) + '">' + (i + 1) + '</div>' +
          '<div class="step-label">' + esc(name) + '</div>' +
          '<div class="step-dates">' +
            '<div class="dates-grid">' +
              '<span></span><span class="dg-head">Target</span><span class="dg-head">Actual</span>' +
              '<span class="dg-row-label">Start</span>' +
                '<span class="dg-val">' + esc(s.ts) + '</span><span class="dg-val">' + esc(s.as) + '</span>' +
              '<span class="dg-row-label">End</span>' +
                '<span class="dg-val">' + esc(s.te) + '</span><span class="dg-val">' + esc(s.ae) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join("");
  }

  function hideProjectHeader() {
    projectHeader.hidden = true;
    stepDetail.hidden = true;
    if (projectDashboard) projectDashboard.hidden = true;
    pagePlaceholder.hidden = false;
    activeSteps = [];
    selectedStepIndex = -1;
  }

  /* ============================================================
     Project dashboard — branched milestone flowchart (default view)
     ------------------------------------------------------------
     1-5 linear; step 6 splits into 6-KM + 6-BP; 6-KM -> 7 -> 8,
     6-BP -> 8; 8 -> 9 -> 10 -> 11. Dot colour is date-based; the
     two step-6 nodes expand to the KM/BP clearance dept matrix.
  ============================================================ */
  const DASH_MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  function parseSeedDate(s) {
    if (!s || s === "—") return null;
    const p = String(s).trim().split(/\s+/);
    if (p.length < 3) return null;
    const d = parseInt(p[0], 10), m = DASH_MON[p[1]], y = 2000 + parseInt(p[2], 10);
    if (isNaN(d) || m == null || isNaN(y)) return null;
    return new Date(y, m, d);
  }
  // Inverse of parseSeedDate, plus the ISO conversions the <input type="date">
  // controls in the settings page need.
  const DASH_MON_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function fmtSeedDate(d) {
    return pad2(d.getDate()) + " " + DASH_MON_NAMES[d.getMonth()] + " " + String(d.getFullYear()).slice(-2);
  }
  function addDays(d, n) { const c = new Date(d.getTime()); c.setDate(c.getDate() + n); return c; }
  function isoOf(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function seedToIso(s) { const d = parseSeedDate(s); return d ? isoOf(d) : ""; }
  function isoToSeed(v) { return v ? fmtSeedDate(new Date(v + "T00:00:00")) : "—"; }
  // Date-based node state (see legend): within target -> green, past -> red,
  // ≤1 week to target -> orange, plus completed / completed-with-delay.
  function dashNodeState(step, te, ae) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tgt = parseSeedDate(te);
    if (step.status === "completed") {
      const act = parseSeedDate(ae);
      return (tgt && act && act > tgt) ? "delaydone" : "done";
    }
    if (tgt) {
      if (today > tgt) return "delayed";
      const wk = new Date(tgt); wk.setDate(wk.getDate() - 7);
      if (today >= wk) return "alarming";
    }
    return step.status === "in-progress" ? "inprogress" : "default";
  }
  const DASH_NODE_CLS = { done: "nd-g", delaydone: "nd-g ring-r", delayed: "nd-r", alarming: "nd-o", inprogress: "nd-y", "default": "nd-d" };

  /* ---------- One status colour across every surface ----------
     The step liner and the detail badge use the same date-based state as
     the dashboard, so a step can never show two different colours.
     Step 6 is one node on the liner but two on the dashboard (KM and BP),
     so it takes the WORSE of the pair — a single node should surface the
     risk, not hide half of it. Ranked worst-first below; "default" (not
     started) outranks the done states, or a half-finished step 6 would
     show green. */
  const STEP_STATE_CLS = {
    done: "completed", delaydone: "completed late", delayed: "delayed",
    alarming: "alarming", inprogress: "in-progress", "default": "upcoming"
  };
  const STEP_STATE_RANK = { delayed: 5, alarming: 4, inprogress: 3, "default": 2, delaydone: 1, done: 0 };

  function stepState(steps, i) {
    const s = (steps && steps[i]) || {};
    let st = dashNodeState(s, s.te, s.ae);
    if (i === 5 && s.bp) {
      const bp = dashNodeState(s, s.bp.te, s.bp.ae);
      if ((STEP_STATE_RANK[bp] || 0) > (STEP_STATE_RANK[st] || 0)) st = bp;
    }
    return st;
  }
  function stepStateClass(steps, i) { return STEP_STATE_CLS[stepState(steps, i)] || "upcoming"; }

  let dashKM = false, dashBP = false;   // independent expand toggles

  // SVG flowchart: circle nodes (number inside) with name + dates below,
  // branched connectors. idx maps to activeSteps; the two step-6 nodes carry
  // an expand key (km/bp) and pull dates from step6 (KM) / step6.bp (BP).
  const DASH_NODES = [
    { idx: 0, x: 70, y: 150, label: "Design Approval" },
    { idx: 1, x: 190, y: 150, label: "Pre-consult" },
    { idx: 2, x: 310, y: 150, label: "KM & BP Submission" },
    { idx: 3, x: 430, y: 150, label: "Hardcopy" },
    { idx: 4, x: 550, y: 150, label: "OSC Meeting" },
    { idx: 5, x: 670, y: 95, label: "Clearance — KM", expand: "km", above: true },
    { idx: 5, x: 670, y: 205, label: "Clearance — BP", expand: "bp", bp: true },
    { idx: 6, x: 790, y: 95, label: "KM Approval", above: true },
    { idx: 7, x: 910, y: 150, label: "BP Approval" },
    { idx: 8, x: 1030, y: 150, label: "Sifus Approval" },
    { idx: 9, x: 1150, y: 150, label: "COB Approval" },
    { idx: 10, x: 1270, y: 150, label: "AP Approval" }
  ];
  // One entry per arrow, and the single source of truth for the flow graph:
  //   d      = SVG path        lx/ly = duration pill centre above the edge
  //   from/to = node keys (see SET_NODE) used by the target-date cascade
  // Durations themselves live in the BU template (days), not here, so the
  // settings page and the dashboard pills can never drift apart.
  const DASH_CONN = [
    { d: "M92,150 L166,150", from: "1", to: "2", lx: 129, ly: 138 },
    { d: "M212,150 L286,150", from: "2", to: "3", lx: 249, ly: 138 },
    { d: "M332,150 L406,150", from: "3", to: "4", lx: 369, ly: 138 },
    { d: "M452,150 L526,150", from: "4", to: "5", lx: 489, ly: 138 },
    // The four branch connectors are right-angle elbows, not curves. Both
    // branches out of step 5 share a vertical stem at x=609, and both branches
    // into step 8 share one at x=849, so the split and the merge each read as
    // a single spine. Pill positions sit clear of those stems.
    { d: "M572,150 L609,150 L609,95 L646,95", from: "5", to: "6km", lx: 618, ly: 83 },
    { d: "M572,150 L609,150 L609,205 L646,205", from: "5", to: "6bp", lx: 618, ly: 218 },
    { d: "M692,95 L766,95", from: "6km", to: "7", lx: 729, ly: 83 },
    { d: "M812,95 L849,95 L849,150 L886,150", from: "7", to: "8", lx: 884, ly: 112 },
    { d: "M692,205 L849,205 L849,150 L886,150", from: "6bp", to: "8", lx: 770, ly: 193 },
    { d: "M932,150 L1006,150", from: "8", to: "9", lx: 969, ly: 138 },
    { d: "M1052,150 L1126,150", from: "9", to: "10", lx: 1089, ly: 138 },
    { d: "M1172,150 L1246,150", from: "10", to: "11", lx: 1209, ly: 138 }
  ];
  function dashDurPill(c, i) {
    const days = setDurations()[i];
    if (days == null || days === "") return "";
    const txt = days + " days";
    const w = txt.length * 5 + 12;
    return '<g text-anchor="middle" font-size="9">' +
      '<rect x="' + (c.lx - w / 2) + '" y="' + (c.ly - 9) + '" width="' + w + '" height="15" rx="7.5" fill="#fff" stroke="#9aa39b" stroke-width="1"/>' +
      '<text x="' + c.lx + '" y="' + (c.ly + 1.5) + '" fill="var(--muted)">' + esc(txt) + "</text></g>";
  }
  const DASH_SVG_STYLE = {
    done:       { fill: "#1a7a3c", tx: "#fff", stroke: "#14602f" },
    delaydone:  { fill: "#1a7a3c", tx: "#fff", stroke: "#c62828", sw: 3 },
    delayed:    { fill: "#c62828", tx: "#fff", stroke: "#8f1d1d" },
    alarming:   { fill: "#d9730d", tx: "#fff", stroke: "#8a4f06" },
    inprogress: { fill: "#e0a416", tx: "#fff", stroke: "#a3670b" },
    "default":  { fill: "#e9ece9", tx: "#4d5852", stroke: "#c3cac5" }
  };

  function dashSvgNode(p) {
    const s = activeSteps[p.idx] || {};
    const src = p.bp ? (s.bp || {}) : s;
    const sty = DASH_SVG_STYLE[dashNodeState(s, src.te, src.ae)] || DASH_SVG_STYLE["default"];
    const selected = (p.expand === "km" && dashKM) || (p.expand === "bp" && dashBP);
    const stroke = selected ? "#1f5fa8" : sty.stroke;
    const sw = selected ? 4 : (sty.sw || 2);
    const exp = p.expand ? ' data-dash-expand="' + p.expand + '"' : "";
    const nmY = p.above ? p.y - 52 : p.y + 38;
    const l1Y = p.above ? p.y - 40 : p.y + 51;
    const l2Y = p.above ? p.y - 28 : p.y + 62;
    return '<g class="dash-svg-node" data-dash-step="' + p.idx + '"' + exp + '>' +
      '<circle cx="' + p.x + '" cy="' + p.y + '" r="22" fill="' + sty.fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>' +
      '<text x="' + p.x + '" y="' + p.y + '" dy=".34em" text-anchor="middle" font-weight="700" font-size="15" fill="' + sty.tx + '">' + (p.idx + 1) + "</text>" +
      '<text x="' + p.x + '" y="' + nmY + '" text-anchor="middle" font-size="10" fill="var(--ink)">' + esc(p.label) + "</text>" +
      '<text x="' + p.x + '" y="' + l1Y + '" text-anchor="middle" font-size="8" fill="var(--muted)">' + esc("TS " + (src.ts || "—") + " · AS " + (src.as || "—")) + "</text>" +
      '<text x="' + p.x + '" y="' + l2Y + '" text-anchor="middle" font-size="8" fill="var(--muted)">' + esc("TE " + (src.te || "—") + " · AE " + (src.ae || "—")) + "</text>" +
      "</g>";
  }

  function dashSvg() {
    deriveActuals();
    const paths = DASH_CONN.map(function (c) { return '<path d="' + c.d + '"/>'; }).join("");
    const pills = DASH_CONN.map(dashDurPill).join("");
    const nodes = DASH_NODES.map(dashSvgNode).join("");
    return '<svg viewBox="0 0 1340 300" width="1340" height="300" role="img" font-family="var(--font-sans)">' +
      '<defs><marker id="dashah" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#9aa39b"/></marker></defs>' +
      '<g fill="none" stroke="#9aa39b" stroke-width="2" marker-end="url(#dashah)">' + paths + "</g>" +
      pills + nodes + "</svg>";
  }

  // `kind` is the matrix this dot is being drawn in, so an agency on both
  // branches is judged against that branch's own target end.
  function dashDeptDotClass(d, kind) {
    const st = cl6DerivedStatus(d);
    let c = st === "approved" ? "dd-g" : (st === "in-progress" ? "dd-y" : (st === "na" ? "dd-na" : "dd-d"));
    const ds = agDateState(5, d, st, kind);
    if (ds === "delayed") c = "dd-r";
    else if (ds === "alarming") c = "dd-o";
    else if (ds === "late") c += " ring-r";
    if (d.approvedAt && d.attempts && d.attempts.some(function (a) { return a.appeal === "Appeal"; })) c += " ring-b";
    return c;
  }
  function dashDeptMatrix(kind) {
    const step6 = activeSteps[5];
    if (!step6) return "";
    if (!step6.cl6) step6.cl6 = cl6DefaultState();
    const cl = step6.cl6;
    // Each matrix shows only the agencies that affect that submission
    // (the Affect KM / BP ticks in the BU agency template).
    const f = function (d) { return agAffectsKind(d, kind); };
    const groups = [
      { t: "External Agency", list: cl.external.filter(f) },
      { t: "Internal Agency", list: cl.internal.filter(f) }
    ].filter(function (g) { return g.list.length; });
    let h = '<div class="dash-matrix">' +
      '<div class="dash-matrix-head">' +
        '<div class="dash-matrix-title">' + (kind === "bp" ? "BP" : "KM") + " Clearance — department status</div>" +
        '<button type="button" class="dash-matrix-open" data-dash-step="5"' +
          ' aria-label="Open Step 6 working page" title="Open Step 6 working page">' + OPEN_SVG + "</button>" +
      "</div>" +
      '<div class="dash-matrix-cols">';
    groups.forEach(function (g) {
      h += '<div class="dash-mcol"><div class="dash-mcol-h">' + esc(g.t) + "</div>";
      g.list.forEach(function (d) { h += '<div class="dash-dept"><span class="dash-dd ' + dashDeptDotClass(d, kind) + '"></span>' + esc(d.code) + "</div>"; });
      h += "</div>";
    });
    h += "</div></div>";   // the open action now lives as an icon in the head
    return h;
  }

  function dashLegendHtml() {
    function li(c, t) { return '<span class="dash-li"><span class="dash-dd ' + c + '"></span>' + t + "</span>"; }
    return '<div class="dash-legend">' +
      li("dd-d", "Default") + li("dd-g", "Completed (within target)") + li("dd-y", "In Progress / Ulasan") +
      li("dd-o", "Alarming (≤1 wk to target)") + li("dd-r", "Delayed") +
      '<span class="dash-li"><span class="dash-dd dd-g ring-r"></span>Completed w/ Delay</span>' +
      '<span class="dash-li"><span class="dash-dd dd-g ring-b"></span>Completed w/ Appeal</span>' +
      '<span class="dash-key">TS = Target Start · AS = Actual Start · TE = Target End · AE = Actual End</span>' +
      "</div>";
  }

  /* ---------- Master KM (MKM) milestone flow ----------
     A KM-only linear version of the dashboard flowchart: steps 1→7
     (Design Approval → … → KM Clearance → KM Approval). The tail
     (Sifus/COB/AP) sits downstream of BP Approval in the graph, so a
     pure KM line ends at KM Approval. Reuses the dashboard's node
     renderer (dashSvgNode) and legend, so styling/colours stay in sync.
     durIdx indexes setDurations() (same source the dashboard pills use). */
  const MKM_NODES = [
    { idx: 0, x: 70,  y: 90, label: "Design Approval" },
    { idx: 1, x: 190, y: 90, label: "Pre-consult" },
    { idx: 2, x: 310, y: 90, label: "KM & BP Submission" },
    { idx: 3, x: 430, y: 90, label: "Hardcopy" },
    { idx: 4, x: 550, y: 90, label: "OSC Meeting" },
    { idx: 5, x: 670, y: 90, label: "Clearance — KM" },
    { idx: 6, x: 790, y: 90, label: "KM Approval" }
  ];
  const MKM_CONN = [
    { d: "M92,90 L166,90",  durIdx: 0, lx: 129, ly: 78 },
    { d: "M212,90 L286,90", durIdx: 1, lx: 249, ly: 78 },
    { d: "M332,90 L406,90", durIdx: 2, lx: 369, ly: 78 },
    { d: "M452,90 L526,90", durIdx: 3, lx: 489, ly: 78 },
    { d: "M572,90 L646,90", durIdx: 4, lx: 609, ly: 78 },
    { d: "M692,90 L766,90", durIdx: 6, lx: 729, ly: 78 }
  ];
  function mkmDurPill(c) {
    const days = setDurations()[c.durIdx];
    if (days == null || days === "") return "";
    const txt = days + " days";
    const w = txt.length * 5 + 12;
    return '<g text-anchor="middle" font-size="9">' +
      '<rect x="' + (c.lx - w / 2) + '" y="' + (c.ly - 9) + '" width="' + w + '" height="15" rx="7.5" fill="#fff" stroke="#9aa39b" stroke-width="1"/>' +
      '<text x="' + c.lx + '" y="' + (c.ly + 1.5) + '" fill="var(--muted)">' + esc(txt) + "</text></g>";
  }
  let mkmSelectedIndex = -1;   // which milestone is open (for the highlight ring)
  function mkmSvgNode(p) {
    const g = dashSvgNode(p);
    if (p.idx !== mkmSelectedIndex) return g;
    // Draw a blue ring around the open milestone so the flow doubles as a switcher.
    return g.replace(/<\/g>$/, '<circle cx="' + p.x + '" cy="' + p.y + '" r="27" fill="none" stroke="#1f5fa8" stroke-width="2.5"/></g>');
  }
  function mkmSvg() {
    deriveActuals();
    const paths = MKM_CONN.map(function (c) { return '<path d="' + c.d + '"/>'; }).join("");
    const pills = MKM_CONN.map(mkmDurPill).join("");
    const nodes = MKM_NODES.map(mkmSvgNode).join("");
    return '<svg viewBox="0 0 862 170" width="862" height="170" role="img" style="display:block;margin:0 auto;max-width:100%" font-family="var(--font-sans)">' +
      '<defs><marker id="mkmah" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#9aa39b"/></marker></defs>' +
      '<g fill="none" stroke="#9aa39b" stroke-width="2" marker-end="url(#mkmah)">' + paths + "</g>" +
      pills + nodes + "</svg>";
  }
  // Fills the [data-mkm-lane] / [data-mkm-legend] hooks in content/master-km.html.
  // Called by showMasterBody after that partial is injected.
  function renderMkmFlow(container) {
    const lane = container.querySelector("[data-mkm-lane]");
    if (!lane) return;   // this partial has no flow hook (e.g. Master Infra)
    if (!activeSteps.length) {
      lane.innerHTML = '<p class="dash-hint">Select a project above to see its KM milestone flow.</p>';
      return;
    }
    lane.innerHTML = mkmSvg();
    const leg = container.querySelector("[data-mkm-legend]");
    if (leg) leg.innerHTML = dashLegendHtml();
  }

  // Fills the hooks in content/step-dashboard.html (must already be injected).
  function renderDashboard() {
    if (!activeSteps.length) return;
    const laneEl = projectDashboard.querySelector("[data-dash-lane]");
    if (!laneEl) return;   // partial not injected yet

    laneEl.innerHTML = dashSvg();

    const kmEl = projectDashboard.querySelector("[data-dash-km]");
    if (kmEl) kmEl.innerHTML = dashKM ? dashDeptMatrix("km") : "";
    const bpEl = projectDashboard.querySelector("[data-dash-bp]");
    if (bpEl) bpEl.innerHTML = dashBP ? dashDeptMatrix("bp") : "";
    const legEl = projectDashboard.querySelector("[data-dash-legend]");
    if (legEl) legEl.innerHTML = dashLegendHtml();
    const titleEl = projectDashboard.querySelector("[data-dash-title]");
    if (titleEl) titleEl.textContent = document.getElementById("phSubtitle").textContent + " — Dashboard";
  }

  function showDashboard() {
    if (!activeSteps.length) return;
    selectedStepIndex = -1;
    ensureStepDetailHome();             // reclaim #stepDetail if MKM borrowed it
    if (masterBody) masterBody.hidden = true;
    pagePlaceholder.hidden = true;
    stepDetail.hidden = true;
    timelineWrap.hidden = true;         // no step liner on the dashboard page
    projectDashboard.hidden = false;

    const url = CONTENT_BASE + "step-dashboard.html";
    if (Object.prototype.hasOwnProperty.call(partialCache, url)) {
      projectDashboard.innerHTML = partialCache[url];
      renderDashboard();
      return;
    }
    projectDashboard.innerHTML = '<p class="sd-loading">Loading…</p>';
    fetch(url, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(function (html) {
        partialCache[url] = html;
        if (!projectDashboard.hidden) { projectDashboard.innerHTML = html; renderDashboard(); }
      })
      .catch(function () { projectDashboard.innerHTML = '<p class="sd-error">Couldn\'t load the dashboard.</p>'; });
  }

  projectDashboard.addEventListener("click", function (e) {
    const exp = e.target.closest("[data-dash-expand]");
    if (exp) {
      const k = exp.getAttribute("data-dash-expand");
      if (k === "km") dashKM = !dashKM; else if (k === "bp") dashBP = !dashBP;
      renderDashboard();
      return;
    }
    const step = e.target.closest("[data-dash-step]");
    if (step) selectStep(Number(step.getAttribute("data-dash-step")));
  });

  (function wireDashboardEntry() {
    const title = document.getElementById("phDashboard");
    if (title) { title.style.cursor = "pointer"; title.addEventListener("click", function () { if (activeSteps.length) showDashboard(); }); }
    const pill = document.getElementById("pillDashboard");
    if (pill) pill.addEventListener("click", function () { setActivePill(pill); if (activeSteps.length) showDashboard(); });
  })();

  /* ---------- Master body pages (Master KM, Master Infra) ----------
     Each pill loads its own content/master-*.html into #masterBody.
     Content lives entirely in those files, so the KM and Infra teams
     edit separate files and never collide. Fetched fresh (no cache)
     so edits show on refresh. */
  const masterBody = document.getElementById("masterBody");
  const stepDetailHome = stepDetail.parentNode;   // <main> — where #stepDetail normally lives

  // #stepDetail is a single shared element. The Master KM page borrows it —
  // moving it into #mkmStepHost so a step opens "inside" MKM — and this returns
  // it to its home in <main> for the KM/BP dashboard + timeline to use.
  function ensureStepDetailHome() {
    if (stepDetail.parentNode !== stepDetailHome) stepDetailHome.appendChild(stepDetail);
  }
  function setActivePill(el) {
    document.querySelectorAll(".sub-tabs .pill").forEach(function (p) { p.classList.remove("active"); });
    if (el) el.classList.add("active");
  }

  function showMasterBody(url, pill) {
    if (!masterBody) return;
    ensureStepDetailHome();
    stepDetail.hidden = true;
    mkmSelectedIndex = -1;   // no milestone open on a fresh page load
    pagePlaceholder.hidden = true;
    if (projectDashboard) projectDashboard.hidden = true;
    if (timelineWrap) timelineWrap.hidden = true;
    if (pill) setActivePill(pill);
    masterBody.hidden = false;
    masterBody.innerHTML = '<p class="sd-loading">Loading…</p>';
    fetch(url, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(function (html) { masterBody.innerHTML = html; renderMkmFlow(masterBody); })
      .catch(function () { masterBody.innerHTML = '<p class="sd-error">Couldn\'t load this page.</p>'; });
  }

  (function wireMasterPills() {
    const km = document.getElementById("pillMasterKm");
    if (km) km.addEventListener("click", function () { showMasterBody(CONTENT_BASE + "master-km.html", km); });
    const infra = document.getElementById("pillMasterInfra");
    if (infra) infra.addEventListener("click", function () { showMasterBody(CONTENT_BASE + "master-infra.html", infra); });
  })();

  // Fill the shared #stepDetail header (badge / index / name / status chip).
  function fillStepHeader(index) {
    const s = activeSteps[index] || {};
    const status = s.status || "upcoming";
    const badge = document.getElementById("sdBadge");
    badge.textContent = index + 1;
    badge.className = "sd-badge " + stepStateClass(activeSteps, index);
    document.getElementById("sdIndex").textContent = index + 1;
    document.getElementById("sdTotal").textContent = STEP_NAMES.length;
    document.getElementById("sdName").textContent = STEP_NAMES[index];
    const chip = document.getElementById("sdChip");
    chip.textContent = STATUS_LABEL[status] || "Upcoming";
    chip.className = "sd-chip " + status;
  }

  // Open a step's working page INSIDE the Master KM page (not the KM/BP view):
  // the shared #stepDetail block is relocated into #mkmStepHost, the overview is
  // hidden, and the Back control (below) returns to the milestone flow.
  function openMkmStep(index) {
    if (!activeSteps.length || !STEP_NAMES[index]) return;
    const host = masterBody.querySelector("#mkmStepHost");
    const overview = masterBody.querySelector("#mkmOverview");
    if (!host) return;
    selectedStepIndex = index;
    mkmSelectedIndex = index;
    renderMkmFlow(masterBody);       // redraw the (always-visible) flow with the ring
    fillStepHeader(index);
    host.appendChild(stepDetail);    // borrow the shared step block
    if (overview) overview.hidden = true;   // free the space; the flow stays on top
    host.hidden = false;
    stepDetail.hidden = false;
    loadStepBody(index);
  }
  function closeMkmStep() {
    stepDetail.hidden = true;
    ensureStepDetailHome();
    const host = masterBody.querySelector("#mkmStepHost");
    const overview = masterBody.querySelector("#mkmOverview");
    if (host) host.hidden = true;
    if (overview) overview.hidden = false;
    selectedStepIndex = -1;
    mkmSelectedIndex = -1;
    renderMkmFlow(masterBody);       // clear the ring
  }

  if (masterBody) {
    masterBody.addEventListener("click", function (e) {
      if (e.target.closest("[data-mkm-back]")) { closeMkmStep(); return; }
      const node = e.target.closest(".dash-svg-node[data-dash-step]");
      if (!node || !activeSteps.length) return;
      openMkmStep(Number(node.getAttribute("data-dash-step")));
    });
  }

  /* ---------- Step selection + content fetch ---------- */
  // opts.scrollToStep (default true): whether to scroll the timeline node
  // into view. Manual clicks/keyboard nav on the timeline want this — the
  // user just touched that exact spot. Auto-advance after Confirm does NOT:
  // the user is reading the step body below, and yanking the page back up
  // to the timeline is a jarring jump. Pass { scrollToStep: false } there.
  function selectStep(index, opts) {
    if (!activeSteps.length || !STEP_NAMES[index]) return;
    ensureStepDetailHome();             // reclaim #stepDetail if MKM borrowed it
    if (masterBody) masterBody.hidden = true;
    selectedStepIndex = index;
    const scrollToStep = !opts || opts.scrollToStep !== false;

    // Highlight the selected node and (optionally) keep it in view.
    phTimelineEl.querySelectorAll(".step").forEach(function (el, i) {
      const isSelected = i === index;
      el.classList.toggle("selected", isSelected);
      if (isSelected && scrollToStep) {
        el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      }
    });

    // Fill the fixed header from the data layer.
    const s = activeSteps[index] || {};
    const status = s.status || "upcoming";

    const badge = document.getElementById("sdBadge");
    badge.textContent = index + 1;
    badge.className = "sd-badge " + stepStateClass(activeSteps, index);   // same colour as the liner

    document.getElementById("sdIndex").textContent = index + 1;
    document.getElementById("sdTotal").textContent = STEP_NAMES.length;
    document.getElementById("sdName").textContent = STEP_NAMES[index];

    const chip = document.getElementById("sdChip");
    chip.textContent = STATUS_LABEL[status] || "Upcoming";
    chip.className = "sd-chip " + status;

    pagePlaceholder.hidden = true;
    if (projectDashboard) projectDashboard.hidden = true;
    timelineWrap.hidden = false;        // step liner returns on a working page
    stepDetail.hidden = false;

    // Fetch the shared body partial for this step.
    loadStepBody(index);
  }

  function stepFileUrl(index) {
    const n = String(index + 1).padStart(2, "0");
    return CONTENT_BASE + "step-" + n + ".html";
  }

  /* ---------- Status engine ----------
     Changes a step's status, then reflects it in BOTH the timeline
     node and (if it's the open step) the detail header badge + chip.
     Mutating activeSteps[i] also persists into PROJECT_DETAILS for
     the session, so status survives navigating between projects. */
  function setStepStatus(index, status) {
    const step = activeSteps[index];
    if (!step || step.status === status) return;
    step.status = status;
    // Stamp the moment a step goes green — step 2's actual end is defined as
    // "when the step turns green", and there is no other record of it.
    if (status === "completed" && !step.greenAt) step.greenAt = new Date().toISOString();

    // The liner's colour is date-based, not a direct read of `status`, so
    // repaint it rather than swapping one class for another.
    renderTimeline(activeSteps);

    // Detail header (only if this step is the one on screen)
    if (index === selectedStepIndex) {
      const badge = document.getElementById("sdBadge");
      badge.className = "sd-badge " + stepStateClass(activeSteps, index);
      const chip = document.getElementById("sdChip");
      chip.textContent = STATUS_LABEL[status] || "Upcoming";
      chip.className = "sd-chip " + status;
    }
  }

  /* ---------- Saved field values (persist across navigation) ----------
     Named fields (input/select/textarea with a `name`) are saved into
     the step's data on Confirm, then restored whenever the body loads.
     Because activeSteps points into PROJECT_DETAILS, values survive
     switching projects during the session. */
  function saveStepValues(index) {
    const step = activeSteps[index];
    if (!step) return;
    const values = {};
    stepBody.querySelectorAll("input[name], select[name], textarea[name]").forEach(function (f) {
      values[f.name] = f.value;
    });
    step.values = values;
  }

  function restoreStepValues(index) {
    const step = activeSteps[index];
    if (!step || !step.values) return;
    Object.keys(step.values).forEach(function (name) {
      const f = stepBody.querySelector('[name="' + name + '"]');
      if (f) f.value = step.values[name];
    });
  }

  // "11 Jul 2026, 2:34 PM"
  function formatDateTime(iso) {
    const d = iso instanceof Date ? iso : new Date(iso);
    if (isNaN(d)) return "";
    const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return date + ", " + time;
  }

  /* One builder for every "recorded" stamp — dot, action in bold, timestamp
     greyed back. Previously this markup was concatenated by hand at 14 call
     sites, so a change to the treatment had to be made 14 times.
       stampInner : contents only, for the partials that ship an empty
                    <span class="saved-stamp" data-saved-stamp> to fill
       stampHtml  : the whole span, for everything built as a string */
  function stampInner(label, when) {
    return STAMP_DOT_SVG + "<b>" + esc(label) + '</b><span class="ss-time">' + esc(when) + "</span>";
  }
  function stampHtml(label, when, extraCls) {
    return '<span class="saved-stamp' + (extraCls ? " " + extraCls : "") + '">' +
      stampInner(label, when) + "</span>";
  }

  // Confirmation stamp beside a field (any partial with [data-saved-stamp]).
  function renderSavedStamp(index) {
    const stamp = stepBody.querySelector("[data-saved-stamp]");
    if (!stamp) return;
    const step = activeSteps[index];
    if (step && step.confirmedAt) {
      stamp.innerHTML = stampInner("Confirmed", formatDateTime(step.confirmedAt));
      stamp.hidden = false;
    } else {
      stamp.hidden = true;
    }
  }

  // Inject a partial, restore any saved values + stamp, then re-evaluate gating.
  function injectStepBody(index, html) {
    stepBody.innerHTML = html;
    restoreStepValues(index);
    renderSavedStamp(index);
    updateStepFormState();
    if (stepBody.querySelector("#pcRoot")) initPreConsult(index);       // Step 2 · Pre-Consultation
    if (stepBody.querySelector("#genDocs")) initGeneralDocs(index);     // Step 2 · Upload (General)
    if (stepBody.querySelector("#kmChecklist")) initKmChecklist(index); // Step 2 · Upload (KM Checklist)
    if (stepBody.querySelector("#bpChecklist")) initBpChecklist(index); // Step 2 · Upload (BP Checklist)
    if (stepBody.querySelector("#kbRoot")) initKbSubmission(index);     // Step 3 · KM & BP Online Submission
    if (stepBody.querySelector("#hcRoot")) initHcSubmission(index);     // Step 4 · Hardcopy Submission
    if (stepBody.querySelector("#oscRoot")) initOscMeeting(index);      // Step 5 · OSC Meeting
    if (stepBody.querySelector("#cl6Root")) initClearance(index);       // Step 6 · Clearance (Ext & Int Depts)
    // Step 1 · 1.1 base plan date comes from upstream (Product Planning), so
    // it is per-project data, not markup — and it is step 1's actual start.
    const basePlanEl = stepBody.querySelector("[data-base-plan]");
    if (basePlanEl) {
      const bp = activeSteps[index] && activeSteps[index].basePlanDate;
      const d = toDate(bp);
      basePlanEl.textContent = d ? fmtSeedDate(d) : "—";
    }
    // Steps 7 (KM) and 8 (BP) run the SAME endorsement module — identical
    // workflow, different wording. State is per step (activeSteps[i].endorse),
    // so the two never share data.
    if (stepBody.querySelector("#endorseRoot")) initEndorseApproval(index);
    if (stepBody.querySelector("#ap11Root")) initAp11Approval(index);   // Step 11 · AP Approval
  }

  /* ---------- Step form: gating + confirm / cancel ----------
     Conventions used by content partials:
       <input ... data-required>            required field(s)
       <div class="sd-actions" data-gated hidden> … </div>
       <button data-action="confirm"> / <button data-action="cancel">
     Confirm/Cancel stay hidden until every data-required field is filled. */
  function requiredFieldsFilled() {
    const fields = stepBody.querySelectorAll("[data-required]");
    if (!fields.length) return false;
    for (let i = 0; i < fields.length; i++) {
      if (!String(fields[i].value || "").trim()) return false;
    }
    return true;
  }

  function updateStepFormState() {
    const gated = stepBody.querySelector(".sd-actions[data-gated]");
    if (gated) gated.hidden = !requiredFieldsFilled();
  }

  function handleFieldInput() {
    // Filling an untouched step moves it to "in-progress".
    const step = activeSteps[selectedStepIndex];
    if (step && step.status === "upcoming") {
      setStepStatus(selectedStepIndex, "in-progress");
    }
    updateStepFormState();
  }

  function handleConfirm() {
    const i = selectedStepIndex;
    if (i < 0) return;
    saveStepValues(i);                      // persist the entered date(s)
    if (activeSteps[i]) activeSteps[i].confirmedAt = new Date().toISOString();  // stamp
    setStepStatus(i, "completed");          // this step -> green
    if (i + 1 < STEP_NAMES.length) {
      selectStep(i + 1, { scrollToStep: false });   // advance without yanking the page back up to the timeline
    }
  }

  function handleCancel() {
    const i = selectedStepIndex;
    // Clear the step's inputs...
    stepBody.querySelectorAll("input, textarea").forEach(function (f) { f.value = ""; });
    stepBody.querySelectorAll("select").forEach(function (f) { f.selectedIndex = 0; });
    // ...drop any saved values / stamp and reset it back to "upcoming".
    if (i >= 0) {
      if (activeSteps[i]) {
        activeSteps[i].values = null;
        activeSteps[i].confirmedAt = null;
      }
      setStepStatus(i, "upcoming");
    }
    updateStepFormState();                  // hides Confirm/Cancel again
    renderSavedStamp(i);                    // hides the stamp
  }

  function loadStepBody(index) {
    const url = stepFileUrl(index);

    // Serve from cache when available.
    if (Object.prototype.hasOwnProperty.call(partialCache, url)) {
      injectStepBody(index, partialCache[url]);
      return;
    }

    stepBody.innerHTML = '<p class="sd-loading">Loading…</p>';

    // no-store: always fetch fresh so edits to content/*.html show up on reload.
    // (Within a session, partialCache above still prevents re-fetching.)
    fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (html) {
        partialCache[url] = html;
        // Guard against out-of-order responses if the user clicks quickly.
        if (selectedStepIndex === index) injectStepBody(index, html);
      })
      .catch(function () {
        stepBody.innerHTML =
          '<p class="sd-error">Couldn\'t load content for this step (' + esc(url) + ').<br>' +
          "If you opened the file directly (file://), serve it over http:// — e.g. VS Code Live Server " +
          "or <code>python -m http.server</code> — so fetch() is allowed.</p>";
      });
  }

  /* ---------- Timeline click / keyboard (event delegation) ---------- */
  function stepIndexFromNode(node) {
    const stepEl = node.closest(".step");
    return Array.prototype.indexOf.call(phTimelineEl.children, stepEl);
  }

  phTimelineEl.addEventListener("click", function (e) {
    const node = e.target.closest(".step-node");
    if (!node) return;
    selectStep(stepIndexFromNode(node));
  });

  phTimelineEl.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const node = e.target.closest(".step-node");
    if (!node) return;
    e.preventDefault();
    selectStep(stepIndexFromNode(node));
  });

  /* ---------- Timeline collapse / expand ---------- */
  timelineToggle.addEventListener("click", function () {
    timelineWrap.classList.toggle("collapsed");
  });

  /* ---------- Clicks inside a step body (event delegation) ----------
     One listener on the persistent #stepBody handles both:
       - folder tabs  (.step-tab / .step-tabpanel via data-tab / data-panel)
       - form actions (buttons with data-action="confirm|cancel")
     It survives re-injection of partial content. */
  stepBody.addEventListener("click", function (e) {
    // Form actions
    const actionBtn = e.target.closest("[data-action]");
    if (actionBtn) {
      const action = actionBtn.getAttribute("data-action");
      if (action === "confirm") handleConfirm();
      else if (action === "cancel") handleCancel();
      return;
    }

    // Folder tabs
    const tab = e.target.closest(".step-tab");
    if (!tab) return;
    const bar = tab.closest(".step-tabs");
    if (!bar) return;
    const key = tab.getAttribute("data-tab");

    bar.querySelectorAll(".step-tab").forEach(function (t) {
      t.classList.toggle("active", t === tab);
    });
    stepBody.querySelectorAll(".step-tabpanel").forEach(function (p) {
      p.classList.toggle("active", p.getAttribute("data-panel") === key);
    });
  });

  // Filling a field: mark step in-progress + re-evaluate Confirm/Cancel gating.
  stepBody.addEventListener("input", handleFieldInput);
  stepBody.addEventListener("change", handleFieldInput);

  /* ============================================================
     Quick project search (header)
     Flattens DATA into { region, businessUnit, project } entries
     so the user can jump straight to a project without walking
     the Region -> Business Unit -> Project cascade by hand.
  ============================================================ */
  const PROJECT_INDEX = [];
  Object.keys(DATA).forEach(function (region) {
    Object.keys(DATA[region]).forEach(function (businessUnit) {
      DATA[region][businessUnit].forEach(function (project) {
        PROJECT_INDEX.push({ region: region, businessUnit: businessUnit, project: project });
      });
    });
  });

  let searchMatches = [];
  let searchHighlight = -1;

  function highlightMatch(text, query) {
    const i = text.toLowerCase().indexOf(query.toLowerCase());
    if (i === -1) return esc(text);
    return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + query.length)) + "</mark>" + esc(text.slice(i + query.length));
  }

  function renderSearchResults(query) {
    searchResultsEl.innerHTML = "";
    searchHighlight = -1;

    if (!searchMatches.length) {
      searchResultsEl.innerHTML = '<li class="search-empty">No projects match "' + esc(query) + '"</li>';
      searchResultsEl.hidden = false;
      return;
    }

    searchMatches.forEach(function (entry, i) {
      const li = document.createElement("li");
      li.className = "search-result";
      li.setAttribute("role", "option");
      li.dataset.index = i;
      li.innerHTML =
        '<div class="sr-name">' + highlightMatch(entry.project, query) + "</div>" +
        '<div class="sr-path">' + esc(entry.region) + " ▸ " + esc(entry.businessUnit) + "</div>";
      searchResultsEl.appendChild(li);
    });
    searchResultsEl.hidden = false;
  }

  function setSearchHighlight(i) {
    const items = searchResultsEl.querySelectorAll(".search-result");
    searchHighlight = i;
    items.forEach(function (el, idx) {
      el.classList.toggle("highlighted", idx === i);
    });
    if (items[i]) items[i].scrollIntoView({ block: "nearest" });
  }

  function closeSearchResults() {
    searchResultsEl.hidden = true;
    searchResultsEl.innerHTML = "";
    searchMatches = [];
    searchHighlight = -1;
  }

  // Drives Region -> Business Unit -> Project exactly as if the user
  // had picked each dropdown by hand, then opens the project header.
  function selectProjectFromSearch(entry) {
    regionSelect.value = entry.region;
    onRegionChange();

    buSelect.value = entry.businessUnit;
    onBusinessUnitChange();

    projectSelect.value = entry.project;
    onProjectChange();

    projectSearch.value = entry.project;
    closeSearchResults();
    stepDetail.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  projectSearch.addEventListener("input", function () {
    const query = projectSearch.value.trim();
    if (!query) { closeSearchResults(); return; }

    searchMatches = PROJECT_INDEX.filter(function (entry) {
      return entry.project.toLowerCase().includes(query.toLowerCase());
    });
    renderSearchResults(query);
  });

  projectSearch.addEventListener("keydown", function (e) {
    if (searchResultsEl.hidden) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closeSearchResults();
      return;
    }
    if (!searchMatches.length) return;   // "no results" open: only Escape applies

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSearchHighlight(Math.min(searchHighlight + 1, searchMatches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSearchHighlight(Math.max(searchHighlight - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = searchMatches[searchHighlight >= 0 ? searchHighlight : 0];
      if (pick) selectProjectFromSearch(pick);
    }
  });

  searchResultsEl.addEventListener("click", function (e) {
    const li = e.target.closest(".search-result");
    if (!li || li.dataset.index == null) return;
    selectProjectFromSearch(searchMatches[Number(li.dataset.index)]);
  });

  projectSearch.addEventListener("focus", function () {
    if (projectSearch.value.trim() && searchMatches.length) searchResultsEl.hidden = false;
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".nav-search")) closeSearchResults();
  });

  /* ============================================================
     Step 2 · Pre-Consultation agency workflow
     ------------------------------------------------------------
     State lives on the step (step.pc), seeded from the project's BU
     agency template on first view (agencyBoardSeed), so each project
     tracks its own agency progress and it survives navigating
     between steps/projects in the session.
  ============================================================ */
  // Real file picker shared by every upload control in this workflow
  // (question b's doc, the meeting note, each submission round). Opens
  // the OS file chooser and reads back the actual selected filename —
  // no file is stored anywhere, this is a static front-end demo.
  const pcFileInput = document.createElement("input");
  pcFileInput.type = "file";
  pcFileInput.hidden = true;
  document.body.appendChild(pcFileInput);

  let pcUploadTarget = null;   // { stepIndex, apply(fileName) } set right before opening the picker

  function triggerPcUpload(stepIndex, apply) {
    pcUploadTarget = { stepIndex: stepIndex, apply: apply };
    pcFileInput.value = "";     // allows re-selecting the same file twice in a row
    pcFileInput.click();
  }

  pcFileInput.addEventListener("change", function () {
    const file = pcFileInput.files[0];
    const target = pcUploadTarget;
    pcUploadTarget = null;
    if (!file || !target) return;
    // Guard: ignore if the user has navigated to a different step meanwhile.
    if (target.stepIndex !== selectedStepIndex) return;
    target.apply(file.name);
    renderPreConsult(target.stepIndex);
  });

  const AGENCY_STATUS = {
    "not-started": { label: "Not Started",  cls: "st-not-started" },
    "in-progress": { label: "In Progress",  cls: "st-in-progress" },
    "completed":   { label: "Completed",    cls: "st-completed" },
    "delayed":     { label: "Delayed",      cls: "st-delayed" },
    "na":          { label: "N/A",          cls: "st-na" }
  };

  /* ---------- The date overlay on an agency board ----------
     Same rules as the dashboard and the step liner, applied per agency:
       past target end          -> Delayed  (red)
       target end ≤ 1 week away -> Alarming (orange)
       finished after target    -> its own colour, red edge
     These are DATE states, not stored ones, so they overlay whatever the
     agency's own status says rather than being more values something has
     to remember to set. One rule, both boards, both surfaces. */
  const AG_ALARMING = { label: "Alarming", cls: "st-alarming" };
  const AG_DELAYED  = { label: "Delayed",  cls: "st-delayed" };
  const AG_DONE = { completed: 1, approved: 1 };

  // When an agency actually finished. Step 6 stamps `approvedAt`; Step 2 has
  // no such field, so its finish is the decision on the round that was
  // accepted. No record either way -> no claim that it was late.
  function agDoneAt(a) {
    if (a.approvedAt) return toDate(a.approvedAt);
    const rounds = a.rounds || [];
    for (let i = rounds.length - 1; i >= 0; i--) {
      if (rounds[i].outcome === "accepted") return toDate(rounds[i].decidedAt);
    }
    return null;
  }

  // Step 6 has two target ends. Pass `kind` when the surface shows ONE branch
  // (the dashboard's KM and BP matrices) — it judges that branch alone, so a
  // both-sides agency can be at risk on KM while its BP side is still calm.
  // Without `kind` (Step 6's combined chip board) an agency takes the nearest
  // deadline of the sides it actually affects — BOMBA is BP-only and must not
  // read its deadline off the KM branch.
  function agTargetEnd(index, a, kind) {
    const step = activeSteps[index];
    if (!step) return null;
    if (index !== 5 || !step.bp) return toDate(step.te);
    if (kind) return toDate(kind === "bp" ? step.bp.te : step.te);
    const ends = [];
    if (agAffectsKind(a, "km")) ends.push(step.te);
    if (agAffectsKind(a, "bp")) ends.push(step.bp.te);
    return earliestOf(ends);
  }

  // "" | "delayed" | "alarming" | "late". N/A is excluded — an agency that
  // does not apply cannot be behind on anything.
  function agDateState(index, a, status, kind) {
    if (!a || a.applicable === false) return "";
    const te = agTargetEnd(index, a, kind);
    if (!te) return "";
    if (AG_DONE[status]) {
      const done = agDoneAt(a);
      return (done && done > te) ? "late" : "";
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (today > te) return "delayed";
    const wk = new Date(te); wk.setDate(wk.getDate() - 7);
    return today >= wk ? "alarming" : "";
  }

  // Chip / pill styling for one agency, date overlay applied.
  function agStatusMeta(index, a, status, map, kind) {
    const ds = agDateState(index, a, status, kind);
    if (ds === "delayed") return AG_DELAYED;
    if (ds === "alarming") return AG_ALARMING;
    const base = map[status] || map["not-started"];
    // Finished, but after the target: keep the colour, add the red edge —
    // the chip equivalent of the dashboard node's green fill + red ring.
    return ds === "late" ? { label: base.label, cls: base.cls + " ag-late" } : base;
  }

  function pcState(index) { return activeSteps[index] && activeSteps[index].pc; }

  // A sensible starting submission history for an agency, derived from its status.
  function defaultRoundsFor(status) {
    if (status === "completed") {
      return [{ key: "R0", file: "Drawing_R0.pdf", submitted: "—", outcome: "accepted", decidedAt: "—", comment: "" }];
    }
    if (status === "delayed") {
      return [
        { key: "R0", file: "Drawing_R0.pdf", submitted: "—", outcome: "rejected", decidedAt: "—", comment: "Revisions requested by the authority." },
        { key: "R1", file: null, submitted: "", outcome: "pending", decidedAt: "", comment: "" }
      ];
    }
    if (status === "na") return [];
    if (status === "not-started") {
      return [{ key: "R0", file: null, submitted: "", outcome: "pending", decidedAt: "", comment: "" }];
    }
    // in-progress fallback (JKB is seeded explicitly)
    return [{ key: "R0", file: "Drawing_R0.pdf", submitted: "—", outcome: "pending", decidedAt: "", comment: "" }];
  }

  // Each agency owns its entire right-panel body content independently:
  // its own pre-consultation date, uploaded docs, meeting notes, review
  // date, submission rounds, and send stamps. Switching the active
  // authority swaps in that agency's own state — nothing is shared.
  function initPreConsult(index) {
    const step = activeSteps[index];
    if (!step) return;
    if (!step.pc) step.pc = agencyBoardSeed();   // per-step clone of the BU template
    step.pc.internal.concat(step.pc.external).forEach(function (a) {
      if (!a.rounds) a.rounds = defaultRoundsFor(a.status);
      if (a.preDate == null) a.preDate = "";
      if (a.reviewDate == null) a.reviewDate = "";
      if (!a.preDoc) a.preDoc = { file: null, uploadedAt: null };
      if (!a.meetingNote) a.meetingNote = { file: null, uploadedAt: null };
      if (!a.sends) a.sends = { preDate: null, preDoc: null, meetingNote: null, reviewDate: null };
      if (a.requirePreDoc == null) a.requirePreDoc = false;   // question 2.2 starts hidden until ticked
      if (a.applicable == null) a.applicable = true;          // agency-settings toggle
    });
    renderPreConsult(index);
  }

  function agencyByCode(pc, code) {
    return pc.internal.concat(pc.external).find(function (a) { return a.code === code; });
  }

  function renderAgencyChips(listEl, agencies, activeCode, index) {
    listEl.innerHTML = agencies.map(function (a) {
      const meta = !a.applicable ? AGENCY_STATUS["na"] : agStatusMeta(index, a, a.status, AGENCY_STATUS);
      const mark = !a.applicable || a.status !== "completed" ? "" : " ✓";
      const active = a.code === activeCode ? " selected" : "";
      return '<button type="button" class="agency-chip ' + meta.cls + active + '" ' +
             'data-agency="' + a.code + '" title="' + esc(meta.label) + '">' +
             esc(a.code) + mark + "</button>";
    }).join("");
  }

  function renderRounds(agency) {
    const wrap = stepBody.querySelector("#pcRounds");
    if (!wrap) return;
    const rounds = (agency && agency.rounds) || [];

    if (!rounds.length) {
      wrap.innerHTML = '<div class="pc-hint">No submission required for this agency.</div>';
      return;
    }

    wrap.innerHTML = rounds.map(function (r, i) {
      const isLast = i === rounds.length - 1;
      let body = "";

      if (!r.file) {
        // Nothing attached yet.
        body += '<button type="button" class="upload-btn" data-pc-upload="' + i + '">' + UPLOAD_SVG + "Upload Document</button>";
      } else if (!r.submitted) {
        // Attached but not yet sent: file chip + remove (can swap the file) + submit icon.
        body += '<div class="pc-inline"><span class="file-chip">' + DOC_SVG + esc(r.file) +
          '<button type="button" class="chip-del" data-pc-round-remove="' + i + '" aria-label="Remove">' + TRASH_SVG + "</button></span>" +
          '<button type="button" class="send-btn" data-pc-round-send="' + i + '" aria-label="Send">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>' +
          "</button></div>";
      } else {
        // Sent: file chip + "System submitted <time>" + any PPD decision.
        body += '<div class="pc-inline"><span class="file-chip">' + DOC_SVG + esc(r.file) + "</span>" +
          stampHtml("System submitted", formatDateTime(r.submitted)) + "</div>";
        if (r.outcome === "rejected") body += '<div class="round-meta rejected">Rejected ' + esc(r.decidedAt) + "</div>";
        if (r.outcome === "accepted") body += '<div class="round-meta accepted">Accepted ' + esc(r.decidedAt) + "</div>";
      }

      // Rejected rounds show the PPD comment read-only
      if (r.outcome === "rejected" && r.comment) {
        body += '<div class="ppd-box"><div class="ppd-box-title">PPD Comment</div>' +
          '<div class="ppd-text">' + esc(r.comment) + "</div></div>";
      }

      // The latest round, once sent & awaiting a decision, gets the PPD decision box
      if (isLast && r.submitted && r.outcome === "pending") {
        body += '<div class="ppd-box"><div class="ppd-box-title">PPD Comment</div>' +
          '<textarea data-pc-comment placeholder="Provide details on why the submission was accepted or rejected…"></textarea>' +
          '<div class="ppd-actions">' +
          '<button type="button" class="btn btn-sm btn-reject" data-pc-decide="reject">✕ Reject</button>' +
          '<button type="button" class="btn btn-sm btn-accept" data-pc-decide="accept">✓ Accept</button>' +
          "</div></div>";
      }

      return '<div class="round-row"><div class="round-key">' + esc(r.key) + "</div>" +
             '<div class="round-body">' + body + "</div></div>";
    }).join("");
  }

  // A file slot (question b's doc, or the meeting note): an upload
  // button when empty, a file chip (+ remove) once attached, and once
  // Sent, the remove button disappears — a sent file can no longer be
  // deleted, only swapped by attaching a new one via a fresh upload.
  function renderDocSlot(agency, field) {
    const doc = agency[field] || { file: null, uploadedAt: null };
    if (doc.file) {
      const sent = !!(agency.sends && agency.sends[field]);
      const removeBtn = sent ? "" :
        '<button type="button" class="chip-del" data-pc-doc-remove="' + field + '" aria-label="Remove">' + TRASH_SVG + "</button>";
      return '<span class="file-chip">' + DOC_SVG + esc(doc.file) + removeBtn + "</span>";
    }
    return '<button type="button" class="upload-btn" data-pc-doc-upload="' + field + '">' +
      UPLOAD_SVG + "Upload Document</button>";
  }

  function renderPreConsult(index) {
    const pc = pcState(index);
    if (!pc) return;

    renderAgencyChips(stepBody.querySelector("#pcInternal"), pc.internal, pc.activeAuthority, index);
    renderAgencyChips(stepBody.querySelector("#pcExternal"), pc.external, pc.activeAuthority, index);

    stepBody.querySelector("#pcAuthority").textContent = pc.activeAuthority;
    const active = agencyByCode(pc, pc.activeAuthority);
    const naActive = !!(active && !active.applicable);
    const meta = naActive ? AGENCY_STATUS["na"] : agStatusMeta(index, active, (active && active.status) || "not-started", AGENCY_STATUS);
    const pill = stepBody.querySelector("#pcStatusPill");
    pill.textContent = meta.label;
    pill.className = "st-chip " + meta.cls;

    // Not Applicable: dim + disable this agency's workflow, show a note.
    const pcMain = stepBody.querySelector("#pcRoot .pc-main");
    if (pcMain) pcMain.classList.toggle("pc-na-dim", naActive);
    const pcNote = stepBody.querySelector("[data-pc-na-note]");
    if (pcNote) pcNote.hidden = !naActive;

    // This agency's own answers for questions 2.1, 2.2, 2.4. Question 2.1's date
    // locks once sent — a system-submitted date is a fixed record, same
    // as an uploaded-and-sent file losing its remove button.
    const preDateInput = stepBody.querySelector('[data-pc-field="preDate"]');
    preDateInput.value = (active && active.preDate) || "";
    preDateInput.disabled = !!(active && active.sends && active.sends.preDate);
    const reviewDateInput = stepBody.querySelector('[data-pc-field="reviewDate"]');
    reviewDateInput.value = (active && active.reviewDate) || "";
    reviewDateInput.disabled = !!(active && active.sends && active.sends.reviewDate);

    // Question 2.2's upload only appears once "Require" is ticked for this agency.
    const requireBox = stepBody.querySelector('[data-pc-require="preDoc"]');
    requireBox.checked = !!(active && active.requirePreDoc);
    stepBody.querySelector('[data-pc-requireable]').hidden = !requireBox.checked;

    stepBody.querySelector('[data-pc-doc="preDoc"]').innerHTML = renderDocSlot(active, "preDoc");
    stepBody.querySelector('[data-pc-doc="meetingNote"]').innerHTML = renderDocSlot(active, "meetingNote");

    renderRounds(active);
    renderSendStamps(index);
    renderTabDots(index);
  }

  const PC_DOC_FIELDS = ["preDoc", "meetingNote"];   // agency fields that hold { file, uploadedAt }

  // Send controls: reveal the send button once this agency's own
  // answer is filled in; once sent, show "System submitted <date & time>".
  function renderSendStamps(index) {
    const pc = pcState(index);
    const active = pc && agencyByCode(pc, pc.activeAuthority);
    if (!active) return;

    stepBody.querySelectorAll("[data-send-group]").forEach(function (group) {
      const key = group.getAttribute("data-send-group");   // "preDate" | "preDoc" | "meetingNote"
      const sendBtn = group.querySelector("[data-send]");
      const stamp = group.querySelector("[data-send-stamp]");
      const filled = PC_DOC_FIELDS.indexOf(key) !== -1 ? !!(active[key] && active[key].file) : !!active[key];

      if (active.sends[key]) {
        if (sendBtn) sendBtn.hidden = true;
        stamp.innerHTML = stampInner("System submitted", formatDateTime(active.sends[key]));
        stamp.hidden = false;
      } else {
        if (sendBtn) sendBtn.hidden = !filled;
        stamp.hidden = true;
      }
    });
  }

  /* ---------- Step 2 tab status + completion ----------
     Every tab carries its own status dot:
       Pre-Consultation        : every applicable agency completed.
       Upload (General)        : every listed item has a sent (saved) file.
       KM / BP Checklist       : every authority/agency item has a sent (saved) file.
     Step 2 becomes In Progress on any send, and Completed only once all
     four tabs are Completed — then it advances to Step 3. */
  const STEP2_TABS = ["pre", "general", "km", "bp"];
  const TAB_DOT_CLASS = { "not-started": "", "in-progress": "dot-in-progress", "completed": "dot-completed" };
  const TAB_STATUS_TITLE = { "not-started": "Not Started", "in-progress": "In Progress", "completed": "Completed" };

  function preTabStatus(pc) {
    if (!pc) return "not-started";
    const all = pc.internal.concat(pc.external).filter(function (a) { return a.applicable; });
    const applicable = all.filter(function (a) { return a.status !== "na"; });
    if (applicable.length && applicable.every(function (a) { return a.status === "completed"; })) return "completed";
    if (all.some(function (a) { return a.status !== "not-started" && a.status !== "na"; })) return "in-progress";
    return "not-started";
  }

  function docsTabStatus(docs) {
    if (!docs || !docs.length) return "not-started";
    const anyActivity = docs.some(function (d) { return (d.saved && d.saved.length) || (d.pending && d.pending.length) || d.draft; });
    const allSent = docs.every(function (d) { return !d.draft && d.saved && d.saved.length > 0 && (!d.pending || d.pending.length === 0); });
    if (allSent) return "completed";
    if (anyActivity) return "in-progress";
    return "not-started";
  }

  // Upload (KM/BP Checklist): In Progress once any document has been sent,
  // Completed once every authority/agency document has been sent. Shared
  // by both the km and bp tabs — same seed, same shape, independent state.
  // Codes marked Not Applicable on the Pre-Consultation board — used to
  // grey + exclude the matching rows in the KM/BP checklist tabs.
  function pcNaCodeSet(step) {
    const set = {};
    const pc = step && step.pc;
    if (pc) pc.internal.concat(pc.external).forEach(function (a) { if (!a.applicable) set[a.code] = true; });
    return set;
  }

  function checklistTabStatus(kc, naSet) {
    if (!kc) return "not-started";
    naSet = naSet || {};
    let total = 0, sent = 0, anyActivity = false;
    kc.forEach(function (section) {
      section.items.forEach(function (item) {
        if (naSet[item.code]) return;   // N/A rows don't count toward completion
        total++;
        if (item.saved.length) sent++;
        if (item.saved.length || item.pending.length) anyActivity = true;
      });
    });
    if (!total) return "not-started";
    if (sent === total) return "completed";
    if (anyActivity) return "in-progress";
    return "not-started";
  }

  function computeTabStatuses(index) {
    const step = activeSteps[index] || {};
    const naSet = pcNaCodeSet(step);
    return {
      pre: preTabStatus(step.pc),
      general: docsTabStatus(step.generalDocs),
      km: checklistTabStatus(step.kmChecklist, naSet),
      bp: checklistTabStatus(step.bpChecklist, naSet)
    };
  }

  function renderTabDots(index) {
    const statuses = computeTabStatuses(index);
    STEP2_TABS.forEach(function (t) {
      const dot = stepBody.querySelector('[data-tab-dot="' + t + '"]');
      if (!dot) return;
      dot.className = "tab-dot " + (TAB_DOT_CLASS[statuses[t]] || "");
      dot.title = TAB_STATUS_TITLE[statuses[t]];
    });
    return statuses;
  }

  // Refresh dots; complete + advance Step 2 when all four tabs are done,
  // otherwise flag it In Progress if there's any activity.
  function recomputeStep2(index) {
    const step = activeSteps[index];
    if (!step) return;
    const statuses = renderTabDots(index);
    const allDone = STEP2_TABS.every(function (t) { return statuses[t] === "completed"; });
    if (allDone && step.status !== "completed") {
      setStepStatus(index, "completed");
      if (index + 1 < STEP_NAMES.length) selectStep(index + 1, { scrollToStep: false });
    } else if (!allDone) {
      const anyActivity = STEP2_TABS.some(function (t) { return statuses[t] !== "not-started"; });
      if (anyActivity && step.status === "upcoming") setStepStatus(index, "in-progress");
    }
  }

  // Called on any "send" in Step 2.
  function markStep2Sent(index) {
    const step = activeSteps[index];
    if (step && step.status === "upcoming") setStepStatus(index, "in-progress");
    recomputeStep2(index);
  }

  /* ---------- Pre-Consultation events (delegated on #stepBody) ---------- */
  stepBody.addEventListener("click", function (e) {
    const root = e.target.closest("#pcRoot");
    if (!root) return;
    const index = selectedStepIndex;
    const pc = pcState(index);
    if (!pc) return;

    // Gear -> agency settings popover (also greys matching KM/BP rows).
    const gear = e.target.closest("[data-pc-settings]");
    if (gear) {
      openAgencyPopover(gear, [
        { title: "Internal Agency", items: pc.internal },
        { title: "External Agency", items: pc.external }
      ], function (map) {
        pc.internal.concat(pc.external).forEach(function (a) {
          if (Object.prototype.hasOwnProperty.call(map, a.code)) a.applicable = map[a.code];
        });
        renderPreConsult(index);
        renderChecklistTab(index, "kmChecklist");
        renderChecklistTab(index, "bpChecklist");
      });
      return;
    }

    // Select an agency as the active authority
    const chip = e.target.closest(".agency-chip");
    if (chip) {
      pc.activeAuthority = chip.getAttribute("data-agency");
      renderPreConsult(index);
      return;
    }

    const active = agencyByCode(pc, pc.activeAuthority);
    if (!active) return;
    if (!active.rounds) active.rounds = [];

    // Send a field -> stamp "System submitted <now>" on THIS agency;
    // submitting anything moves it out of "Not Started" into "In Progress".
    const sendBtn = e.target.closest("[data-send]");
    if (sendBtn) {
      const key = sendBtn.closest("[data-send-group]").getAttribute("data-send-group");
      active.sends[key] = new Date().toISOString();
      if (active.status === "not-started") active.status = "in-progress";
      renderPreConsult(index);
      markStep2Sent(index);
      return;
    }

    // Upload question 2.2's doc, or the meeting note — opens the real file picker.
    const docUpload = e.target.closest("[data-pc-doc-upload]");
    if (docUpload) {
      const field = docUpload.getAttribute("data-pc-doc-upload");
      triggerPcUpload(index, function (fileName) {
        active[field] = { file: fileName, uploadedAt: formatDateTime(new Date()) };
      });
      return;
    }

    // Remove an uploaded doc — also clears its "sent" stamp so it can be resent.
    const docRemove = e.target.closest("[data-pc-doc-remove]");
    if (docRemove) {
      const field = docRemove.getAttribute("data-pc-doc-remove");
      active[field] = { file: null, uploadedAt: null };
      if (field === "preDoc") active.sends.preDoc = null;
      renderPreConsult(index);
      return;
    }

    // Attach a document for a round — opens the real file picker. Not yet
    // "sent"; the round shows a submit icon until data-pc-round-send is clicked.
    const upBtn = e.target.closest("[data-pc-upload]");
    if (upBtn) {
      const roundIndex = Number(upBtn.getAttribute("data-pc-upload"));
      triggerPcUpload(index, function (fileName) {
        const r = active.rounds[roundIndex];
        r.file = fileName;
        r.submitted = "";
        r.outcome = "pending";
      });
      return;
    }

    // Remove an attached-but-not-yet-sent round file (lets the user swap it).
    const roundRemove = e.target.closest("[data-pc-round-remove]");
    if (roundRemove) {
      const r = active.rounds[Number(roundRemove.getAttribute("data-pc-round-remove"))];
      r.file = null;
      renderPreConsult(index);
      return;
    }

    // Submit an attached round file -> "System submitted <now>".
    const roundSend = e.target.closest("[data-pc-round-send]");
    if (roundSend) {
      const r = active.rounds[Number(roundSend.getAttribute("data-pc-round-send"))];
      r.submitted = formatDateTime(new Date());
      if (active.status === "not-started") active.status = "in-progress";
      renderPreConsult(index);
      markStep2Sent(index);
      return;
    }

    // PPD accept / reject on the latest round
    const decideBtn = e.target.closest("[data-pc-decide]");
    if (decideBtn) {
      const decision = decideBtn.getAttribute("data-pc-decide");
      const commentEl = root.querySelector("[data-pc-comment]");
      const comment = commentEl ? commentEl.value.trim() : "";
      const round = active.rounds[active.rounds.length - 1];

      round.comment = comment;
      round.decidedAt = formatDateTime(new Date());

      if (decision === "accept") {
        round.outcome = "accepted";
        active.status = "completed";
        renderPreConsult(index);
        recomputeStep2(index);             // pre tab may now be done -> maybe advance Step 2
      } else {
        round.outcome = "rejected";
        active.status = "in-progress";
        const n = active.rounds.length;                    // next round number
        active.rounds.push({ key: "R" + n, file: null, submitted: "", outcome: "pending", decidedAt: "", comment: "" });
        renderPreConsult(index);
        markStep2Sent(index);
      }
    }
  });

  // Typing into a per-agency field (question 2.1's date, question 2.4's
  // review date): save it onto the ACTIVE agency only, and re-evaluate
  // send-button visibility without a full re-render (keeps focus/caret).
  stepBody.addEventListener("input", function (e) {
    const field = e.target.closest("#pcRoot") && e.target.getAttribute("data-pc-field");
    if (!field) return;
    const pc = pcState(selectedStepIndex);
    const active = pc && agencyByCode(pc, pc.activeAuthority);
    if (!active) return;
    active[field] = e.target.value;
    renderSendStamps(selectedStepIndex);
  });

  // Question 2.2's "Require" checkbox: toggling it shows/hides that
  // agency's upload block, and persists per agency like everything else.
  stepBody.addEventListener("change", function (e) {
    const requireKey = e.target.closest("#pcRoot") && e.target.getAttribute("data-pc-require");
    if (requireKey) {
      const index = selectedStepIndex;
      const pc = pcState(index);
      const active = pc && agencyByCode(pc, pc.activeAuthority);
      if (!active) return;
      active.requirePreDoc = e.target.checked;
      renderPreConsult(index);
    }
  });

  /* ============================================================
     Step 2 · Upload (General) document grid
     ------------------------------------------------------------
     Per-step state (step.generalDocs), cloned from GENERAL_DOCS_SEED.
     Each item: { title, desc, custom, pending:[name], saved:[{name,savedAt}] }.
     Uploading (button OR drag-drop) adds names to `pending`; Send moves
     every pending file into `saved` with a system timestamp.
  ============================================================ */

  // a, b, … z, aa, ab … for item letters.
  function letterLabel(i) {
    let s = "";
    i += 1;
    while (i > 0) { i -= 1; s = String.fromCharCode(97 + (i % 26)) + s; i = Math.floor(i / 26); }
    return s;
  }

  function initGeneralDocs(index) {
    const step = activeSteps[index];
    if (!step) return;
    if (!step.generalDocs) {
      step.generalDocs = GENERAL_DOCS_SEED.map(function (d) {
        return { title: d.title, desc: d.desc || "", pending: (d.pending || []).slice(), saved: [] };
      });
    }
    renderGeneralDocs(index);   // also refreshes tab dots
  }

  // `letter` is "" for a draft (unconfirmed) item — drafts don't consume
  // a letter, so confirmed items always read a, b, c … in order.
  function genItemHtml(d, i, letter) {
    const isDraft = !!d.draft;

    // Left label: editable inputs while draft, static "x. Title" once confirmed.
    const labelInner = isDraft
      ? '<input class="gen-title-input" data-gen-title="' + i + '" value="' + esc(d.title) + '" placeholder="Document name">' +
        '<input class="gen-desc-input" data-gen-desc="' + i + '" value="' + esc(d.desc) + '" placeholder="Description (optional)">'
      : '<div class="gen-item-title"><span class="gen-letter">' + esc(letter) + ".</span> " + esc(d.title) + "</div>" +
        (d.desc ? '<div class="gen-item-desc">' + esc(d.desc) + "</div>" : "");

    // Saved files use their own merged green bar (icon + filename + timestamp
    // in one pill). Pending files reuse Pre-Consultation's .file-chip + .chip-del.
    const savedHtml = d.saved.map(function (s) {
      return '<div class="gen-saved-row">' + DOC_SVG.replace("<svg", '<svg class="doc-ic"') +
        '<span class="gen-name">' + esc(s.name) + "</span>" +
        '<span class="gen-saved-time">System submitted ' + esc(formatDateTime(s.savedAt)) + "</span></div>";
    }).join("");

    const pendingHtml = d.pending.map(function (name, pi) {
      return '<div class="gen-pending-chip">' + DOC_SVG.replace("<svg", '<svg class="doc-ic"') +
        '<span class="gen-name">' + esc(name) + "</span>" +
        '<button type="button" class="gen-remove" data-gen-remove="' + i + ":" + pi + '" aria-label="Remove">' + CLOSE_SVG + "</button></div>";
    }).join("");

    // Draft items get confirm (✓) / delete (✗); the send icon only shows once
    // a document has been uploaded (pending) and disappears again after sending.
    const draftBtns = isDraft
      ? '<button type="button" class="gen-mini-btn gen-confirm-btn" data-gen-confirm="' + i + '" aria-label="Confirm">' + CHECK_SVG + "</button>" +
        '<button type="button" class="gen-mini-btn gen-delete-btn" data-gen-delete="' + i + '" aria-label="Delete">' + CLOSE_SVG + "</button>"
      : "";
    const sendHtml = d.pending.length
      ? '<button type="button" class="send-btn" data-gen-send="' + i + '" aria-label="Send">' + SEND_SVG + "</button>"
      : "";
    const files = (savedHtml + pendingHtml) ? '<div class="gen-files">' + savedHtml + pendingHtml + "</div>" : "";

    return '<div class="gen-item" data-gen="' + i + '">' +
      '<div class="gen-item-body">' +
        '<div class="gen-item-label">' + labelInner + "</div>" +
        '<div class="gen-item-right">' +
          '<div class="gen-item-actions">' +
            draftBtns +
            '<button type="button" class="gen-upload-btn" data-gen-upload="' + i + '">' + UPLOAD_SVG + "Upload Document</button>" +
            sendHtml +
          "</div>" +
          files +
        "</div>" +
      "</div></div>";
  }

  function renderGeneralDocs(index) {
    const step = activeSteps[index];
    const wrap = stepBody.querySelector("#genDocs");
    if (!wrap || !step || !step.generalDocs) return;
    let letterIdx = 0;
    wrap.innerHTML = step.generalDocs.map(function (d, i) {
      const letter = d.draft ? "" : letterLabel(letterIdx++);   // confirmed items number continuously
      return genItemHtml(d, i, letter);
    }).join("");
    renderTabDots(index);
  }

  function addPendingFiles(docIndex, names) {
    const step = activeSteps[selectedStepIndex];
    const doc = step && step.generalDocs && step.generalDocs[docIndex];
    if (!doc || !names.length) return;
    names.forEach(function (n) { doc.pending.push(n); });
    renderGeneralDocs(selectedStepIndex);
  }

  // Shared multi-file picker for the General tab uploads.
  const genFileInput = document.createElement("input");
  genFileInput.type = "file";
  genFileInput.multiple = true;
  genFileInput.hidden = true;
  document.body.appendChild(genFileInput);

  let genUploadTarget = null;   // { stepIndex, docIndex }

  genFileInput.addEventListener("change", function () {
    const files = Array.prototype.slice.call(genFileInput.files);
    const target = genUploadTarget;
    genUploadTarget = null;
    if (!files.length || !target || target.stepIndex !== selectedStepIndex) return;
    addPendingFiles(target.docIndex, files.map(function (f) { return f.name; }));
  });

  // Clicks inside the General tab (upload / send / remove / add-more).
  stepBody.addEventListener("click", function (e) {
    const addBtn = e.target.closest("[data-gen-add]");
    const inGrid = e.target.closest("#genDocs");
    if (!addBtn && !inGrid) return;

    const index = selectedStepIndex;
    const step = activeSteps[index];
    if (!step || !step.generalDocs) return;

    if (addBtn) {
      // New item starts as a draft (editable, with confirm ✓ / delete ✗).
      step.generalDocs.push({ title: "", desc: "", draft: true, pending: [], saved: [] });
      renderGeneralDocs(index);
      return;
    }

    // Confirm (✓) a draft: needs a name, then it joins the list with the next letter.
    const confirmBtn = e.target.closest("[data-gen-confirm]");
    if (confirmBtn) {
      const doc = step.generalDocs[Number(confirmBtn.getAttribute("data-gen-confirm"))];
      if (!String(doc.title || "").trim()) return;   // require a document name first
      doc.draft = false;
      renderGeneralDocs(index);
      return;
    }

    // Delete (✗) a draft: removes the item entirely.
    const deleteBtn = e.target.closest("[data-gen-delete]");
    if (deleteBtn) {
      step.generalDocs.splice(Number(deleteBtn.getAttribute("data-gen-delete")), 1);
      renderGeneralDocs(index);
      return;
    }

    const upload = e.target.closest("[data-gen-upload]");
    if (upload) {
      genUploadTarget = { stepIndex: index, docIndex: Number(upload.getAttribute("data-gen-upload")) };
      genFileInput.value = "";
      genFileInput.click();
      return;
    }

    const send = e.target.closest("[data-gen-send]");
    if (send) {
      const doc = step.generalDocs[Number(send.getAttribute("data-gen-send"))];
      if (!doc.pending.length) return;
      const now = new Date().toISOString();
      doc.pending.forEach(function (name) { doc.saved.push({ name: name, savedAt: now }); });
      doc.pending = [];
      renderGeneralDocs(index);
      markStep2Sent(index);
      return;
    }

    const remove = e.target.closest("[data-gen-remove]");
    if (remove) {
      const parts = remove.getAttribute("data-gen-remove").split(":");
      step.generalDocs[Number(parts[0])].pending.splice(Number(parts[1]), 1);
      renderGeneralDocs(index);
    }
  });

  // Live-edit a custom item's title/description (no re-render, keeps focus).
  stepBody.addEventListener("input", function (e) {
    const titleEl = e.target.closest("[data-gen-title]");
    const descEl = e.target.closest("[data-gen-desc]");
    const step = activeSteps[selectedStepIndex];
    if (!step || !step.generalDocs) return;
    if (titleEl) step.generalDocs[Number(titleEl.getAttribute("data-gen-title"))].title = titleEl.value;
    else if (descEl) step.generalDocs[Number(descEl.getAttribute("data-gen-desc"))].desc = descEl.value;
  });

  // Drag & drop a file onto an item card -> adds it to that item's pending files.
  stepBody.addEventListener("dragover", function (e) {
    const item = e.target.closest("#genDocs .gen-item");
    if (!item) return;
    e.preventDefault();
    item.classList.add("dragover");
  });
  stepBody.addEventListener("dragleave", function (e) {
    const item = e.target.closest("#genDocs .gen-item");
    if (item && !item.contains(e.relatedTarget)) item.classList.remove("dragover");
  });
  stepBody.addEventListener("drop", function (e) {
    const item = e.target.closest("#genDocs .gen-item");
    if (!item) return;
    e.preventDefault();
    item.classList.remove("dragover");
    const files = e.dataTransfer ? Array.prototype.slice.call(e.dataTransfer.files) : [];
    if (files.length) addPendingFiles(Number(item.getAttribute("data-gen")), files.map(function (f) { return f.name; }));
  });

  /* ============================================================
     Step 2 · Upload (KM Checklist) / Upload (BP Checklist)
     authority/agency grid
     ------------------------------------------------------------
     Both tabs share the same content (KM_CHECKLIST_SEED: three
     sections, 18 authorities/agencies) and the same behavior —
     only the per-step state field ("kmChecklist"/"bpChecklist")
     and DOM container ("#kmChecklist"/"#bpChecklist") differ, so
     progress on one tab is fully independent of the other.

     Per-step state: three sections, each item one authority/agency
     with its own { pending:[name], saved:[{name,savedAt}] } —
     mirrors Upload (General) exactly. Uploading (multi-file picker
     OR drag & drop anywhere on the card) adds names to `pending`;
     one Send flushes every pending file for that item into `saved`
     with a shared timestamp. Sending flips Step 2 to In Progress;
     the tab reaches Completed only once every item has at least
     one saved file.
  ============================================================ */
  const CHECKLIST_TABS = { kmChecklist: "kmChecklist", bpChecklist: "bpChecklist" };

  function initChecklistTab(index, field) {
    const step = activeSteps[index];
    if (!step) return;
    if (!step[field]) {
      step[field] = KM_CHECKLIST_SEED.map(function (section) {
        return {
          title: section.title,
          items: section.items.map(function (it) {
            return { code: it.code, desc: it.desc, pending: [], saved: [] };
          })
        };
      });
    }
    renderChecklistTab(index, field);
  }

  function initKmChecklist(index) { initChecklistTab(index, "kmChecklist"); }
  function initBpChecklist(index) { initChecklistTab(index, "bpChecklist"); }

  function checklistItemByPath(step, field, path) {
    const p = path.split(":");
    const section = step[field] && step[field][Number(p[0])];
    return section && section.items[Number(p[1])];
  }

  // A section's status badge: Completed once every item has a saved file,
  // In Progress once some activity exists, Upcoming otherwise.
  function checklistSectionStatus(section, naSet) {
    naSet = naSet || {};
    const items = (section.items || []).filter(function (i) { return !naSet[i.code]; });
    if (!items.length) return "upcoming";
    const allSaved = items.every(function (i) { return i.saved.length > 0; });
    if (allSaved) return "completed";
    const anyActivity = items.some(function (i) { return i.saved.length > 0 || i.pending.length > 0; });
    if (anyActivity) return "in-progress";
    return "upcoming";
  }

  // One card's file list + actions — same shape as Upload (General)'s items:
  // saved rows (green, timestamped) above pending chips (removable), a
  // multi-file Upload Document button, and one Send once anything is pending.
  function checklistItemHtml(item, path, na) {
    if (na) {
      return '<div class="km-card km-na" data-cl-card="' + path + '">' +
        '<div class="km-card-body"><div class="km-card-label">' +
          '<div class="km-code">' + esc(item.code) + "</div>" +
          '<div class="km-desc">' + esc(item.desc) + "</div>" +
        "</div>" +
        '<div class="km-card-right"><span class="st-chip st-na">N/A</span></div>' +
        "</div></div>";
    }
    const savedHtml = item.saved.map(function (s) {
      return '<div class="gen-saved-row">' + DOC_SVG.replace("<svg", '<svg class="doc-ic"') +
        '<span class="gen-name">' + esc(s.name) + "</span>" +
        '<span class="gen-saved-time">System submitted ' + esc(formatDateTime(s.savedAt)) + "</span></div>";
    }).join("");

    const pendingHtml = item.pending.map(function (name, pi) {
      return '<div class="gen-pending-chip">' + DOC_SVG.replace("<svg", '<svg class="doc-ic"') +
        '<span class="gen-name">' + esc(name) + "</span>" +
        '<button type="button" class="gen-remove" data-cl-remove="' + path + ":" + pi + '" aria-label="Remove">' + CLOSE_SVG + "</button></div>";
    }).join("");

    const sendHtml = item.pending.length
      ? '<button type="button" class="send-btn" data-cl-send="' + path + '" aria-label="Send">' + SEND_SVG + "</button>"
      : "";
    const files = (savedHtml + pendingHtml) ? '<div class="gen-files">' + savedHtml + pendingHtml + "</div>" : "";

    return '<div class="km-card" data-cl-card="' + path + '">' +
      '<div class="km-card-body">' +
        '<div class="km-card-label">' +
          '<div class="km-code">' + esc(item.code) + "</div>" +
          '<div class="km-desc">' + esc(item.desc) + "</div>" +
        "</div>" +
        '<div class="km-card-right">' +
          '<div class="km-card-actions">' +
            '<button type="button" class="gen-upload-btn" data-cl-upload="' + path + '">' + UPLOAD_SVG + "Upload Document</button>" +
            sendHtml +
          "</div>" +
          files +
        "</div>" +
      "</div></div>";
  }

  function renderChecklistTab(index, field) {
    const step = activeSteps[index];
    const wrap = stepBody.querySelector("#" + field);
    if (!wrap || !step || !step[field]) return;

    const naSet = pcNaCodeSet(step);
    wrap.innerHTML = step[field].map(function (section, si) {
      const status = checklistSectionStatus(section, naSet);
      const cards = section.items.map(function (item, ii) {
        return checklistItemHtml(item, si + ":" + ii, !!naSet[item.code]);
      }).join("");

      return '<section class="km-section">' +
        '<div class="km-section-head">' +
          '<h4 class="km-section-title">' + (si + 1) + ". " + esc(section.title) + "</h4>" +
          '<span class="sd-chip ' + status + '">' + (STATUS_LABEL[status] || "Upcoming") + "</span>" +
        "</div>" +
        '<div class="km-grid">' + cards + "</div>" +
        "</section>";
    }).join("");

    renderTabDots(index);
  }

  function addChecklistPendingFiles(field, path, names) {
    const step = activeSteps[selectedStepIndex];
    const item = step && checklistItemByPath(step, field, path);
    if (!item || !names.length) return;
    names.forEach(function (n) { item.pending.push(n); });
    renderChecklistTab(selectedStepIndex, field);
  }

  // Shared multi-file picker for both checklist tabs' upload buttons.
  const clFileInput = document.createElement("input");
  clFileInput.type = "file";
  clFileInput.multiple = true;
  clFileInput.hidden = true;
  document.body.appendChild(clFileInput);

  let clUploadTarget = null;   // { stepIndex, field, path }

  clFileInput.addEventListener("change", function () {
    const files = Array.prototype.slice.call(clFileInput.files);
    const target = clUploadTarget;
    clUploadTarget = null;
    if (!files.length || !target || target.stepIndex !== selectedStepIndex) return;
    addChecklistPendingFiles(target.field, target.path, files.map(function (f) { return f.name; }));
  });

  // Resolves which checklist tab (km/bp) an event happened inside, by
  // matching the closest container id against CHECKLIST_TABS.
  function checklistFieldFromEvent(e) {
    const wrap = e.target.closest("#kmChecklist, #bpChecklist");
    return wrap && CHECKLIST_TABS[wrap.id];
  }

  stepBody.addEventListener("click", function (e) {
    const field = checklistFieldFromEvent(e);
    if (!field) return;
    const index = selectedStepIndex;
    const step = activeSteps[index];
    if (!step || !step[field]) return;

    // Attach documents -> opens the real multi-file picker.
    const upload = e.target.closest("[data-cl-upload]");
    if (upload) {
      clUploadTarget = { stepIndex: index, field: field, path: upload.getAttribute("data-cl-upload") };
      clFileInput.value = "";
      clFileInput.click();
      return;
    }

    // Remove one pending (not-yet-sent) file.
    const remove = e.target.closest("[data-cl-remove]");
    if (remove) {
      const parts = remove.getAttribute("data-cl-remove").split(":");
      const path = parts[0] + ":" + parts[1];
      const pendingIndex = Number(parts[2]);
      const item = checklistItemByPath(step, field, path);
      if (item) item.pending.splice(pendingIndex, 1);
      renderChecklistTab(index, field);
      return;
    }

    // Send -> bulk-flush every pending file into saved with a shared
    // timestamp; flips Step 2 to In Progress.
    const send = e.target.closest("[data-cl-send]");
    if (send) {
      const item = checklistItemByPath(step, field, send.getAttribute("data-cl-send"));
      if (item && item.pending.length) {
        const now = new Date().toISOString();
        item.pending.forEach(function (name) { item.saved.push({ name: name, savedAt: now }); });
        item.pending = [];
        renderChecklistTab(index, field);
        markStep2Sent(index);
      }
    }
  });

  // Drag & drop a file onto a card anywhere -> adds it to that item's pending files.
  stepBody.addEventListener("dragover", function (e) {
    const card = e.target.closest("#kmChecklist .km-card, #bpChecklist .km-card");
    if (!card) return;
    e.preventDefault();
    card.classList.add("dragover");
  });
  stepBody.addEventListener("dragleave", function (e) {
    const card = e.target.closest("#kmChecklist .km-card, #bpChecklist .km-card");
    if (card && !card.contains(e.relatedTarget)) card.classList.remove("dragover");
  });
  stepBody.addEventListener("drop", function (e) {
    const card = e.target.closest("#kmChecklist .km-card, #bpChecklist .km-card");
    if (!card) return;
    e.preventDefault();
    card.classList.remove("dragover");
    const field = checklistFieldFromEvent(e);
    const files = e.dataTransfer ? Array.prototype.slice.call(e.dataTransfer.files) : [];
    if (field && files.length) addChecklistPendingFiles(field, card.getAttribute("data-cl-card"), files.map(function (f) { return f.name; }));
  });

  /* ============================================================
     Step 3 · KM & BP Online Submission
     ------------------------------------------------------------
     Per-step state (step.kb.km / step.kb.bp), each { file, date, submitted }.
     Mirrors Pre-Consultation's rounds exactly: Upload Document -> file
     attached (file-chip + remove + send icon) -> Send -> file-chip +
     "System submitted <date & time>". Sending (like elsewhere) flips
     the step to "in-progress" if it hasn't started yet.
     "Raise PR" is a static placeholder — intentionally not wired up.
  ============================================================ */
  function initKbSubmission(index) {
    const step = activeSteps[index];
    if (!step) return;
    if (!step.kb) step.kb = { km: { file: null, date: "", submitted: null }, bp: { file: null, date: "", submitted: null } };
    renderKbSubmission(index);
  }

  // The upload slot only ever shows the upload button or the file chip
  // (+ remove, while not yet sent) — the Send action lives separately,
  // to the right of the date field, since it depends on BOTH the file
  // and the date being present.
  function kbDocHtml(doc) {
    if (!doc.file) {
      return '<button type="button" class="upload-btn" data-kb-upload>' + UPLOAD_SVG + "Upload Document</button>";
    }
    const removeBtn = doc.submitted ? "" :
      '<button type="button" class="chip-del" data-kb-remove aria-label="Remove">' + TRASH_SVG + "</button>";
    return '<span class="file-chip">' + DOC_SVG + '<span class="kb-file-name">' + esc(doc.file) + "</span>" + removeBtn + "</span>";
  }

  // Send only appears once both the document is uploaded and the date is
  // picked; once sent, shows the "System submitted" stamp instead.
  function kbActionHtml(doc) {
    if (doc.submitted) {
      return stampHtml("System submitted", formatDateTime(doc.submitted));
    }
    if (doc.file && doc.date) {
      return '<button type="button" class="send-btn" data-kb-send aria-label="Send">' + SEND_SVG + "</button>";
    }
    return "";
  }

  // Refresh only the send/stamp slot for one row — used while typing a
  // date so the file-chip and date input itself aren't re-rendered.
  function renderKbAction(index, key) {
    const step = activeSteps[index];
    if (!step || !step.kb) return;
    const wrap = stepBody.querySelector('[data-kb-send-wrap="' + key + '"]');
    if (wrap) wrap.innerHTML = kbActionHtml(step.kb[key]);
  }

  function renderKbSubmission(index) {
    const step = activeSteps[index];
    if (!step || !step.kb) return;
    ["km", "bp"].forEach(function (key) {
      const doc = step.kb[key];
      const wrap = stepBody.querySelector('[data-kb-doc="' + key + '"]');
      if (wrap) wrap.innerHTML = kbDocHtml(doc);
      const dateInput = stepBody.querySelector('[data-kb-date="' + key + '"]');
      if (dateInput) {
        dateInput.value = doc.date || "";
        dateInput.disabled = !!doc.submitted;   // locked once sent
      }
      renderKbAction(index, key);
    });
    recomputeStep3(index);
  }

  // Question (a) is the only tracked field in step 3 ("Raise PR" is a static
  // placeholder), so once BOTH the KM and BP rows are sent the step is done:
  // it turns green and opens step 4. Same shape as recomputeStep4 / Step5.
  function recomputeStep3(index) {
    const step = activeSteps[index];
    if (!step || !step.kb) return;
    const nodes = [step.kb.km, step.kb.bp];
    const allSent = nodes.every(function (n) { return !!n.submitted; });
    const anyActivity = nodes.some(function (n) { return !!n.file || !!n.date || !!n.submitted; });
    if (allSent && step.status !== "completed") {
      setStepStatus(index, "completed");
      if (index + 1 < STEP_NAMES.length) selectStep(index + 1, { scrollToStep: false });
    } else if (!allSent && anyActivity && step.status !== "in-progress") {
      setStepStatus(index, "in-progress");
    }
  }

  // Shared real file picker for the KM/BP upload buttons.
  const kbFileInput = document.createElement("input");
  kbFileInput.type = "file";
  kbFileInput.hidden = true;
  document.body.appendChild(kbFileInput);

  let kbUploadTarget = null;   // { stepIndex, key }

  kbFileInput.addEventListener("change", function () {
    const file = kbFileInput.files[0];
    const target = kbUploadTarget;
    kbUploadTarget = null;
    if (!file || !target || target.stepIndex !== selectedStepIndex) return;
    const step = activeSteps[target.stepIndex];
    step.kb[target.key].file = file.name;
    step.kb[target.key].submitted = null;   // a freshly (re-)attached file always needs sending again
    renderKbSubmission(target.stepIndex);
  });

  stepBody.addEventListener("click", function (e) {
    if (!e.target.closest("#kbRoot")) return;
    const index = selectedStepIndex;
    const step = activeSteps[index];
    if (!step || !step.kb) return;

    const upload = e.target.closest("[data-kb-upload]");
    if (upload) {
      const key = upload.closest("[data-kb-doc]").getAttribute("data-kb-doc");
      kbUploadTarget = { stepIndex: index, key: key };
      kbFileInput.value = "";
      kbFileInput.click();
      return;
    }

    const remove = e.target.closest("[data-kb-remove]");
    if (remove) {
      const key = remove.closest("[data-kb-doc]").getAttribute("data-kb-doc");
      step.kb[key].file = null;
      renderKbSubmission(index);
      return;
    }

    const send = e.target.closest("[data-kb-send]");
    if (send) {
      const key = send.closest("[data-kb-send-wrap]").getAttribute("data-kb-send-wrap");
      step.kb[key].submitted = new Date().toISOString();
      renderKbSubmission(index);   // recomputeStep3 owns the status from here

    }
  });

  // Persist the KM/BP dates onto the step as the user picks them, and
  // re-evaluate whether the Send button should now appear.
  stepBody.addEventListener("input", function (e) {
    const key = e.target.closest("#kbRoot") && e.target.getAttribute("data-kb-date");
    if (!key) return;
    const step = activeSteps[selectedStepIndex];
    if (!step || !step.kb) return;
    step.kb[key].date = e.target.value;
    renderKbAction(selectedStepIndex, key);
  });

  /* ============================================================
     Step 4 · Hardcopy Submission
     ------------------------------------------------------------
     Per-step state (step.hc), grouped into three sections that
     mirror content/step-04.html:
       a. hardcopy signing date (KM + BP)   -> date + Send
       b. authority consent date            -> date + Send
       c. QR code upload (KM + BP)          -> single-file attach + Send
       d. Raise PRF                         -> static placeholder, not wired up
       e. official receipt (KM + BP)        -> single-file attach + date + Send
       f. acknowledged copy (KM + BP)       -> single-file attach + Send
     Every upload is single-file: a fresh attach (button OR drag & drop
     onto its row) always replaces whatever was there before, and always
     needs a fresh Send. The step reaches Completed — advancing to
     Step 5 — only once every one of the 9 tracked fields above is sent
     ((d) is a placeholder and doesn't track state, so it isn't required).
  ============================================================ */
  function hcDefaultState() {
    return {
      // Keys are q<N> matching the visible label 4.<N>. There is no q4 —
      // 4.4 "Raise PRF" is a static placeholder with no state — and the gap is
      // deliberate so qN always lines up with 4.N.
      q1: { km: { date: "", sent: null }, bp: { date: "", sent: null } },
      q2: { date: "", sent: null },
      q3: { km: { file: null, submitted: null }, bp: { file: null, submitted: null } },
      q5: { km: { file: null, date: "", submitted: null }, bp: { file: null, date: "", submitted: null } },
      // 4.6 carries a date per side: it is what step 4's actual end is derived from.
      q6: { km: { file: null, date: "", submitted: null }, bp: { file: null, date: "", submitted: null } }
    };
  }

  const HC_FIELD_PATHS = ["q1.km", "q1.bp", "q2", "q3.km", "q3.bp", "q5.km", "q5.bp", "q6.km", "q6.bp"];

  function hcNodeByPath(step, path) {
    const parts = path.split(".");
    let node = step.hc[parts[0]];
    if (parts[1]) node = node[parts[1]];
    return node;
  }

  function hcIsDoc(node) { return Object.prototype.hasOwnProperty.call(node, "file"); }

  function hcDocHtml(node) {
    if (!node.file) {
      return '<button type="button" class="upload-btn" data-hc-upload aria-label="Upload document">' + UPLOAD_SVG + "Upload Document</button>";
    }
    const removeBtn = node.submitted ? "" :
      '<button type="button" class="chip-del" data-hc-remove aria-label="Remove">' + TRASH_SVG + "</button>";
    return '<span class="file-chip">' + DOC_SVG + '<span class="kb-file-name">' + esc(node.file) + "</span>" + removeBtn + "</span>";
  }

  function hcSendWrapHtml(node) {
    const stamp = hcIsDoc(node) ? node.submitted : node.sent;
    if (stamp) {
      return stampHtml("System submitted", formatDateTime(stamp));
    }
    const ready = hcIsDoc(node) ? !!node.file : !!node.date;
    return ready ? '<button type="button" class="send-btn" data-hc-send aria-label="Send">' + SEND_SVG + "</button>" : "";
  }

  function renderHcField(path) {
    const step = activeSteps[selectedStepIndex];
    if (!step || !step.hc) return;
    const node = hcNodeByPath(step, path);
    const dateInput = stepBody.querySelector('[data-hc-date="' + path + '"]');
    if (dateInput) {
      dateInput.value = node.date || "";
      dateInput.disabled = hcIsDoc(node) ? !!node.submitted : !!node.sent;   // locked once sent
    }
    const docWrap = stepBody.querySelector('[data-hc-doc="' + path + '"]');
    if (docWrap) docWrap.innerHTML = hcDocHtml(node);
    const sendWrap = stepBody.querySelector('[data-hc-send-wrap="' + path + '"]');
    if (sendWrap) sendWrap.innerHTML = hcSendWrapHtml(node);
  }

  function renderHcSubmission(index) {
    const step = activeSteps[index];
    if (!step || !step.hc) return;
    HC_FIELD_PATHS.forEach(renderHcField);
    recomputeStep4(index);
  }

  function initHcSubmission(index) {
    const step = activeSteps[index];
    if (!step) return;
    if (!step.hc) step.hc = hcDefaultState();
    renderHcSubmission(index);
  }

  // All 9 tracked fields must be sent for the step to reach Completed and
  // auto-advance; any single one flips it to In Progress. 4.4 is a static
  // placeholder — it has no state, so it isn't part of this check.
  function recomputeStep4(index) {
    const step = activeSteps[index];
    if (!step || !step.hc) return;
    const hc = step.hc;
    const nodes = [hc.q1.km, hc.q1.bp, hc.q2, hc.q3.km, hc.q3.bp, hc.q5.km, hc.q5.bp, hc.q6.km, hc.q6.bp];
    const allDone = nodes.every(function (n) { return hcIsDoc(n) ? !!n.submitted : !!n.sent; });
    const anyActivity = nodes.some(function (n) {
      return !!n.file || !!n.date || !!n.sent || !!n.submitted;
    });
    if (allDone && step.status !== "completed") {
      setStepStatus(index, "completed");
      if (index + 1 < STEP_NAMES.length) selectStep(index + 1, { scrollToStep: false });
    } else if (anyActivity && step.status === "upcoming") {
      setStepStatus(index, "in-progress");
    }
  }

  // Shared real single-file picker for every KM/BP upload in this step.
  const hcFileInput = document.createElement("input");
  hcFileInput.type = "file";
  hcFileInput.hidden = true;
  document.body.appendChild(hcFileInput);

  let hcUploadTarget = null;   // { stepIndex, path }

  hcFileInput.addEventListener("change", function () {
    const file = hcFileInput.files[0];
    const target = hcUploadTarget;
    hcUploadTarget = null;
    if (!file || !target || target.stepIndex !== selectedStepIndex) return;
    const step = activeSteps[target.stepIndex];
    const node = hcNodeByPath(step, target.path);
    node.file = file.name;
    node.submitted = null;   // a freshly (re-)attached file always needs sending again
    renderHcField(target.path);
    recomputeStep4(target.stepIndex);
  });

  stepBody.addEventListener("click", function (e) {
    if (!e.target.closest("#hcRoot")) return;
    const index = selectedStepIndex;
    const step = activeSteps[index];
    if (!step || !step.hc) return;

    const upload = e.target.closest("[data-hc-upload]");
    if (upload) {
      const path = upload.closest("[data-hc-doc]").getAttribute("data-hc-doc");
      hcUploadTarget = { stepIndex: index, path: path };
      hcFileInput.value = "";
      hcFileInput.click();
      return;
    }

    const remove = e.target.closest("[data-hc-remove]");
    if (remove) {
      const path = remove.closest("[data-hc-doc]").getAttribute("data-hc-doc");
      const node = hcNodeByPath(step, path);
      node.file = null;
      renderHcField(path);
      recomputeStep4(index);
      return;
    }

    const send = e.target.closest("[data-hc-send]");
    if (send) {
      const path = send.closest("[data-hc-send-wrap]").getAttribute("data-hc-send-wrap");
      const node = hcNodeByPath(step, path);
      if (hcIsDoc(node)) node.submitted = new Date().toISOString();
      else node.sent = new Date().toISOString();
      if (step.status === "upcoming") setStepStatus(index, "in-progress");
      renderHcField(path);
      recomputeStep4(index);
    }
  });

  // Typing a date directly: save it, then refresh just that field's
  // Send/stamp slot (keeps focus on the date input).
  stepBody.addEventListener("input", function (e) {
    const dateEl = e.target.closest("#hcRoot") && e.target.closest("[data-hc-date]");
    if (!dateEl) return;
    const path = dateEl.getAttribute("data-hc-date");
    const step = activeSteps[selectedStepIndex];
    if (!step || !step.hc) return;
    hcNodeByPath(step, path).date = dateEl.value;
    const sendWrap = stepBody.querySelector('[data-hc-send-wrap="' + path + '"]');
    if (sendWrap) sendWrap.innerHTML = hcSendWrapHtml(hcNodeByPath(step, path));
  });

  // Drag & drop a file onto a KM/BP row -> single file, replaces whatever
  // was attached before (max 1 file per field, same as a fresh Upload
  // Document click).
  stepBody.addEventListener("dragover", function (e) {
    const row = e.target.closest("#hcRoot .hc-doc-row");
    if (!row) return;
    e.preventDefault();
    row.classList.add("dragover");
  });
  stepBody.addEventListener("dragleave", function (e) {
    const row = e.target.closest("#hcRoot .hc-doc-row");
    if (row && !row.contains(e.relatedTarget)) row.classList.remove("dragover");
  });
  stepBody.addEventListener("drop", function (e) {
    const row = e.target.closest("#hcRoot .hc-doc-row");
    if (!row) return;
    e.preventDefault();
    row.classList.remove("dragover");
    const files = e.dataTransfer ? Array.prototype.slice.call(e.dataTransfer.files) : [];
    if (!files.length) return;
    const step = activeSteps[selectedStepIndex];
    if (!step || !step.hc) return;
    const path = row.getAttribute("data-hc-drop");
    const node = hcNodeByPath(step, path);
    node.file = files[0].name;
    node.submitted = null;
    renderHcField(path);
    recomputeStep4(selectedStepIndex);
  });

  /* ============================================================
     Step 5 · OSC Meeting
     ------------------------------------------------------------
     Per-step state (step.osc):
       a. OSC Edaran circulation list  -> single-file (PDF only) attach + date + Send
       b. OSC meeting date             -> date + Send
       c. OSC meeting minutes letter   -> single-file (PDF only) attach + date + Send
     Same attach -> Send -> "System submitted" flow as Step 4, but the
     file picker is restricted to .pdf. All three fields are required —
     the step reaches Completed, advancing to Step 6, only once (a), (b)
     and (c) are all sent.
  ============================================================ */
  function oscDefaultState() {
    return {
      // Keys are q<N> matching the visible label 5.<N>.
      q1: { file: null, date: "", submitted: null },
      q2: { date: "", sent: null },
      q3: { file: null, date: "", submitted: null }
    };
  }

  const OSC_FIELD_PATHS = ["q1", "q2", "q3"];

  function oscIsDoc(node) { return Object.prototype.hasOwnProperty.call(node, "file"); }

  function oscDocHtml(node) {
    if (!node.file) {
      return '<button type="button" class="upload-btn" data-osc-upload aria-label="Upload document">' + UPLOAD_SVG + "Upload Document</button>";
    }
    const removeBtn = node.submitted ? "" :
      '<button type="button" class="chip-del" data-osc-remove aria-label="Remove">' + TRASH_SVG + "</button>";
    return '<span class="file-chip">' + DOC_SVG + '<span class="kb-file-name">' + esc(node.file) + "</span>" + removeBtn + "</span>";
  }

  function oscSendWrapHtml(node) {
    const stamp = oscIsDoc(node) ? node.submitted : node.sent;
    if (stamp) {
      return stampHtml("System submitted", formatDateTime(stamp));
    }
    const ready = oscIsDoc(node) ? !!(node.file && node.date) : !!node.date;
    return ready ? '<button type="button" class="send-btn" data-osc-send aria-label="Send">' + SEND_SVG + "</button>" : "";
  }

  function renderOscField(path) {
    const step = activeSteps[selectedStepIndex];
    if (!step || !step.osc) return;
    const node = step.osc[path];
    const dateInput = stepBody.querySelector('[data-osc-date="' + path + '"]');
    if (dateInput) {
      dateInput.value = node.date || "";
      dateInput.disabled = oscIsDoc(node) ? !!node.submitted : !!node.sent;   // locked once sent
    }
    const docWrap = stepBody.querySelector('[data-osc-doc="' + path + '"]');
    if (docWrap) docWrap.innerHTML = oscDocHtml(node);
    const sendWrap = stepBody.querySelector('[data-osc-send-wrap="' + path + '"]');
    if (sendWrap) sendWrap.innerHTML = oscSendWrapHtml(node);
  }

  function renderOscMeeting(index) {
    const step = activeSteps[index];
    if (!step || !step.osc) return;
    OSC_FIELD_PATHS.forEach(renderOscField);
    recomputeStep5(index);
  }

  function initOscMeeting(index) {
    const step = activeSteps[index];
    if (!step) return;
    if (!step.osc) step.osc = oscDefaultState();
    renderOscMeeting(index);
  }

  // All three fields (5.1, 5.2, 5.3) must be sent for the step to reach
  // Completed and auto-advance; any single one flips it to In Progress.
  function recomputeStep5(index) {
    const step = activeSteps[index];
    if (!step || !step.osc) return;
    const nodes = [step.osc.q1, step.osc.q2, step.osc.q3];
    const allDone = nodes.every(function (n) { return oscIsDoc(n) ? !!n.submitted : !!n.sent; });
    const anyActivity = nodes.some(function (n) { return !!n.file || !!n.date || !!n.sent || !!n.submitted; });
    if (allDone && step.status !== "completed") {
      setStepStatus(index, "completed");
      if (index + 1 < STEP_NAMES.length) selectStep(index + 1, { scrollToStep: false });
    } else if (anyActivity && step.status === "upcoming") {
      setStepStatus(index, "in-progress");
    }
  }

  // Shared real single-file picker for Step 5's uploads — restricted to
  // PDF, per the "Upload PDF" requirement, while keeping the app's
  // standard "Upload Document" label/styling.
  const oscFileInput = document.createElement("input");
  oscFileInput.type = "file";
  oscFileInput.accept = ".pdf,application/pdf";
  oscFileInput.hidden = true;
  document.body.appendChild(oscFileInput);

  let oscUploadTarget = null;   // { stepIndex, path }

  oscFileInput.addEventListener("change", function () {
    const file = oscFileInput.files[0];
    const target = oscUploadTarget;
    oscUploadTarget = null;
    if (!file || !target || target.stepIndex !== selectedStepIndex) return;
    const node = activeSteps[target.stepIndex].osc[target.path];
    node.file = file.name;
    node.submitted = null;   // a freshly (re-)attached file always needs sending again
    renderOscField(target.path);
    recomputeStep5(target.stepIndex);
  });

  stepBody.addEventListener("click", function (e) {
    if (!e.target.closest("#oscRoot")) return;
    const index = selectedStepIndex;
    const step = activeSteps[index];
    if (!step || !step.osc) return;

    const upload = e.target.closest("[data-osc-upload]");
    if (upload) {
      const path = upload.closest("[data-osc-doc]").getAttribute("data-osc-doc");
      oscUploadTarget = { stepIndex: index, path: path };
      oscFileInput.value = "";
      oscFileInput.click();
      return;
    }

    const remove = e.target.closest("[data-osc-remove]");
    if (remove) {
      const path = remove.closest("[data-osc-doc]").getAttribute("data-osc-doc");
      step.osc[path].file = null;
      renderOscField(path);
      recomputeStep5(index);
      return;
    }

    const send = e.target.closest("[data-osc-send]");
    if (send) {
      const path = send.closest("[data-osc-send-wrap]").getAttribute("data-osc-send-wrap");
      const node = step.osc[path];
      if (oscIsDoc(node)) node.submitted = new Date().toISOString();
      else node.sent = new Date().toISOString();
      if (step.status === "upcoming") setStepStatus(index, "in-progress");
      renderOscField(path);
      recomputeStep5(index);
    }
  });

  // Typing a date directly: save it, then refresh just that field's
  // Send/stamp slot (keeps focus on the date input).
  stepBody.addEventListener("input", function (e) {
    const dateEl = e.target.closest("#oscRoot") && e.target.closest("[data-osc-date]");
    if (!dateEl) return;
    const path = dateEl.getAttribute("data-osc-date");
    const step = activeSteps[selectedStepIndex];
    if (!step || !step.osc) return;
    step.osc[path].date = dateEl.value;
    const sendWrap = stepBody.querySelector('[data-osc-send-wrap="' + path + '"]');
    if (sendWrap) sendWrap.innerHTML = oscSendWrapHtml(step.osc[path]);
  });

  // Drag & drop a file onto a row -> single file, replaces whatever was
  // attached before (max 1 file, same as a fresh Upload Document click).
  stepBody.addEventListener("dragover", function (e) {
    const row = e.target.closest("#oscRoot .hc-doc-row");
    if (!row) return;
    e.preventDefault();
    row.classList.add("dragover");
  });
  stepBody.addEventListener("dragleave", function (e) {
    const row = e.target.closest("#oscRoot .hc-doc-row");
    if (row && !row.contains(e.relatedTarget)) row.classList.remove("dragover");
  });
  stepBody.addEventListener("drop", function (e) {
    const row = e.target.closest("#oscRoot .hc-doc-row");
    if (!row) return;
    e.preventDefault();
    row.classList.remove("dragover");
    const files = e.dataTransfer ? Array.prototype.slice.call(e.dataTransfer.files) : [];
    if (!files.length || !/\.pdf$/i.test(files[0].name)) return;   // PDF only
    const step = activeSteps[selectedStepIndex];
    if (!step || !step.osc) return;
    const path = row.getAttribute("data-osc-drop");
    const node = step.osc[path];
    node.file = files[0].name;
    node.submitted = null;
    renderOscField(path);
    recomputeStep5(selectedStepIndex);
  });

  /* ============================================================
     Step 7 · KM Approval Endorsement
     ------------------------------------------------------------
     Per-step state (step.endorse):
       t1/t2/t3  7.1 target dates (PPD sets)         -> date + Send
       rounds    7.2/7.2.1 endorsement set submission -> dual PDF+CAD
                 attach + date + Send, then PPD Accept/Reject with a
                 comment (same round-based reject loop as Step 2's
                 Pre-Consultation: Reject spawns R1, R2… with a fresh
                 blank attempt; Accept locks the round).
       ack       7.3 acknowledged copy               -> single-file + date + Send
       letter    7.4/7.4.1 approval letter            -> single-file + date +
                 ref no + Send, then PPD Accept/Reject — Reject here is
                 simpler than the rounds: it just clears the fields for
                 a fresh re-upload, no round history.
     Every field (all 3 target dates, the final round Accepted, ack
     sent, and the letter Accepted) must be done for the step to reach
     Completed and advance to Step 8.
  ============================================================ */
  function endorseDefaultState() {
    return {
      t1: { date: "", sent: null },
      t2: { date: "", sent: null },
      t3: { date: "", sent: null },
      rounds: [{ key: "R0", pdf: null, cad: null, date: "", submitted: "", outcome: "pending", decidedAt: "", comment: "" }],
      ack: { file: null, date: "", submitted: null },
      letter: { file: null, date: "", refNo: "", submitted: null, verified: null, verifiedAt: null }
    };
  }

  function initEndorseApproval(index) {
    const step = activeSteps[index];
    if (!step) return;
    if (!step.endorse) step.endorse = endorseDefaultState();
    renderEndorseApproval(index);
  }

  function renderEndorseApproval(index) {
    const step = activeSteps[index];
    if (!step || !step.endorse) return;
    ["t1", "t2", "t3"].forEach(renderEndorseTarget);
    renderEndorseRounds();
    renderEndorseAck();
    renderEndorseLetter();
    recomputeStep7(index);
  }

  // Shared doc-slot renderer (round pdf/cad, ack, letter) — upload button
  // when empty, file chip (+ remove while not yet sent) once attached.
  function endorseDocHtml(file, submitted, path, label) {
    if (!file) {
      return '<button type="button" class="upload-btn" data-endorse-upload="' + path + '" aria-label="Upload ' + label + '">' + UPLOAD_SVG + "Upload " + label + "</button>";
    }
    const removeBtn = submitted ? "" :
      '<button type="button" class="chip-del" data-endorse-remove="' + path + '" aria-label="Remove">' + TRASH_SVG + "</button>";
    return '<span class="file-chip">' + DOC_SVG + '<span class="kb-file-name">' + esc(file) + "</span>" + removeBtn + "</span>";
  }

  function endorseSetFile(step, path, filename) {
    if (path === "ack") { step.endorse.ack.file = filename; step.endorse.ack.submitted = null; return; }
    if (path === "letter") { step.endorse.letter.file = filename; step.endorse.letter.submitted = null; return; }
    const parts = path.split(":");
    const r = step.endorse.rounds[Number(parts[1])];
    r[parts[0]] = filename;
    r.submitted = "";   // a freshly (re-)attached file always needs sending again
  }

  function endorseClearFile(step, path) {
    if (path === "ack") { step.endorse.ack.file = null; return; }
    if (path === "letter") { step.endorse.letter.file = null; return; }
    const parts = path.split(":");
    step.endorse.rounds[Number(parts[1])][parts[0]] = null;
  }

  /* ---- 7.1 target dates ---- */
  function endorseTargetSendHtml(node) {
    if (node.sent) {
      return stampHtml("System submitted", formatDateTime(node.sent));
    }
    return node.date ? '<button type="button" class="send-btn" data-endorse-send aria-label="Send">' + SEND_SVG + "</button>" : "";
  }

  function renderEndorseTarget(key) {
    const step = activeSteps[selectedStepIndex];
    if (!step || !step.endorse) return;
    const node = step.endorse[key];
    const dateInput = stepBody.querySelector('[data-endorse-date="' + key + '"]');
    if (dateInput) {
      dateInput.value = node.date || "";
      dateInput.disabled = !!node.sent;
    }
    const sendWrap = stepBody.querySelector('[data-endorse-send-wrap="' + key + '"]');
    if (sendWrap) sendWrap.innerHTML = endorseTargetSendHtml(node);
  }

  /* ---- 7.2 / 7.2.1 submission rounds ---- */
  function endorseRoundSendHtml(r) {
    if (r.submitted) {
      return stampHtml("System submitted", formatDateTime(r.submitted));
    }
    const ready = !!(r.pdf && r.cad && r.date);
    return ready ? '<button type="button" class="send-btn" data-endorse-round-send aria-label="Send">' + SEND_SVG + "</button>" : "";
  }

  function endorseRoundsHtml() {
    const step = activeSteps[selectedStepIndex];
    const rounds = (step && step.endorse && step.endorse.rounds) || [];
    return rounds.map(function (r, i) {
      const isLast = i === rounds.length - 1;
      let body = '<div class="kb-row" style="margin-top:0">' +
        '<div class="kb-upload-wrap hc-doc-row" data-endorse-drop="pdf:' + i + '">' + endorseDocHtml(r.pdf, r.submitted, "pdf:" + i, "PDF") + "</div>" +
        '<div class="kb-upload-wrap hc-doc-row" data-endorse-drop="cad:' + i + '">' + endorseDocHtml(r.cad, r.submitted, "cad:" + i, "CAD") + "</div>" +
        '<input type="date" class="sd-input kb-date" data-endorse-round-date="' + i + '" value="' + esc(r.date) + '"' + (r.submitted ? " disabled" : "") + ">" +
        "<div>" + endorseRoundSendHtml(r) + "</div>" +
        "</div>";

      if (r.outcome === "rejected") {
        body += '<div class="round-meta rejected">Rejected ' + esc(r.decidedAt) + "</div>";
        if (r.comment) body += '<div class="ppd-box"><div class="ppd-box-title">PPD Comment</div><div class="ppd-text">' + esc(r.comment) + "</div></div>";
      }
      if (r.outcome === "accepted") {
        body += '<div class="round-meta accepted">Accepted ' + esc(r.decidedAt) + "</div>";
      }
      if (isLast && r.submitted && r.outcome === "pending") {
        body += '<div class="ppd-box"><div class="ppd-box-title">PPD Comment</div>' +
          '<textarea data-endorse-comment placeholder="editor to edit/sketch/comment"></textarea>' +
          '<div class="ppd-actions">' +
          '<button type="button" class="btn btn-sm btn-reject" data-endorse-decide="reject">✕ Reject</button>' +
          '<button type="button" class="btn btn-sm btn-accept" data-endorse-decide="accept">✓ Accept</button>' +
          "</div></div>";
      }

      return '<div class="round-row"><div class="round-key">' + esc(r.key) + "</div><div class=\"round-body\">" + body + "</div></div>";
    }).join("");
  }

  function renderEndorseRounds() {
    const wrap = stepBody.querySelector("#endorseRounds");
    if (wrap) wrap.innerHTML = endorseRoundsHtml();
  }

  /* ---- 7.3 acknowledged copy ---- */
  function endorseAckSendHtml(node) {
    if (node.submitted) return stampHtml("System submitted", formatDateTime(node.submitted));
    return (node.file && node.date) ? '<button type="button" class="send-btn" data-endorse-ack-send aria-label="Send">' + SEND_SVG + "</button>" : "";
  }

  function renderEndorseAck() {
    const step = activeSteps[selectedStepIndex];
    if (!step || !step.endorse) return;
    const node = step.endorse.ack;
    const docWrap = stepBody.querySelector('[data-endorse-doc="ack"]');
    if (docWrap) docWrap.innerHTML = endorseDocHtml(node.file, node.submitted, "ack", "Document");
    const dateInput = stepBody.querySelector('[data-endorse-date="ack"]');
    if (dateInput) { dateInput.value = node.date || ""; dateInput.disabled = !!node.submitted; }
    const sendWrap = stepBody.querySelector('[data-endorse-send-wrap="ack"]');
    if (sendWrap) sendWrap.innerHTML = endorseAckSendHtml(node);
  }

  /* ---- 7.4 / 7.4.1 approval letter ---- */
  function endorseLetterSendHtml(node) {
    if (node.submitted) return stampHtml("System submitted", formatDateTime(node.submitted));
    return (node.file && node.date && node.refNo) ? '<button type="button" class="send-btn" data-endorse-letter-send aria-label="Send">' + SEND_SVG + "</button>" : "";
  }

  function renderEndorseLetter() {
    const step = activeSteps[selectedStepIndex];
    if (!step || !step.endorse) return;
    const node = step.endorse.letter;
    const docWrap = stepBody.querySelector('[data-endorse-doc="letter"]');
    if (docWrap) docWrap.innerHTML = endorseDocHtml(node.file, node.submitted, "letter", "Document");
    const dateInput = stepBody.querySelector('[data-endorse-date="letter"]');
    if (dateInput) { dateInput.value = node.date || ""; dateInput.disabled = !!node.submitted; }
    const refInput = stepBody.querySelector("[data-endorse-refno]");
    if (refInput) { refInput.value = node.refNo || ""; refInput.disabled = !!node.submitted; }
    const sendWrap = stepBody.querySelector('[data-endorse-send-wrap="letter"]');
    if (sendWrap) sendWrap.innerHTML = endorseLetterSendHtml(node);

    const decideWrap = stepBody.querySelector("[data-endorse-letter-decide-wrap]");
    if (decideWrap) {
      if (node.verified === "accepted") {
        decideWrap.innerHTML = stampHtml("Verified", formatDateTime(node.verifiedAt));
      } else if (node.submitted) {
        decideWrap.innerHTML =
          '<button type="button" class="btn btn-sm btn-reject" data-endorse-letter-decide="reject">✕ Reject</button>' +
          '<button type="button" class="btn btn-sm btn-accept" data-endorse-letter-decide="accept">✓ Accept</button>';
      } else {
        decideWrap.innerHTML = "";
      }
    }
  }

  // All target dates sent, final round Accepted, ack sent, and the
  // letter Accepted are required for the step to reach Completed and
  // auto-advance to Step 8.
  function recomputeStep7(index) {
    const step = activeSteps[index];
    if (!step || !step.endorse) return;
    const endorse = step.endorse;
    const lastRound = endorse.rounds[endorse.rounds.length - 1];
    const allDone = !!endorse.t1.sent && !!endorse.t2.sent && !!endorse.t3.sent &&
      lastRound.outcome === "accepted" &&
      !!endorse.ack.submitted &&
      !!endorse.letter.submitted && endorse.letter.verified === "accepted";
    const anyActivity = !!(endorse.t1.sent || endorse.t2.sent || endorse.t3.sent || endorse.t1.date || endorse.t2.date || endorse.t3.date ||
      lastRound.pdf || lastRound.cad || lastRound.date || lastRound.submitted ||
      endorse.ack.file || endorse.ack.date || endorse.ack.submitted ||
      endorse.letter.file || endorse.letter.date || endorse.letter.refNo || endorse.letter.submitted);
    if (allDone && step.status !== "completed") {
      setStepStatus(index, "completed");
      if (index + 1 < STEP_NAMES.length) selectStep(index + 1, { scrollToStep: false });
    } else if (anyActivity && step.status === "upcoming") {
      setStepStatus(index, "in-progress");
    }
  }

  // 7.2's PDF slot only accepts .pdf, its CAD slot only accepts .dwg/.dxf;
  // ack/letter (no "pdf:"/"cad:" prefix) stay unrestricted. Returns null
  // for unrestricted paths.
  function endorseExtPattern(path) {
    if (path.indexOf("pdf:") === 0) return /\.pdf$/i;
    if (path.indexOf("cad:") === 0) return /\.(dwg|dxf)$/i;
    return null;
  }
  function endorseAcceptAttr(path) {
    if (path.indexOf("pdf:") === 0) return ".pdf,application/pdf";
    if (path.indexOf("cad:") === 0) return ".dwg,.dxf";
    return "";
  }

  // Shared real single-file picker for every upload in this step.
  const endorseFileInput = document.createElement("input");
  endorseFileInput.type = "file";
  endorseFileInput.hidden = true;
  document.body.appendChild(endorseFileInput);

  let endorseUploadTarget = null;   // { stepIndex, path }

  endorseFileInput.addEventListener("change", function () {
    const file = endorseFileInput.files[0];
    const target = endorseUploadTarget;
    endorseUploadTarget = null;
    if (!file || !target || target.stepIndex !== selectedStepIndex) return;
    endorseSetFile(activeSteps[target.stepIndex], target.path, file.name);
    renderEndorseApproval(target.stepIndex);
  });

  stepBody.addEventListener("click", function (e) {
    if (!e.target.closest("#endorseRoot")) return;
    const index = selectedStepIndex;
    const step = activeSteps[index];
    if (!step || !step.endorse) return;

    const upload = e.target.closest("[data-endorse-upload]");
    if (upload) {
      const path = upload.getAttribute("data-endorse-upload");
      endorseUploadTarget = { stepIndex: index, path: path };
      endorseFileInput.value = "";
      endorseFileInput.accept = endorseAcceptAttr(path);
      endorseFileInput.click();
      return;
    }

    const remove = e.target.closest("[data-endorse-remove]");
    if (remove) {
      endorseClearFile(step, remove.getAttribute("data-endorse-remove"));
      renderEndorseApproval(index);
      return;
    }

    const tSend = e.target.closest("[data-endorse-send]");
    if (tSend) {
      const key = tSend.closest("[data-endorse-send-wrap]").getAttribute("data-endorse-send-wrap");
      step.endorse[key].sent = new Date().toISOString();
      if (step.status === "upcoming") setStepStatus(index, "in-progress");
      renderEndorseTarget(key);
      recomputeStep7(index);
      return;
    }

    const roundSend = e.target.closest("[data-endorse-round-send]");
    if (roundSend) {
      const i = Number(roundSend.closest(".round-row").querySelector("[data-endorse-round-date]").getAttribute("data-endorse-round-date"));
      step.endorse.rounds[i].submitted = new Date().toISOString();
      if (step.status === "upcoming") setStepStatus(index, "in-progress");
      renderEndorseRounds();
      recomputeStep7(index);
      return;
    }

    const decide = e.target.closest("[data-endorse-decide]");
    if (decide) {
      const decision = decide.getAttribute("data-endorse-decide");
      const commentEl = stepBody.querySelector("[data-endorse-comment]");
      const comment = commentEl ? commentEl.value.trim() : "";
      const round = step.endorse.rounds[step.endorse.rounds.length - 1];
      round.comment = comment;
      round.decidedAt = formatDateTime(new Date());
      if (decision === "accept") {
        round.outcome = "accepted";
      } else {
        round.outcome = "rejected";
        const n = step.endorse.rounds.length;
        step.endorse.rounds.push({ key: "R" + n, pdf: null, cad: null, date: "", submitted: "", outcome: "pending", decidedAt: "", comment: "" });
      }
      renderEndorseRounds();
      recomputeStep7(index);
      return;
    }

    const ackSend = e.target.closest("[data-endorse-ack-send]");
    if (ackSend) {
      step.endorse.ack.submitted = new Date().toISOString();
      if (step.status === "upcoming") setStepStatus(index, "in-progress");
      renderEndorseAck();
      recomputeStep7(index);
      return;
    }

    const letterSend = e.target.closest("[data-endorse-letter-send]");
    if (letterSend) {
      step.endorse.letter.submitted = new Date().toISOString();
      if (step.status === "upcoming") setStepStatus(index, "in-progress");
      renderEndorseLetter();
      recomputeStep7(index);
      return;
    }

    const letterDecide = e.target.closest("[data-endorse-letter-decide]");
    if (letterDecide) {
      const decision = letterDecide.getAttribute("data-endorse-letter-decide");
      if (decision === "accept") {
        step.endorse.letter.verified = "accepted";
        step.endorse.letter.verifiedAt = new Date().toISOString();
      } else {
        // Simpler reject than the rounds — just clears the fields for a
        // fresh re-upload, no round history tracked.
        step.endorse.letter.file = null;
        step.endorse.letter.date = "";
        step.endorse.letter.refNo = "";
        step.endorse.letter.submitted = null;
        step.endorse.letter.verified = null;
      }
      renderEndorseLetter();
      recomputeStep7(index);
    }
  });

  stepBody.addEventListener("input", function (e) {
    if (!e.target.closest("#endorseRoot")) return;
    const step = activeSteps[selectedStepIndex];
    if (!step || !step.endorse) return;

    const tKey = e.target.getAttribute("data-endorse-date");
    if (tKey === "t1" || tKey === "t2" || tKey === "t3") {
      step.endorse[tKey].date = e.target.value;
      const sendWrap = stepBody.querySelector('[data-endorse-send-wrap="' + tKey + '"]');
      if (sendWrap) sendWrap.innerHTML = endorseTargetSendHtml(step.endorse[tKey]);
      return;
    }
    if (tKey === "ack") {
      step.endorse.ack.date = e.target.value;
      const sendWrap = stepBody.querySelector('[data-endorse-send-wrap="ack"]');
      if (sendWrap) sendWrap.innerHTML = endorseAckSendHtml(step.endorse.ack);
      return;
    }
    if (tKey === "letter") {
      step.endorse.letter.date = e.target.value;
      const sendWrap = stepBody.querySelector('[data-endorse-send-wrap="letter"]');
      if (sendWrap) sendWrap.innerHTML = endorseLetterSendHtml(step.endorse.letter);
      return;
    }

    const roundDateAttr = e.target.getAttribute("data-endorse-round-date");
    if (roundDateAttr != null) {
      const i = Number(roundDateAttr);
      step.endorse.rounds[i].date = e.target.value;
      const row = e.target.closest(".round-row");
      const sendWrap = row && row.querySelector(".kb-row > div:last-child");
      if (sendWrap) sendWrap.innerHTML = endorseRoundSendHtml(step.endorse.rounds[i]);
      return;
    }

    if (e.target.hasAttribute("data-endorse-refno")) {
      step.endorse.letter.refNo = e.target.value;
      const sendWrap = stepBody.querySelector('[data-endorse-send-wrap="letter"]');
      if (sendWrap) sendWrap.innerHTML = endorseLetterSendHtml(step.endorse.letter);
    }
  });

  // Drag & drop a file onto a doc slot -> single file, replaces whatever
  // was attached before (max 1 file, same as a fresh Upload click).
  stepBody.addEventListener("dragover", function (e) {
    const zone = e.target.closest("#endorseRoot [data-endorse-drop]");
    if (!zone) return;
    e.preventDefault();
    zone.classList.add("dragover");
  });
  stepBody.addEventListener("dragleave", function (e) {
    const zone = e.target.closest("#endorseRoot [data-endorse-drop]");
    if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove("dragover");
  });
  stepBody.addEventListener("drop", function (e) {
    const zone = e.target.closest("#endorseRoot [data-endorse-drop]");
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove("dragover");
    const files = e.dataTransfer ? Array.prototype.slice.call(e.dataTransfer.files) : [];
    if (!files.length) return;
    const path = zone.getAttribute("data-endorse-drop");
    const pattern = endorseExtPattern(path);
    if (pattern && !pattern.test(files[0].name)) return;   // wrong file type for this slot
    const step = activeSteps[selectedStepIndex];
    if (!step || !step.endorse) return;
    endorseSetFile(step, path, files[0].name);
    renderEndorseApproval(selectedStepIndex);
  });

  /* ============================================================
     Step 11 · AP Approval
     ------------------------------------------------------------
     Per-step state (step.ap11):
       geran / bPdf / bCad / cPdf / cCad / approval
                 single-file upload slots. Unlike Step 7, there is
                 no separate Send — uploading auto-saves the date
                 ("System auto-saved <time>"), matching the spec's
                 "System auto-save the uploaded date". Remove swaps.
       bottom    the interactive Submission Checklist rows (CTOS,
                 Akuan Berkanun, Proposed Advertisement, Price List
                 + any "Add items"). Each row's dot toggles on click.
     The read-only top checklist mirrors earlier approval steps:
       Approved KM -> Step 7, Approved BP -> Step 8, Approved Sifus
       -> Step 9 (green once those are Completed). The remaining
       items stay white for now (no mapped step).
     Completing item d (S&M uploads the AP approval) marks the step
     Completed — this is the last step, so nothing auto-advances.
  ============================================================ */
  const AP11_TOP = [
    { title: "Land Title",          step: null },
    { title: "Approved KM",         step: 6 },   // Step 7 · KM Approval Endorsement
    { title: "Approved Precom",     step: null },
    { title: "Approved BP",         step: 7 },   // Step 8 · BP Approval Endorsement
    { title: "Approved Sifus",      step: 8 },   // Step 9 · Sifus Approval
    { title: "Schedule of parcel",  step: null },
    { title: "Architect Certificate", step: null },
    { title: "Sijil Akuan Ukur",    step: null }
  ];
  const AP11_BOTTOM_SEED = [
    "CTOS Report",
    "Akuan Berkanun (Borang L2C)",
    "Proposed Advertisement",
    "Price List (Product type, land size, built-up, no of unit, min & max price)"
  ];
  // Per-slot file-type restriction (mirrors Step 7's PDF/CAD split).
  const AP11_ACCEPT = {
    geran:    ".pdf,application/pdf",
    bPdf:     ".pdf,application/pdf",
    bCad:     ".dwg,.dxf",
    cPdf:     ".pdf,application/pdf",
    cCad:     ".dwg,.dxf",
    approval: ".pdf,.dwg,.dxf,application/pdf"
  };
  const AP11_PATTERN = {
    geran:    /\.pdf$/i,
    bPdf:     /\.pdf$/i,
    bCad:     /\.(dwg|dxf)$/i,
    cPdf:     /\.pdf$/i,
    cCad:     /\.(dwg|dxf)$/i,
    approval: /\.(pdf|dwg|dxf)$/i
  };
  const AP11_LABEL = {
    geran: "PDF", bPdf: "PDF", bCad: "CAD", cPdf: "PDF", cCad: "CAD", approval: "PDF & CAD"
  };
  const AP11_SLOTS = ["geran", "bPdf", "bCad", "cPdf", "cCad", "approval"];

  function ap11DefaultState() {
    const s = {
      bottom: AP11_BOTTOM_SEED.map(function (t) { return { title: t, done: false, custom: false }; })
    };
    AP11_SLOTS.forEach(function (k) { s[k] = { file: null, uploadedAt: null }; });
    return s;
  }

  function initAp11Approval(index) {
    const step = activeSteps[index];
    if (!step) return;
    if (!step.ap11) step.ap11 = ap11DefaultState();
    renderAp11(index);
  }

  // Upload slot: dashed button when empty; once a file is attached it shows
  // the file chip (+ remove) and an auto-saved timestamp — no Send step.
  function ap11SlotHtml(node, path) {
    const label = AP11_LABEL[path] || "Document";
    if (!node.file) {
      return '<button type="button" class="upload-btn" data-ap-upload="' + path + '" aria-label="Upload ' + label + '">' + UPLOAD_SVG + "Upload " + label + "</button>";
    }
    return '<span class="file-chip">' + DOC_SVG + '<span class="kb-file-name">' + esc(node.file) + "</span>" +
      '<button type="button" class="chip-del" data-ap-remove="' + path + '" aria-label="Remove">' + TRASH_SVG + "</button></span>" +
      stampHtml("System auto-saved", node.uploadedAt, "ap-auto-stamp");
  }

  function ap11DotHtml(status) {
    // "completed" -> filled green, anything else -> hollow outline
    return '<span class="ap-dot ' + (status === "completed" ? "ap-dot-done" : "ap-dot-empty") + '"></span>';
  }

  function ap11TopRowsHtml() {
    return AP11_TOP.map(function (item, i) {
      const mapped = item.step != null && activeSteps[item.step] && activeSteps[item.step].status === "completed";
      const status = mapped ? "completed" : "not-started";
      return '<div class="ap-cl-row">' +
        '<div class="ap-cl-doc"><span class="ap-cl-letter">' + letterLabel(i) + ")</span> " + esc(item.title) + "</div>" +
        '<div class="ap-cl-stat">' + ap11DotHtml(status) + "</div></div>";
    }).join("");
  }

  function ap11BottomRowsHtml(index) {
    const bottom = (activeSteps[index].ap11 && activeSteps[index].ap11.bottom) || [];
    return bottom.map(function (row, i) {
      if (row.draft) {
        return '<div class="ap-cl-row ap-cl-draft">' +
          '<div class="ap-cl-doc"><input class="ap-cl-input" data-ap-draft-input="' + i + '" value="' + esc(row.title) + '" placeholder="Document name"></div>' +
          '<div class="ap-cl-stat ap-cl-draft-btns">' +
            '<button type="button" class="gen-mini-btn gen-confirm-btn" data-ap-draft-confirm="' + i + '" aria-label="Confirm">' + CHECK_SVG + "</button>" +
            '<button type="button" class="gen-mini-btn gen-delete-btn" data-ap-draft-delete="' + i + '" aria-label="Delete">' + CLOSE_SVG + "</button>" +
          "</div></div>";
      }
      const del = row.custom
        ? '<button type="button" class="ap-cl-del" data-ap-row-delete="' + i + '" aria-label="Remove item">' + CLOSE_SVG + "</button>"
        : "";
      return '<div class="ap-cl-row">' +
        '<div class="ap-cl-doc"><span class="ap-cl-letter">' + letterLabel(i) + ")</span> " + esc(row.title) + del + "</div>" +
        '<div class="ap-cl-stat">' +
          '<button type="button" class="ap-dot-btn" data-ap-row-toggle="' + i + '" aria-label="Toggle status for ' + esc(row.title) + '">' +
            ap11DotHtml(row.done ? "completed" : "not-started") +
          "</button></div></div>";
    }).join("");
  }

  function renderAp11(index) {
    const step = activeSteps[index];
    if (!step || !step.ap11) return;
    AP11_SLOTS.forEach(function (path) {
      const wrap = stepBody.querySelector('[data-ap-drop="' + path + '"]');
      if (wrap) wrap.innerHTML = ap11SlotHtml(step.ap11[path], path);
    });
    const top = stepBody.querySelector("#ap11TopList");
    if (top) top.innerHTML = ap11TopRowsHtml();
    const bottom = stepBody.querySelector("#ap11BottomList");
    if (bottom) bottom.innerHTML = ap11BottomRowsHtml(index);
    recomputeStep11(index);
  }

  // Item d (AP approval uploaded) completes the step. Any upload or a ticked
  // checklist row flags it In Progress. Last step -> never auto-advances.
  function recomputeStep11(index) {
    const step = activeSteps[index];
    if (!step || !step.ap11) return;
    const ap = step.ap11;
    const done = !!ap.approval.file;
    const anyActivity = AP11_SLOTS.some(function (k) { return !!ap[k].file; }) ||
      ap.bottom.some(function (r) { return r.done; });
    if (done && step.status !== "completed") {
      setStepStatus(index, "completed");
    } else if (!done && anyActivity && step.status !== "in-progress") {
      setStepStatus(index, "in-progress");
    } else if (!done && !anyActivity && step.status !== "upcoming") {
      setStepStatus(index, "upcoming");
    }
  }

  function ap11SetFile(step, path, filename) {
    step.ap11[path] = { file: filename, uploadedAt: formatDateTime(new Date()) };
  }

  // Shared real single-file picker for every upload in Step 11.
  const ap11FileInput = document.createElement("input");
  ap11FileInput.type = "file";
  ap11FileInput.hidden = true;
  document.body.appendChild(ap11FileInput);

  let ap11UploadTarget = null;   // { stepIndex, path }

  ap11FileInput.addEventListener("change", function () {
    const file = ap11FileInput.files[0];
    const target = ap11UploadTarget;
    ap11UploadTarget = null;
    if (!file || !target || target.stepIndex !== selectedStepIndex) return;
    ap11SetFile(activeSteps[target.stepIndex], target.path, file.name);
    renderAp11(target.stepIndex);
  });

  stepBody.addEventListener("click", function (e) {
    if (!e.target.closest("#ap11Root")) return;
    const index = selectedStepIndex;
    const step = activeSteps[index];
    if (!step || !step.ap11) return;

    const upload = e.target.closest("[data-ap-upload]");
    if (upload) {
      const path = upload.getAttribute("data-ap-upload");
      ap11UploadTarget = { stepIndex: index, path: path };
      ap11FileInput.value = "";
      ap11FileInput.accept = AP11_ACCEPT[path] || "";
      ap11FileInput.click();
      return;
    }

    const remove = e.target.closest("[data-ap-remove]");
    if (remove) {
      step.ap11[remove.getAttribute("data-ap-remove")] = { file: null, uploadedAt: null };
      renderAp11(index);
      return;
    }

    // Toggle a checklist row's status dot.
    const toggle = e.target.closest("[data-ap-row-toggle]");
    if (toggle) {
      const row = step.ap11.bottom[Number(toggle.getAttribute("data-ap-row-toggle"))];
      if (row) row.done = !row.done;
      renderAp11(index);
      return;
    }

    // "+ Add items" -> append an editable draft row.
    if (e.target.closest("[data-ap-add]")) {
      step.ap11.bottom.push({ title: "", done: false, custom: true, draft: true });
      renderAp11(index);
      const inputs = stepBody.querySelectorAll("[data-ap-draft-input]");
      if (inputs.length) inputs[inputs.length - 1].focus();
      return;
    }

    // Confirm a draft row (needs a name).
    const confirm = e.target.closest("[data-ap-draft-confirm]");
    if (confirm) {
      const row = step.ap11.bottom[Number(confirm.getAttribute("data-ap-draft-confirm"))];
      if (!row || !String(row.title || "").trim()) return;
      row.draft = false;
      renderAp11(index);
      return;
    }

    // Delete a draft row, or remove a confirmed custom row.
    const draftDel = e.target.closest("[data-ap-draft-delete]");
    const rowDel = e.target.closest("[data-ap-row-delete]");
    if (draftDel || rowDel) {
      const i = Number((draftDel || rowDel).getAttribute(draftDel ? "data-ap-draft-delete" : "data-ap-row-delete"));
      step.ap11.bottom.splice(i, 1);
      renderAp11(index);
      return;
    }
  });

  // Keep a draft row's title in state as it's typed (survives re-render).
  stepBody.addEventListener("input", function (e) {
    if (!e.target.closest("#ap11Root")) return;
    const attr = e.target.getAttribute("data-ap-draft-input");
    if (attr == null) return;
    const step = activeSteps[selectedStepIndex];
    const row = step && step.ap11 && step.ap11.bottom[Number(attr)];
    if (row) row.title = e.target.value;
  });

  // Enter confirms a draft row; Escape drops it.
  stepBody.addEventListener("keydown", function (e) {
    if (!e.target.closest("#ap11Root")) return;
    const attr = e.target.getAttribute("data-ap-draft-input");
    if (attr == null) return;
    const index = selectedStepIndex;
    const step = activeSteps[index];
    const i = Number(attr);
    const row = step && step.ap11 && step.ap11.bottom[i];
    if (!row) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (String(row.title || "").trim()) { row.draft = false; renderAp11(index); }
    } else if (e.key === "Escape") {
      e.preventDefault();
      step.ap11.bottom.splice(i, 1);
      renderAp11(index);
    }
  });

  // Drag & drop onto a slot -> single file, honouring the slot's type filter.
  stepBody.addEventListener("dragover", function (e) {
    const zone = e.target.closest("#ap11Root [data-ap-drop]");
    if (!zone) return;
    e.preventDefault();
    zone.classList.add("dragover");
  });
  stepBody.addEventListener("dragleave", function (e) {
    const zone = e.target.closest("#ap11Root [data-ap-drop]");
    if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove("dragover");
  });
  stepBody.addEventListener("drop", function (e) {
    const zone = e.target.closest("#ap11Root [data-ap-drop]");
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove("dragover");
    const files = e.dataTransfer ? Array.prototype.slice.call(e.dataTransfer.files) : [];
    if (!files.length) return;
    const path = zone.getAttribute("data-ap-drop");
    const pattern = AP11_PATTERN[path];
    if (pattern && !pattern.test(files[0].name)) return;   // wrong file type for this slot
    const step = activeSteps[selectedStepIndex];
    if (!step || !step.ap11) return;
    ap11SetFile(step, path, files[0].name);
    renderAp11(selectedStepIndex);
  });

  /* ============================================================
     Agency settings popover (shared by Step 2 + Step 6)
     ------------------------------------------------------------
     Gear icon -> floating window of tick/untick per agency (all on
     by default). Apply flips each agency's `applicable` flag; an
     unticked agency renders "Not Applicable" (grey, disabled) and is
     excluded from that board's completion. State lives per step.
  ============================================================ */
  function closeAgencyPopover() {
    const b = document.querySelector(".agency-pop-backdrop");
    if (b) b.remove();
  }

  function openAgencyPopover(anchorEl, groups, onApply) {
    closeAgencyPopover();
    const backdrop = document.createElement("div");
    backdrop.className = "agency-pop-backdrop";
    const pop = document.createElement("div");
    pop.className = "agency-pop";

    let html = '<div class="agency-pop-head"><span>Agency settings</span>' +
      '<button type="button" class="agency-pop-x" aria-label="Close">' + CLOSE_SVG + "</button></div>" +
      '<p class="agency-pop-hint">Untick an agency to mark it not applicable.</p>';
    groups.forEach(function (g) {
      html += '<div class="agency-pop-group">' + esc(g.title) + '</div><div class="agency-pop-list">';
      g.items.forEach(function (it) {
        html += '<label class="agency-pop-item"><input type="checkbox" data-code="' + esc(it.code) + '"' +
          (it.applicable ? " checked" : "") + ">" + esc(it.code) + "</label>";
      });
      html += "</div>";
    });
    html += '<div class="agency-pop-actions">' +
      '<button type="button" class="btn btn-sm" data-pop-cancel>Cancel</button>' +
      '<button type="button" class="btn btn-sm btn-accept" data-pop-apply>Apply</button></div>';
    pop.innerHTML = html;
    backdrop.appendChild(pop);
    document.body.appendChild(backdrop);

    // Anchor below the gear, clamped to the viewport.
    const r = anchorEl.getBoundingClientRect();
    pop.style.top = Math.max(12, Math.min(r.bottom + 8, window.innerHeight - pop.offsetHeight - 12)) + "px";
    pop.style.left = Math.max(12, Math.min(r.left, window.innerWidth - pop.offsetWidth - 12)) + "px";

    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) closeAgencyPopover(); });
    pop.querySelector(".agency-pop-x").addEventListener("click", closeAgencyPopover);
    pop.querySelector("[data-pop-cancel]").addEventListener("click", closeAgencyPopover);
    pop.querySelector("[data-pop-apply]").addEventListener("click", function () {
      const map = {};
      pop.querySelectorAll("input[data-code]").forEach(function (cb) { map[cb.getAttribute("data-code")] = cb.checked; });
      closeAgencyPopover();
      onApply(map);
    });
  }

  /* ============================================================
     Step 6 · Clearance (Ext & Int Depts) — attempt-tab model
     ------------------------------------------------------------
     Per dept (step.cl6): the 6.1 letter is issued once; everything
     from 6.2 onward lives in an "attempt". Each Authority rejection
     locks the current attempt tab and opens a fresh one; the global
     revision counter (dept.roundCounter) never resets, so round keys
     continue across tabs (tab 1 ends R3 -> tab 2 starts R4).
       6.1  Approval letter -> Approve -> green -> Step 7.
       6.2  Appeal|Compliance + time impact -> Send.
            Compliance         -> resubmit rounds -> Authority gate.
            Appeal + no impact -> resubmit rounds -> Authority gate.
            Appeal + impact    -> CDO gate (Accept/Revise/Reject):
                Accept -> resubmit; Reject -> compliance -> resubmit.
       Authority gate (round Accept/Reject):
            Ok     -> acknowledged copy -> green -> Step 7.
            Not Ok -> lock tab, open next attempt tab.
     Unticked agencies (gear popover) render N/A and are excluded.
  ============================================================ */
  const CL6_STATUS = {
    "not-started": { label: "Not Started", cls: "st-not-started" },
    "in-progress": { label: "In Progress", cls: "st-in-progress" },
    "in-review":   { label: "In Review",   cls: "st-in-review" },
    "approved":    { label: "Approved",     cls: "st-completed" },
    "delay":       { label: "Delay",        cls: "st-delayed" },
    "na":          { label: "N/A",          cls: "st-na" }
  };
  const CL6_COMMENT_TYPES = ["Tiada Halang with New Condition", "Ulasan / Comment Letter", "Rejection Letter"];

  function cl6BlankFile() { return { file: null, uploadedAt: null }; }

  function cl6MakeAttempt() {
    return {
      appeal: "", timeImpact: "", sent2: null,
      apFile: cl6BlankFile(), apDate: "", apSent: null,
      meetingReq: "", meetingDate: "", meetingSent: null,
      noteFile: cl6BlankFile(), noteSent: null,
      cdoFile: cl6BlankFile(), cdoComment: "", cdoCommentSaved: null, cdoOutcome: "", cdoDecidedAt: "", cdoRevisions: [],
      rounds: [],
      authComment: "", authDecidedAt: "", authOutcome: "",
      ackFile: cl6BlankFile(), ackDate: "", ackSent: null,
      locked: false
    };
  }

  function cl6MakeDept(code) {
    return {
      code: code, applicable: true,
      letterType: "", doc: cl6BlankFile(), date: "", refNo: "", comment: "", sent1: null,
      approvedAt: null,
      attempts: [cl6MakeAttempt()], activeAttempt: 0, roundCounter: 0
    };
  }

  function cl6DefaultState(template) {
    const t = template || agencyTemplateFor();
    function mk(list) {
      return list.map(function (a) {
        const d = cl6MakeDept(a.code);
        d.name = a.name;
        d.km = a.km !== false;
        d.bp = a.bp !== false;
        d.applicable = agAffects(a);
        return d;
      });
    }
    return {
      activeAuthority: agencyDefaultAuthority(t),
      internal: mk(t.internal),
      external: mk(t.external)
    };
  }

  function cl6NoReview(d) { return d.letterType === "Tiada Halangan Letter / Approval Letter"; }
  function cl6Show62(d) { return CL6_COMMENT_TYPES.indexOf(d.letterType) !== -1; }

  function cl6DerivedStatus(d) {
    if (!d) return "not-started";
    if (!d.applicable) return "na";
    if (d.approvedAt) return "approved";
    if (d.sent1) return "in-progress";
    return "not-started";
  }

  function cl6State(index) { return activeSteps[index] && activeSteps[index].cl6; }
  function cl6ByCode(cl, code) { return cl.internal.concat(cl.external).find(function (d) { return d.code === code; }); }
  function cl6Att(d) { return d.attempts[d.activeAttempt]; }

  function initClearance(index) {
    const step = activeSteps[index];
    if (!step) return;
    if (!step.cl6) step.cl6 = cl6DefaultState();
    renderClearance(index);
  }

  /* ---------- chips ---------- */
  function cl6ChipHtml(d, activeCode, index) {
    const st = cl6DerivedStatus(d);
    const meta = agStatusMeta(index, d, st, CL6_STATUS);
    const mark = st === "approved" ? " ✓" : "";
    const active = d.code === activeCode ? " selected" : "";
    return '<button type="button" class="agency-chip ' + meta.cls + active + '" data-cl6-agency="' + d.code + '" title="' + esc(meta.label) + '">' + esc(d.code) + mark + "</button>";
  }
  function cl6ChipsHtml(list, activeCode, index) { return list.map(function (d) { return cl6ChipHtml(d, activeCode, index); }).join(""); }

  /* ---------- shared bits ---------- */
  function cl6DocHtml(fileObj, slot, locked, label) {
    if (!fileObj || !fileObj.file) {
      if (locked) return '<span class="file-chip">—</span>';
      return '<button type="button" class="upload-btn" data-cl6-upload="' + slot + '" aria-label="Upload ' + label + '">' + UPLOAD_SVG + "Upload " + label + "</button>";
    }
    const removeBtn = locked ? "" : '<button type="button" class="chip-del" data-cl6-remove="' + slot + '" aria-label="Remove">' + TRASH_SVG + "</button>";
    return '<span class="file-chip">' + DOC_SVG + '<span class="kb-file-name">' + esc(fileObj.file) + "</span>" + removeBtn + "</span>";
  }
  function cl6SendHtml(ready, sentIso, attr, locked) {
    if (sentIso) return stampHtml("System submitted", formatDateTime(sentIso));
    if (locked) return "";
    return ready ? '<button type="button" class="send-btn" ' + attr + ' aria-label="Send">' + SEND_SVG + "</button>" : "";
  }
  function cl6Opt(val, label, cur) {
    const sel = val === (cur || "") ? " selected" : "";
    const ph = val === "" ? " disabled hidden" : "";
    return '<option value="' + esc(val) + '"' + sel + ph + ">" + esc(label) + "</option>";
  }
  function cl6PpdBox(title, text) {
    return '<div class="ppd-box"><div class="ppd-box-title">' + esc(title) + '</div><div class="ppd-text">' + esc(text) + "</div></div>";
  }

  // File field for a slot: "doc" (dept) | ap|note|cdo|ack (attempt) | rpdf:i|rcad:i (round).
  function cl6FileField(dept, att, slot) {
    if (slot === "doc") return { set: function (v) { dept.doc = v; } };
    if (slot === "ap") return { set: function (v) { att.apFile = v; } };
    if (slot === "note") return { set: function (v) { att.noteFile = v; } };
    if (slot === "cdo") return { set: function (v) { att.cdoFile = v; } };
    if (slot === "ack") return { set: function (v) { att.ackFile = v; } };
    const parts = slot.split(":");
    const r = att.rounds[Number(parts[1])];
    return { set: function (v) { if (parts[0] === "rpdf") r.pdf = v; else r.cad = v; } };
  }
  function cl6SlotAccept(slot) {
    if (slot === "ap" || slot === "note" || slot === "cdo" || slot === "ack") return "";
    return (slot.indexOf("rcad") === 0) ? ".dwg,.dxf" : ".pdf,application/pdf";
  }

  function cl6Impact(att) { return !!(att.timeImpact && att.timeImpact !== "No time & no cost impact"); }

  // Has this attempt reached the "resubmit to Authority" stage?
  function cl6ResubStage(att) {
    if (!(att.appeal && att.timeImpact)) return false;
    if (!cl6Impact(att)) return true;                                   // no impact -> straight to resubmit
    return att.cdoOutcome === "accepted" || att.cdoOutcome === "rejected";  // impact -> after CDO decision
  }
  function cl6EnsureRound(dept, att) {
    if (cl6ResubStage(att) && att.rounds.length === 0) {
      att.rounds.push({ key: "R" + (dept.roundCounter++), pdf: cl6BlankFile(), cad: cl6BlankFile(), date: "", sent: null });
    }
  }

  /* ---------- attempt body ---------- */
  function cl6AttemptLabel(att, i) { return (att.appeal === "Compliance" ? "Compliance" : "Appeal") + " " + (i + 1); }

  function cl6TabsHtml(dept) {
    if (!cl6Show62(dept)) return "";
    return dept.attempts.map(function (att, i) {
      const active = i === dept.activeAttempt ? " active" : "";
      const lock = att.locked ? ' <span class="cl6-tab-lock">•</span>' : "";
      return '<button type="button" class="cl6-tab' + active + '" data-cl6-tab="' + i + '">' + esc(cl6AttemptLabel(att, i)) + lock + "</button>";
    }).join("");
  }

  function cl6CdoBodyHtml(att, locked) {
    const decided = att.cdoOutcome === "accepted" || att.cdoOutcome === "rejected";
    const rejectLabel = att.appeal === "Compliance" ? "Reject (to comply)" : "Reject (to appeal)";
    let h = '<div class="kb-upload-wrap hc-doc-row cl6-docslot" data-cl6-drop="cdo" style="max-width:320px;margin-bottom:10px">' +
      cl6DocHtml(att.cdoFile, "cdo", locked || decided, "Document") + "</div>";
    att.cdoRevisions.forEach(function (rv) { h += '<div class="round-meta rejected">To revise' + (rv ? " — " + esc(rv) : "") + "</div>"; });
    if (att.cdoOutcome === "accepted") {
      h += '<div class="round-meta accepted">Approved by CDO ' + esc(att.cdoDecidedAt) + "</div>";
      if (att.cdoComment) h += cl6PpdBox("CDO Comments", att.cdoComment);
      return h;
    }
    if (att.cdoOutcome === "rejected") {
      h += '<div class="round-meta rejected">' + esc(rejectLabel) + " " + esc(att.cdoDecidedAt) + "</div>";
      if (att.cdoComment) h += cl6PpdBox("CDO Comments", att.cdoComment);
      return h;
    }
    if (locked) return h;
    h += '<div class="cl6-cdo-actions">' +
      '<button type="button" class="cl6-cdo-accept" data-cl6-cdo="accept">Approve by CDO</button>' +
      '<button type="button" class="cl6-cdo-revise" data-cl6-cdo="revise">To revise (with remarks)</button>' +
      '<button type="button" class="cl6-cdo-reject" data-cl6-cdo="reject">' + esc(rejectLabel) + "</button>" +
      "</div>" +
      '<div class="cl6-cdo-comment"><label>CDO Comments</label>' +
      '<textarea class="cl6-comment-input" data-cl6-cdo-comment placeholder="Enter comments here…">' + esc(att.cdoComment || "") + "</textarea>" +
      "</div>";
    return h;
  }

  function cl6CdoSectionHtml(att, locked) {
    const noMeeting = att.meetingReq === "No meeting required";
    const meetingReady = noMeeting ? !!att.meetingReq : !!(att.meetingReq && att.meetingDate);
    const ivTitle = att.meetingReq === "Meeting required" ? "iv. PPD-HOD to update meeting outcome:" : "iv. CDO to review for approval:";

    let h = '<div class="pc-q cl6-appeal">' +
      '<div class="pc-q-label">If to appeal (with time/cost impact to AP/launch date):</div>' +
      '<div class="cl6-internal-tag">INTERNAL PPD USE ONLY</div>' +
      '<div class="cl6-62a-sub"><div class="cl6-62a-subtitle">i. HOD-PPD to upload the proposed adjusted AP/Launch timeline and action plan:</div>' +
        '<div class="cl6-uploadrow"><div class="kb-upload-wrap hc-doc-row cl6-docslot" data-cl6-drop="ap">' + cl6DocHtml(att.apFile, "ap", locked || !!att.apSent, "Document") + "</div>" +
        '<input type="date" class="sd-input cl6-date" data-cl6-apdate value="' + esc(att.apDate) + '"' + ((locked || att.apSent) ? " disabled" : "") + "></div>" +
        '<div class="cl6-actions">' + cl6SendHtml(!!(att.apFile.file && att.apDate), att.apSent, "data-cl6-apsend", locked) + "</div></div>" +
      '<div class="cl6-62a-sub"><div class="cl6-62a-subtitle">ii. HOD-PPD to select if required for a meeting with CDO:</div>' +
        '<div class="cl6-62-row"><select class="sd-input" data-cl6-meetingreq' + ((locked || att.meetingSent) ? " disabled" : "") + ">" +
          cl6Opt("", "Select meeting requirement", att.meetingReq) + cl6Opt("Meeting required", "Meeting required", att.meetingReq) + cl6Opt("No meeting required", "No meeting required", att.meetingReq) + "</select>" +
          (noMeeting ? "" : '<input type="date" class="sd-input" data-cl6-meetingdate value="' + esc(att.meetingDate) + '"' + ((locked || att.meetingSent) ? " disabled" : "") + ">") + "</div>" +
        '<div class="cl6-actions">' + cl6SendHtml(meetingReady, att.meetingSent, "data-cl6-meetingsend", locked) + "</div></div>";

    h += '<div class="cl6-62a-sub cl6-cdo-card"><div class="cl6-62a-subtitle">' + ivTitle + "</div>" +
        cl6CdoBodyHtml(att, locked) + "</div>" +
    "</div>";
    return h;
  }

  // Resubmit rounds — live in their own card (card 3).
  function cl6RoundsHtml(dept, att, locked) {
    let h = '<div id="cl6Rounds">';
    att.rounds.forEach(function (r, i) {
      const isLast = i === att.rounds.length - 1;
      const rlock = locked || !!r.sent || !isLast;
      h += '<div class="round-row"><div class="round-key">' + esc(r.key) + '</div><div class="round-body">' +
        '<div class="kb-row" style="margin-top:0">' +
          '<div class="kb-upload-wrap hc-doc-row" data-cl6-drop="rpdf:' + i + '">' + cl6DocHtml(r.pdf, "rpdf:" + i, rlock, "PDF") + "</div>" +
          '<div class="kb-upload-wrap hc-doc-row" data-cl6-drop="rcad:' + i + '">' + cl6DocHtml(r.cad, "rcad:" + i, rlock, "CAD") + "</div>" +
          '<input type="date" class="sd-input kb-date" data-cl6-round-date="' + i + '" value="' + esc(r.date) + '"' + (rlock ? " disabled" : "") + ">" +
          "<div>" + cl6SendHtml(!!(r.pdf.file && r.cad.file && r.date) && isLast, r.sent, 'data-cl6-round-send="' + i + '"', locked) + "</div>" +
        "</div></div></div>";
    });
    h += "</div>";
    return h;
  }

  // Authority approval gate + acknowledged copy — stays in the 6.2 card.
  function cl6AuthHtml(att, locked) {
    const last = att.rounds[att.rounds.length - 1];
    let inner = "";
    if (att.authOutcome === "accepted") {
      inner += '<div class="round-meta accepted">PPD approved ' + esc(att.authDecidedAt) + "</div>";
      if (att.authComment) inner += cl6PpdBox("PPD Comment", att.authComment);
      inner += '<div class="cl6-62a-sub"><div class="cl6-62a-subtitle">Consultant uploads acknowledged copy and doc/dwgs submitted</div>' +
        '<div class="cl6-uploadrow"><div class="kb-upload-wrap hc-doc-row cl6-docslot" data-cl6-drop="ack">' + cl6DocHtml(att.ackFile, "ack", locked || !!att.ackSent, "Document") + "</div>" +
        '<input type="date" class="sd-input cl6-date" data-cl6-ackdate value="' + esc(att.ackDate) + '"' + ((locked || att.ackSent) ? " disabled" : "") + "></div>" +
        '<div class="cl6-actions">' + cl6SendHtml(!!(att.ackFile.file && att.ackDate), att.ackSent, "data-cl6-acksend", locked) + "</div></div>";
    } else if (att.authOutcome === "rejected") {
      inner += '<div class="round-meta rejected">PPD Not Ok ' + esc(att.authDecidedAt) + "</div>";
      if (att.authComment) inner += cl6PpdBox("PPD Comment", att.authComment);
    } else if (last && last.sent && !locked) {
      inner += '<div class="ppd-box"><div class="ppd-box-title">PPD Comment</div>' +
        '<textarea data-cl6-auth-comment placeholder="PPD comment, then Ok or Not Ok…">' + esc(att.authComment || "") + "</textarea>" +
        '<div class="ppd-actions">' +
        '<button type="button" class="btn btn-sm btn-reject" data-cl6-auth="reject">✕ Not Ok</button>' +
        '<button type="button" class="btn btn-sm btn-accept" data-cl6-auth="accept">✓ Ok</button>' +
        "</div></div>";
    }
    if (!inner) return "";
    return '<div class="pc-q cl6-62a"><div class="pc-q-label">PPD Approval</div>' + inner + "</div>";
  }

  function cl6AttemptHtml(dept, att) {
    const locked = att.locked;
    const dis = locked ? " disabled" : "";
    let h = '<div class="pc-q cl6-62"><div class="pc-q-label">6.2 Appeal / Compliance classification</div>' +
      '<div class="cl6-62-row">' +
        '<select class="sd-input" data-cl6-appeal aria-label="Appeal / Compliance"' + dis + ">" +
          cl6Opt("", "Select Appeal", att.appeal) + cl6Opt("Appeal", "Appeal", att.appeal) + cl6Opt("Compliance", "Compliance", att.appeal) + "</select>" +
        '<select class="sd-input" data-cl6-time aria-label="Time impact"' + dis + ">" +
          cl6Opt("", "Select Time Impact", att.timeImpact) +
          cl6Opt("No time & no cost impact", "No time & no cost impact", att.timeImpact) +
          cl6Opt("Time & cost impact", "Time & cost impact", att.timeImpact) +
          cl6Opt("Cost impact, no time impact", "Cost impact, no time impact", att.timeImpact) +
          cl6Opt("Time impact, no cost impact", "Time impact, no cost impact", att.timeImpact) + "</select>" +
      "</div></div>";

    if (!(att.appeal && att.timeImpact)) return h;
    if (cl6Impact(att)) h += cl6CdoSectionHtml(att, locked);
    return h;
  }

  /* ---------- render ---------- */
  function renderClearance(index) {
    const cl = cl6State(index);
    if (!cl) return;

    const internalEl = stepBody.querySelector("#cl6Internal");
    const externalEl = stepBody.querySelector("#cl6External");
    if (internalEl) internalEl.innerHTML = cl6ChipsHtml(cl.internal, cl.activeAuthority, index);
    if (externalEl) externalEl.innerHTML = cl6ChipsHtml(cl.external, cl.activeAuthority, index);

    const active = cl6ByCode(cl, cl.activeAuthority);
    stepBody.querySelector("#cl6Authority").textContent = cl.activeAuthority;
    const meta = agStatusMeta(index, active, cl6DerivedStatus(active), CL6_STATUS);
    const pill = stepBody.querySelector("#cl6StatusPill");
    pill.textContent = meta.label;
    pill.className = "st-chip " + meta.cls;

    const tabsEl = stepBody.querySelector("[data-cl6-tabs]");
    const attEl = stepBody.querySelector("[data-cl6-attempt]");

    // Not Applicable: keep the 6.1 card (greyed), hide the 6.2 card + show note.
    const naActive = !!(active && !active.applicable);
    const naNote = stepBody.querySelector("[data-cl6-na-note]");
    if (naNote) naNote.hidden = !naActive;
    const mainQ = stepBody.querySelector("[data-cl6-main]");
    if (mainQ) mainQ.classList.toggle("cl6-dim", naActive);
    const card2 = stepBody.querySelector("[data-cl6-card2]");
    if (card2) card2.hidden = naActive || !(active && cl6Show62(active));   // 6.2 card only for review letters

    // 6.1 (locks on sent1)
    const l1 = !!(active && active.sent1);
    const select = stepBody.querySelector("[data-cl6-letter]");
    if (select) { select.value = (active && active.letterType) || ""; select.disabled = l1; }
    const docSlot = stepBody.querySelector('[data-cl6-drop="doc"]');
    if (docSlot) docSlot.innerHTML = cl6DocHtml(active && active.doc, "doc", l1, "Document");
    const dateInput = stepBody.querySelector("[data-cl6-date]");
    if (dateInput) { dateInput.value = (active && active.date) || ""; dateInput.disabled = l1; }
    const refInput = stepBody.querySelector("[data-cl6-refno]");
    if (refInput) { refInput.value = (active && active.refNo) || ""; refInput.disabled = l1; }
    const showComment = !!(active && cl6Show62(active));
    const commentBox = stepBody.querySelector("[data-cl6-comment-box]");
    if (commentBox) commentBox.hidden = !showComment;
    const commentInput = stepBody.querySelector("[data-cl6-comment]");
    if (commentInput) { commentInput.value = (active && active.comment) || ""; commentInput.disabled = l1; }
    const send1Wrap = stepBody.querySelector("[data-cl6-send1-wrap]");
    if (send1Wrap) send1Wrap.innerHTML = active ? cl6SendHtml(!!(active.letterType && active.doc.file && active.date && active.refNo), active.sent1, "data-cl6-send1", false) : "";
    const approveWrap = stepBody.querySelector("[data-cl6-approve-wrap]");
    if (approveWrap) {
      if (active && active.approvedAt) approveWrap.innerHTML = stampHtml("Approved", formatDateTime(active.approvedAt));
      else if (active && cl6NoReview(active) && active.sent1) approveWrap.innerHTML = '<button type="button" class="btn btn-sm btn-accept" data-cl6-approve>✓ Approve</button>';
      else approveWrap.innerHTML = "";
    }

    // Tabs + active attempt (review letters only)
    const showAttempt = !naActive && active && cl6Show62(active);
    if (showAttempt) {
      cl6EnsureRound(active, cl6Att(active));
      if (tabsEl) tabsEl.innerHTML = cl6TabsHtml(active);
      if (attEl) attEl.innerHTML = cl6AttemptHtml(active, cl6Att(active));
    } else {
      if (tabsEl) tabsEl.innerHTML = "";
      if (attEl) attEl.innerHTML = "";
    }

    // Card 3: resubmit rounds — only once the attempt reaches resubmit stage
    const att = showAttempt ? cl6Att(active) : null;
    const resubShow = !!(att && cl6ResubStage(att));
    const card3 = stepBody.querySelector("[data-cl6-card3]");
    if (card3) card3.hidden = !resubShow;
    const resubEl = stepBody.querySelector("[data-cl6-resub]");
    if (resubEl) resubEl.innerHTML = resubShow ? cl6RoundsHtml(active, att, att.locked) + cl6AuthHtml(att, att.locked) : "";

    recomputeStep6(index);
  }

  // Step 6 completes once every applicable dept is Approved (green).
  function recomputeStep6(index) {
    const step = activeSteps[index];
    const cl = step && step.cl6;
    if (!cl) return;
    const all = cl.internal.concat(cl.external).filter(function (d) { return d.applicable; });
    const allApproved = all.length > 0 && all.every(function (d) { return !!d.approvedAt; });
    const anyActivity = all.some(function (d) { return d.sent1 || d.letterType; });
    if (allApproved && step.status !== "completed") {
      setStepStatus(index, "completed");
      if (index + 1 < STEP_NAMES.length) selectStep(index + 1, { scrollToStep: false });
    } else if (!allApproved && anyActivity && step.status === "upcoming") {
      setStepStatus(index, "in-progress");
    }
  }

  /* ---------- file picker ---------- */
  const cl6FileInput = document.createElement("input");
  cl6FileInput.type = "file";
  cl6FileInput.hidden = true;
  document.body.appendChild(cl6FileInput);
  let cl6UploadTarget = null;   // { stepIndex, code, slot }

  cl6FileInput.addEventListener("change", function () {
    const file = cl6FileInput.files[0];
    const target = cl6UploadTarget;
    cl6UploadTarget = null;
    if (!file || !target || target.stepIndex !== selectedStepIndex) return;
    const cl = cl6State(target.stepIndex);
    const dept = cl && cl6ByCode(cl, target.code);
    if (!dept) return;
    cl6FileField(dept, cl6Att(dept), target.slot).set({ file: file.name, uploadedAt: formatDateTime(new Date()) });
    renderClearance(target.stepIndex);
  });

  /* ---------- clicks ---------- */
  stepBody.addEventListener("click", function (e) {
    if (!e.target.closest("#cl6Root")) return;
    const index = selectedStepIndex;
    const cl = cl6State(index);
    if (!cl) return;

    // Gear -> agency settings popover.
    const gear = e.target.closest("[data-cl6-settings]");
    if (gear) {
      openAgencyPopover(gear, [
        { title: "Internal Agency", items: cl.internal },
        { title: "External Agency", items: cl.external }
      ], function (map) {
        cl.internal.concat(cl.external).forEach(function (d) {
          if (Object.prototype.hasOwnProperty.call(map, d.code)) d.applicable = map[d.code];
        });
        renderClearance(index);
      });
      return;
    }

    const chip = e.target.closest("[data-cl6-agency]");
    if (chip) { cl.activeAuthority = chip.getAttribute("data-cl6-agency"); renderClearance(index); return; }

    const active = cl6ByCode(cl, cl.activeAuthority);
    if (!active) return;

    const tab = e.target.closest("[data-cl6-tab]");
    if (tab) { active.activeAttempt = Number(tab.getAttribute("data-cl6-tab")); renderClearance(index); return; }

    const att = cl6Att(active);

    // Uploads / removes (any slot).
    const up = e.target.closest("[data-cl6-upload]");
    if (up) {
      const slot = up.getAttribute("data-cl6-upload");
      cl6UploadTarget = { stepIndex: index, code: active.code, slot: slot };
      cl6FileInput.value = "";
      cl6FileInput.accept = cl6SlotAccept(slot);
      cl6FileInput.click();
      return;
    }
    const rm = e.target.closest("[data-cl6-remove]");
    if (rm) { cl6FileField(active, att, rm.getAttribute("data-cl6-remove")).set({ file: null, uploadedAt: null }); renderClearance(index); return; }

    // 6.1 Send / Approve.
    if (e.target.closest("[data-cl6-send1]")) {
      active.sent1 = new Date().toISOString();
      if (activeSteps[index].status === "upcoming") setStepStatus(index, "in-progress");
      renderClearance(index); return;
    }
    if (e.target.closest("[data-cl6-approve]")) { active.approvedAt = new Date().toISOString(); renderClearance(index); return; }

    // CDO decisions.
    const cdo = e.target.closest("[data-cl6-cdo]");
    if (cdo) {
      const ta = stepBody.querySelector("[data-cl6-cdo-comment]");
      const comment = ta ? ta.value.trim() : att.cdoComment;
      const decision = cdo.getAttribute("data-cl6-cdo");
      if (decision === "accept") { att.cdoComment = comment; att.cdoOutcome = "accepted"; att.cdoDecidedAt = formatDateTime(new Date()); }
      else if (decision === "reject") { att.cdoComment = comment; att.cdoOutcome = "rejected"; att.cdoDecidedAt = formatDateTime(new Date()); }
      else { att.cdoRevisions.push(comment); att.cdoFile = cl6BlankFile(); att.cdoComment = ""; att.cdoCommentSaved = null; active.roundCounter++; }
      renderClearance(index); return;
    }

    // Resubmit round Send.
    const roundSend = e.target.closest("[data-cl6-round-send]");
    if (roundSend) { att.rounds[Number(roundSend.getAttribute("data-cl6-round-send"))].sent = new Date().toISOString(); renderClearance(index); return; }

    // Authority decision.
    const auth = e.target.closest("[data-cl6-auth]");
    if (auth) {
      const ta = stepBody.querySelector("[data-cl6-auth-comment]");
      att.authComment = ta ? ta.value.trim() : "";
      att.authDecidedAt = formatDateTime(new Date());
      if (auth.getAttribute("data-cl6-auth") === "accept") {
        att.authOutcome = "accepted";   // -> ack copy -> green on ack send
      } else {
        att.authOutcome = "rejected";
        att.locked = true;
        active.attempts.push(cl6MakeAttempt());
        active.activeAttempt = active.attempts.length - 1;
      }
      renderClearance(index); return;
    }

    // Acknowledged-copy Send -> department Approved (green).
    if (e.target.closest("[data-cl6-acksend]")) { att.ackSent = new Date().toISOString(); active.approvedAt = att.ackSent; renderClearance(index); return; }

    // 6.2a (i) dates Send (legacy set-date block removed; no-op guard kept minimal).
  });

  /* ---------- inputs (text/date; no full re-render for text) ---------- */
  stepBody.addEventListener("input", function (e) {
    if (!e.target.closest("#cl6Root")) return;
    const cl = cl6State(selectedStepIndex);
    const active = cl && cl6ByCode(cl, cl.activeAuthority);
    if (!active) return;
    const att = cl6Att(active);
    // 6.1 text/date -> state + refresh Send1 only (keep focus).
    if (e.target.hasAttribute("data-cl6-date")) { active.date = e.target.value; refreshSend1(active); return; }
    if (e.target.hasAttribute("data-cl6-refno")) { active.refNo = e.target.value; refreshSend1(active); return; }
    if (e.target.hasAttribute("data-cl6-comment")) { active.comment = e.target.value; return; }
    // attempt textareas -> state only.
    if (e.target.hasAttribute("data-cl6-cdo-comment")) { att.cdoComment = e.target.value; return; }
    if (e.target.hasAttribute("data-cl6-auth-comment")) { att.authComment = e.target.value; return; }
    // attempt dates -> state + re-render attempt body (refresh dependent Send).
    if (e.target.hasAttribute("data-cl6-apdate")) { att.apDate = e.target.value; renderCl6Attempt(); return; }
    if (e.target.hasAttribute("data-cl6-meetingdate")) { att.meetingDate = e.target.value; renderCl6Attempt(); return; }
    if (e.target.hasAttribute("data-cl6-ackdate")) { att.ackDate = e.target.value; renderCl6Attempt(); return; }
    const rd = e.target.getAttribute("data-cl6-round-date");
    if (rd != null) { att.rounds[Number(rd)].date = e.target.value; renderCl6Attempt(); return; }
  });

  function refreshSend1(active) {
    const w = stepBody.querySelector("[data-cl6-send1-wrap]");
    if (w) w.innerHTML = cl6SendHtml(!!(active.letterType && active.doc.file && active.date && active.refNo), active.sent1, "data-cl6-send1", false);
  }
  function renderCl6Attempt() {
    const cl = cl6State(selectedStepIndex);
    const active = cl && cl6ByCode(cl, cl.activeAuthority);
    if (!active) return;
    const attEl = stepBody.querySelector("[data-cl6-attempt]");
    if (attEl && cl6Show62(active)) { cl6EnsureRound(active, cl6Att(active)); attEl.innerHTML = cl6AttemptHtml(active, cl6Att(active)); }
    // Keep card 3 (resubmit rounds) in sync.
    const att = cl6Att(active);
    const resubShow = cl6Show62(active) && cl6ResubStage(att);
    const card3 = stepBody.querySelector("[data-cl6-card3]");
    if (card3) card3.hidden = !resubShow;
    const resubEl = stepBody.querySelector("[data-cl6-resub]");
    if (resubEl) resubEl.innerHTML = resubShow ? cl6RoundsHtml(active, att, att.locked) + cl6AuthHtml(att, att.locked) : "";
  }

  /* ---------- selects (change) ---------- */
  stepBody.addEventListener("change", function (e) {
    if (!e.target.closest("#cl6Root")) return;
    const cl = cl6State(selectedStepIndex);
    const active = cl && cl6ByCode(cl, cl.activeAuthority);
    if (!active) return;
    const att = cl6Att(active);
    if (e.target.hasAttribute("data-cl6-letter")) { active.letterType = e.target.value; renderClearance(selectedStepIndex); }
    else if (e.target.hasAttribute("data-cl6-appeal")) { att.appeal = e.target.value; renderClearance(selectedStepIndex); }
    else if (e.target.hasAttribute("data-cl6-time")) { att.timeImpact = e.target.value; renderClearance(selectedStepIndex); }
    else if (e.target.hasAttribute("data-cl6-meetingreq")) { att.meetingReq = e.target.value; renderCl6Attempt(); }
  });

  /* ---------- drag & drop onto any upload slot ---------- */
  stepBody.addEventListener("dragover", function (e) {
    const zone = e.target.closest("#cl6Root [data-cl6-drop]");
    if (!zone) return;
    e.preventDefault(); zone.classList.add("dragover");
  });
  stepBody.addEventListener("dragleave", function (e) {
    const zone = e.target.closest("#cl6Root [data-cl6-drop]");
    if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove("dragover");
  });
  stepBody.addEventListener("drop", function (e) {
    const zone = e.target.closest("#cl6Root [data-cl6-drop]");
    if (!zone) return;
    e.preventDefault(); zone.classList.remove("dragover");
    if (!zone.querySelector("[data-cl6-upload]")) return;   // locked slots don't accept
    const files = e.dataTransfer ? Array.prototype.slice.call(e.dataTransfer.files) : [];
    if (!files.length) return;
    const cl = cl6State(selectedStepIndex);
    const active = cl && cl6ByCode(cl, cl.activeAuthority);
    if (!active) return;
    cl6FileField(active, cl6Att(active), zone.getAttribute("data-cl6-drop")).set({ file: files[0].name, uploadedAt: formatDateTime(new Date()) });
    renderClearance(selectedStepIndex);
  });

  /* ============================================================
     Settings (header gear) — Global + Project tabs
     ------------------------------------------------------------
     Global  1 add Region / BU / Project     2 BU agency template
             3 role permissions (placeholder) 4 BU duration template
     Project 1 target dates  2 agency applicability  3 members
     A BU template is FORWARD-ONLY: it stamps a project when the
     project is created and never rewrites an existing one. Edits
     here save immediately; everything resets on reload.
  ============================================================ */
  const SET_NODE = {
    "1": { i: 0 }, "2": { i: 1 }, "3": { i: 2 }, "4": { i: 3 }, "5": { i: 4 },
    "6km": { i: 5 }, "6bp": { i: 5, bp: true },
    "7": { i: 6 }, "8": { i: 7 }, "9": { i: 8 }, "10": { i: 9 }, "11": { i: 10 }
  };
  // Cascade order — everything after the two anchor steps, parents first.
  const SET_ORDER = ["3", "4", "5", "6km", "6bp", "7", "8", "9", "10", "11"];
  const SET_SHORT = { "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6km": "6-KM", "6bp": "6-BP", "7": "7", "8": "8", "9": "9", "10": "10", "11": "11" };
  const SET_ROWS = [
    { key: "1", label: "1 · Design Approval" }, { key: "2", label: "2 · Pre-consult" },
    { key: "3", label: "3 · KM & BP Submission" }, { key: "4", label: "4 · Hardcopy" },
    { key: "5", label: "5 · OSC Meeting" }, { key: "6km", label: "6-KM · Clearance (KM)" },
    { key: "6bp", label: "6-BP · Clearance (BP)" }, { key: "7", label: "7 · KM Approval" },
    { key: "8", label: "8 · BP Approval" }, { key: "9", label: "9 · Sifus Approval" },
    { key: "10", label: "10 · COB Approval" }, { key: "11", label: "11 · AP Approval" }
  ];
  function setEdgeLabel(c) { return SET_SHORT[c.from] + " → " + SET_SHORT[c.to]; }

  function setBuTemplate(bu) {
    const t = SETTINGS.buTemplates, key = bu || "_default";
    if (!t[key]) {
      const ag = AGENCY_TEMPLATES[key] || AGENCY_TEMPLATES._default;
      t[key] = {
        durations: SETTINGS.durationsDefault.slice(),
        internal: JSON.parse(JSON.stringify(ag.internal)),
        external: JSON.parse(JSON.stringify(ag.external))
      };
    }
    return t[key];
  }
  function setDurations() { return setBuTemplate(buSelect.value).durations; }

  // A project keeps the agency template it was stamped with; anything
  // else falls back to its BU's template.
  function agencyTemplateFor() {
    const p = PROJECT_DETAILS[projectSelect.value];
    return (p && p.agencyTemplate) ? p.agencyTemplate : setBuTemplate(buSelect.value);
  }
  // An agency applies at all if it affects KM, BP, or both. Unticking
  // both renders it Not Applicable (data preserved) rather than removing
  // it, so a per-project override can switch it back on.
  function agAffects(a) { return a.km !== false || a.bp !== false; }
  function agAffectsKind(a, kind) { return kind === "bp" ? a.bp !== false : a.km !== false; }

  function agencyDefaultAuthority(t) {
    const first = t.internal.concat(t.external).filter(agAffects)[0];
    return first ? first.code : "";
  }
  function agencyBoardSeed(template) {
    const t = template || agencyTemplateFor();
    function mk(list) {
      return list.map(function (a) {
        return {
          code: a.code, name: a.name, km: a.km !== false, bp: a.bp !== false,
          status: "not-started", applicable: agAffects(a)
        };
      });
    }
    return { activeAuthority: agencyDefaultAuthority(t), internal: mk(t.internal), external: mk(t.external) };
  }

  function setNodeSrc(steps, key) {
    const n = SET_NODE[key];
    if (!n || !steps[n.i]) return null;
    if (!n.bp) return steps[n.i];
    if (!steps[n.i].bp) steps[n.i].bp = { ts: "—", as: "—", te: "—", ae: "—" };
    return steps[n.i].bp;
  }

  // A node starts when its EARLIEST predecessor ends (the KM and BP
  // branches run in parallel into step 8) and ends at the LATEST
  // predecessorEnd + edgeDays, so the slowest incoming branch governs.
  function cascadeDates(steps, durations, overwriteManual) {
    SET_ORDER.forEach(function (key) {
      const tgt = setNodeSrc(steps, key);
      if (!tgt) return;
      // A hand-edited row keeps its own length; read it before ts moves.
      const keepDays = (tgt.manual && !overwriteManual) ? setSpanDays(tgt) : "";
      let start = null, end = null;
      DASH_CONN.forEach(function (c, i) {
        if (c.to !== key) return;
        const src = setNodeSrc(steps, c.from);
        const pte = src && parseSeedDate(src.te);
        if (!pte) return;
        if (!start || pte < start) start = pte;      // chain onto the earliest predecessor
        const days = durations[i];
        if (days == null || days === "") return;
        const cand = addDays(pte, Number(days));
        if (!end || cand > end) end = cand;          // slowest incoming branch governs
      });
      if (!start) return;
      // Every start re-chains onto the previous end, manual rows included, so
      // the timeline is always continuous after a recompute.
      tgt.ts = fmtSeedDate(start);
      if (keepDays !== "") tgt.te = fmtSeedDate(addDays(start, keepDays));
      else if (end) { tgt.te = fmtSeedDate(end); tgt.manual = false; }
    });
  }

  function setBlankSteps() {
    const steps = STEP_NAMES.map(function () { return { status: "upcoming", ts: "—", as: "—", te: "—", ae: "—" }; });
    steps[5].bp = { ts: "—", as: "—", te: "—", ae: "—" };
    return steps;
  }

  function setCreateProject(region, bu, name, a) {
    DATA[region][bu].push(name);
    const steps = setBlankSteps();
    steps[0].ts = a.s1ts; steps[0].te = a.s1te;
    steps[1].ts = a.s2ts; steps[1].te = a.s2te;
    const tpl = setBuTemplate(bu);
    cascadeDates(steps, tpl.durations, true);
    const last = parseSeedDate(steps[10].te);
    PROJECT_DETAILS[name] = {
      dashboard: "KM/BP DASHBOARD",
      updated: fmtSeedDate(new Date()),
      targetDate: last ? isoOf(last) : null,
      steps: steps,
      agencyTemplate: JSON.parse(JSON.stringify({ internal: tpl.internal, external: tpl.external })),
      members: []
    };
  }

  // Rebuild the header cascade in place, keeping the current selection.
  function setRefreshNav() {
    const r = regionSelect.value, b = buSelect.value, p = projectSelect.value;
    resetSelect(regionSelect, "Select Region");
    fillOptions(regionSelect, Object.keys(DATA));
    if (!r || !DATA[r]) return;
    regionSelect.value = r;
    resetSelect(buSelect, "Select Business Unit");
    fillOptions(buSelect, Object.keys(DATA[r]));
    buSelect.disabled = false;
    if (!b || !DATA[r][b]) return;
    buSelect.value = b;
    resetSelect(projectSelect, "Select Project");
    fillOptions(projectSelect, DATA[r][b]);
    projectSelect.disabled = !DATA[r][b].length;
    if (p && DATA[r][b].indexOf(p) !== -1) projectSelect.value = p;
  }

  function setRefreshProject() {
    const d = PROJECT_DETAILS[projectSelect.value];
    if (!d) return;
    activeSteps = d.steps;
    renderTimeline(d.steps);
    document.getElementById("phCountdown").textContent = daysLeft(d.targetDate);
    document.getElementById("phUpdated").textContent = d.updated;
    if (projectDashboard && !projectDashboard.hidden) renderDashboard();
  }

  /* ---------- markup ---------- */
  let setTab = "global";
  const setMsg = { g2: "", p1: "" };      // inline validation notices, per section
  function setAlertHtml(key) {
    return setMsg[key] ? '<p class="set-alert">' + esc(setMsg[key]) + "</p>" : "";
  }
  function setClearMsgs() { setMsg.g2 = ""; setMsg.p1 = ""; }
  const setSel = { region: "", bu: "" };

  /* ---------- section drafts ----------
     Field edits land in a per-section draft; nothing reaches the app
     until Apply, and Cancel throws the draft away. A draft is null
     while its section is clean. Global section 1 is NOT drafted —
     Add Region / Create Project are one-shot actions, and staging
     "create a thing" behind Apply reads as broken.
  ------------------------------------------------------------------ */
  const setDraft = { g2: null, g3: null, g4: null, p1: null, p2: null, p3: null };
  const SET_SEC_LABEL = {
    g2: "Global · 2 Agency template", g3: "Global · 3 Access permission",
    g4: "Global · 4 Duration template", p1: "Project · 1 Target dates",
    p2: "Project · 2 Agency applicability", p3: "Project · 3 Access permission"
  };
  function setDirtyKeys() { return Object.keys(setDraft).filter(function (k) { return setDraft[k]; }); }
  function setClearDrafts() { Object.keys(setDraft).forEach(function (k) { setDraft[k] = null; }); }

  // Reveal a section's Apply/Cancel bar in place. Doing this without a
  // re-render is what lets you keep typing in a text field without
  // losing focus or caret position the moment the section goes dirty.
  function setDirty(key) {
    const bar = document.querySelector('.set-modal [data-set-bar="' + key + '"]');
    if (bar) bar.hidden = false;
  }
  function setActionsHtml(key) {
    return '<div class="set-actions" data-set-bar="' + key + '"' + (setDraft[key] ? "" : " hidden") + ">" +
      '<span class="set-dirty">Un-applied changes</span>' +
      '<button type="button" class="btn btn-sm" data-set-cancel="' + key + '">Cancel</button>' +
      '<button type="button" class="btn btn-sm btn-accept" data-set-apply="' + key + '">Apply</button></div>';
  }

  /* Draft accessors — the draft once dirty, the live state until then. */
  function setAgDraft(bu) {
    if (!setDraft.g2) setDraft.g2 = {};
    if (!setDraft.g2[bu]) {
      const t = setBuTemplate(bu);
      setDraft.g2[bu] = {
        internal: JSON.parse(JSON.stringify(t.internal)),
        external: JSON.parse(JSON.stringify(t.external))
      };
    }
    return setDraft.g2[bu];
  }
  function setAgView(bu) { return (setDraft.g2 && setDraft.g2[bu]) || setBuTemplate(bu); }

  function setPermDraft() {
    if (!setDraft.g3) setDraft.g3 = JSON.parse(JSON.stringify(SETTINGS.matrix));
    return setDraft.g3;
  }
  function setPermView() { return setDraft.g3 || SETTINGS.matrix; }

  function setDurDraft(bu) {
    if (!setDraft.g4) setDraft.g4 = {};
    if (!setDraft.g4[bu]) setDraft.g4[bu] = setBuTemplate(bu).durations.slice();
    return setDraft.g4[bu];
  }
  function setDurView(bu) { return (setDraft.g4 && setDraft.g4[bu]) || setBuTemplate(bu).durations; }

  // p1 mirrors only the editable date fields, in a steps-shaped array, so
  // setNodeSrc and cascadeDates operate on the draft unchanged.
  function setDatesDraft() {
    if (!setDraft.p1) {
      const d = PROJECT_DETAILS[projectSelect.value];
      const steps = d.steps.map(function (s) { return { ts: s.ts, te: s.te, manual: !!s.manual }; });
      const bp = d.steps[5] && d.steps[5].bp;
      steps[5].bp = { ts: bp ? bp.ts : "—", te: bp ? bp.te : "—", manual: !!(bp && bp.manual) };
      setDraft.p1 = { steps: steps, targetDate: d.targetDate };
    }
    return setDraft.p1;
  }
  function setDatesView() {
    const d = PROJECT_DETAILS[projectSelect.value];
    return setDraft.p1 || { steps: d.steps, targetDate: d.targetDate };
  }

  function setProjAgDraft() {
    if (!setDraft.p2) {
      const fl = function (a) { return { km: a.km !== false, bp: a.bp !== false }; };
      const snap = function (s) { return { internal: s.internal.map(fl), external: s.external.map(fl) }; };
      setDraft.p2 = { pc: snap(activeSteps[1].pc), cl6: snap(activeSteps[5].cl6) };
    }
    return setDraft.p2;
  }
  function setProjAgFlags(tag, kind, i) {
    const live = tag === "pc" ? activeSteps[1].pc : activeSteps[5].cl6;
    return setDraft.p2 ? setDraft.p2[tag][kind][i] : live[kind][i];
  }

  function setMembersDraft() {
    if (!setDraft.p3) setDraft.p3 = JSON.parse(JSON.stringify(PROJECT_DETAILS[projectSelect.value].members || []));
    return setDraft.p3;
  }
  function setMembersView() {
    const d = PROJECT_DETAILS[projectSelect.value];
    return setDraft.p3 || (d.members = d.members || []);
  }

  function setApply(key) {
    const d = setDraft[key];
    if (!d) return;
    if (key === "g2") {
      Object.keys(d).forEach(function (bu) {
        const t = setBuTemplate(bu);
        t.internal = d[bu].internal;
        t.external = d[bu].external;
      });
    } else if (key === "g3") {
      SETTINGS.matrix = d;
    } else if (key === "g4") {
      Object.keys(d).forEach(function (bu) { setBuTemplate(bu).durations = d[bu]; });
    } else if (key === "p1") {
      // Copy field values onto the existing step objects — activeSteps points
      // at this array, and replacing it would orphan every step's pc/cl6 state.
      const steps = PROJECT_DETAILS[projectSelect.value].steps;
      d.steps.forEach(function (m, i) {
        steps[i].ts = m.ts; steps[i].te = m.te; steps[i].manual = m.manual;
        if (!m.bp) return;
        if (!steps[i].bp) steps[i].bp = { as: "—", ae: "—" };
        steps[i].bp.ts = m.bp.ts; steps[i].bp.te = m.bp.te; steps[i].bp.manual = m.bp.manual;
      });
      PROJECT_DETAILS[projectSelect.value].targetDate = d.targetDate;
    } else if (key === "p2") {
      [["pc", activeSteps[1].pc], ["cl6", activeSteps[5].cl6]].forEach(function (p) {
        ["internal", "external"].forEach(function (kind) {
          d[p[0]][kind].forEach(function (f, i) {
            const a = p[1][kind][i];
            a.km = f.km; a.bp = f.bp; a.applicable = agAffects(a);
          });
        });
      });
    } else if (key === "p3") {
      PROJECT_DETAILS[projectSelect.value].members = d;
    }
    setDraft[key] = null;
    setClearMsgs();
    // g2 is forward-only and g3 is a placeholder, so neither touches the views.
    if (key === "g4" || key === "p1" || key === "p2") setRefreshProject();
    renderSettings();
  }

  function setCancel(key) { setDraft[key] = null; setClearMsgs(); renderSettings(); }

  // The agency-template row a section-2 input belongs to (drafted on touch).
  function setAgRow(el) {
    return setAgDraft(el.getAttribute("data-set-bu-key"))[el.getAttribute("data-kind")][Number(el.getAttribute("data-i"))];
  }

  function setSelectHtml(attr, items, cur) {
    return "<select " + attr + ">" + (items.length ? "" : '<option value="">—</option>') +
      items.map(function (v) {
        return '<option value="' + esc(v) + '"' + (v === cur ? " selected" : "") + ">" + esc(v) + "</option>";
      }).join("") + "</select>";
  }

  function setStructureHtml() {
    const bus = Object.keys(DATA[setSel.region] || {});
    const projects = (DATA[setSel.region] || {})[setSel.bu] || [];
    return '<section class="set-sec"><h4>1 · Region / Project</h4>' +
      '<p class="set-note">Business units are added in section 2, where their agency list lives.</p>' +
      '<div class="set-row"><label>Region</label>' + setSelectHtml("data-set-region", Object.keys(DATA), setSel.region) +
        '<input type="text" data-set-newregion placeholder="New region name">' +
        '<button type="button" class="btn btn-sm btn-accept" data-set-addregion>Add region</button></div>' +
      '<div class="set-sub">Add project</div>' +
      '<div class="set-row"><label>Business Unit</label>' + setSelectHtml("data-set-bu", bus, setSel.bu) +
        '<span class="set-note">Projects here: ' + (projects.length ? esc(projects.join(", ")) : "none yet") + "</span></div>" +
      '<div class="set-row"><label>Name</label><input type="text" data-set-newproj placeholder="Project name"></div>' +
      '<div class="set-row"><label>Step 1 target</label>' +
        '<input type="date" data-set-a="s1ts" aria-label="Step 1 target start">' +
        '<input type="date" data-set-a="s1te" aria-label="Step 1 target end"></div>' +
      '<div class="set-row"><label>Step 2 target</label>' +
        '<input type="date" data-set-a="s2ts" aria-label="Step 2 target start">' +
        '<input type="date" data-set-a="s2te" aria-label="Step 2 target end"></div>' +
      '<div class="set-row"><button type="button" class="btn btn-sm btn-accept" data-set-addproj' +
        (setSel.bu ? "" : " disabled") + ">Create project</button>" +
        '<span class="set-note">Steps 3–11 are computed from the ' + esc(setSel.bu || "BU") + " duration template below.</span></div></section>";
  }

  // Region a BU sits under, for the column header.
  function setRegionOf(bu) {
    const regions = Object.keys(DATA);
    for (let i = 0; i < regions.length; i++) if (DATA[regions[i]][bu]) return regions[i];
    return "—";
  }

  // One column per BU. Lists are independent per BU (the same role is a
  // different authority in each state), so each column is self-contained
  // and columns need not have equal row counts.
  // A BU counts as configured once it has more than the default OSC row.
  function setAgConfigured(bu) {
    const t = setBuTemplate(bu);
    return (t.internal.length + t.external.length) > 1 ? 1 : 0;
  }

  function setAgencyTplHtml() {
    // Scoped to one region, configured BUs first — showing every BU in the
    // group means scrolling past a dozen OSC-only columns to reach the real ones.
    const region = setSel.region || Object.keys(DATA)[0] || "";
    const bus = Object.keys(DATA[region] || {}).sort(function (a, b) {
      return setAgConfigured(b) - setAgConfigured(a);
    });

    function rows(bu, kind) {
      const list = setAgView(bu)[kind];
      return list.map(function (a, i) {
        const d = ' data-set-bu-key="' + esc(bu) + '" data-kind="' + kind + '" data-i="' + i + '"';
        return '<div class="ag-row">' +
          '<input type="text" class="ag-name" value="' + esc(a.name || "") + '" placeholder="Agency name" data-set-agname' + d + ">" +
          '<input type="text" class="ag-code" value="' + esc(a.code || "") + '" placeholder="Code" data-set-agcode' + d + ">" +
          '<span class="ag-ck"><input type="checkbox" data-set-agkm' + d + (a.km !== false ? " checked" : "") + "></span>" +
          '<span class="ag-ck"><input type="checkbox" data-set-agbp' + d + (a.bp !== false ? " checked" : "") + "></span>" +
          '<button type="button" class="set-del" data-set-agdel' + d + ' aria-label="Remove agency">' + CLOSE_SVG + "</button>" +
          "</div>";
      }).join("") +
      '<button type="button" class="ag-addrow" data-set-addag="' + kind + '" data-set-bu-key="' + esc(bu) + '">+ Add ' + kind + " agency</button>";
    }

    function col(bu) {
      return '<div class="ag-bu">' +
        '<div class="ag-head"><div class="ag-reg">' + esc(setRegionOf(bu)) + "</div>" +
          '<div class="ag-nm">' + esc(bu) + "</div></div>" +
        '<div class="ag-cols"><span>Agency</span><span>Code</span><span>KM</span><span>BP</span><span></span></div>' +
        '<div class="ag-grp">Internal departments</div>' + rows(bu, "internal") +
        '<div class="ag-grp">External departments</div>' + rows(bu, "external") +
        "</div>";
    }

    return '<section class="set-sec"><h4>2 · Authority agency template by Business Unit</h4>' +
      '<p class="set-note">Each BU keeps its own list — the same role is a different authority in each state. <strong>KM</strong> and <strong>BP</strong> control which clearance board and dashboard matrix an agency appears on; unticking both marks it Not Applicable without losing its data. Codes must be unique within a BU. Forward-only — existing projects are untouched.</p>' +
      '<div class="set-row"><label>Show region</label>' + setSelectHtml("data-set-region", Object.keys(DATA), region) +
        '<span class="set-note">' + bus.length + " business unit" + (bus.length === 1 ? "" : "s") + " in " + esc(region) + "</span></div>" +
      setAlertHtml("g2") +
      '<div class="ag-scroll"><div class="ag-lane">' + bus.map(col).join("") +
        '<div class="ag-newbu"><div class="ag-newbu-h">Add Business Unit</div>' +
          '<div class="set-row"><label>Region</label>' + setSelectHtml("data-set-newbu-region", Object.keys(DATA), setSel.region) + "</div>" +
          '<div class="set-row"><input type="text" data-set-newbu placeholder="Business unit name"></div>' +
          '<div class="set-row"><button type="button" class="btn btn-sm btn-accept" data-set-addbu>Add BU column</button></div>' +
          '<p class="set-note">Starts with the default OSC row only.</p></div>' +
      "</div></div>" + setActionsHtml("g2") + "</section>";
  }

  function setPermHtml() {
    return '<section class="set-sec"><h4>3 · Access permission by role</h4>' +
      '<p class="set-note set-warn">Preview only — permissions are not enforced in this demo.</p>' +
      '<table class="set-tbl"><thead><tr><th>Role</th>' +
      SETTINGS_CAPS.map(function (c) { return "<th>" + esc(c.label) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      SETTINGS_ROLES.map(function (r) {
        const have = setPermView()[r] || [];
        return "<tr><td>" + esc(r) + "</td>" + SETTINGS_CAPS.map(function (c) {
          return '<td class="set-c"><input type="checkbox" data-set-perm="' + esc(r) + '" data-cap="' + c.key + '"' +
            (have.indexOf(c.key) !== -1 ? " checked" : "") + "></td>";
        }).join("") + "</tr>";
      }).join("") + "</tbody></table>" + setActionsHtml("g3") + "</section>";
  }

  function setDurTplHtml() {
    const durs = setDurView(setSel.bu);
    const bus = Object.keys(DATA[setSel.region] || {});
    return '<section class="set-sec"><h4>4 · Target duration template</h4>' +
      '<p class="set-note">Days per arrow (1 month = 30, 2 weeks = 15). A step takes the duration of its incoming arrow. Steps 1 and 2 are the anchor pair entered at project creation, so 1 → 2 carries no duration.</p>' +
      '<div class="set-row"><label>Business Unit</label>' + setSelectHtml("data-set-bu", bus, setSel.bu) + "</div>" +
      '<table class="set-tbl"><thead><tr><th>Arrow</th><th>Days</th></tr></thead><tbody>' +
      DASH_CONN.map(function (c, i) {
        const v = durs[i];
        return "<tr><td>" + esc(setEdgeLabel(c)) + '</td><td><input type="number" min="0" step="1" class="set-num" data-set-dur="' +
          i + '" value="' + (v == null ? "" : v) + '"' + (i === 0 ? ' placeholder="anchor"' : "") + "></td></tr>";
      }).join("") + "</tbody></table>" + setActionsHtml("g4") + "</section>";
  }

  // Days a step spans, target start -> target end. Same arithmetic the
  // cascade uses, so the column and the template always agree.
  function setSpanDays(src) {
    const a = parseSeedDate(src.ts), b = parseSeedDate(src.te);
    return (a && b) ? Math.round((b - a) / 86400000) : "";
  }

  // The BU template duration governing a step: the largest incoming arrow,
  // since every parallel branch has to complete before the step can end.
  // Blank for steps 1 and 2 — they are the anchor pair, not computed.
  function setGlobalDays(key) {
    const durs = setBuTemplate(buSelect.value).durations;
    let days = null, from = "";
    DASH_CONN.forEach(function (c, i) {
      if (c.to !== key) return;
      const v = durs[i];
      if (v == null || v === "") return;
      if (days == null || Number(v) > days) { days = Number(v); from = setEdgeLabel(c); }
    });
    return { days: days, from: from };
  }

  function setDatesHtml() {
    const d = setDatesView();
    return '<section class="set-sec"><h4>1 · Target dates</h4>' +
      '<p class="set-note">Duration is target end minus target start, in days, and is editable both ways: change a date and the duration follows; type a duration and the target end moves. Moving a target start shifts its target end by the same number of days, so a step keeps its length and the duration can never go negative. <strong>Global</strong> is the BU template duration for the same step, for comparison. Recompute always re-chains each target start onto the previous target end; a row you edited (•) keeps its own duration unless you tick overwrite. Actual start/end stay on the step working pages.</p>' +
      setAlertHtml("p1") +
      '<div class="set-row"><label>Countdown target</label><input type="date" data-set-target value="' + (d.targetDate || "") + '"></div>' +
      '<table class="set-tbl"><thead><tr><th></th><th>Step</th><th>Target start</th><th>Target end</th><th>Duration (days)</th><th>Global (days)</th></tr></thead><tbody>' +
      SET_ROWS.map(function (r) {
        const src = setNodeSrc(d.steps, r.key) || {};
        const days = setSpanDays(src);
        const g = setGlobalDays(r.key);
        const differs = g.days != null && days !== "" && Number(days) !== g.days;
        return '<tr><td class="set-flag">' + (src.manual ? "•" : "") + "</td><td>" + esc(r.label) + "</td>" +
          '<td><input type="date" data-set-date="' + r.key + '" data-f="ts" value="' + seedToIso(src.ts) + '"></td>' +
          '<td><input type="date" data-set-date="' + r.key + '" data-f="te" value="' + seedToIso(src.te) + '"></td>' +
          '<td class="set-c"><input type="number" min="0" step="1" class="set-num" data-set-span="' + r.key + '" value="' + days + '"' +
            (parseSeedDate(src.ts) ? "" : ' disabled title="Set a target start first"') + "></td>" +
          '<td class="set-c set-gdays' + (differs ? " set-gdiff" : "") + '"' +
            (g.days == null ? "" : ' title="' + esc(g.from) + (differs ? " · project differs" : "") + '"') + ">" +
            (g.days == null ? "—" : g.days) + "</td></tr>";
      }).join("") + "</tbody></table>" +
      '<div class="set-row"><button type="button" class="btn btn-sm" data-set-recompute>Recompute steps 3–11</button>' +
      '<label class="set-chk"><input type="checkbox" data-set-overwrite>Also reset manual durations to Global</label></div>' +
      setActionsHtml("p1") + "</section>";
  }

  function setProjAgencyHtml() {
    const s2 = activeSteps[1], s6 = activeSteps[5];
    if (!s2 || !s6) return "";
    if (!s2.pc) s2.pc = agencyBoardSeed();
    if (!s6.cl6) s6.cl6 = cl6DefaultState();
    function board(state, tag, title) {
      return '<div class="ag-bu"><div class="ag-head"><div class="ag-nm">' + title + "</div></div>" +
        '<div class="ag-cols"><span>Agency</span><span>Code</span><span>KM</span><span>BP</span><span></span></div>' +
        ["internal", "external"].map(function (kind) {
          if (!state[kind].length) return "";
          return '<div class="ag-grp">' + (kind === "internal" ? "Internal" : "External") + " departments</div>" +
            state[kind].map(function (a, i) {
              const d = ' data-set-ag="' + tag + '" data-kind="' + kind + '" data-i="' + i + '"';
              const f = setProjAgFlags(tag, kind, i);   // draft flags once dirty
              const on = agAffects(f);
              return '<div class="ag-row' + (on ? "" : " ag-off") + '">' +
                '<span class="ag-name-ro" title="' + esc(a.name || a.code) + '">' + esc(a.name || a.code) + "</span>" +
                '<span class="ag-code-ro">' + esc(a.code) + "</span>" +
                '<span class="ag-ck"><input type="checkbox" data-f="km"' + d + (f.km !== false ? " checked" : "") + "></span>" +
                '<span class="ag-ck"><input type="checkbox" data-f="bp"' + d + (f.bp !== false ? " checked" : "") + "></span>" +
                '<span class="ag-na">' + (on ? "" : "N/A") + "</span></div>";
            }).join("");
        }).join("") + "</div>";
    }
    return '<section class="set-sec"><h4>2 · Authority agency applicability</h4>' +
      '<p class="set-note">Seeded from this project\'s BU template and overridable here. Unticking both KM and BP marks the agency Not Applicable — its data is kept and it is excluded from completion.</p>' +
      '<div class="ag-scroll"><div class="ag-lane">' + board(s2.pc, "pc", "Step 2 · Pre-consultation") +
      board(s6.cl6, "cl6", "Step 6 · Clearance") + "</div></div>" + setActionsHtml("p2") + "</section>";
  }

  function setMembersHtml() {
    const members = setMembersView();
    return '<section class="set-sec"><h4>3 · Access permission</h4>' +
      '<p class="set-note set-warn">Preview only — not enforced.</p>' +
      '<table class="set-tbl"><thead><tr><th>Name</th><th>Role</th><th></th></tr></thead><tbody>' +
      members.map(function (m, i) {
        return '<tr><td><input type="text" data-set-mname="' + i + '" value="' + esc(m.name) + '"></td><td>' +
          setSelectHtml('data-set-mrole="' + i + '"', SETTINGS_ROLES, m.role) +
          '</td><td><button type="button" class="set-del" data-set-mdel="' + i + '" aria-label="Remove">' + CLOSE_SVG + "</button></td></tr>";
      }).join("") + "</tbody></table>" +
      '<div class="set-row"><button type="button" class="btn btn-sm" data-set-madd>Add member</button></div>' +
      setActionsHtml("p3") + "</section>";
  }

  /* ---------- shell ---------- */
  function closeSettings(force) {
    const b = document.querySelector(".set-backdrop");
    if (!b) return;
    const dirty = setDirtyKeys();
    if (!force && dirty.length) {
      const names = dirty.map(function (k) { return "  • " + SET_SEC_LABEL[k]; }).join("\n");
      if (!window.confirm("These sections have changes you haven't applied:\n\n" + names + "\n\nDiscard them?")) return;
    }
    setClearDrafts();
    setClearMsgs();
    b.remove();
  }

  function renderSettings() {
    const modal = document.querySelector(".set-modal");
    if (!modal) return;
    // Keep the reader where they were — re-rendering after Apply must not
    // throw the panel back to the top, and the BU lanes keep their offset too.
    const oldBody = modal.querySelector(".set-body");
    const keepY = oldBody ? oldBody.scrollTop : 0;
    const keepX = [];
    modal.querySelectorAll(".ag-scroll").forEach(function (el, i) { keepX[i] = el.scrollLeft; });

    const proj = projectSelect.value;
    const body = setTab === "global"
      ? setStructureHtml() + setAgencyTplHtml() + setPermHtml() + setDurTplHtml()
      : setDatesHtml() + setProjAgencyHtml() + setMembersHtml();
    modal.innerHTML =
      '<div class="set-head"><span>Settings — KM/BP AKM/ABP</span>' +
        '<button type="button" class="set-x" aria-label="Close">' + CLOSE_SVG + "</button></div>" +
      '<div class="set-tabs">' +
        '<button type="button" class="set-tab' + (setTab === "global" ? " active" : "") + '" data-set-tab="global">Global</button>' +
        '<button type="button" class="set-tab' + (setTab === "project" ? " active" : "") + '" data-set-tab="project"' +
          (proj ? "" : ' disabled title="Select a project first"') + ">Project" + (proj ? " — " + esc(proj) : "") + "</button>" +
      "</div>" +
      '<div class="set-body">' + body + "</div>";
    modal.querySelector(".set-x").addEventListener("click", function () { closeSettings(); });

    const newBody = modal.querySelector(".set-body");
    if (newBody) newBody.scrollTop = keepY;
    modal.querySelectorAll(".ag-scroll").forEach(function (el, i) {
      if (keepX[i] != null) el.scrollLeft = keepX[i];
    });
  }

  function openSettings() {
    closeSettings(true);
    setSel.region = regionSelect.value || Object.keys(DATA)[0] || "";
    setSel.bu = buSelect.value || Object.keys(DATA[setSel.region] || {})[0] || "";
    if (setTab === "project" && !projectSelect.value) setTab = "global";
    const backdrop = document.createElement("div");
    backdrop.className = "set-backdrop";
    backdrop.innerHTML = '<div class="set-modal" role="dialog" aria-label="Settings"></div>';
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) closeSettings(); });
    backdrop.addEventListener("click", onSettingsClick);
    backdrop.addEventListener("change", onSettingsChange);
    renderSettings();
  }

  function setVal(sel) {
    const el = document.querySelector(".set-modal " + sel);
    return el ? el.value.trim() : "";
  }

  function onSettingsClick(e) {
    const t = e.target.closest("button");
    if (!t) return;

    if (t.hasAttribute("data-set-apply")) {
      setApply(t.getAttribute("data-set-apply"));
    } else if (t.hasAttribute("data-set-cancel")) {
      setCancel(t.getAttribute("data-set-cancel"));
    } else if (t.hasAttribute("data-set-tab")) {
      if (t.disabled) return;
      setTab = t.getAttribute("data-set-tab");
      renderSettings();
    } else if (t.hasAttribute("data-set-addregion")) {
      const name = setVal("[data-set-newregion]");
      if (!name || DATA[name]) return;
      DATA[name] = {};
      setSel.region = name; setSel.bu = "";
      setRefreshNav(); renderSettings();
    } else if (t.hasAttribute("data-set-addbu")) {
      const name = setVal("[data-set-newbu]");
      const region = setVal("[data-set-newbu-region]") || setSel.region;
      if (!name || !region || DATA[region][name]) return;
      DATA[region][name] = [];
      setSel.region = region; setSel.bu = name;
      setBuTemplate(name);            // seeds the OSC-only default list
      setRefreshNav(); renderSettings();
    } else if (t.hasAttribute("data-set-agdel")) {
      setAgDraft(t.getAttribute("data-set-bu-key"))[t.getAttribute("data-kind")]
        .splice(Number(t.getAttribute("data-i")), 1);
      renderSettings();
    } else if (t.hasAttribute("data-set-addproj")) {
      const name = setVal("[data-set-newproj]");
      const a = {
        s1ts: isoToSeed(setVal('[data-set-a="s1ts"]')), s1te: isoToSeed(setVal('[data-set-a="s1te"]')),
        s2ts: isoToSeed(setVal('[data-set-a="s2ts"]')), s2te: isoToSeed(setVal('[data-set-a="s2te"]'))
      };
      if (!name || !setSel.bu || PROJECT_DETAILS[name]) return;
      setCreateProject(setSel.region, setSel.bu, name, a);
      setRefreshNav(); renderSettings();
    } else if (t.hasAttribute("data-set-addag")) {
      const kind = t.getAttribute("data-set-addag");
      setAgDraft(t.getAttribute("data-set-bu-key"))[kind].push({ code: "", name: "", km: true, bp: true });
      renderSettings();
    } else if (t.hasAttribute("data-set-recompute")) {
      const over = document.querySelector(".set-modal [data-set-overwrite]");
      cascadeDates(setDatesDraft().steps, setDurView(buSelect.value), !!(over && over.checked));
      renderSettings();
    } else if (t.hasAttribute("data-set-madd")) {
      setMembersDraft().push({ name: "", role: SETTINGS_ROLES[2] });
      renderSettings();
    } else if (t.hasAttribute("data-set-mdel")) {
      setMembersDraft().splice(Number(t.getAttribute("data-set-mdel")), 1);
      renderSettings();
    }
  }

  function onSettingsChange(e) {
    const el = e.target;

    if (el.hasAttribute("data-set-region")) {
      setSel.region = el.value;
      setSel.bu = Object.keys(DATA[setSel.region] || {})[0] || "";
      renderSettings();
    } else if (el.hasAttribute("data-set-bu")) {
      setSel.bu = el.value;
      renderSettings();
    } else if (el.hasAttribute("data-set-dur")) {
      setDurDraft(setSel.bu)[Number(el.getAttribute("data-set-dur"))] = el.value === "" ? null : Number(el.value);
      setDirty("g4");
    } else if (el.hasAttribute("data-set-agname")) {
      setAgRow(el).name = el.value;
      setDirty("g2");
    } else if (el.hasAttribute("data-set-agcode")) {
      const bu = el.getAttribute("data-set-bu-key");
      const row = setAgRow(el), tpl = setAgView(bu), code = el.value.trim();
      const clash = code && tpl.internal.concat(tpl.external).some(function (a) {
        return a !== row && a.code === code;
      });
      if (clash) {
        // Codes are the identity key on every agency board, so a duplicate
        // would make two departments collide. Refuse it, don't warn and allow.
        setMsg.g2 = 'Code "' + code + '" is already used in ' + bu + " — codes must be unique within a BU.";
      } else {
        setMsg.g2 = ""; row.code = code;
      }
      renderSettings();
    } else if (el.hasAttribute("data-set-agkm")) {
      setAgRow(el).km = el.checked;
      setDirty("g2");
    } else if (el.hasAttribute("data-set-agbp")) {
      setAgRow(el).bp = el.checked;
      setDirty("g2");
    } else if (el.hasAttribute("data-set-perm")) {
      const role = el.getAttribute("data-set-perm"), cap = el.getAttribute("data-cap");
      const m = setPermDraft();
      const list = m[role] || (m[role] = []);
      const at = list.indexOf(cap);
      if (el.checked && at === -1) list.push(cap);
      if (!el.checked && at !== -1) list.splice(at, 1);
      setDirty("g3");
    } else if (el.hasAttribute("data-set-date")) {
      const src = setNodeSrc(setDatesDraft().steps, el.getAttribute("data-set-date"));
      if (!src) return;
      const seed = isoToSeed(el.value);
      if (el.getAttribute("data-f") === "ts") {
        // Moving the start drags the end along, so the step keeps its length
        // and the duration can never be pushed negative.
        const oldTs = parseSeedDate(src.ts), newTs = parseSeedDate(seed), te = parseSeedDate(src.te);
        src.ts = seed;
        if (oldTs && newTs && te) src.te = fmtSeedDate(addDays(te, Math.round((newTs - oldTs) / 86400000)));
        setMsg.p1 = "";
      } else {
        const ts = parseSeedDate(src.ts), newTe = parseSeedDate(seed);
        if (ts && newTe && newTe < ts) {
          setMsg.p1 = "Target end cannot be earlier than target start (" + src.ts + ") — that would make the duration negative.";
          renderSettings();
          return;
        }
        src.te = seed;
        setMsg.p1 = "";
      }
      src.manual = true;
      renderSettings();          // refresh the • flag and the duration column
    } else if (el.hasAttribute("data-set-span")) {
      const src = setNodeSrc(setDatesDraft().steps, el.getAttribute("data-set-span"));
      const start = src && parseSeedDate(src.ts);
      const n = Number(el.value);
      if (!start || el.value === "" || isNaN(n)) return;
      if (n < 0) {
        setMsg.p1 = "Duration cannot be negative.";
        renderSettings();
        return;
      }
      src.te = fmtSeedDate(addDays(start, n));
      src.manual = true;
      setMsg.p1 = "";
      renderSettings();
    } else if (el.hasAttribute("data-set-target")) {
      setDatesDraft().targetDate = el.value || null;
      setDirty("p1");
    } else if (el.hasAttribute("data-set-ag")) {
      const tag = el.getAttribute("data-set-ag");
      const f = setProjAgDraft()[tag][el.getAttribute("data-kind")][Number(el.getAttribute("data-i"))];
      f[el.getAttribute("data-f")] = el.checked;
      renderSettings();          // refresh the N/A badge
    } else if (el.hasAttribute("data-set-mname")) {
      setMembersDraft()[Number(el.getAttribute("data-set-mname"))].name = el.value;
      setDirty("p3");
    } else if (el.hasAttribute("data-set-mrole")) {
      setMembersDraft()[Number(el.getAttribute("data-set-mrole"))].role = el.value;
      setDirty("p3");
    }
  }

  // Runnable check for the date cascade — open index.html?selfcheck=1
  // and read the console. Fails loudly if the branch/merge rule drifts.
  function setSelfCheck() {
    const steps = setBlankSteps();
    steps[0].ts = "05 Feb 25"; steps[0].te = "19 Feb 25";
    steps[1].ts = "24 Feb 25"; steps[1].te = "14 Mar 25";
    cascadeDates(steps, SETTINGS.buTemplates._default.durations, true);
    const got = [steps[2].te, steps[5].te, steps[5].bp.te, steps[7].te, steps[10].te].join(" | ");
    const want = "28 Apr 25 | 27 Jun 25 | 27 Jun 25 | 10 Sep 25 | 09 Dec 25";
    if (got === want) console.log("cascade self-check OK");
    else console.error("cascade self-check FAILED\n got  " + got + "\n want " + want);

    // Codes are the identity key on every agency board, so a duplicate
    // inside one BU silently cross-wires two departments.
    let bad = 0;
    Object.keys(AGENCY_TEMPLATES).forEach(function (bu) {
      const t = AGENCY_TEMPLATES[bu], seen = {};
      t.internal.concat(t.external).forEach(function (a) {
        if (seen[a.code]) { console.error('agency self-check FAILED: duplicate code "' + a.code + '" in ' + bu); bad++; }
        seen[a.code] = 1;
      });
    });
    if (!bad) console.log("agency code self-check OK");
  }

  /* ---------- Keep derived actuals live ----------
     Every step module mutates its own state and re-renders only its own
     body, so the timeline's derived dates would go stale. Repainting the
     timeline after any interaction inside a step is one hook instead of
     one per module; renderTimeline re-derives and keeps the selection. */
  ["input", "change", "click"].forEach(function (evt) {
    stepBody.addEventListener(evt, function () {
      if (activeSteps.length) renderTimeline(activeSteps);
    });
  });

  /* ---------- Wire up + initial render ---------- */
  regionSelect.addEventListener("change", onRegionChange);
  buSelect.addEventListener("change", onBusinessUnitChange);
  projectSelect.addEventListener("change", onProjectChange);
  document.getElementById("settingsBtn").addEventListener("click", openSettings);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSettings(); });

  /* ---------- "Sample" — the demo project's working pages ----------
     PROJECT_DETAILS.Sample (data.js) carries only the dates and the source
     fields the timeline derives from. Everything behind a completed step —
     the agency board, both checklists, the general docs, hardcopy, OSC and
     the clearance boards — is built HERE, from the same default-state
     builders the live app uses, so a shape change can never leave a
     hand-written state tree behind. Runs once, at boot. */
  function seedSample() {
    const p = PROJECT_DETAILS["Sample"];
    if (!p) return;
    const tpl = setBuTemplate("Eco Grandeur");
    // Stamp the template onto the project exactly as setCreateProject does,
    // so the boards don't fall back to whatever BU happens to be selected.
    p.agencyTemplate = JSON.parse(JSON.stringify({ internal: tpl.internal, external: tpl.external }));
    const s = p.steps;
    function at(day, time) { return day + "T" + (time || "10:20") + ":00"; }       // system stamp
    function disp(day) { return fmtSeedDate(new Date(day + "T00:00:00")); }        // "21 Jul 26"
    function doc(name, day) { return { file: name, uploadedAt: at(day) }; }
    function apr(n) { return "2026-04-" + pad2(n); }

    /* Step 2 — every applicable agency taken all the way through, plus the
       general docs and both checklists. The earliest preDate is step 2's
       derived actual start, so these must precede the 29 May greenAt. */
    s[1].pc = agencyBoardSeed(p.agencyTemplate);
    s[1].pc.internal.concat(s[1].pc.external).forEach(function (a, i) {
      if (!a.applicable) return;
      const pre = apr(10 + (i % 4)), meet = apr(20 + (i % 4)), rev = "2026-05-" + pad2(11 + (i % 5));
      a.preDate = pre;
      a.reviewDate = rev;
      a.requirePreDoc = true;                          // 2.2 stays hidden until "Require" is ticked
      a.preDoc = doc("PreConsult_" + a.code + ".pdf", pre);
      a.meetingNote = doc("MeetingNote_" + a.code + ".pdf", meet);
      a.sends = { preDate: at(pre), preDoc: at(pre, "10:35"), meetingNote: at(meet), reviewDate: at(rev) };
      a.status = "completed";
      a.rounds = [{ key: "R0", file: "Drawing_R0_" + a.code + ".pdf", submitted: at(rev, "09:05"),
                    outcome: "accepted", decidedAt: disp(rev), comment: "" }];
    });
    s[1].generalDocs = GENERAL_DOCS_SEED.map(function (d, i) {
      return { title: d.title, desc: d.desc || "", pending: [],
               saved: [{ name: d.title.replace(/[^A-Za-z0-9]+/g, "_").replace(/_+$/, "") + ".pdf", savedAt: at(apr(14 + (i % 3)), "11:05") }] };
    });
    function checklist() {
      return KM_CHECKLIST_SEED.map(function (section) {
        return { title: section.title, items: section.items.map(function (it, i) {
          return { code: it.code, desc: it.desc, pending: [],
                   saved: [{ name: it.code.replace(/[^A-Za-z0-9]+/g, "") + "_Checklist.pdf", savedAt: at(apr(22 + (i % 4)), "15:40") }] };
        }) };
      });
    }
    s[1].kmChecklist = checklist();
    s[1].bpChecklist = checklist();

    /* Step 3 — both online submissions sent. The later date is the actual end. */
    s[2].kb = {
      km: { file: "KM_Online_Submission.pdf", date: "2026-06-04", submitted: at("2026-06-04", "14:10") },
      bp: { file: "BP_Online_Submission.pdf", date: "2026-06-05", submitted: at("2026-06-05", "09:50") }
    };

    /* Step 4 — all nine tracked fields sent (4.4 is a static placeholder).
       4.6's two dates are what step 4's actual end derives from. */
    s[3].hc = {
      q1: { km: { date: "2026-06-10", sent: at("2026-06-10") }, bp: { date: "2026-06-10", sent: at("2026-06-10", "10:40") } },
      q2: { date: "2026-06-17", sent: at("2026-06-17") },
      q3: { km: { file: "Hardcopy_Set_KM.pdf", submitted: at("2026-06-22") },
            bp: { file: "Hardcopy_Set_BP.pdf", submitted: at("2026-06-22", "11:15") } },
      q5: { km: { file: "Payment_Receipt_KM.pdf", date: "2026-06-29", submitted: at("2026-06-29") },
            bp: { file: "Payment_Receipt_BP.pdf", date: "2026-06-29", submitted: at("2026-06-29", "16:05") } },
      q6: { km: { file: "Acknowledgement_KM.pdf", date: "2026-07-05", submitted: at("2026-07-05") },
            bp: { file: "Acknowledgement_BP.pdf", date: "2026-07-06", submitted: at("2026-07-06", "12:30") } }
    };

    /* Step 5 — 5.3's date is the actual end. */
    s[4].osc = {
      q1: { file: "OSC_Meeting_Invite.pdf", date: "2026-07-13", submitted: at("2026-07-13") },
      q2: { date: "2026-07-16", sent: at("2026-07-16") },
      q3: { file: "OSC_Meeting_Minutes.pdf", date: "2026-07-21", submitted: at("2026-07-21", "17:20") }
    };

    /* Step 6 — mid-flight on purpose. Most of the board is cleared, the rest
       is still out with the authority, and every third agency is in the
       comment/appeal path — so neither branch can auto-complete
       (recomputeClearance greens the step only when EVERY applicable
       department is approved). BOMBA is BP-only and deliberately left open,
       which is what keeps the 6-BP branch honestly in progress. */
    s[5].cl6 = cl6DefaultState(p.agencyTemplate);
    s[5].cl6.internal.concat(s[5].cl6.external).forEach(function (d, i) {
      if (!d.applicable) return;
      const sent = "2026-07-" + pad2(23 + (i % 3));
      const cleared = i % 3 !== 2;                    // two in three come back clean
      d.letterType = cleared ? "Tiada Halangan Letter / Approval Letter" : "Ulasan / Comment Letter";
      d.doc = doc((cleared ? "TiadaHalangan_" : "Ulasan_") + d.code + ".pdf", sent);
      d.date = sent;
      d.refNo = "EG/SMP/" + d.code + "/2026";
      d.sent1 = at(sent);
      if (cleared && d.code !== "BOMBA" && i < 14) d.approvedAt = at("2026-07-" + pad2(27 + (i % 4)), "09:15");
      if (!cleared) {                                  // comment letter -> 6.2 appeal path, awaiting CDO
        const att = d.attempts[0];
        att.appeal = "Appeal";
        att.timeImpact = "Time impact, no cost impact";
        att.sent2 = at(sent, "14:00");
        att.apFile = doc("Appeal_" + d.code + ".pdf", sent);
        att.apDate = sent;
        att.apSent = at(sent, "14:05");
        att.meetingReq = "Meeting required";
        att.meetingDate = "2026-08-05";
        att.meetingSent = at(sent, "14:10");
      }
    });
  }
  seedSample();

  fillOptions(regionSelect, Object.keys(DATA));
  if (/[?&]selfcheck=/.test(location.search)) setSelfCheck();
})();
