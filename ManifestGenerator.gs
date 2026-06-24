/**
 * ToL Manifest Generator
 * ──────────────────────
 * Reads the "all_manifest_builder_v1.0" sheet and generates a tailored
 * Sample Manifest and accompanying SOP documents for a given ToL project.
 *
 * WHAT IT GENERATES (per run):
 *   1. A new Google Sheets manifest file — tab named "Metadata Entry",
 *      with 96 data rows, colour-coded headers, dropdowns, and date
 *      validation. Saved to the shared output folder in Google Drive.
 *   2. An internal SOP Google Doc — all columns listed, hidden columns
 *      marked [HIDDEN] and greyed. Saved to the shared output folder.
 *   3. A partner-facing SOP Google Doc — hidden columns omitted, with a
 *      note explaining they require no input. Saved to the shared folder.
 *   4. A partner SOP tab inside the manifest Google Sheet.
 *   5. A new row in the ToL Manifest Catalogue section of the builder
 *      sheet — col A highlighted yellow, other cells colour-coded to
 *      match the manifest headers (green/blue/white). For SM team review.
 *
 * MENU (📋 ToL Manifest Tools):
 *   • 🔍 Check catalogue for identical manifest  → checkCatalogue()
 *   • 📂 Load from catalogue into row 2          → loadFromCatalogue()
 *   • 🔄 Sync SOP comments to builder headers    → syncSopCommentsToBuilder()
 *   • Generate manifest + SOP > ▶ Run generator  → generateManifest()
 *
 * BUILDER SHEET STRUCTURE (all_manifest_builder_v1.0):
 *   Row 1 — Column names  |  Col A = project name & version
 *   Row 2 — Project selections (dropdown per column):
 *             "Include and visible (mandatory)"  → green header
 *             "Include, visible and mandatory"   → green header
 *             "Include, visible and optional"    → light blue header
 *             "Include and hidden"               → white header, hidden,
 *                                                  prefixed [ignore]
 *             "Exclude"                          → not included
 *   Row 3 — Column order numbers (optional; blank = keep natural order)
 *   Row 4 — System requirements (Mandatory/Optional) — used as fallback
 *            when row 2 says plain "Include and visible" with no nuance
 *   Row 5 — Manifest requirements (reference only, not used by script)
 *   Rows 12+ — ToL Manifest Catalogue (one row per past manifest)
 *
 * CONFIGURATION (edit the constants below):
 *   BUILDER_SHEET_NAME  — name of the builder tab
 *   DATA_VAL_SHEET_NAME — name of the Data Validation tab
 *   SOP_DOC_ID          — Google Doc ID of the master SOP (fetched live)
 *   OUTPUT_FOLDER_ID    — Google Drive folder ID for all output files
 *   CATALOGUE_DATA_START— first data row of the catalogue section
 *
 * PERMISSIONS REQUIRED (granted on first run):
 *   • Google Sheets (read/write)
 *   • Google Drive (create + move files)
 *   • Google Docs (read SOP doc, create SOP output docs)
 *
 * NOTE — Shared folder permissions:
 *   The person running this script must have Editor access to the folder
 *   at OUTPUT_FOLDER_ID. If a PI runs this and lacks access, files will
 *   be created in their Drive root instead (a warning is logged but
 *   generation still completes).
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const BUILDER_SHEET_NAME  = 'all_manifest_builder_v1.0';
const DATA_VAL_SHEET_NAME = 'Data Validation';
const MANIFEST_TAB_NAME   = 'Metadata Entry';
const MANIFEST_DATA_ROWS  = 96;

// Builder sheet row numbers
const ROW_PROJECT_NAME = 1;   // Col A: project name & version
const ROW_SELECTION    = 2;   // Include/exclude/hidden choices
const ROW_COL_ORDER    = 3;   // Optional column ordering numbers
const ROW_SYSTEM_REQ   = 4;   // System requirements (Mandatory/Optional)
// Row 5 = Manifest requirements (reference only, not used for colouring)

// Catalogue section
const CATALOGUE_HEADER_ROW = 11;  // "Manifest names and versions"
const CATALOGUE_DATA_START = 12;  // First project row

// Project name cell
const PROJECT_NAME_CELL = 'A1';

// Date column
const DATE_COLUMN_NAME = 'DATE_OF_COLLECTION';

// SOP Google Doc ID (fetched live at run-time)
const SOP_DOC_ID = '10WMIZ9GuB0hj5pBzFkz1U2V3_KwIFH-3cAud6h3-Gow';

// Shared output folder — all generated files are moved here after creation.
// To change: replace the ID with the new folder ID from the Drive URL.
// Current: https://drive.google.com/drive/folders/1pHO9F18QAF96UQjpNUN23L7WUX1XNFfc
const OUTPUT_FOLDER_ID = '1pHO9F18QAF96UQjpNUN23L7WUX1XNFfc';

// ─── Colours ──────────────────────────────────────────────────────────────────
// Single source of truth — changing these updates both sheet headers and SOP highlights.
// Palette: deep teal/sage family for biodiversity genomics manifests.
// Dark = must fill | Light = supplementary | Amber = missing required | Coral = error
// Avoids red/green error/success semantics; accessible for colourblind users.

const COLOUR_MANDATORY        = '#355C4B';  // Deep forest teal  — mandatory headers (dark)
const COLOUR_MANDATORY_CELL   = '#F5F8F6';  // Very pale moss    — mandatory data cells
const COLOUR_OPTIONAL         = '#355C4B';  // (same family — see COLOUR_OPTIONAL_LIGHT)
const COLOUR_OPTIONAL_LIGHT   = '#C8DDD3';  // Soft sage         — optional headers (light)
const COLOUR_OPTIONAL_CELL    = '#F5F8F6';  // Very pale moss    — optional data cells
const COLOUR_HIDDEN_BG        = '#FFFFFF';  // White             — hidden column headers
const COLOUR_HIDDEN_CELL      = '#FAFBF9';  // Off-white         — hidden data cells
const COLOUR_HEADER_TEXT_DARK = '#FFFFFF';  // White             — text on dark (mandatory) headers
const COLOUR_HEADER_TEXT_LIGHT= '#1E2A24';  // Dark charcoal     — text on light (optional/hidden) headers
const COLOUR_HEADER_TEXT      = '#1E2A24';  // Dark charcoal     — default (backwards compat)
const COLOUR_GRID_LINE        = '#CCCCCC';  // Grey              — cell borders
const COLOUR_MISSING_REQUIRED = '#F3D27A';  // Soft amber        — blank mandatory cell
const COLOUR_DATE_ERROR       = '#D97C6C';  // Muted coral       — date format error
const COLOUR_ROW_ALT          = '#EEF2EF';  // Pale moss-grey    — alternating row stripe
const COLOUR_EXCLUDED_CELL    = '#EFEFEF';  // Light grey        — excluded columns in catalogue row

// ─── Row 2 selection values → behaviour ──────────────────────────────────────
// Mandatory (deep teal header) triggers — any of these in row 2 → teal/mandatory
const ORANGE_TRIGGERS = [
  'include and visible (mandatory)',
  'include, visible and mandatory',
  'include and visible'          // plain visible → green/mandatory if row 4 is Mandatory, else blue/optional
];
// Soft sage (optional) trigger
const BLUE_TRIGGER = 'include, visible and optional';
// Hidden trigger
const HIDDEN_TRIGGER = 'include and hidden';
// Exclude trigger
const EXCLUDE_TRIGGER = 'exclude';

// ─── Dropdown options for row 2 ───────────────────────────────────────────────
const BUILDER_DROPDOWN_OPTIONS = [
  'Include and visible (mandatory)',
  'Include, visible and mandatory',
  'Include, visible and optional',
  'Include and hidden',
  'Exclude'
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: generateManifest()
// Orchestrates the full manifest generation pipeline (steps 1–17).
// Called from the menu: 📋 ToL Manifest Tools > Generate manifest + SOP > ▶ Run generator
// ═══════════════════════════════════════════════════════════════════════════════

function generateManifest() {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const builder = ss.getSheetByName(BUILDER_SHEET_NAME);
  const dvSheet = ss.getSheetByName(DATA_VAL_SHEET_NAME);

  if (!builder) { alert_(`Sheet "${BUILDER_SHEET_NAME}" not found.`); return; }
  if (!dvSheet)  { alert_(`Sheet "${DATA_VAL_SHEET_NAME}" not found.`); return; }

  // ── Step 1: Apply row 2 dropdowns (fast, harmless every run) ─────────────
  applyBuilderDropdowns_(builder);

  // ── Step 2: Read & validate project name ─────────────────────────────────
  let projectName = String(builder.getRange(PROJECT_NAME_CELL).getValue() || '').trim();
  // Treat the column's own instruction label as blank — it means the PI hasn't filled it in
  if (projectName.toLowerCase() === 'project name and version') projectName = '';
  if (!projectName) {
    const ui  = SpreadsheetApp.getUi();
    const res = ui.prompt(
      'Project Name Required',
      `Cell ${PROJECT_NAME_CELL} is blank.\n\nEnter the project name and version (e.g. "DToL_Bats_v1.0"):`,
      ui.ButtonSet.OK_CANCEL
    );
    if (res.getSelectedButton() !== ui.Button.OK) {
      alert_('Generation cancelled — no project name provided.'); return;
    }
    projectName = res.getResponseText().trim();
    if (!projectName) { alert_('Generation cancelled — project name cannot be blank.'); return; }
    builder.getRange(PROJECT_NAME_CELL).setValue(projectName);
  }

  // ── Step 3: Check catalogue for exact duplicate before doing anything expensive ──
  // Protects against accidental duplicate generation even if the PI skipped
  // the manual 🔍 Check catalogue step.
  const lastCol  = builder.getLastColumn();
  const row1     = builder.getRange(ROW_PROJECT_NAME, 1, 1, lastCol).getValues()[0];
  const row2     = builder.getRange(ROW_SELECTION,    1, 1, lastCol).getValues()[0];

  const existingExact = findExactCatalogueMatches_(builder, lastCol, row1, row2);
  if (existingExact.length > 0) {
    const matchList = existingExact.map(m => `  • ${m}`).join('\n');
    const ui  = SpreadsheetApp.getUi();
    const res = ui.alert(
      '⚠️ Identical manifest already exists',
      `The current column selections exactly match ` +
      `${existingExact.length === 1 ? 'this existing manifest' : 'these existing manifests'}:\n\n` +
      `${matchList}\n\n` +
      `Generate a new identical manifest anyway?`,
      ui.ButtonSet.YES_NO
    );
    if (res !== ui.Button.YES) {
      alert_('Generation cancelled. Use 📂 Load from catalogue to work with an existing manifest.');
      return;
    }
  }

  // ── Step 4: Fetch live SOP descriptions ──────────────────────────────────
  let sopComments;
  try {
    sopComments = fetchSopComments_();
  } catch (e) {
    alert_(`⚠️ SOP Sync Failed — Manifest NOT generated\n\n${e.message}`); return;
  }

  // ── Step 5: Read remaining builder rows ───────────────────────────────────
  const row3     = builder.getRange(ROW_COL_ORDER,  1, 1, lastCol).getValues()[0];
  const row4     = builder.getRange(ROW_SYSTEM_REQ, 1, 1, lastCol).getValues()[0];

  // ── Step 6: Read Data Validation tab ─────────────────────────────────────
  const dvMap = readDataValidationMap_(dvSheet);

  // ── Step 7: Build column list ─────────────────────────────────────────────
  const missingCols = [];
  const rawColumns  = [];   // before reordering

  for (let col = 2; col <= lastCol; col++) {   // col 1 is the label column
    const colName = String(row1[col - 1] || '').trim();
    if (!colName) continue;

    const rawSel  = String(row2[col - 1] || '').trim();
    const selNorm = rawSel.toLowerCase();

    // Skip unset
    if (!rawSel || selNorm === 'select option') {
      missingCols.push(`"${colName}" (col ${col})`);
      continue;
    }

    // Determine inclusion type
    let inclusion;  // 'green' | 'blue' | 'hidden' | 'exclude'
    if (selNorm === EXCLUDE_TRIGGER) {
      inclusion = 'exclude';
    } else if (selNorm === HIDDEN_TRIGGER) {
      inclusion = 'hidden';
    } else if (selNorm === BLUE_TRIGGER) {
      inclusion = 'blue';
    } else if (ORANGE_TRIGGERS.includes(selNorm)) {
      // Plain "include and visible" → check row 4 system req
      if (selNorm === 'include and visible') {
        const sysReq = String(row4[col - 1] || '').trim().toLowerCase();
        // 'mandatory' and 'wospi mandatory' both → green/mandatory
        inclusion = (sysReq.startsWith('mandatory') || sysReq.includes('mandatory')) ? 'orange' : 'blue';  // 'orange' = green in the UI — internal label kept for compatibility
      } else {
        inclusion = 'orange';  // rendered as green in the manifest
      }
    } else {
      missingCols.push(`"${colName}" (col ${col}) — unrecognised: "${rawSel}"`);
      continue;
    }

    if (inclusion === 'exclude') continue;

    // Column order number from row 3 (blank = null = keep natural order)
    const orderVal = row3[col - 1];
    const orderNum = (orderVal !== null && orderVal !== '' && !isNaN(Number(orderVal)))
      ? Number(orderVal) : null;

    rawColumns.push({
      name:       colName,
      inclusion,                              // 'orange' (=green) | 'blue' | 'hidden'
      isMandatory: inclusion === 'orange',    // 'orange' is the internal label; colour is green
      isHidden:    inclusion === 'hidden',
      isOptional:  inclusion === 'blue',
      dvValues:    dvMap[colName] || null,
      sopComment:  sopComments[colName] || null,
      orderNum,
      naturalIdx:  col                        // preserve original position as tiebreaker
    });
  }

  // ── Step 8: Block on missing selections ───────────────────────────────────
  if (missingCols.length > 0) {
    const list = missingCols.slice(0, 20).join('\n  • ');
    const more = missingCols.length > 20 ? `\n  …and ${missingCols.length - 20} more.` : '';
    alert_(`⚠️ Please fill in row 2 for these columns before generating:\n\n  • ${list}${more}\n\nUse the dropdowns provided.`);
    return;
  }
  if (rawColumns.length === 0) { alert_('No columns selected. Please update row 2.'); return; }

  // ── Step 9: Apply column ordering from row 3 ─────────────────────────────
  // Columns with an order number sort by that number first;
  // columns without (null) retain their natural left-to-right order after numbered ones.
  const numbered   = rawColumns.filter(c => c.orderNum !== null).sort((a, b) =>
    a.orderNum !== b.orderNum ? a.orderNum - b.orderNum : a.naturalIdx - b.naturalIdx);
  const unnumbered = rawColumns.filter(c => c.orderNum === null).sort((a, b) =>
    a.naturalIdx - b.naturalIdx);
  const columns = [...numbered, ...unnumbered];

  // ── Step 10: Create the Google Sheets file ───────────────────────────────
  const today    = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const safeName = projectName.replace(/[\\/:*?"<>|]/g, '_');
  const baseName = `ToL_Manifest_${safeName}_${today}`;
  const newSS    = SpreadsheetApp.create(baseName);
  const manifest = newSS.getActiveSheet();
  manifest.setName(MANIFEST_TAB_NAME);
  // Move manifest to shared output folder immediately after creation
  moveToOutputFolder_(newSS.getId());

  const numCols = columns.length;

  // ── Step 11: Write header row ─────────────────────────────────────────────
  // Hidden columns get "[ignore]" appended to the name
  const headerValues = columns.map(col =>
    col.isHidden ? `[ignore] ${col.name}` : col.name
  );
  const headerRange = manifest.getRange(1, 1, 1, numCols);
  headerRange.setValues([headerValues])
             .setFontWeight('bold')
             .setFontColor(COLOUR_HEADER_TEXT)
             .setWrap(true)
             .setVerticalAlignment('middle');
  manifest.setRowHeight(1, 60);  // taller to accommodate wrapped text
  manifest.setFrozenRows(1);

  // Per-column: header background + light cell background for entire data column
  // Applied column-by-column so each column has its own consistent tint
  const dataStart = 2;
  const dataEnd   = dataStart + MANIFEST_DATA_ROWS - 1;

  columns.forEach((col, i) => {
    const colNum = i + 1;

    // Header cell
    let headerBg, dataBg;
    if (col.isHidden) {
      headerBg = COLOUR_HIDDEN_BG;
      dataBg   = COLOUR_HIDDEN_CELL;
    } else if (col.isMandatory) {
      headerBg = COLOUR_MANDATORY;
      dataBg   = COLOUR_MANDATORY_CELL;
    } else {
      headerBg = COLOUR_OPTIONAL_LIGHT;
      dataBg   = COLOUR_OPTIONAL_CELL;
    }

    manifest.getRange(1, colNum).setBackground(headerBg);
    // Dark headers (mandatory) get white text; light headers (optional/hidden) get charcoal
    const headerTextColour = col.isMandatory ? COLOUR_HEADER_TEXT_DARK : COLOUR_HEADER_TEXT_LIGHT;
    manifest.getRange(1, colNum).setFontColor(headerTextColour);
    if (col.sopComment) manifest.getRange(1, colNum).setComment(col.sopComment);

    // Data cells — uniform light tint (no alternating rows, colour carries the meaning)
    manifest.getRange(dataStart, colNum, MANIFEST_DATA_ROWS, 1).setBackground(dataBg);
  });

  // Grey grid lines across the entire used range (header + data)
  const fullRange = manifest.getRange(1, 1, dataEnd, numCols);
  fullRange.setBorder(true, true, true, true, true, true,
    COLOUR_GRID_LINE, SpreadsheetApp.BorderStyle.SOLID);

  // Column widths
  for (let i = 1; i <= numCols; i++) manifest.setColumnWidth(i, 160);

  // ── Step 12: Data rows ────────────────────────────────────────────────────

  columns.forEach((col, i) => {
    const colNum = i + 1;

    // Dropdown
    if (col.dvValues && col.dvValues.length > 0) {
      applyDropdown_(manifest, newSS, colNum, dataStart, dataEnd, col.name, col.dvValues);
    }

    // Date: conditional formatting only (coral if non-empty and wrong format)
    if (col.name === DATE_COLUMN_NAME) {
      applyDateFormatting_(manifest, colNum, dataStart, dataEnd);
    }

    // Missing mandatory value: amber highlight if mandatory column cell is blank
    if (col.isMandatory) {
      applyMissingMandatoryHighlight_(manifest, colNum, dataStart, dataEnd);
    }
  });

  // Row heights for data rows
  for (let r = dataStart; r <= dataEnd; r++) {
    manifest.setRowHeight(r, 21);
  }

  // ── Step 13: Hide hidden columns ──────────────────────────────────────────
  const hiddenCols = columns
    .map((col, i) => col.isHidden ? i + 1 : null)
    .filter(Boolean);
  hiddenCols.slice().reverse().forEach(c => manifest.hideColumns(c));

  // ── Step 14: Add partner-facing SOP tab ───────────────────────────────────
  addPartnerSopTab_(newSS, columns, today, sopComments, projectName);

  // ── Step 15: Create two SOP Google Docs ──────────────────────────────────
  const internalDoc = createSopDoc_(baseName, columns, today, sopComments, projectName, false);
  moveToOutputFolder_(internalDoc.getId());
  const partnerDoc  = createSopDoc_(baseName, columns, today, sopComments, projectName, true);
  moveToOutputFolder_(partnerDoc.getId());

  // ── Step 16: Append catalogue row to builder sheet ───────────────────────
  const catRowNum = appendCatalogueRow_(builder, projectName, columns, lastCol, row1, row2);

  // ── Step 17: Summary ─────────────────────────────────────────────────────
  const sheetUrl   = newSS.getUrl();
  const internalUrl = internalDoc.getUrl();
  const partnerUrl  = partnerDoc.getUrl();
  Logger.log(`Manifest:     ${sheetUrl}`);
  Logger.log(`Internal SOP: ${internalUrl}`);
  Logger.log(`Partner SOP:  ${partnerUrl}`);

  alert_(
    `✅ Generation complete!\n\n` +
    `📊 Manifest:\n${sheetUrl}\n\n` +
    `📄 Internal SOP:\n${internalUrl}\n\n` +
    `📄 Partner SOP:\n${partnerUrl}\n\n` +
    `Project: ${projectName} | Columns: ${numCols} (${hiddenCols.length} hidden)\n\n` +
    `📋 Catalogue row added at row ${catRowNum} of the builder sheet (highlighted yellow).\n` +
    `Please copy this row to the master manifest catalogue when ready.\n\n` +
    `All URLs saved to Apps Script log.`
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: findExactCatalogueMatches_(builder, lastCol, row1, row2)
// Returns an array of catalogue entry names whose column selections exactly
// match the current row 2. Used by generateManifest() to warn before
// creating a duplicate, and by checkCatalogue() for its exact-match report.
// ═══════════════════════════════════════════════════════════════════════════════

function findExactCatalogueMatches_(builder, lastCol, row1, row2) {
  // Build a normalised map of the current selections
  const currentFull = new Map();
  for (let col = 2; col <= lastCol; col++) {
    const colName = String(row1[col - 1] || '').trim();
    if (!colName) continue;
    const sel     = String(row2[col - 1] || '').trim();
    const selNorm = sel.toLowerCase();
    if (sel && selNorm !== 'select option' && selNorm !== EXCLUDE_TRIGGER) {
      currentFull.set(colName, selNorm);
    }
  }
  if (currentFull.size === 0) return [];

  const lastRow = builder.getLastRow();
  if (lastRow < CATALOGUE_DATA_START) return [];

  const catData = builder.getRange(
    CATALOGUE_DATA_START, 1, lastRow - CATALOGUE_DATA_START + 1, lastCol
  ).getValues();

  const exactMatches = [];
  catData.forEach(catRow => {
    const manifestName = String(catRow[0] || '').trim();
    if (!manifestName) return;

    const catFull = new Map();
    for (let col = 2; col <= lastCol; col++) {
      const colName = String(row1[col - 1] || '').trim();
      if (!colName) continue;
      const val = catRow[col - 1];
      let selStr = '';
      if (val === true)                                           selStr = 'include and visible (mandatory)';
      else if (typeof val === 'string' && val.trim().length > 0) selStr = val.trim().toLowerCase();
      if (selStr) catFull.set(colName, selStr);
    }

    // Exact match: same column set and same selection for every column
    if (currentFull.size !== catFull.size) return;
    if (![...currentFull].every(([k, v]) => catFull.get(k) === v)) return;
    exactMatches.push(manifestName);
  });

  return exactMatches;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: checkCatalogue()
// Compares the current row 2 selections against every named entry in the
// catalogue section. Reports exact matches (same columns + same nuance)
// and near matches (same columns, different mandatory/optional/hidden status).
// Called from the menu: 📋 ToL Manifest Tools > 🔍 Check catalogue
// ═══════════════════════════════════════════════════════════════════════════════

function checkCatalogue() {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const builder = ss.getSheetByName(BUILDER_SHEET_NAME);
  if (!builder) { alert_(`Sheet "${BUILDER_SHEET_NAME}" not found.`); return; }

  const lastCol = builder.getLastColumn();
  const row1    = builder.getRange(ROW_PROJECT_NAME, 1, 1, lastCol).getValues()[0];
  const row2    = builder.getRange(ROW_SELECTION,    1, 1, lastCol).getValues()[0];

  // Build current selection maps:
  //   currentCols  — Set of selected column names (for near-match comparison)
  //   currentFull  — Map of colName → normalised selection string (for exact match)
  const currentCols = new Set();
  const currentFull = new Map();

  for (let col = 2; col <= lastCol; col++) {
    const colName = String(row1[col - 1] || '').trim();
    if (!colName) continue;
    const sel     = String(row2[col - 1] || '').trim();
    const selNorm = sel.toLowerCase();
    if (sel && selNorm !== 'select option' && selNorm !== EXCLUDE_TRIGGER) {
      currentCols.add(colName);
      currentFull.set(colName, selNorm);
    }
  }

  if (currentCols.size === 0) {
    alert_('No columns are currently selected in row 2. Please make selections before checking the catalogue.');
    return;
  }

  const lastRow = builder.getLastRow();
  if (lastRow < CATALOGUE_DATA_START) {
    alert_('No catalogue entries found (catalogue starts at row ' + CATALOGUE_DATA_START + ').'); return;
  }

  const catData      = builder.getRange(CATALOGUE_DATA_START, 1, lastRow - CATALOGUE_DATA_START + 1, lastCol).getValues();
  const exactMatches = [];
  const nearMatches  = [];  // same columns, different mandatory/optional/hidden nuance

  catData.forEach(catRow => {
    const manifestName = String(catRow[0] || '').trim();
    if (!manifestName) return;

    // Build catalogue entry maps
    const catCols = new Set();
    const catFull = new Map();

    for (let col = 2; col <= lastCol; col++) {
      const colName = String(row1[col - 1] || '').trim();
      if (!colName) continue;
      const val     = catRow[col - 1];
      // Support both old TRUE/FALSE checkboxes and new full-string storage
      let selStr = '';
      if (val === true)                                            selStr = 'include and visible (mandatory)';
      else if (typeof val === 'string' && val.trim().length > 0)  selStr = val.trim().toLowerCase();
      // false / blank / null = excluded

      if (selStr) {
        catCols.add(colName);
        catFull.set(colName, selStr);
      }
    }

    // Same column set?
    const sameColumns =
      currentCols.size === catCols.size &&
      [...currentCols].every(c => catCols.has(c));

    if (!sameColumns) return;

    // Same columns — now check if nuance also matches (exact) or differs (near)
    let nuanceMatches = true;
    for (const [colName, curSel] of currentFull) {
      if (catFull.get(colName) !== curSel) { nuanceMatches = false; break; }
    }

    if (nuanceMatches) exactMatches.push(manifestName);
    else               nearMatches.push(manifestName);
  });

  // Build result message
  if (exactMatches.length === 0 && nearMatches.length === 0) {
    alert_(
      `🔍 No matching manifest found in the catalogue.

` +
      `Your current selection (${currentCols.size} columns) does not match any existing manifest — ` +
      `either in columns selected or in their mandatory/optional/hidden configuration.

` +
      `This appears to be a new manifest configuration.`
    );
  } else {
    let msg = `🔍 Catalogue check complete (${currentCols.size} columns selected)\n\n`;

    if (exactMatches.length > 0) {
      msg += `✅ Exact match (identical columns AND mandatory/optional/hidden status):\n`;
      msg += exactMatches.map(m => `  • ${m}`).join('\n');
      msg += '\n\nConsider reusing one of these instead of generating a new one.\n\n';
    }

    if (nearMatches.length > 0) {
      msg += `🔶 Near match (same columns, different mandatory/optional/hidden nuance):\n`;
      msg += nearMatches.map(m => `  • ${m}`).join('\n');
      msg += '\n\nThese manifests use the same fields but with different visibility or obligation settings.';
    }

    alert_(msg);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: Load from catalogue (Option A — simple dialog)
//
// FUTURE — Option B (searchable HTML sidebar):
//   Replace the prompt() dialog below with a HtmlService sidebar that renders
//   a search input and a card-per-manifest list (showing mandatory/optional/hidden
//   counts as coloured badges). On selection, it calls google.script.run to write
//   the row 2 values back. Build with HtmlService.createHtmlOutputFromFile() and
//   SpreadsheetApp.getUi().showSidebar(). The catalogue data can be passed into
//   the HTML template via a scriptlet or via google.script.run return value.
//   See: https://developers.google.com/apps-script/guides/html/communication
// ═══════════════════════════════════════════════════════════════════════════════

function loadFromCatalogue() {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const builder = ss.getSheetByName(BUILDER_SHEET_NAME);
  if (!builder) { alert_(`Sheet "${BUILDER_SHEET_NAME}" not found.`); return; }

  const lastCol = builder.getLastColumn();
  const row1    = builder.getRange(ROW_PROJECT_NAME, 1, 1, lastCol).getValues()[0];
  const lastRow = builder.getLastRow();

  if (lastRow < CATALOGUE_DATA_START) {
    alert_('No catalogue entries found. The catalogue section starts at row ' + CATALOGUE_DATA_START + '.'); return;
  }

  // Read catalogue entries — col A = name, cols B+ = selection strings
  const catData = builder.getRange(
    CATALOGUE_DATA_START, 1, lastRow - CATALOGUE_DATA_START + 1, lastCol
  ).getValues();

  // Build list of named entries with a summary of their column counts
  const entries = [];
  catData.forEach((catRow, idx) => {
    const name = String(catRow[0] || '').trim();
    if (!name) return;

    let mandatory = 0, optional = 0, hidden = 0;
    for (let col = 2; col <= lastCol; col++) {
      const val     = catRow[col - 1];
      let   selStr  = '';
      if (val === true)                                           selStr = 'include and visible (mandatory)';
      else if (typeof val === 'string' && val.trim().length > 0) selStr = val.trim().toLowerCase();
      if (!selStr) continue;

      if (selStr.includes('hidden'))                              hidden++;
      else if (selStr.includes('optional'))                       optional++;
      else                                                        mandatory++;
    }

    entries.push({ name, mandatory, optional, hidden, dataRowIdx: idx });
  });

  if (entries.length === 0) {
    alert_('No named entries found in the catalogue section.'); return;
  }

  // ── Option A: native prompt with a numbered list ────────────────────────
  // The user types the number of their choice.
  // (Option B would show a searchable HTML sidebar instead — see comment above.)
  const listLines = entries.map((e, i) =>
    `${i + 1}. ${e.name}  (${e.mandatory} mandatory, ${e.optional} optional, ${e.hidden} hidden)`
  ).join('\n');

  const ui       = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Load from catalogue',
    `Enter the number of the manifest to pre-populate row 2:\n\n${listLines}\n`,
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  const choice = parseInt(response.getResponseText().trim(), 10);
  if (isNaN(choice) || choice < 1 || choice > entries.length) {
    alert_(`Invalid choice. Please enter a number between 1 and ${entries.length}.`); return;
  }

  const selected  = entries[choice - 1];
  const catRow    = catData[selected.dataRowIdx];

  // ── Write selections back into row 2 ─────────────────────────────────────
  // For each column in the catalogue entry:
  //   • Full selection string → write directly into row 2
  //   • Old TRUE checkbox     → map to "Include and visible (mandatory)"
  //   • Empty / FALSE         → write "Exclude"
  // Columns that don't appear in the catalogue (new columns added since) are left as-is.
  let written = 0;
  for (let col = 2; col <= lastCol; col++) {
    const val    = catRow[col - 1];
    let   newSel = '';

    if (val === true) {
      newSel = 'Include and visible (mandatory)';
    } else if (typeof val === 'string' && val.trim().length > 0) {
      // Restore original casing from BUILDER_DROPDOWN_OPTIONS if possible
      const stored   = val.trim();
      const matched  = BUILDER_DROPDOWN_OPTIONS.find(
        opt => opt.toLowerCase() === stored.toLowerCase()
      );
      newSel = matched || stored;  // use canonical casing if found
    } else {
      newSel = 'Exclude';
    }

    builder.getRange(ROW_SELECTION, col).setValue(newSel);
    written++;
  }

  alert_(
    `✅ Row 2 pre-populated from: ${selected.name}

` +
    `${written} columns updated (${selected.mandatory} mandatory, ` +
    `${selected.optional} optional, ${selected.hidden} hidden, rest excluded).

` +
    `You can now adjust any selections before generating the manifest.`
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: syncSopCommentsToBuilder()
// Fetches the latest SOP descriptions from the master SOP Google Doc and writes
// them as cell comments on the row 1 column headers of the builder sheet
// (all_manifest_builder_v1.0). This keeps the builder sheet up to date whenever
// the SOP source document is edited, without needing to run a full generation.
// Called from the menu: 📋 ToL Manifest Tools > 🔄 Sync SOP comments to builder headers
// ═══════════════════════════════════════════════════════════════════════════════

function syncSopCommentsToBuilder() {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const builder = ss.getSheetByName(BUILDER_SHEET_NAME);
  if (!builder) { alert_(`Sheet "${BUILDER_SHEET_NAME}" not found.`); return; }

  // Fetch latest SOP descriptions — hard-fails if Doc is inaccessible or malformed
  let sopComments;
  try {
    sopComments = fetchSopComments_();
  } catch (e) {
    alert_(`⚠️ SOP Sync Failed\n\n${e.message}`); return;
  }

  // Apply comments to every named header cell in row 1 (skip col 1 = label column)
  const lastCol = builder.getLastColumn();
  const row1    = builder.getRange(ROW_PROJECT_NAME, 1, 1, lastCol).getValues()[0];
  let updated = 0;
  let missing  = 0;

  for (let col = 2; col <= lastCol; col++) {
    const colName = String(row1[col - 1] || '').trim();
    if (!colName) continue;
    if (sopComments[colName]) {
      builder.getRange(ROW_PROJECT_NAME, col).setComment(sopComments[colName]);
      updated++;
    } else {
      missing++;
    }
  }

  alert_(
    `✅ SOP comments synced to builder headers.\n\n` +
    `${updated} column(s) updated with the latest SOP descriptions.\n` +
    (missing > 0
      ? `${missing} column(s) had no matching SOP entry — their comments were left unchanged.`
      : `All columns matched.`)
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: applyBuilderDropdowns_(builder)
// Applies the five-option dropdown validation list to every column in row 2
// of the builder sheet. Runs automatically at the start of generateManifest()
// so the dropdowns are always up to date without a separate setup step.
// ═══════════════════════════════════════════════════════════════════════════════

function applyBuilderDropdowns_(builder) {
  const lastCol = builder.getLastColumn();
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(BUILDER_DROPDOWN_OPTIONS, true)
    .setAllowInvalid(false)
    .build();
  // Apply to all data columns in row 2 (skip col 1 which is the label)
  for (let col = 2; col <= lastCol; col++) {
    builder.getRange(ROW_SELECTION, col).setDataValidation(rule);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: applyDateFormatting_(sheet, colNum, startRow, endRow)
// Applied to DATE_OF_COLLECTION only. Does two things:
//   1. Pre-formats cells as Text (@) so Excel doesn't auto-convert YYYY-MM-DD
//      into its own date serial when the file is downloaded as .xlsx.
//   2. Adds a conditional formatting rule that highlights the cell coral if it
//      is non-empty and does not match the YYYY-MM-DD pattern.
// Note: no rejection rule is used — rejection rules don't survive xlsx export
// but conditional formatting does, so coral highlighting is the safety net.
//
// WHY no TEXT() wrapper in the formula:
//   TEXT(cell,"@") on a value that Google Sheets has auto-converted to a date
//   serial returns the serial number as a string (e.g. "45306"), not the
//   displayed date string. This caused false positives on correctly formatted
//   dates. Since cells are already pre-formatted as Text, the cell reference
//   is used directly in REGEXMATCH so it operates on the stored string value.
// ═══════════════════════════════════════════════════════════════════════════════

function applyDateFormatting_(sheet, colNum, startRow, endRow) {
  const range       = sheet.getRange(startRow, colNum, endRow - startRow + 1, 1);
  const firstCellA1 = sheet.getRange(startRow, colNum).getA1Notation();

  // Pre-format as Text so Excel doesn't mangle YYYY-MM-DD on xlsx download
  range.setNumberFormat('@');

  // Coral highlight if non-empty AND doesn't match YYYY-MM-DD
  // Simple format-only check (YYYY-MM-DD digits) — no range validation needed
  const pattern = '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';
  const cfRule  = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(
      `=AND(${firstCellA1}<>"",NOT(REGEXMATCH(${firstCellA1},"${pattern}")))`
    )
    .setBackground(COLOUR_DATE_ERROR)
    .setFontColor(COLOUR_HEADER_TEXT_DARK)
    .setRanges([range])
    .build();

  const rules = sheet.getConditionalFormatRules();
  rules.push(cfRule);
  sheet.setConditionalFormatRules(rules);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: applyMissingMandatoryHighlight_(sheet, colNum, startRow, endRow)
// Applies a conditional formatting rule to mandatory columns: if a cell is
// blank, it is highlighted with soft amber (#F3D27A) to guide data curators.
// This is the single most useful validation cue in a large manifest — it makes
// missing required values immediately visible without being alarming.
// ═══════════════════════════════════════════════════════════════════════════════

function applyMissingMandatoryHighlight_(sheet, colNum, startRow, endRow) {
  const range       = sheet.getRange(startRow, colNum, endRow - startRow + 1, 1);
  const firstCellA1 = sheet.getRange(startRow, colNum).getA1Notation();

  const cfRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(`=${firstCellA1}=""`)
    .setBackground(COLOUR_MISSING_REQUIRED)
    .setRanges([range])
    .build();

  const rules = sheet.getConditionalFormatRules();
  rules.push(cfRule);
  sheet.setConditionalFormatRules(rules);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: readDataValidationMap_(dvSheet)
// Reads the 'Data Validation' tab and returns a map of
// { COLUMN_NAME: ['option1', 'option2', …] } for every column that has a
// controlled vocabulary list. Used to apply dropdown validation in the manifest.
// ═══════════════════════════════════════════════════════════════════════════════

function readDataValidationMap_(dvSheet) {
  const lastRow = dvSheet.getLastRow();
  const lastCol = dvSheet.getLastColumn();
  if (lastRow < 2) return {};
  const data = dvSheet.getRange(1, 1, lastRow, lastCol).getValues();
  const map  = {};
  for (let c = 0; c < lastCol; c++) {
    const header = String(data[0][c] || '').trim();
    if (!header) continue;
    const vals = [];
    for (let r = 1; r < data.length; r++) {
      const v = data[r][c];
      if (v !== null && v !== undefined && v !== '') vals.push(String(v));
    }
    if (vals.length > 0) map[header] = vals;
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: applyDropdown_(manifestSheet, newSS, colNum, startRow, endRow, colName, values)
// Applies a dropdown validation list to a column range in the manifest sheet.
// Short lists (≤500 chars) are applied inline. Longer lists (e.g. ORGANISM_PART)
// are written to a hidden '_DV_Lists' helper sheet and referenced by range,
// working around Google Sheets' inline character limit for validation lists.
// ═══════════════════════════════════════════════════════════════════════════════

function applyDropdown_(manifestSheet, newSS, colNum, startRow, endRow, colName, values) {
  const range  = manifestSheet.getRange(startRow, colNum, endRow - startRow + 1, 1);
  const inline = values.join(',');
  if (inline.length <= 500) {
    range.setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(values, true)
        .setAllowInvalid(true)
        .build()
    );
    return;
  }
  // Long list → hidden helper sheet
  let dvListSheet = newSS.getSheetByName('_DV_Lists');
  if (!dvListSheet) {
    dvListSheet = newSS.insertSheet('_DV_Lists');
    dvListSheet.hideSheet();
  }
  const listCol = dvListSheet.getLastColumn() + 1;
  dvListSheet.getRange(1, listCol).setValue(colName);
  dvListSheet.getRange(2, listCol, values.length, 1).setValues(values.map(v => [v]));
  range.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInRange(dvListSheet.getRange(2, listCol, values.length, 1), true)
      .setAllowInvalid(true)
      .build()
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: colLetter_(n)
// Converts a 1-based column index to a spreadsheet column letter.
// Examples: 1→A, 26→Z, 27→AA, 53→BA. Used in SOP documents to prefix each
// field description with its actual column letter in the generated manifest.
// ═══════════════════════════════════════════════════════════════════════════════

function colLetter_(n) {
  let letter = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: fetchSopComments_()
// Opens the master SOP Google Doc (SOP_DOC_ID) at run-time and parses every
// bullet-point LIST_ITEM into a map of { COLUMN_NAME: 'description text' }.
// This ensures the generated manifest cell comments and SOP documents always
// reflect the latest version of the SOP without any script changes needed.
//
// THROWS (does NOT fall back) if:
//   • The Doc cannot be opened (permissions/wrong ID)
//   • Fewer than 5 entries are parsed (Doc structure changed)
// This is intentional — a silent fallback risks using stale descriptions
// without anyone noticing. Generation is cancelled with a clear error message.
// ═══════════════════════════════════════════════════════════════════════════════

function fetchSopComments_() {
  let doc;
  try {
    doc = DocumentApp.openById(SOP_DOC_ID);
  } catch (e) {
    // Check for the specific error caused by pointing at a .docx file instead
    // of a native Google Doc — DocumentApp cannot open .docx files.
    const isDocxError = e.message && (
      e.message.toLowerCase().includes('inaccessible') ||
      e.message.toLowerCase().includes('not a google doc')
    );

    if (isDocxError) {
      throw new Error(
        `The SOP file appears to be a .docx file rather than a native Google Doc.\n\n` +
        `DocumentApp can only open native Google Docs format.\n\n` +
        `To fix this (one-time step):\n` +
        `  1. Open the file in Google Drive\n` +
        `  2. Go to File → Save as Google Docs\n` +
        `  3. Copy the new Doc ID from the URL\n` +
        `  4. Update SOP_DOC_ID in the script constants\n\n` +
        `Current Doc ID: ${SOP_DOC_ID}\n` +
        `Original error: ${e.message}`
      );
    }

    throw new Error(
      `Could not open the SOP Google Doc.\n` +
      `Doc ID: ${SOP_DOC_ID}\nError: ${e.message}\n\n` +
      `Check that the Doc is shared with the account running this script, ` +
      `and that the ID points to a native Google Doc (not a .docx file).`
    );
  }
  const body  = doc.getBody();
  const count = body.getNumChildren();
  const map   = {};
  for (let i = 0; i < count; i++) {
    const child = body.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.LIST_ITEM) continue;
    const text     = child.asListItem().getText().trim();
    const colonIdx = text.indexOf(':');
    if (colonIdx < 1) continue;
    const rawName = text.substring(0, colonIdx).trim();
    const desc    = text.substring(colonIdx + 1).trim();
    if (!desc || /[a-z]/.test(rawName)) continue;
    const nameMatch = rawName.match(/^([A-Z][A-Z0-9_]+)/);
    if (!nameMatch) continue;
    map[nameMatch[1]] = desc;
  }
  if (Object.keys(map).length < 5) {
    throw new Error(
      `SOP Doc opened but only ${Object.keys(map).length} column description(s) parsed.\n` +
      `The Doc structure may have changed or the wrong Doc ID is set.\n` +
      `Doc ID: ${SOP_DOC_ID}\n\nGeneration cancelled.`
    );
  }
  Logger.log(`SOP Doc parsed: ${Object.keys(map).length} descriptions found.`);
  return map;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: addPartnerSopTab_(newSS, columns, today, sopComments, projectName)
// Adds a 'Partner SOP' tab (green) to the generated manifest Google Sheet.
// Contains the full SOP preamble + column-by-column instructions for visible
// columns only. Hidden columns are omitted with an explanatory note.
// Column entries use the format: 'A. FIELDNAME: description text'
// ═══════════════════════════════════════════════════════════════════════════════

function addPartnerSopTab_(newSS, columns, today, sopComments, projectName) {
  const sheet = newSS.insertSheet('Partner SOP');
  sheet.setTabColor('#34A853');
  sheet.setColumnWidth(1, 900);

  const visibleCols = columns.filter(c => !c.isHidden);
  const letterMap   = {};
  columns.forEach((col, i) => { letterMap[col.name] = colLetter_(i + 1); });

  const headings = [
    'Purpose of this document',
    'Detailed instructions for filling in the Sample Manifest',
    'Column by column instructions for completing the manifest (Metadata Entry tab)'
  ];

  const rows = [
    [`Recording Sample Metadata for Tree of Life projects`],
    [`Sample Manifest SOP — Partner Version  |  ${projectName}`],
    [`Version: 1.0  |  Generated: ${today}  |  Project: ${projectName}  |  Correspondence: treeoflifesamples@sanger.ac.uk`],
    [''],
    ['Purpose of this document'],
    [''],
    ['The Tree of Life (ToL) Programme produces biodiversity genomic data publicly available in the ENA (https://www.ebi.ac.uk/ena/browser). This SOP contains instructions for filling in the Sample Manifest for the project "' + projectName + '".'],
    [''],
    ['Detailed instructions for filling in the Sample Manifest'],
    [''],
    ['I. Please only fill in the Metadata Entry tab. If you identify a problem, contact treeoflifesamples@sanger.ac.uk.'],
    [''],
    ['II. Mandatory fields are highlighted in green. If information is unavailable, use:'],
    ['    • NOT_APPLICABLE = information is inappropriate to report.'],
    ['    • NOT_COLLECTED = information was not collected.'],
    ['    • NOT_PROVIDED = information not provided, but may be at a later stage.'],
    [''],
  ];

  // Hidden column note
  const hiddenCount = columns.filter(c => c.isHidden).length;
  if (hiddenCount > 0) {
    rows.push([`Note: This manifest contains ${hiddenCount} hidden column(s) managed internally by the ToL team. These have a white header background and show "[ignore]" in the column name — no input is needed from you for these columns.`]);
    rows.push(['']);
  }

  rows.push(['Column by column instructions for completing the manifest (Metadata Entry tab)']);
  rows.push(['']);
  rows.push([`This partner SOP covers only the visible columns in the manifest for project "${projectName}", generated on ${today}.`]);
  rows.push(['']);

  visibleCols.forEach((col, idx) => {
    const letter  = letterMap[col.name];
    const comment = sopComments[col.name] || '(No SOP description available.)';
    rows.push([`${letter}. ${col.name}: ${comment}`]);
    rows.push(['']);
  });

  sheet.getRange(1, 1, rows.length, 1).setValues(rows).setWrap(true).setVerticalAlignment('top');

  // Bold headings
  rows.forEach((row, idx) => {
    const val = String(row[0]).trim();
    if (idx === 0) sheet.getRange(idx + 1, 1).setFontSize(14).setFontWeight('bold');
    else if (headings.includes(val)) sheet.getRange(idx + 1, 1).setFontWeight('bold').setFontSize(11);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: createSopDoc_(baseName, columns, today, sopComments, projectName, partnerFacing)
// Creates a tailored SOP Google Doc saved to the shared output folder.
// Called twice per run — once with partnerFacing=false (internal), once true.
//
// Internal version:  all columns listed; hidden columns greyed and marked [HIDDEN]
// Partner version:   hidden columns omitted; note explains they need no input
//
// Both versions include: header/footer, title block (left-aligned), purpose,
// general instructions, and column-by-column entries in 'A. FIELDNAME: desc'
// format with FIELDNAME highlighted in its manifest header colour.
// ═══════════════════════════════════════════════════════════════════════════════

function createSopDoc_(baseName, columns, today, sopComments, projectName, partnerFacing) {
  const docType = partnerFacing ? 'Partner_SOP' : 'Internal_SOP';
  const doc     = DocumentApp.create(`ToL_${docType}_${baseName}`);
  const body    = doc.getBody();
  body.clear();
  body.setAttributes({
    [DocumentApp.Attribute.HORIZONTAL_ALIGNMENT]: DocumentApp.HorizontalAlignment.LEFT
  });

  // Colour constants linked to sheet header colours
  const COL_MANDATORY = COLOUR_MANDATORY;   // '#355C4B' deep forest teal — links to manifest header colour
  const COL_OPTIONAL  = COLOUR_OPTIONAL_LIGHT;  // '#C8DDD3' soft sage

  const sopColumns = partnerFacing
    ? columns.filter(col => !col.isHidden)
    : columns;

  const letterMap = {};
  columns.forEach((col, i) => { letterMap[col.name] = colLetter_(i + 1); });

  // ── Header (all pages) ────────────────────────────────────────────────────
  const header     = doc.addHeader();
  const headerPara = header.appendParagraph('Recording Sample Metadata for Tree of Life Projects');
  headerPara.setFontSize(10).setAlignment(DocumentApp.HorizontalAlignment.LEFT);
  header.appendParagraph('').setFontSize(4);

  // ── Footer ────────────────────────────────────────────────────────────────
  const footer     = doc.addFooter();
  const footerPara = footer.appendParagraph(
    `Recording Sample Metadata for ToL Projects  |  Standard Operating Procedure  |  ` +
    `Project: ${projectName}  |  Version: 1.0  |  ` +
    (partnerFacing ? 'Partner Version' : 'Internal Version')
  );
  footerPara.setFontSize(9).setAlignment(DocumentApp.HorizontalAlignment.LEFT);
  footer.appendParagraph('').setFontSize(4);

  // ── Title block ───────────────────────────────────────────────────────────
  const titlePara = body.appendParagraph('Recording Sample Metadata for Tree of Life projects');
  titlePara.setHeading(DocumentApp.ParagraphHeading.TITLE);
  titlePara.setAlignment(DocumentApp.HorizontalAlignment.LEFT);

  const subtitlePara = body.appendParagraph(
    partnerFacing
      ? `Sample Manifest SOP — Partner Version  |  ${projectName}`
      : `Sample Manifest SOP — Internal Version  |  ${projectName}`
  );
  subtitlePara.setHeading(DocumentApp.ParagraphHeading.SUBTITLE);
  subtitlePara.setAlignment(DocumentApp.HorizontalAlignment.LEFT);

  body.appendParagraph(
    `Version: 1.0  |  Generated: ${today}  |  Project: ${projectName}  |  Correspondence: treeoflifesamples@sanger.ac.uk`
  ).setAlignment(DocumentApp.HorizontalAlignment.LEFT);
  body.appendParagraph('');

  // ── Purpose ───────────────────────────────────────────────────────────────
  body.appendParagraph('Purpose of this document').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(
    'The Tree of Life (ToL) Programme produces biodiversity genomic data publicly available ' +
    'in the ENA (https://www.ebi.ac.uk/ena/browser). This SOP contains instructions for ' +
    `filling in the Master Sample Manifest for the project "${projectName}". ` +
    'ToL projects only accession and process samples that have complete metadata.'
  );
  body.appendParagraph('');

  // ── General instructions ──────────────────────────────────────────────────
  body.appendParagraph('Detailed instructions for filling in the Sample Manifest')
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(
    'I. Please only fill in the Metadata Entry tab. If you identify a problem, contact treeoflifesamples@sanger.ac.uk.'
  );
  body.appendParagraph(
    'II. Mandatory fields are highlighted in green. If information is unavailable, use:'
  );
  ['NOT_APPLICABLE = information is inappropriate to report.',
   'NOT_COLLECTED = information was not collected.',
   'NOT_PROVIDED = information not provided, but may be at a later stage.'
  ].forEach(t => body.appendListItem(t).setGlyphType(DocumentApp.GlyphType.BULLET));
  body.appendParagraph('');

  // ── Column-by-column ─────────────────────────────────────────────────────
  body.appendParagraph('Column by column instructions for completing the manifest (Metadata Entry tab)')
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);

  if (partnerFacing) {
    const hiddenCount = columns.filter(c => c.isHidden).length;
    if (hiddenCount > 0) {
      body.appendParagraph(
        `Note: This manifest contains ${hiddenCount} hidden column(s) managed internally by the ` +
        'ToL team. These have a white header background and show "[ignore]" in the column name — ' +
        'no input is needed from you for these columns.'
      ).editAsText().setForegroundColor('#555555');
      body.appendParagraph('');
    }
    body.appendParagraph(
      `This partner SOP covers only the visible columns in the manifest for project "${projectName}", generated on ${today}.`
    );
  } else {
    body.appendParagraph(
      `This internal SOP covers all columns (visible and hidden) for project "${projectName}", generated on ${today}. Hidden columns are marked [HIDDEN].`
    );
  }
  body.appendParagraph('');

  // ── Column entries: "A. FIELDNAME: description" ───────────────────────────
  sopColumns.forEach(col => {
    const letter    = letterMap[col.name];
    const comment   = sopComments[col.name] || '(No SOP description available.)';
    const isHidden  = col.isHidden;
    const hiddenTag = (!partnerFacing && isHidden) ? ' [HIDDEN]' : '';
    const prefix    = `${letter}${hiddenTag}. `;
    const fieldName = col.name;
    const suffix    = `: ${comment}`;
    const fullText  = prefix + fieldName + suffix;

    const para    = body.appendParagraph(fullText);
    para.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
    const textEl  = para.editAsText();
    const nameStart = prefix.length;
    const nameEnd   = nameStart + fieldName.length - 1;

    // Bold field name
    textEl.setBold(nameStart, nameEnd, true);

    // Highlight field name with manifest header colour; match header text contrast
    let hlColour, hlTextColour;
    if (isHidden)             { hlColour = '#EEEEEE';    hlTextColour = '#000000'; }
    else if (col.isMandatory) { hlColour = COL_MANDATORY; hlTextColour = '#FFFFFF'; }
    else                      { hlColour = COL_OPTIONAL;  hlTextColour = '#000000'; }
    textEl.setBackgroundColor(nameStart, nameEnd, hlColour);
    textEl.setForegroundColor(nameStart, nameEnd, hlTextColour);

    // Grey out entire entry for hidden columns in internal SOP
    if (!partnerFacing && isHidden) {
      textEl.setForegroundColor(0, prefix.length - 1, '#999999');
      textEl.setForegroundColor(nameEnd + 1, fullText.length - 1, '#999999');
    }

    body.appendParagraph('');
  });

  // ── Document History ──────────────────────────────────────────────────────
  body.appendParagraph('Document History').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('Version: 1.0  |  Date: 2025-09-09  |  Status: Draft');
  body.appendParagraph(`Project: ${projectName}  |  Generated: ${today}`);
  body.appendParagraph(
    partnerFacing
      ? 'Partner-facing version. Hidden columns omitted.'
      : 'Internal version. All columns listed; hidden columns marked [HIDDEN].'
  );

  doc.saveAndClose();
  return doc;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: appendCatalogueRow_(builder, projectName, columns, lastCol, row1, row2)
// See doc comment below for full details.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Appends a new row to the ToL Manifest Catalogue section of the builder sheet.
 *
 * Format of the new row:
 *   Col A  = project name, bold, yellow background, with a cell note
 *            flagging it as pending SM team review.
 *   Col B+ = full selection string for included columns (e.g. "Include,
 *            visible and mandatory"), empty string for excluded/unset.
 *            Each cell is colour-coded to match the manifest headers:
 *            teal (mandatory), sage (optional), white (hidden),
 *            light grey (excluded).
 *
 * Row formatting: font size 8, text wrap, solid border around the full row.
 *
 * This richer format (vs old TRUE/FALSE checkboxes) allows loadFromCatalogue()
 * to restore the exact mandatory/optional/hidden nuance when pre-populating
 * row 2, and allows checkCatalogue() to distinguish exact vs near matches.
 * Old TRUE/FALSE rows in the catalogue are still supported by both functions.
 *
 * Insertion: finds the last named row in the catalogue section and inserts
 * one row below it (blank separator rows between entries are preserved).
 */
