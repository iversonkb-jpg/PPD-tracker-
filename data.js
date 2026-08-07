/* ============================================================
   EcoWorld Tracker — data layer
   ------------------------------------------------------------
   Pure data only. No DOM, no logic. Loaded before app.js so
   these globals are available to it.
   ============================================================ */

/* ------------------------------------------------------------
   Region ▸ Business Unit ▸ Project
   Each Business Unit lives under one Region and holds an array
   of its Projects.

   Confirmed mappings:
     North   ▸ Eco Sun      ▸ Irama
     Central ▸ Eco Grandeur ▸ Utopia South
   Remaining Business Units are grouped by best-guess region —
   verify / rearrange as needed.
------------------------------------------------------------ */
const DATA = {
  "North": {
    "Eco Horizon":  [],
    "Eco Terraces": [],
    "Eco Sun":      ["Irama"]
  },
  "Central": {
    "Bukit Bintang City Centre": [],
    "Eco Ardence":  [],
    "Eco Grandeur": ["Utopia South", "Sample"],
    "Eco Majestic": [],
    "Eco Forest":   [],
    "Eco Radiance": [],
    "Eco Santuary": []
  },
  "South": {
    "Eco Botanic":           [],
    "Eco Botanic 2":         [],
    "Eco Botanic 3":         [],
    "Eco Business Park I":    [],
    "Eco Business Park II":   [],
    "Eco Business Park III":  [],
    "Eco Business Park V":    [],
    "Eco Business Park VI":   [],
    "Eco Business Park VII":  [],
    "Eco Business Park VIII": [],
    "Eco Spring":  [],
    "Eco Tropics": []
  }
};

/* ------------------------------------------------------------
   STEP_NAMES — the 11 KM/BP process stages (shared by all
   projects). The order here maps 1:1 to the timeline and to the
   content partials: index 0 -> content/step-01.html, etc.
------------------------------------------------------------ */
const STEP_NAMES = [
  "Design Approval & Briefing",
  "Pre-Consultation & Upload Doc",
  "KM & BP Online Submission",
  "Hardcopy Submission",
  "OSC Meeting",
  "Clearance (Ext & Int Depts)",
  "KM Approval Endorsement",
  "BP Approval Endorsement",
  "Sifus Approval",
  "COB Approval",
  "AP Approval"
];

/* ------------------------------------------------------------
   AGENCY_TEMPLATES — the authority list per Business Unit.
   Each BU keeps its OWN list: the same role is a different
   authority in each state (MPKS in Selangor, MBSP in Penang),
   so the lists are independent, not aligned row-for-row.

   Row shape: "CODE|Name|km|bp"  (1 = affects, 0 = does not)
     code : identity key — MUST be unique within a BU. Every
            agency board keys off it (chips, cl6ByCode).
     km   : appears on the KM clearance board / 6-KM matrix
     bp   : appears on the BP clearance board / 6-BP matrix
   Both 0 = the agency does not apply to that BU; it renders
   as Not Applicable rather than vanishing, so per-project
   overrides can switch it back on without losing data.
   Step 2's combined board shows anything with km OR bp.

   OSC is seeded into every BU's internal list and can be
   toggled or removed like any other row. "_default" is what a
   BU with no list of its own starts from: OSC only.
------------------------------------------------------------ */
function agRow(s) {
  const p = s.split("|");
  return { code: p[0], name: p[1], km: p[2] === "1", bp: p[3] === "1" };
}
function agList(rows) { return rows.map(agRow); }

// OSC affects KM only. Seeded into every BU's internal list as the default
// first row; toggle or remove it per BU as needed.
const OSC_ROW = "OSC|One Stop Centre|1|0";

