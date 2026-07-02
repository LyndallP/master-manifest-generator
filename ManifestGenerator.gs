/**
 * ToL Manifest Generator
 * ──────────────────────
 * Reads an "all_manifest_builder_v1.0" sheet and generates a tailored
 * Sample Manifest and accompanying SOP documents for a given ToL project.
 *
 * TWO KINDS OF SPREADSHEET, ONE SHARED SCRIPT:
 *   This same script file is bound to two different kinds of spreadsheet.
 *   Which menu appears is decided at open-time by comparing the active
 *   spreadsheet's ID against MASTER_SPREADSHEET_ID (see Constants below):
 *
 *   • THE MASTER MANIFEST — the single canonical spreadsheet the SM team
 *     maintains: column structure/requirements (rows 1–8), the live
 *     Manifest Catalogue (rows 14+), and a "default" row 3 selection state
 *     that every new PI template starts from. Shows the SM Only menu.
 *     Nobody generates directly from the master — see "Create New Builder
 *     Template for a PI" below.
 *
 *   • A PI BUILDER TEMPLATE — a full Drive copy of the master (made via
 *     SM Only > Create New Builder Template for a PI), handed to one PI to
 *     fill in their own row 3 selections and project name. Shows the
 *     ToL Manifest Tools menu. Because copying a spreadsheet also copies
 *     its bound script, every template runs this exact same file — but
 *     since its ID never matches MASTER_SPREADSHEET_ID, it always renders
 *     the PI-facing menu instead.
 *     Its own local Manifest Catalogue rows are just a frozen snapshot from
 *     copy-time and are never read or written — checking, loading, and
 *     appending to the catalogue always go through the live master
 *     (getMasterBuilderSheet_()), so every PI template shares one
 *     up-to-date catalogue. This means every PI needs at least Editor
 *     access to the master spreadsheet, not just their own template.
 *
 * WHAT GENERATE MY MANIFEST BUILDS (per run, from a PI template):
 *   1. A new Google Sheets manifest file — tab named "Metadata Entry",
 *      with 1920 data rows, colour-coded headers, dropdowns, and date
 *      validation. Saved to a per-project subfolder in the shared output
 *      folder in Google Drive.
 *   2. An internal SOP Google Doc — all columns listed, hidden columns
 *      marked [HIDDEN] and greyed. Saved to the same subfolder.
 *   3. A partner-facing SOP Google Doc — hidden columns omitted, with a
 *      note explaining they require no input. Saved to the same subfolder.
 *   4. A partner SOP tab inside the manifest Google Sheet.
 *   5. A new row in the ToL Manifest Catalogue section of the MASTER's
 *      builder sheet — col A highlighted yellow, other cells colour-coded
 *      to match the manifest headers (green/blue/white). For SM team
 *      review. If the project name & version matches an existing catalogue
 *      entry, an iteration suffix ("-1", "-2", …) is appended.
 *
 * MENU on the master manifest (SM Only):
 *   • 🆕 Create New Builder Template for a PI    → createBuilderTemplate()
 *   • 🔄 Sync SOP comments to builder headers    → syncSopCommentsToBuilder()
 *
 * MENU on a PI builder template (📋 ToL Manifest Tools):
 *   • 🔍 Check catalogue for identical manifest  → checkCatalogue()
 *   • 📂 Load from catalogue into row 3          → loadFromCatalogue()
 *   • ▶ Generate my manifest                     → generateManifest()
 *
 * BUILDER SHEET STRUCTURE (all_manifest_builder_v1.0):
 *   Row 1 — Column group labels (reference only, not used by script)
 *   Row 2 — Column names  |  Col A = project name & version
 *   Row 3 — Project selections (dropdown per column). The dropdown list
 *           offered depends on row 5 (system-mandatory columns get a
 *           restricted 3-option list; all others get the full 5-option
 *           list, including the unset placeholder):
 *             "Mandatory, visible"                  → mandatory header
 *             "Optional, visible"                   → optional header
 *             "Mandatory/Include, hide, use NOT_COLLECTED"
 *                                                    → hidden column,
 *                                                      every data row
 *                                                      pre-filled with
 *                                                      NOT_COLLECTED
 *             "Mandatory/Include, hide, use bespoke term"
 *                                                    → hidden column,
 *                                                      every data row
 *                                                      pre-filled with the
 *                                                      value from row 7
 *             "select option" / blank                → unset — silently
 *                                                       excluded from the
 *                                                       manifest (no error)
 *           There is no "Exclude" option in the UI — leaving a column
 *           unset has the same effect.
 *   Row 4 — Column order numbers (optional; blank = keep natural order)
 *   Row 5 — System requirements (Mandatory/Optional) — determines which
 *            row 3 dropdown list a column gets
 *   Row 6 — Manifest requirements (reference only, not used by script)
 *   Row 7 — Bespoke autopopulate values — read by the script to pre-fill
 *            hidden columns whose row 3 selection is "...use bespoke term"
 *   Row 8 — Notes (reference only, not used by script)
 *   Rows 14+ — ToL Manifest Catalogue (one row per past manifest)
 *
 * CONFIGURATION (edit the constants below):
 *   MASTER_SPREADSHEET_ID — REQUIRED ONE-TIME SETUP. Must be set, from
 *                         within the master manifest itself, to the master's
 *                         own spreadsheet ID (from its URL). Until this is
 *                         set correctly, every spreadsheet running this
 *                         script — including the real master — will render
 *                         the PI-facing "ToL Manifest Tools" menu, since none
 *                         of them will match the placeholder ID.
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

// ID of the master manifest spreadsheet — REQUIRED ONE-TIME SETUP. From
// inside the master spreadsheet, open its URL (docs.google.com/spreadsheets/
// d/[ID]/edit) and paste [ID] here. This is how onOpen() and every catalogue
// function tell the master apart from a PI builder template copy.
const MASTER_SPREADSHEET_ID = 'PUT_MASTER_SPREADSHEET_ID_HERE';

const BUILDER_SHEET_NAME  = 'all_manifest_builder_v1.0';
const DATA_VAL_SHEET_NAME = 'Data Validation';
const MANIFEST_TAB_NAME   = 'Metadata Entry';
const MANIFEST_DATA_ROWS  = 1920;

// Builder sheet row numbers
// Row 1 is a group-label row (e.g. "mandatory fields, must be visible in all
// manifests") and is not read by the script.
const ROW_PROJECT_NAME  = 2;   // Col A: project name & version
const ROW_SELECTION     = 3;   // Include/exclude/hidden choices
const ROW_COL_ORDER     = 4;   // Optional column ordering numbers
const ROW_SYSTEM_REQ    = 5;   // System requirements (Mandatory/Optional)
const ROW_MANIFEST_REQ  = 6;   // Manifest requirements (reference only)
const ROW_BESPOKE       = 7;   // Bespoke autopopulate values for hidden columns
// Row 8 is a free-text Notes row (design-process comments) — reference only,
// not read by the script.

// Catalogue section
const CATALOGUE_HEADER_ROW = 13;  // "Manifest names and versions"
const CATALOGUE_DATA_START = 14;  // First project row

// Project name cell
const PROJECT_NAME_CELL = 'A2';

// Date column
const DATE_COLUMN_NAME = 'DATE_OF_COLLECTION';

// SOP Google Doc ID (fetched live at run-time)
const SOP_DOC_ID = '10WMIZ9GuB0hj5pBzFkz1U2V3_KwIFH-3cAud6h3-Gow';

// Shared output folder — a per-project subfolder is created/reused inside this
// folder on every run, and all generated files are moved there after creation.
// To change: replace the ID with the new folder ID from the Drive URL.
// Current: https://drive.google.com/drive/folders/1hGB3WXCTcc78oW230iizswW5jQd2-5uE
const OUTPUT_FOLDER_ID = '1hGB3WXCTcc78oW230iizswW5jQd2-5uE';

// ─── Colours ──────────────────────────────────────────────────────────────────
// Single source of truth — changing these updates both sheet headers and SOP highlights.
// Palette: forest green / light blue family for biodiversity genomics manifests.
// Dark = must fill | Light = supplementary | Light green = missing required | Coral = error
// Avoids red/green error/success semantics; accessible for colourblind users.

const COLOUR_MANDATORY        = '#2E6F40';  // Forest green      — mandatory headers (dark)
const COLOUR_MANDATORY_CELL   = '#FFFFFF';  // White             — mandatory data cells (no tint)
const COLOUR_OPTIONAL         = '#2E6F40';  // (same family — see COLOUR_OPTIONAL_LIGHT)
const COLOUR_OPTIONAL_LIGHT   = '#DCEEFB';  // Very light blue   — optional headers (light)
const COLOUR_OPTIONAL_CELL    = '#FFFFFF';  // White             — optional data cells (no tint)
const COLOUR_HIDDEN_BG        = '#FFFFFF';  // White             — hidden column headers
const COLOUR_HIDDEN_CELL      = '#FAFBF9';  // Off-white         — hidden data cells
const COLOUR_HEADER_TEXT_DARK = '#FFFFFF';  // White             — text on dark (mandatory) headers
const COLOUR_HEADER_TEXT_LIGHT= '#1E2A24';  // Dark charcoal     — text on light (hidden) headers
const COLOUR_HEADER_TEXT_BLUE = '#003366';  // Dark blue         — text on optional (light blue) headers
const COLOUR_HEADER_TEXT      = '#1E2A24';  // Dark charcoal     — default (backwards compat)
const COLOUR_GRID_LINE        = '#CCCCCC';  // Grey              — cell borders
const COLOUR_MISSING_REQUIRED = '#C8E6C9';  // Light green       — blank mandatory cell
const COLOUR_DATE_ERROR       = '#D97C6C';  // Muted coral       — date format error
const COLOUR_ROW_ALT          = '#EEF2EF';  // Pale moss-grey    — alternating row stripe
const COLOUR_EXCLUDED_CELL    = '#EFEFEF';  // Light grey        — excluded columns in catalogue row

// ─── Row 2 selection values → behaviour ──────────────────────────────────────
// Two sets: mandatory cols get a restricted set; optional cols get the full set.
// No 'Exclude' option — unset/blank = excluded silently.
const BUILDER_DROPDOWN_OPTIONS_MANDATORY = [
  'Mandatory, visible',
  'Mandatory, hide, use NOT_COLLECTED',
  'Mandatory, hide, use a bespoke term'
];
const BUILDER_DROPDOWN_OPTIONS_OPTIONAL = [
  'select option',
  'Mandatory, visible',
  'Optional, visible',
  'Include, hide, use NOT_COLLECTED',
  'Include, hide, use bespoke term'
];
// Legacy — used by loadFromCatalogue to restore canonical casing
const BUILDER_DROPDOWN_OPTIONS = [
  ...BUILDER_DROPDOWN_OPTIONS_MANDATORY,
  ...BUILDER_DROPDOWN_OPTIONS_OPTIONAL
];

const SEL_MANDATORY_VISIBLE      = 'mandatory, visible';
const SEL_OPTIONAL_VISIBLE       = 'optional, visible';
const SEL_MANDATORY_HIDE_NC      = 'mandatory, hide, use not_collected';
const SEL_INCLUDE_HIDE_NC        = 'include, hide, use not_collected';
const SEL_MANDATORY_HIDE_BESPOKE = 'mandatory, hide, use a bespoke term';
const SEL_INCLUDE_HIDE_BESPOKE   = 'include, hide, use bespoke term';
const SEL_EXCLUDE                = 'exclude';  // backwards compat only — not a UI option
const SEL_UNSET                  = 'select option';

const HIDDEN_NC_TRIGGERS      = [SEL_MANDATORY_HIDE_NC, SEL_INCLUDE_HIDE_NC];
const HIDDEN_BESPOKE_TRIGGERS = [SEL_MANDATORY_HIDE_BESPOKE, SEL_INCLUDE_HIDE_BESPOKE];
const ALL_HIDDEN_TRIGGERS     = [...HIDDEN_NC_TRIGGERS, ...HIDDEN_BESPOKE_TRIGGERS];

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers: isMasterSpreadsheet_(), getMasterSpreadsheet_(), getMasterBuilderSheet_()
// Every spreadsheet running this script is either the master manifest itself,
// or a PI builder template copy of it. These three helpers are how the rest
// of the script tells the two apart and reaches the master's live catalogue
// from a template. See the "TWO KINDS OF SPREADSHEET" note at the top of
// this file for the full picture.
// ═══════════════════════════════════════════════════════════════════════════════

function isMasterSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getId() === MASTER_SPREADSHEET_ID;
}

function getMasterSpreadsheet_() {
  if (isMasterSpreadsheet_()) return SpreadsheetApp.getActiveSpreadsheet();
  if (MASTER_SPREADSHEET_ID === 'PUT_MASTER_SPREADSHEET_ID_HERE') {
    throw new Error(
      'MASTER_SPREADSHEET_ID has not been set up yet. From the master manifest\'s ' +
      'Apps Script editor, set MASTER_SPREADSHEET_ID to the master spreadsheet\'s own ID ' +
      '(from its URL) — see the README\'s Installation section.'
    );
  }
  return SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
}

function getMasterBuilderSheet_() {
  const sheet = getMasterSpreadsheet_().getSheetByName(BUILDER_SHEET_NAME);
  if (!sheet) {
    throw new Error(`The master spreadsheet is missing a "${BUILDER_SHEET_NAME}" sheet.`);
  }
  return sheet;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: generateManifest()
// Orchestrates the full manifest generation pipeline (steps 1–17).
// Called from the menu: 📋 ToL Manifest Tools > ▶ Generate my manifest
// ═══════════════════════════════════════════════════════════════════════════════

function generateManifest() {
  if (isMasterSpreadsheet_()) {
    alert_(
      '⚠️ Generation must be run from a PI builder template, not the master manifest.\n\n' +
      'Use SM Only > Create New Builder Template for a PI to make one.'
    );
    return;
  }

  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const builder = ss.getSheetByName(BUILDER_SHEET_NAME);
  const dvSheet = ss.getSheetByName(DATA_VAL_SHEET_NAME);

  if (!builder) { alert_(`Sheet "${BUILDER_SHEET_NAME}" not found.`); return; }
  if (!dvSheet)  { alert_(`Sheet "${DATA_VAL_SHEET_NAME}" not found.`); return; }

  // ── Step 1: Apply row 3 dropdowns (fast, harmless every run) ─────────────
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

  // ── Step 3: Check the MASTER catalogue for an exact duplicate before doing
  // anything expensive. Protects against accidental duplicate generation even
  // if the PI skipped the manual 🔍 Check catalogue step.
  const lastCol  = builder.getLastColumn();
  const row1     = builder.getRange(ROW_PROJECT_NAME, 1, 1, lastCol).getValues()[0];
  const row2     = builder.getRange(ROW_SELECTION,    1, 1, lastCol).getValues()[0];

  const currentFull   = buildSelectionMap_(row1, row2, lastCol);
  const existingExact = findExactCatalogueMatches_(currentFull);
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

  // ── Step 3b: Work out the iteration suffix ───────────────────────────────
  // If this project name & version already appears in the MASTER catalogue,
  // append "-1", "-2", etc. so regenerated manifests are clearly distinguishable.
  const iteration    = getNextIteration_(projectName);
  const versionedName = iteration > 0 ? `${projectName}-${iteration}` : projectName;

  // ── Step 3c: Get/create the per-project output subfolder ────────────────
  let projectFolder = null;
  try {
    projectFolder = getOrCreateProjectFolder_(versionedName);
  } catch (e) {
    Logger.log(`⚠️  Could not create/access project subfolder "${versionedName}": ${e.message}`);
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
  const row6     = builder.getRange(ROW_BESPOKE,    1, 1, lastCol).getValues()[0];

  // ── Step 6: Read Data Validation tab ─────────────────────────────────────
  const dvMap = readDataValidationMap_(dvSheet);

  // ── Step 7: Build column list ─────────────────────────────────────────────
  const rawColumns  = [];   // before reordering

  for (let col = 2; col <= lastCol; col++) {   // col 1 is the label column
    const colName = String(row1[col - 1] || '').trim();
    if (!colName) continue;

    const rawSel  = String(row2[col - 1] || '').trim();
    const selNorm = rawSel.toLowerCase();

    // Unset/blank/select option → silently excluded
    if (!rawSel || selNorm === SEL_UNSET || selNorm === SEL_EXCLUDE) continue;

    // Determine inclusion type
    let inclusion;  // 'mandatory' | 'optional' | 'hidden_nc' | 'hidden_bespoke'
    if (HIDDEN_NC_TRIGGERS.includes(selNorm))           inclusion = 'hidden_nc';
    else if (HIDDEN_BESPOKE_TRIGGERS.includes(selNorm)) inclusion = 'hidden_bespoke';
    else if (selNorm === SEL_OPTIONAL_VISIBLE)          inclusion = 'optional';
    else if (selNorm === SEL_MANDATORY_VISIBLE)         inclusion = 'mandatory';
    else continue;  // unrecognised — skip silently

    const isHidden    = inclusion === 'hidden_nc' || inclusion === 'hidden_bespoke';
    const isMandatory = inclusion === 'mandatory' || isHidden;
    const bespokeVal  = inclusion === 'hidden_bespoke'
      ? String(row6[col - 1] || '').trim() : null;
    const prefillVal  = inclusion === 'hidden_nc' ? 'NOT_COLLECTED'
                      : inclusion === 'hidden_bespoke' ? bespokeVal : null;

    // Column order number from row 4 (blank = null = keep natural order)
    const orderVal = row3[col - 1];
    const orderNum = (orderVal !== null && orderVal !== '' && !isNaN(Number(orderVal)))
      ? Number(orderVal) : null;

    rawColumns.push({
      name:        colName,
      inclusion,
      isMandatory,
      isHidden,
      isOptional:  inclusion === 'optional',
      prefillVal,
      dvValues:    dvMap[colName] || null,
      sopComment:  sopComments[colName] || null,
      orderNum,
      naturalIdx:  col                        // preserve original position as tiebreaker
    });
  }

  // ── Step 8: Require at least one selected column ─────────────────────────
  if (rawColumns.length === 0) {
    alert_('No columns are selected in row 3. Please choose an option for at least one column.');
    return;
  }

  // ── Step 9: Apply column ordering from row 4 ─────────────────────────────
  // Columns with an order number sort by that number first;
  // columns without (null) retain their natural left-to-right order after numbered ones.
  const numbered   = rawColumns.filter(c => c.orderNum !== null).sort((a, b) =>
    a.orderNum !== b.orderNum ? a.orderNum - b.orderNum : a.naturalIdx - b.naturalIdx);
  const unnumbered = rawColumns.filter(c => c.orderNum === null).sort((a, b) =>
    a.naturalIdx - b.naturalIdx);
  const columns = [...numbered, ...unnumbered];

  // ── Step 10: Create the Google Sheets file ───────────────────────────────
  const today    = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const safeName = versionedName.replace(/[\\/:*?"<>|]/g, '_');
  const baseName = `ToL_Manifest_${safeName}_${today}`;
  const newSS    = SpreadsheetApp.create(baseName);
  const manifest = newSS.getActiveSheet();
  manifest.setName(MANIFEST_TAB_NAME);
  // Move manifest to the per-project output subfolder immediately after creation
  moveToOutputFolder_(newSS.getId(), projectFolder);

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
    // Forest green (mandatory, visible) headers get white text; light blue (optional)
    // headers get dark blue text; white (hidden) headers get charcoal text
    let headerTextColour;
    if (col.isHidden)         headerTextColour = COLOUR_HEADER_TEXT_LIGHT;
    else if (col.isMandatory) headerTextColour = COLOUR_HEADER_TEXT_DARK;
    else                      headerTextColour = COLOUR_HEADER_TEXT_BLUE;
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

    // Pre-fill hidden columns with NOT_COLLECTED or bespoke value from row 7
    if (col.prefillVal !== null && col.prefillVal !== '') {
      const prefillRange = manifest.getRange(dataStart, colNum, MANIFEST_DATA_ROWS, 1);
      prefillRange.setValues(Array(MANIFEST_DATA_ROWS).fill([col.prefillVal]));
    } else if (col.inclusion === 'hidden_bespoke') {
      // Bespoke selected but row 7 is empty — warn via header cell comment
      const existing = manifest.getRange(1, colNum).getComment()
        ? manifest.getRange(1, colNum).getComment().getText() + '\n\n' : '';
      manifest.getRange(1, colNum).setComment(
        existing +
        '⚠️ Bespoke term selected in row 3 but no value found in row 7 of the builder sheet. ' +
        'Please populate this column manually or add the term to row 7 and regenerate.'
      );
    }

    // Missing mandatory value: amber highlight if mandatory column cell is blank
    // and not already pre-filled
    if (col.isMandatory && !col.prefillVal) {
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
  addPartnerSopTab_(newSS, columns, today, sopComments, versionedName);

  // ── Step 15: Create two SOP Google Docs ──────────────────────────────────
  const internalDoc = createSopDoc_(baseName, columns, today, sopComments, versionedName, false);
  moveToOutputFolder_(internalDoc.getId(), projectFolder);
  const partnerDoc  = createSopDoc_(baseName, columns, today, sopComments, versionedName, true);
  moveToOutputFolder_(partnerDoc.getId(), projectFolder);

  // ── Step 16: Append catalogue row to the MASTER's builder sheet ──────────
  const catRowNum = appendCatalogueRow_(versionedName, row1, row2, lastCol);

  // ── Step 17: Summary ─────────────────────────────────────────────────────
  const sheetUrl   = newSS.getUrl();
  const internalUrl = internalDoc.getUrl();
  const partnerUrl  = partnerDoc.getUrl();
  const folderUrl   = projectFolder ? projectFolder.getUrl() : null;
  Logger.log(`Manifest:     ${sheetUrl}`);
  Logger.log(`Internal SOP: ${internalUrl}`);
  Logger.log(`Partner SOP:  ${partnerUrl}`);
  Logger.log(`Folder:       ${folderUrl || '(subfolder unavailable — files saved to Drive root)'}`);

  alert_(
    `✅ Generation complete!\n\n` +
    `📊 Manifest:\n${sheetUrl}\n\n` +
    `📄 Internal SOP:\n${internalUrl}\n\n` +
    `📄 Partner SOP:\n${partnerUrl}\n\n` +
    `Project: ${versionedName} | Columns: ${numCols} (${hiddenCols.length} hidden)\n\n` +
    (folderUrl
      ? `📁 All files saved to the "${versionedName}" folder:\n${folderUrl}\n\n`
      : `⚠️ Could not access the shared output folder — files were saved to your Drive root instead.\n\n`) +
    `📋 Catalogue row added at row ${catRowNum} of the master manifest's builder sheet (highlighted yellow).\n\n` +
    `If this looks good to you, or if you're unsure, get in touch with the ToL Sample Management team at treeoflifesamples@sanger.ac.uk. If it's not what you need, update your selections and regenerate.\n\n` +
    `All URLs saved to Apps Script log.`
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: buildSelectionMap_(row1, row2, lastCol)
// Builds a Map of colName → normalised (lowercase) selection string from a
// builder sheet's row 2 (names) and row 3 (selections), skipping unset/
// excluded columns. Used to describe "what's currently selected" on the
// LOCAL (active) builder sheet, independent of the master's column layout.
// ═══════════════════════════════════════════════════════════════════════════════

function buildSelectionMap_(row1, row2, lastCol) {
  const map = new Map();
  for (let col = 2; col <= lastCol; col++) {
    const colName = String(row1[col - 1] || '').trim();
    if (!colName) continue;
    const sel     = String(row2[col - 1] || '').trim();
    const selNorm = sel.toLowerCase();
    if (sel && selNorm !== SEL_UNSET && selNorm !== SEL_EXCLUDE) {
      map.set(colName, selNorm);
    }
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: readMasterCatalogue_()
// Opens the MASTER builder sheet (regardless of which spreadsheet this script
// is currently running in — see getMasterBuilderSheet_()) and returns its
// column names (row 2) alongside every catalogue row (14+). This is the one
// place that reads the catalogue's raw data; findExactCatalogueMatches_(),
// getNextIteration_(), checkCatalogue(), and loadFromCatalogue() all build on
// top of it so every PI template shares one live, up-to-date catalogue.
// ═══════════════════════════════════════════════════════════════════════════════

function readMasterCatalogue_() {
  const masterBuilder = getMasterBuilderSheet_();
  const masterLastCol = masterBuilder.getLastColumn();
  const masterRow1    = masterBuilder.getRange(ROW_PROJECT_NAME, 1, 1, masterLastCol).getValues()[0];
  const masterLastRow = masterBuilder.getLastRow();
  const catData = masterLastRow >= CATALOGUE_DATA_START
    ? masterBuilder.getRange(
        CATALOGUE_DATA_START, 1, masterLastRow - CATALOGUE_DATA_START + 1, masterLastCol
      ).getValues()
    : [];
  return { masterBuilder, masterLastCol, masterRow1, catData };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: catalogueRowToMap_(catRow, masterRow1, masterLastCol)
// Converts one raw catalogue row (from readMasterCatalogue_()) into a Map of
// colName → normalised selection string, using the MASTER's own row 2 names
// for column mapping. Supports both old TRUE/FALSE checkboxes and the current
// full-selection-string storage.
// ═══════════════════════════════════════════════════════════════════════════════

function catalogueRowToMap_(catRow, masterRow1, masterLastCol) {
  const map = new Map();
  for (let col = 2; col <= masterLastCol; col++) {
    const colName = String(masterRow1[col - 1] || '').trim();
    if (!colName) continue;
    const val = catRow[col - 1];
    let selStr = '';
    if (val === true)                                           selStr = SEL_MANDATORY_VISIBLE;
    else if (typeof val === 'string' && val.trim().length > 0) selStr = val.trim().toLowerCase();
    if (selStr) map.set(colName, selStr);
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: findExactCatalogueMatches_(currentFull)
// Returns an array of catalogue entry names (from the MASTER catalogue) whose
// column selections exactly match currentFull (built by buildSelectionMap_()
// from the LOCAL builder's current row 3). Used by generateManifest() to warn
// before creating a duplicate, and by checkCatalogue() for its exact-match report.
// ═══════════════════════════════════════════════════════════════════════════════

function findExactCatalogueMatches_(currentFull) {
  if (currentFull.size === 0) return [];

  const { masterRow1, masterLastCol, catData } = readMasterCatalogue_();

  const exactMatches = [];
  catData.forEach(catRow => {
    const manifestName = String(catRow[0] || '').trim();
    if (!manifestName) return;

    const catFull = catalogueRowToMap_(catRow, masterRow1, masterLastCol);

    // Exact match: same column set and same selection for every column
    if (currentFull.size !== catFull.size) return;
    if (![...currentFull].every(([k, v]) => catFull.get(k) === v)) return;
    exactMatches.push(manifestName);
  });

  return exactMatches;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: getNextIteration_(projectName)
// Looks through the MASTER catalogue's col A entries for names matching
// projectName, either bare (first generation) or with a trailing "-N"
// iteration suffix from a previous regeneration. Returns 0 if no matching
// entry exists yet (no suffix needed), otherwise the next iteration number
// (1, 2, 3, …). Used by generateManifest() so regenerating the same project
// name & version — from any PI template — doesn't overwrite/duplicate a
// previous catalogue entry or output files.
// ═══════════════════════════════════════════════════════════════════════════════

function getNextIteration_(projectName) {
  const { catData } = readMasterCatalogue_();
  const names = catData.map(r => String(r[0] || '').trim());

  const escaped = projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}(?:-(\\d+))?$`, 'i');

  let found = false;
  let maxIteration = 0;
  names.forEach(name => {
    const m = name.match(pattern);
    if (!m) return;
    found = true;
    const n = m[1] ? parseInt(m[1], 10) : 0;
    if (n > maxIteration) maxIteration = n;
  });

  return found ? maxIteration + 1 : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: checkCatalogue()
// Compares the current row 3 selections against every named entry in the
// catalogue section. Reports exact matches (same columns + same nuance)
// and near matches (same columns, different mandatory/optional/hidden status).
// Called from the menu: 📋 ToL Manifest Tools > 🔍 Check catalogue
// ═══════════════════════════════════════════════════════════════════════════════

function checkCatalogue() {
  if (isMasterSpreadsheet_()) {
    alert_('⚠️ Check catalogue is run from a PI builder template, not the master manifest itself.');
    return;
  }

  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const builder = ss.getSheetByName(BUILDER_SHEET_NAME);
  if (!builder) { alert_(`Sheet "${BUILDER_SHEET_NAME}" not found.`); return; }

  const lastCol = builder.getLastColumn();
  const row1    = builder.getRange(ROW_PROJECT_NAME, 1, 1, lastCol).getValues()[0];
  const row2    = builder.getRange(ROW_SELECTION,    1, 1, lastCol).getValues()[0];

  // currentFull — Map of colName → normalised selection string, from the
  // LOCAL (this template's) row 3. currentCols is just its key set.
  const currentFull = buildSelectionMap_(row1, row2, lastCol);
  const currentCols = new Set(currentFull.keys());

  if (currentCols.size === 0) {
    alert_('No columns are currently selected in row 3. Please make selections before checking the catalogue.');
    return;
  }

  // Scan the MASTER's live catalogue, not this template's own (frozen at
  // copy-time) catalogue rows — see readMasterCatalogue_().
  const { masterRow1, masterLastCol, catData } = readMasterCatalogue_();
  if (catData.length === 0) {
    alert_('No catalogue entries found in the master manifest (catalogue starts at row ' + CATALOGUE_DATA_START + ').'); return;
  }

  const exactMatches = [];
  const nearMatches  = [];  // same columns, different mandatory/optional/hidden nuance

  catData.forEach(catRow => {
    const manifestName = String(catRow[0] || '').trim();
    if (!manifestName) return;

    const catFull = catalogueRowToMap_(catRow, masterRow1, masterLastCol);
    const catCols = new Set(catFull.keys());

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
//   the row 3 values back. Build with HtmlService.createHtmlOutputFromFile() and
//   SpreadsheetApp.getUi().showSidebar(). The catalogue data can be passed into
//   the HTML template via a scriptlet or via google.script.run return value.
//   See: https://developers.google.com/apps-script/guides/html/communication
// ═══════════════════════════════════════════════════════════════════════════════

function loadFromCatalogue() {
  if (isMasterSpreadsheet_()) {
    alert_('⚠️ Load from catalogue is run from a PI builder template, not the master manifest itself.');
    return;
  }

  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const builder = ss.getSheetByName(BUILDER_SHEET_NAME);
  if (!builder) { alert_(`Sheet "${BUILDER_SHEET_NAME}" not found.`); return; }

  // Deliberately does NOT call applyBuilderDropdowns_() here — that rebuilds
  // each cell's data validation rule from scratch, which wipes any custom
  // dropdown item colours the SM team has set up in the sheet UI (Apps
  // Script's data validation API can't read or restore those colours).
  // Instead, validity below is checked against each cell's *existing* live
  // dropdown list, left completely untouched.

  const lastCol = builder.getLastColumn();
  const row1    = builder.getRange(ROW_PROJECT_NAME, 1, 1, lastCol).getValues()[0];

  // Read entries from the MASTER's live catalogue, not this template's own
  // (frozen at copy-time) catalogue rows — see readMasterCatalogue_().
  const { masterRow1, masterLastCol, catData } = readMasterCatalogue_();
  if (catData.length === 0) {
    alert_('No catalogue entries found in the master manifest. The catalogue section starts at row ' + CATALOGUE_DATA_START + '.'); return;
  }

  // Build list of named entries with a summary of their column counts
  const entries = [];
  catData.forEach((catRow, idx) => {
    const name = String(catRow[0] || '').trim();
    if (!name) return;

    const selMap = catalogueRowToMap_(catRow, masterRow1, masterLastCol);
    let mandatory = 0, optional = 0, hidden = 0;
    selMap.forEach(selStr => {
      if (ALL_HIDDEN_TRIGGERS.includes(selStr))      hidden++;
      else if (selStr === SEL_OPTIONAL_VISIBLE)      optional++;
      else                                            mandatory++;
    });

    entries.push({ name, mandatory, optional, hidden, dataRowIdx: idx });
  });

  if (entries.length === 0) {
    alert_('No named entries found in the master catalogue.'); return;
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
    `Enter the number of the manifest to pre-populate row 3:\n\n${listLines}\n`,
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  const choice = parseInt(response.getResponseText().trim(), 10);
  if (isNaN(choice) || choice < 1 || choice > entries.length) {
    alert_(`Invalid choice. Please enter a number between 1 and ${entries.length}.`); return;
  }

  const selected     = entries[choice - 1];
  const catRow       = catData[selected.dataRowIdx];
  const catSelByName = catalogueRowToMap_(catRow, masterRow1, masterLastCol);  // colName → lowercase selection string

  // ── Write selections back into the LOCAL row 3, matched by column NAME ──
  // (not position) — robust even if this template's columns have drifted
  // from the master's since it was created.
  //   • Catalogue has a value for this column → write it, if it's still a
  //     valid choice for that column's current dropdown
  //   • Column absent from the catalogue entry → write "select option" (unset)
  // Some columns (e.g. the "must stay visible" fields) have a dropdown with
  // only a single allowed value and no "unset" option — if the catalogue
  // value isn't in that cell's actual current dropdown list, the cell is
  // left unchanged rather than being written with a value that would violate
  // its data validation rule. Validity is checked against each cell's live
  // dropdown (via getDataValidation()) rather than a hard-coded list, so this
  // works correctly for any column's dropdown without needing to touch/rebuild
  // it — which would also strip any custom item colours set up in the sheet.
  let written = 0;
  const skipped = [];
  for (let col = 2; col <= lastCol; col++) {
    const colName = String(row1[col - 1] || '').trim();
    if (!colName) continue;

    const storedNorm = catSelByName.get(colName);  // lowercase, or undefined if excluded/not in catalogue
    let newSel;
    if (storedNorm === undefined) {
      newSel = 'select option';
    } else {
      // Restore original casing from BUILDER_DROPDOWN_OPTIONS if possible
      const matched = BUILDER_DROPDOWN_OPTIONS.find(opt => opt.toLowerCase() === storedNorm);
      newSel = matched || storedNorm;
    }

    const cell = builder.getRange(ROW_SELECTION, col);
    if (!isValueAllowedByCellDropdown_(cell, newSel)) {
      skipped.push(colName);
      continue;
    }

    cell.setValue(newSel);
    written++;
  }

  alert_(
    `✅ Row 3 pre-populated from: ${selected.name}

` +
    `${written} columns updated (${selected.mandatory} mandatory, ` +
    `${selected.optional} optional, ${selected.hidden} hidden, rest excluded).

` +
    (skipped.length > 0
      ? `⚠️ ${skipped.length} column(s) left unchanged because the catalogue value isn't a valid choice in their current dropdown (e.g. a "must stay visible" column with no matching entry in the catalogue): ${skipped.join(', ')}

`
      : '') +
    `You can now adjust any selections before generating the manifest.`
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: isValueAllowedByCellDropdown_(cell, value)
// Checks value against cell's own live "value in list" data validation rule
// (case-insensitive), without ever reading or rebuilding the rule itself —
// used instead of a hard-coded option list so we never have to call
// setDataValidation() (which would silently strip any custom dropdown item
// colours configured in the sheet UI; Apps Script cannot read or restore
// those colours). Cells with no rule, or a rule that isn't a value-in-list,
// are treated as unrestricted.
// ═══════════════════════════════════════════════════════════════════════════════

function isValueAllowedByCellDropdown_(cell, value) {
  const rule = cell.getDataValidation();
  if (!rule) return true;
  if (rule.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) return true;
  const allowedValues = rule.getCriteriaValues()[0];
  return allowedValues.some(v => String(v).toLowerCase() === String(value).toLowerCase());
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: syncSopCommentsToBuilder()
// Fetches the latest SOP descriptions from the master SOP Google Doc and writes
// them as cell comments on the row 2 column headers of the builder sheet
// (all_manifest_builder_v1.0). This keeps the master's builder sheet up to
// date whenever the SOP source document is edited, without needing to run a
// full generation. Every PI template inherits whatever comments existed on
// the master at copy-time, so this only needs to run on the master itself.
// Called from the menu: SM Only > 🔄 Sync SOP comments to builder headers
// ═══════════════════════════════════════════════════════════════════════════════

function syncSopCommentsToBuilder() {
  if (!isMasterSpreadsheet_()) {
    alert_('⚠️ Sync SOP comments is run from the master manifest, not a PI builder template.');
    return;
  }

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

  // Apply comments to every named header cell in row 2 (skip col 1 = label column)
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
// Applies the row 3 dropdown validation list to every column in the builder
// sheet. Columns whose row 5 system requirement is "Mandatory" get the
// restricted 3-option list; all other columns get the full 5-option list
// (including the unset placeholder). Runs automatically at the start of
// generateManifest() so the dropdowns are always up to date.
// ═══════════════════════════════════════════════════════════════════════════════

function applyBuilderDropdowns_(builder) {
  const lastCol  = builder.getLastColumn();
  const row5vals = builder.getRange(ROW_SYSTEM_REQ, 1, 1, lastCol).getValues()[0];

  const mandatoryRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(BUILDER_DROPDOWN_OPTIONS_MANDATORY, true)
    .setAllowInvalid(false).build();

  const optionalRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(BUILDER_DROPDOWN_OPTIONS_OPTIONAL, true)
    .setAllowInvalid(false).build();

  for (let col = 2; col <= lastCol; col++) {
    const sysReq = String(row5vals[col - 1] || '').trim().toLowerCase();
    const isSysMandatory = sysReq.includes('mandatory');
    builder.getRange(ROW_SELECTION, col)
      .setDataValidation(isSysMandatory ? mandatoryRule : optionalRule);
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
// blank, it is highlighted light green (#C8E6C9) to guide data curators.
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
  const COL_MANDATORY = COLOUR_MANDATORY;       // forest green — links to manifest header colour
  const COL_OPTIONAL  = COLOUR_OPTIONAL_LIGHT;  // very light blue

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
// Helper: appendCatalogueRow_(projectName, localRow1, localRow2, localLastCol)
// See doc comment below for full details.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Appends a new row to the ToL Manifest Catalogue section of the MASTER's
 * builder sheet — not the local (active) one, so every PI template's runs
 * land in the one shared catalogue (see getMasterBuilderSheet_()).
 *
 * localRow1/localRow2/localLastCol describe the LOCAL builder's current
 * project-name row and selections; they're re-projected onto the MASTER's
 * own column layout by NAME (not position), so this still works correctly
 * if a template's columns have drifted from the master's since it was made.
 * Any local column whose name doesn't exist in the master is simply dropped
 * from the catalogue row (there's nowhere to put it).
 *
 * Format of the new row:
 *   Col A  = project name (with an "-N" iteration suffix if this project
 *            name & version was already generated before), bold, yellow
 *            background to flag it as pending SM team review.
 *   Col B+ = full selection string for included columns (e.g. "Mandatory,
 *            visible"), empty string for excluded/unset.
 *            Each cell is colour-coded to match the manifest headers:
 *            forest green (mandatory), light blue (optional), white (hidden),
 *            light grey (excluded).
 *
 * Row formatting: font size 8, text wrap, solid border around the full row.
 *
 * This richer format (vs old TRUE/FALSE checkboxes) allows loadFromCatalogue()
 * to restore the exact mandatory/optional/hidden nuance when pre-populating
 * row 3, and allows checkCatalogue() to distinguish exact vs near matches.
 * Old TRUE/FALSE rows in the catalogue are still supported by both functions.
 *
 * Insertion: finds the last named row in the catalogue section and inserts
 * one row below it (blank separator rows between entries are preserved).
 */