function appendCatalogueRow_(builder, projectName, columns, lastCol, row1, row2) {
  // Find the last row that has any content in col A at or after CATALOGUE_DATA_START
  const lastRow   = builder.getLastRow();
  let   insertRow = CATALOGUE_DATA_START;

  for (let r = CATALOGUE_DATA_START; r <= lastRow; r++) {
    const val = builder.getRange(r, 1).getValue();
    if (val !== null && val !== '' && val !== undefined) {
      insertRow = r + 1;  // place new entry one row below the last named entry
    }
  }

  // Skip any blank separator rows between last entry and insertion point
  // (keep insertRow as-is — blank rows between entries are fine)

  // Build the row values: col A = name, cols B onward = selection strings or ''
  const rowValues = new Array(lastCol).fill('');
  rowValues[0] = projectName;  // col A (index 0)

  // Store the full selection string for each column (richer than TRUE/FALSE).
  // This allows "Load from catalogue" to restore the exact mandatory/optional/hidden
  // nuance, and lets the catalogue checker distinguish exact vs near matches.
  // Empty string = excluded/unset.
  for (let col = 2; col <= lastCol; col++) {
    const sel     = String(row2[col - 1] || '').trim();
    const selNorm = sel.toLowerCase();
    const isIncluded = sel && selNorm !== 'select option' && selNorm !== EXCLUDE_TRIGGER;
    rowValues[col - 1] = isIncluded ? sel : '';  // store original casing
  }

  // Write the row
  const targetRange = builder.getRange(insertRow, 1, 1, lastCol);
  targetRange.setValues([rowValues]);

  // Row-wide formatting: compact font, wrapped text, border around the full row
  targetRange
    .setFontSize(8)
    .setWrap(true)
    .setBorder(true, true, true, true, null, null,
      '#000000', SpreadsheetApp.BorderStyle.SOLID);

  // Col A: yellow to flag as new/pending SM review
  const nameCell = builder.getRange(insertRow, 1);
  nameCell.setBackground('#FFF9C4').setFontWeight('bold');
  nameCell.setNote(
    'Generated ' + new Date().toLocaleDateString() +
    ' — pending SM team review. Copy this row to the master manifest catalogue.'
  );

  // Cols B onward: colour-coded to match the manifest header colours
  //   Teal       = mandatory → white text
  //   Sage       = optional  → charcoal text
  //   White      = hidden    → charcoal text
  //   Light grey = excluded  → charcoal text
  for (let col = 2; col <= lastCol; col++) {
    const val  = rowValues[col - 1];
    const cell = builder.getRange(insertRow, col);
    if (!val) {
      cell.setBackground(COLOUR_EXCLUDED_CELL).setFontColor(COLOUR_HEADER_TEXT_LIGHT);
      continue;
    }
    const selNorm = String(val).toLowerCase();
    let bg, fg;
    if      (selNorm.includes('hidden'))   { bg = COLOUR_HIDDEN_BG;     fg = COLOUR_HEADER_TEXT_LIGHT; }
    else if (selNorm.includes('optional')) { bg = COLOUR_OPTIONAL_LIGHT; fg = COLOUR_HEADER_TEXT_LIGHT; }
    else                                   { bg = COLOUR_MANDATORY;      fg = COLOUR_HEADER_TEXT_DARK;  }
    cell.setBackground(bg).setFontColor(fg);
  }

  Logger.log(`Catalogue row appended at row ${insertRow}: ${projectName}`);
  return insertRow;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: moveToOutputFolder_(fileId)
// See doc comment below for full details.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Moves a Drive file into OUTPUT_FOLDER_ID and removes it from all other parents
 * (Drive creates files in the root by default — this relocates them).
 * Falls back gracefully if the folder ID is wrong or permissions are missing.
 */
function moveToOutputFolder_(fileId) {
  try {
    const folder = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
    const file   = DriveApp.getFileById(fileId);
    folder.addFile(file);
    // Remove from root / any other parents
    const parents = file.getParents();
    while (parents.hasNext()) {
      const parent = parents.next();
      if (parent.getId() !== OUTPUT_FOLDER_ID) {
        parent.removeFile(file);
      }
    }
  } catch (e) {
    Logger.log(`⚠️  Could not move file ${fileId} to output folder: ${e.message}`);
    // Non-fatal — file still exists in Drive root
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: alert_(msg)
// Shorthand for SpreadsheetApp.getUi().alert(msg). Used throughout to keep
// error/success messages concise at the call site.
// ═══════════════════════════════════════════════════════════════════════════════

function alert_(msg) {
  SpreadsheetApp.getUi().alert(msg);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Menu: onOpen()
// Runs automatically when the spreadsheet is opened. Adds the
// '📋 ToL Manifest Tools' menu with four items:
//   • 🔍 Check catalogue for identical manifest  (top-level, easy access)
//   • 📂 Load from catalogue into row 2          (top-level, easy access)
//   • 🔄 Sync SOP comments to builder headers    (top-level — run after SOP edits)
//   • Generate manifest + SOP > ▶ Run generator  (in submenu — prevents
//     accidental triggering of the full generation pipeline)
// ═══════════════════════════════════════════════════════════════════════════════

function onOpen() {
  const ui = SpreadsheetApp.getUi();

  // Top-level menu: catalogue and SOP sync are immediately accessible
  // Generate manifest lives in a submenu so it is harder to trigger accidentally
  ui.createMenu('📋 ToL Manifest Tools')
    .addItem('🔍 Check catalogue for identical manifest', 'checkCatalogue')
    .addItem('📂 Load from catalogue into row 2', 'loadFromCatalogue')
    .addItem('🔄 Sync SOP comments to builder headers', 'syncSopCommentsToBuilder')
    .addSeparator()
    .addSubMenu(
      ui.createMenu('Generate manifest + SOP')
        .addItem('▶ Run generator', 'generateManifest')
    )
    .addToUi();
}