const AGENCY_TEMPLATES = {
  _default: { internal: agList([OSC_ROW]), external: [] },

  // Eco Grandeur (used by Utopia South) follows the corrected authority list
  // supplied 2026-08-02, NOT the .xlsx in Reference/ — that file is superseded
  // and disagrees on 14 rows. MPKS and LLM were dropped, BOMBA added.
  "Eco Grandeur": {
    internal: agList([
      OSC_ROW,
      "JPP|Jabatan Perancangan Pembangunan|1|1",
      "JKB|Jabatan Kawalan Bangunan|1|1",
      "JK|Jabatan Kejuruteraan|1|1",
      "JPPH|Jabatan Penilaian dan Perkhidmatan Hartanah|1|1",
      "JL|Jabatan Landskap|1|0",
      "JKP|Jabatan Kesihatan & Persekitaran|1|0",
      "COB|Unit Pesuruhjaya Bangunan|1|1",
      "JPBD|Jabatan Perancangan Bandar & Desa|1|0"
    ]),
    external: agList([
      "Ais|Air Selangor|1|0",
      "TNB|Tenaga Nasional Berhad|1|0",
      "IWK|Indah Water Konsortium|1|0",
      "JPS|Jabatan Pengaliran & Saliran|1|0",
      "JKR|Jabatan Kerja Raya|1|0",
      "PTD|Pejabat Daerah Tanah|1|0",
      "SKMM|Suruhanjaya Komunikasi & Multimedia Malaysia|1|0",
      "JMG|Jabatan Mineral dan Galian|1|0",
      "LUAS|Lembaga Urus Air Selangor|1|0",
      "JAS|Jabatan Alam Sekitar|1|0",
      "LPHS|Lembaga Perumahan dan Hartanah Selangor|1|0",
      "SPAN|Suruhanjaya Perkhidmatan Air Negara|1|0",
      "BOMBA|Jabatan Bomba dan Penyelamat Malaysia|0|1"
    ])
  },

  "Eco Sun": {
    internal: agList([
      OSC_ROW,
      "MBSP|Majlis Bandaraya Seberang Perai|1|1",
      "JPP|Jabatan Perancangan Pembangunan|1|0",
      "JB|Jabatan Bangunan|0|1",
      "JK|Jabatan Kejuruteraan|1|1",
      "JPPH|Jabatan Penilaian dan Perkhidmatan Hartanah|1|0",
      "JL|Jabatan Landskap|1|1",
      "JKN|Jabatan Kesihatan|1|1",
      "COB|Jabatan Pesuruhjaya Bangunan|0|1",
      "JP|Jabatan Pelesenan|1|0",
      "JPP-khid|Jabatan Perkhidmatan Perbandaran|1|1"
    ]),
    external: agList([
      "PBA|Perbadanan Bekalan Air Pulau Pinang|1|1",
      "TNB|Tenaga Nasional Berhad|1|1",
      "IWK|Indah Water Konsortium|1|1",
      "JPS|Jabatan Pengaliran & Saliran|1|1",
      "JKR|Jabatan Kerja Raya|1|0",
      "PTD|Pejabat Daerah Tanah|1|0",
      "SKMM|Suruhanjaya Komunikasi & Multimedia Malaysia|1|0",
      "JMG|Jabatan Mineral dan Galian|1|0",
      "JAS|Jabatan Alam Sekitar|1|0",
      "MAIPP|Majlis Agama Islam Negeri Pulau Pinang|1|0",
      "PTG|Pejabat Tanah Galian Negeri Pulau Pinang|1|0",
      "JPBD|Plan Malaysia@Jabatan Perancangan Bandar & Desa|1|0",
      "PDC|Perbadanan Pembangunan Pulau Pinang|1|0"
    ])
  }
};