function appendCatalogueRow_(projectName, localRow1, localRow2, localLastCol) {
  const masterBuilder = getMasterBuilderSheet_();
  const masterLastCol = masterBuilder.getLastColumn();
  const masterRow1    = masterBuilder.getRange(ROW_PROJECT_NAME, 1, 1, masterLastCol).getValues()[0];

  // Build a name → original-casing-selection-string map from the LOCAL
  // builder's current row 2 / row 3. Empty string = excluded/unset.
  const localSelByName = new Map();
  for (let col = 2; col <= localLastCol; col++) {
    const colName = String(localRow1[col - 1] || '').trim();
    if (!colName) continue;
    const sel     = String(localRow2[col - 1] || '').trim();
    const selNorm = sel.toLowerCase();
    const isIncluded = sel && selNorm !== SEL_UNSET && selNorm !== SEL_EXCLUDE;
    localSelByName.set(colName, isIncluded ? sel : '');
  }

  // Find the last row that has any content in col A at or after CATALOGUE_DATA_START
  const lastRow   = masterBuilder.getLastRow();
  let   insertRow = CATALOGUE_DATA_START;

  for (let r = CATALOGUE_DATA_START; r <= lastRow; r++) {
    const val = masterBuilder.getRange(r, 1).getValue();
    if (val !== null && val !== '' && val !== undefined) {
      insertRow = r + 1;  // place new entry one row below the last named entry
    }
  }

  // Skip any blank separator rows between last entry and insertion point
  // (keep insertRow as-is — blank rows between entries are fine)

  // Build the row values: col A = name, cols B onward = selection strings or ''
  // — re-projected onto the MASTER's own column layout by name.
  const rowValues = new Array(masterLastCol).fill('');
  rowValues[0] = projectName;  // col A (index 0)

  for (let col = 2; col <= masterLastCol; col++) {
    const colName = String(masterRow1[col - 1] || '').trim();
    if (!colName) continue;
    rowValues[col - 1] = localSelByName.get(colName) || '';
  }

  // Write the row
  const targetRange = masterBuilder.getRange(insertRow, 1, 1, masterLastCol);
  targetRange.setValues([rowValues]);

  // Row-wide formatting: compact font, wrapped text, border around the full row
  targetRange
    .setFontSize(8)
    .setWrap(true)
    .setBorder(true, true, true, true, null, null,
      '#000000', SpreadsheetApp.BorderStyle.SOLID);

  // Col A: yellow to flag as new/pending SM review
  const nameCell = masterBuilder.getRange(insertRow, 1);
  nameCell.setBackground('#FFF9C4').setFontWeight('bold');

  // Cols B onward: colour-coded to match the manifest header colours
  //   Forest green = mandatory → white text
  //   Light blue   = optional  → charcoal text
  //   White        = hidden    → charcoal text
  //   Light grey   = excluded  → charcoal text
  for (let col = 2; col <= masterLastCol; col++) {
    const val  = rowValues[col - 1];
    const cell = masterBuilder.getRange(insertRow, col);
    if (!val) {
      cell.setBackground(COLOUR_EXCLUDED_CELL).setFontColor(COLOUR_HEADER_TEXT_LIGHT);
      continue;
    }
    const selNorm = String(val).toLowerCase();
    let bg, fg;
    if      (ALL_HIDDEN_TRIGGERS.includes(selNorm)) { bg = COLOUR_HIDDEN_BG;      fg = COLOUR_HEADER_TEXT_LIGHT; }
    else if (selNorm === SEL_OPTIONAL_VISIBLE)      { bg = COLOUR_OPTIONAL_LIGHT; fg = COLOUR_HEADER_TEXT_LIGHT; }
    else                                             { bg = COLOUR_MANDATORY;      fg = COLOUR_HEADER_TEXT_DARK;  }
    cell.setBackground(bg).setFontColor(fg);
  }

  Logger.log(`Catalogue row appended at master row ${insertRow}: ${projectName}`);
  return insertRow;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: moveToOutputFolder_(fileId)
// See doc comment below for full details.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Moves a Drive file into the given folder (or OUTPUT_FOLDER_ID itself if no
 * folder is passed) and removes it from all other parents (Drive creates
 * files in the root by default — this relocates them).
 * Falls back gracefully if the folder is wrong/inaccessible or permissions
 * are missing.
 */