/* ------------------------------------------------------------
   GENERAL_DOCS_SEED — the checklist shown in Step 2's
   "Upload (General)" tab. Each item can hold uploaded files.
   At runtime every item gains:
     pending : [fileName, …]        uploaded, not yet sent
     saved   : [{ name, savedAt }]  sent -> stored in system
   Cloned per-step on first view so each project tracks its own.
------------------------------------------------------------ */
const GENERAL_DOCS_SEED = [
  { title: "Pre-Comp Plan", desc: "Required for initial verification" },
  { title: "Land Title", desc: "Certified true copy" },
  { title: "Company Reg. Form", desc: "Form 9, 24, 49 or equivalent" },
  { title: "Latest Assessment Receipt", desc: "Current year payment" },
  { title: "Latest Quit Rent Receipt", desc: "Current year payment" },
  { title: "Hakmilik Tanah", desc: "Geran/Pajakan" },
  { title: "Carian Rasmi Terkini (6 months)", desc: "Official search result" },
  { title: "Resit Cukai Taksiran (Valid)", desc: "Proof of validity" },
  { title: "Resit Cukai Tanah (Valid)", desc: "Proof of validity" },
  { title: "Power Attorney (If applicant is not land owner)", desc: "Legal authorization document" },
  { title: "Consent Letter (if the land is charged to a bank or caveated)", desc: "Bank or legal consent" }
];

/* ------------------------------------------------------------
   KM_CHECKLIST_SEED — the authorities/agencies shown in Step 2's
   "Upload (KM Checklist)" tab, grouped into three sections. Each
   item is one authority/agency that can hold one or more uploaded documents.
   Cloned per-step on first view; at runtime every item gains:
     pending : [fileName, …]        uploaded (button or drag & drop), not yet sent
     saved   : [{ name, savedAt }]  sent -> stored in system, each with its own stamp
------------------------------------------------------------ */
const KM_CHECKLIST_SEED = [
  {
    title: "Authority Documents",
    items: [
      { code: "MBPP", desc: "Majlis Bandaraya Pulau Pinang" },
      { code: "MBSP", desc: "Majlis Bandaraya Seberang Perai" },
      { code: "MBI",  desc: "Majlis Bandaraya Ipoh" },
      { code: "MBAS", desc: "Majlis Bandaraya Alor Setar" },
      { code: "MPBP", desc: "Majlis Perbandaran Kangar / Perlis" }
    ]
  },
  {
    title: "Internal Agency Documents",
    items: [
      { code: "JPB", desc: "Jabatan Perancangan Bandar" },
      { code: "JB",  desc: "Jabatan Bangunan" },
      { code: "JK",  desc: "Jabatan Kejuruteraan" },
      { code: "JL",  desc: "Jabatan Landskap" }
    ]
  },
  {
    title: "External Agency Documents",
    items: [
      { code: "BOMBA",     desc: "Fire & Rescue" },
      { code: "JKR",       desc: "Public Works" },
      { code: "JPS",       desc: "Drainage & Irrigation" },
      { code: "DOE / JAS", desc: "Environment" },
      { code: "TNB",       desc: "Electricity" },
      { code: "IWK",       desc: "Sewerage" },
      { code: "PBA",       desc: "Penang Water" },
      { code: "SADA",      desc: "Kedah Water" },
      { code: "LAP",       desc: "Perak Water" }
    ]
  }
];