function moveToOutputFolder_(fileId, folder) {
  try {
    const targetFolder = folder || DriveApp.getFolderById(OUTPUT_FOLDER_ID);
    const file = DriveApp.getFileById(fileId);
    targetFolder.addFile(file);
    // Remove from root / any other parents
    const parents = file.getParents();
    while (parents.hasNext()) {
      const parent = parents.next();
      if (parent.getId() !== targetFolder.getId()) {
        parent.removeFile(file);
      }
    }
  } catch (e) {
    Logger.log(`⚠️  Could not move file ${fileId} to output folder: ${e.message}`);
    // Non-fatal — file still exists in Drive root
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: getOrCreateProjectFolder_(folderName)
// Finds (or creates) a subfolder named folderName directly inside
// OUTPUT_FOLDER_ID. All files from a single generateManifest() run (the
// manifest sheet + both SOP docs) are moved into this subfolder, so every
// project/version (and each of its iterations) has its own tidy folder
// inside the shared output folder. Throws if OUTPUT_FOLDER_ID itself is
// inaccessible — the caller catches this and falls back to the folder root.
// ═══════════════════════════════════════════════════════════════════════════════

function getOrCreateProjectFolder_(folderName) {
  const parent   = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
  const existing = parent.getFoldersByName(folderName);
  return existing.hasNext() ? existing.next() : parent.createFolder(folderName);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: createBuilderTemplate()
// Makes a full Drive copy of the master manifest (bound script included) and
// saves it into the shared output folder, ready to hand to one PI. Resets the
// copy's project-name cell to the placeholder so the PI is prompted for their
// own name/version on first generation. The copy's own Manifest Catalogue
// rows are left exactly as copied — they're never read from again, since
// checkCatalogue(), loadFromCatalogue(), and generateManifest() all talk to
// the live master catalogue instead (see getMasterBuilderSheet_()).
// Sharing the new file with the PI is a manual step for the SM team.
// Called from the menu: SM Only > 🆕 Create New Builder Template for a PI
// ═══════════════════════════════════════════════════════════════════════════════

function createBuilderTemplate() {
  if (!isMasterSpreadsheet_()) {
    alert_('⚠️ Create New Builder Template is run from the master manifest, not a PI builder template.');
    return;
  }

  const ui  = SpreadsheetApp.getUi();
  const res = ui.prompt(
    'Create New Builder Template',
    'Enter a short name for this PI/project (used in the template\'s file name only), e.g. "DToL_Bats":',
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const label = res.getResponseText().trim();
  if (!label) { alert_('Cancelled — a name is required.'); return; }

  const today     = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const safeLabel = label.replace(/[\\/:*?"<>|]/g, '_');
  const newName   = `ToL_Builder_Template_${safeLabel}_${today}`;

  let copiedFile;
  try {
    const masterFile   = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
    const outputFolder = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
    copiedFile = masterFile.makeCopy(newName, outputFolder);
  } catch (e) {
    alert_(`⚠️ Could not create the template.\n\n${e.message}`);
    return;
  }

  // Reset the copy's project name cell so the PI is prompted for their own
  // name on first generation, rather than inheriting whatever was last typed
  // into the master's own A2. Row 3 selections are left as copied — the
  // master's own row 3 is the standard starting point every template inherits.
  try {
    const newSS      = SpreadsheetApp.openById(copiedFile.getId());
    const newBuilder = newSS.getSheetByName(BUILDER_SHEET_NAME);
    if (newBuilder) newBuilder.getRange(PROJECT_NAME_CELL).setValue('Project Name and Version');
  } catch (e) {
    Logger.log(`⚠️ Could not reset project name cell in new template: ${e.message}`);
  }

  alert_(
    `✅ Builder template created for "${label}".\n\n` +
    `📄 File: ${copiedFile.getName()}\n${copiedFile.getUrl()}\n\n` +
    `Share this file with the PI yourself (Editor access) — this is not done automatically.\n\n` +
    `Reminder: the PI also needs at least Editor access to this master manifest, ` +
    `since their template checks and generates against the shared catalogue here.`
  );
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
// Runs automatically when the spreadsheet is opened. Which menu appears
// depends on isMasterSpreadsheet_() (see that helper and the "TWO KINDS OF
// SPREADSHEET" note at the top of this file):
//
//   On the MASTER manifest — SM Only:
//     • 🆕 Create New Builder Template for a PI
//     • 🔄 Sync SOP comments to builder headers
//
//   On a PI builder template — 📋 ToL Manifest Tools:
//     • 🔍 Check catalogue for identical manifest
//     • 📂 Load from catalogue into row 3
//     • ▶ Generate my manifest
// ═══════════════════════════════════════════════════════════════════════════════

function onOpen() {
  const ui = SpreadsheetApp.getUi();

  if (isMasterSpreadsheet_()) {
    ui.createMenu('SM Only')
      .addItem('🆕 Create New Builder Template for a PI', 'createBuilderTemplate')
      .addItem('🔄 Sync SOP comments to builder headers', 'syncSopCommentsToBuilder')
      .addToUi();
  } else {
    ui.createMenu('📋 ToL Manifest Tools')
      .addItem('🔍 Check catalogue for identical manifest', 'checkCatalogue')
      .addItem('📂 Load from catalogue into row 3', 'loadFromCatalogue')
      .addItem('▶ Generate my manifest', 'generateManifest')
      .addToUi();
  }
}