/* ------------------------------------------------------------
   PROJECT_DETAILS[project] — per-project dashboard data.
     dashboard  : label shown under the project title
     updated    : "last updated" date (display only)
     targetDate : ISO date (YYYY-MM-DD) that drives the countdown
     steps[]    : one entry per STEP_NAMES stage
                    status : "upcoming" | "in-progress" | "completed"
                             (grey / yellow / green in the UI)
                    ts/as  : Target / Actual Start dates
                    te/ae  : Target / Actual End dates
                    Use "—" for a date that is not yet known.
   Projects without an entry render a blank timeline.
------------------------------------------------------------ */
const PROJECT_DETAILS = {
  "Utopia South": {
    dashboard: "KM/BP DASHBOARD",
    updated: "24 Oct 2024",
    targetDate: "2027-08-14",
    steps: [
      // basePlanDate = 1.1, approved upstream in Product Planning. It is step 1's
      // actual start, and step 1's briefing is due within a week of it.
      { status: "upcoming", ts: "01 Jul 24", as: "—", te: "15 Jul 24", ae: "—", basePlanDate: "2024-06-26" },
      { status: "upcoming", ts: "20 Jul 24", as: "—", te: "12 Aug 24", ae: "—" },
      { status: "upcoming", ts: "14 Aug 24", as: "—", te: "28 Aug 24", ae: "—" },
      { status: "upcoming", ts: "30 Aug 24", as: "—", te: "13 Sep 24", ae: "—" },
      { status: "upcoming", ts: "16 Sep 24", as: "—", te: "20 Sep 24", ae: "—" },
      { status: "upcoming", ts: "23 Sep 24", as: "—", te: "11 Oct 24", ae: "—",
        bp: { ts: "23 Sep 24", as: "—", te: "18 Oct 24", ae: "—" } },
      { status: "upcoming", ts: "14 Oct 24", as: "—", te: "25 Oct 24", ae: "—" },
      { status: "upcoming", ts: "28 Oct 24", as: "—", te: "08 Nov 24", ae: "—" },
      { status: "upcoming", ts: "11 Nov 24", as: "—", te: "22 Nov 24", ae: "—" },
      { status: "upcoming", ts: "25 Nov 24", as: "—", te: "06 Dec 24", ae: "—" },
      { status: "upcoming", ts: "09 Dec 24", as: "—", te: "20 Dec 24", ae: "—" }
    ]
  },
  "Irama": {
    dashboard: "KM/BP DASHBOARD",
    updated: "30 Jul 2026",
    targetDate: "2027-06-04",
    // A clean, not-yet-started project: every step Upcoming, no progress of any
    // kind seeded. Actual start/end are DERIVED from the working pages (see
    // deriveActuals), so they stay "—" until someone answers the underlying
    // question — including step 1's basePlanDate, which is set when the base
    // plan is actually approved.
    //
    // Steps 1 and 2 are the anchor pair (the 1 → 2 arrow carries no duration).
    // Step 1 starts 01 Aug 26; steps 3–11 below are exactly what cascadeDates
    // produces from the Eco Sun duration template, so a Recompute is a no-op.
    steps: [
      { status: "upcoming", ts: "01 Aug 26", as: "—", te: "15 Aug 26", ae: "—" },
      { status: "upcoming", ts: "17 Aug 26", as: "—", te: "07 Sep 26", ae: "—" },
      { status: "upcoming", ts: "07 Sep 26", as: "—", te: "22 Oct 26", ae: "—" },
      { status: "upcoming", ts: "22 Oct 26", as: "—", te: "06 Nov 26", ae: "—" },
      { status: "upcoming", ts: "06 Nov 26", as: "—", te: "06 Dec 26", ae: "—" },
      { status: "upcoming", ts: "06 Dec 26", as: "—", te: "21 Dec 26", ae: "—",
        bp: { ts: "06 Dec 26", as: "—", te: "21 Dec 26", ae: "—" } },
      { status: "upcoming", ts: "21 Dec 26", as: "—", te: "04 Feb 27", ae: "—" },
      { status: "upcoming", ts: "21 Dec 26", as: "—", te: "06 Mar 27", ae: "—" },
      { status: "upcoming", ts: "06 Mar 27", as: "—", te: "05 Apr 27", ae: "—" },
      { status: "upcoming", ts: "05 Apr 27", as: "—", te: "05 May 27", ae: "—" },
      { status: "upcoming", ts: "05 May 27", as: "—", te: "04 Jun 27", ae: "—" }
    ]
  },
  // A mid-flight demo project, duplicated from Utopia South's structure onto a
  // 2026 timeline so it reads against today rather than the 2024 seed:
  //   1, 3, 4, 5 completed · 2 completed with delay · 6-KM alarming · 6-BP in progress.
  //
  // Only the SOURCE fields are here. as/ae are derived (deriveActuals), and the
  // working-page state behind each completed step — agency board, checklists,
  // hardcopy, OSC, clearance — is filled in by seedSample() in app.js, built
  // from the same default-state builders the live app uses.
  //
  // Dates are exactly what cascadeDates produces from the Eco Grandeur template
  // (anchors 26 Mar / 09 Apr 26), except 6-BP, which is deliberately stretched to
  // 05 Sep so it stays yellow while 6-KM (07 Aug, within a week of today) goes
  // orange — hence manual:true on that row.
  "Sample": {
    dashboard: "KM/BP DASHBOARD",
    updated: "02 Aug 2026",
    targetDate: "2027-02-17",
    steps: [
      { status: "completed", ts: "26 Mar 26", as: "—", te: "09 Apr 26", ae: "—",
        basePlanDate: "2026-03-26", confirmedAt: "2026-04-07T10:15:00", values: { briefingDate: "2026-04-07" } },
      // greenAt is 5 days past target -> completed WITH DELAY (green + red ring).
      { status: "completed", ts: "09 Apr 26", as: "—", te: "24 May 26", ae: "—", greenAt: "2026-05-29T16:40:00" },
      { status: "completed", ts: "24 May 26", as: "—", te: "08 Jun 26", ae: "—" },
      { status: "completed", ts: "08 Jun 26", as: "—", te: "08 Jul 26", ae: "—" },
      { status: "completed", ts: "08 Jul 26", as: "—", te: "23 Jul 26", ae: "—" },
      { status: "in-progress", ts: "23 Jul 26", as: "—", te: "07 Aug 26", ae: "—",
        bp: { ts: "23 Jul 26", as: "—", te: "05 Sep 26", ae: "—", manual: true } },
      { status: "upcoming", ts: "07 Aug 26", as: "—", te: "21 Sep 26", ae: "—" },
      { status: "upcoming", ts: "05 Sep 26", as: "—", te: "19 Nov 26", ae: "—" },
      { status: "upcoming", ts: "19 Nov 26", as: "—", te: "19 Dec 26", ae: "—" },
      { status: "upcoming", ts: "19 Dec 26", as: "—", te: "18 Jan 27", ae: "—" },
      { status: "upcoming", ts: "18 Jan 27", as: "—", te: "17 Feb 27", ae: "—" }
    ]
  }
};

/* ------------------------------------------------------------
   SETTINGS — global config edited from the header gear.
   In-memory like everything else here; resets on reload.

   durations[] : one entry per dashboard edge, in DASH_CONN
                 order, measured in DAYS. All units are days by
                 agreement: 1 month = 30, 2 weeks = 15, so
                 1.5 months = 45 and "2 months + 2 weeks" = 75.
                 null = no duration; steps 1 and 2 are the
                 anchor pair a new project is created from.

   A BU template is FORWARD-ONLY: it stamps a project at
   creation time and never rewrites an existing project.
------------------------------------------------------------ */
const SETTINGS_ROLES = ["System Admin", "PPD Admin", "PPD User", "External User", "EW Management"];

const SETTINGS_CAPS = [
  { key: "view",    label: "View dashboards" },
  { key: "edit",    label: "Edit step data" },
  { key: "approve", label: "Approve (HOD / CDO / AP)" },
  { key: "proj",    label: "Manage project settings" },
  { key: "global",  label: "Manage global settings" }
];

const SETTINGS = {
  // Role × capability grid. Placeholder only — nothing is enforced.
  matrix: {
    "System Admin":  ["view", "edit", "approve", "proj", "global"],
    "PPD Admin":     ["view", "edit", "approve", "proj"],
    "PPD User":      ["view", "edit"],
    "External User": ["view"],
    "EW Management": ["view"]
  },
  // Days per DASH_CONN arrow. 7 → 8 is 30, which makes both routes into
  // step 8 total 75 days (KM: 45 + 30 via step 7, BP: 75 direct), so the
  // parallel branches are designed to finish together.
  durationsDefault: [null, 45, 15, 30, 15, 15, 45, 30, 75, 30, 30, 30],
  // Keyed by Business Unit, built on demand by setBuTemplate() from
  // durationsDefault + AGENCY_TEMPLATES[bu] (or _default).
  buTemplates: {}
};
