# ToL Master Manifest Generator

A Google Apps Script tool for generating tailored sample metadata manifests and Standard Operating Procedure (SOP) documents for Tree of Life (ToL) genomic projects at the Wellcome Sanger Institute.

---

## Overview

The Manifest Generator reads a configuration Google Sheet (`all_manifest_builder_v1.0`) where a project investigator (PI) selects which metadata fields to include in a project-specific manifest. On generation, the script produces:

1. **A Google Sheets manifest file** — pre-formatted with colour-coded headers, dropdown validation, date format checking, and 1920 blank data-entry rows ready for partner use
2. **An internal SOP Google Doc** — full column-by-column instructions for all fields including hidden ones (marked `[HIDDEN]`)
3. **A partner-facing SOP Google Doc** — instructions for visible fields only, with a note about hidden columns
4. **A Partner SOP tab** inside the generated manifest Google Sheet
5. **A new catalogue row** — appended to this builder's own manifest catalogue, colour-coded and flagged for SM team review. If the project name & version has been generated before, an iteration suffix (`-1`, `-2`, …) is appended so repeat runs stay distinguishable

All outputs (the manifest sheet and both SOP docs) are saved into a per-project subfolder — named after the project name & version — inside the shared Google Drive output folder accessible to the sample management team. The subfolder is created automatically on first use and reused on subsequent runs for the same project/version.

### Two kinds of spreadsheet, one shared script

This same script is bound to two different kinds of spreadsheet, which are otherwise identical and fully self-contained — each with its own independent column structure, row 3 selections, and Manifest Catalogue. The only thing that differs is which menu appears:

- **The master manifest** — the single spreadsheet the SM team maintains and preserves untouched. Shows the **SM Only** menu. Nobody generates directly from the master.
- **A PI builder template** — a full, standalone copy of the master (made via **SM Only → Create New Builder Template for a PI**), handed to one PI to fill in their own selections. Shows the **📋 ToL Manifest Tools** menu. Because copying a Google Sheet also copies its bound script, every template runs this exact same file, but always renders the PI-facing menu instead of SM Only.

Checking, loading, and generating all work entirely within that one template — its own Manifest Catalogue grows as manifests are generated from it, and nothing ever reaches back into the master. The master/template split changes nothing except which menu is shown, so that the master itself can never be generated from — see [Master vs PI Builder Template](#master-vs-pi-builder-template) for the full picture.

---

## Repository Contents

| File | Description |
|------|-------------|
| `ManifestGenerator.gs` | The complete Apps Script — paste this into the Google Sheet's script editor |
| `README.md` | This file |

---

## Requirements

### Google Sheet
The script must be installed in a Google Sheet containing the following tabs:
- **`all_manifest_builder_v1.0`** — the main configuration tab (see [Builder Sheet Structure](#builder-sheet-structure) below)
- **`Data Validation`** — tab containing controlled vocabulary lists for dropdown fields

This applies to the master manifest itself; every PI builder template is a full copy of it, so it automatically has both tabs too.

### Google Account Permissions
When first run, Apps Script will request the following permissions:
- **Google Sheets** — read configuration, write catalogue rows, apply validation
- **Google Drive** — create and move output files to the shared folder, create new builder templates
- **Google Docs** — read the live SOP document, create SOP output documents

### SOP Google Doc
The script fetches column descriptions live from a master SOP Google Doc at run-time. The Doc must be shared (at minimum **Viewer** access) with every Google account that will run the script. The Doc ID is set in the `SOP_DOC_ID` constant.

### Shared Output Folder
All generated files, and every new PI builder template, are saved to a shared Google Drive folder. The folder ID is set in the `OUTPUT_FOLDER_ID` constant. Every account running the script needs **Editor** access to this folder. If a user lacks access, generated manifest/SOP files will still be created (in their Drive root) but will not land in the shared folder — a warning is logged but generation completes; template creation fails outright with a clear error instead.

---

## Installation

### One-time setup on the master manifest
1. Open the Google Sheet you want to use as the master manifest — the one containing the `all_manifest_builder_v1.0` tab
2. Go to **Extensions → Apps Script**
3. Delete any existing code in the editor
4. Paste the entire contents of `ManifestGenerator.gs`
5. Copy this spreadsheet's own ID from its URL (`docs.google.com/spreadsheets/d/[ID]/edit`) and paste it into the `MASTER_SPREADSHEET_ID` constant near the top of the script
6. Click **Save** (💾)
7. Close the Apps Script editor and **reload the Google Sheet**
8. A new menu **SM Only** will appear in the menu bar

> **First-run permissions:** The first time you run any function, Google will ask you to authorise the script. Click **Review permissions → Advanced → Go to [project name] (unsafe) → Allow**. This is expected for unverified scripts within your own organisation.

> **Until `MASTER_SPREADSHEET_ID` is set correctly**, every spreadsheet running this script — including the real master — renders the PI-facing **📋 ToL Manifest Tools** menu instead, since no spreadsheet's ID matches the placeholder value. Step 5 above is not optional.

### Creating a template for each PI
No separate installation is needed for PI templates — see [Creating a New Builder Template for a PI](#creating-a-new-builder-template-for-a-pi). Making a template is a normal Drive copy, which brings its own copy of the bound script along automatically.

---

## Configuration

All configurable values are in the **Constants** section at the top of `ManifestGenerator.gs`. The key ones to update are:

```javascript
// ID of the master manifest spreadsheet — REQUIRED ONE-TIME SETUP.
// From inside the master spreadsheet, open its URL
// (docs.google.com/spreadsheets/d/[ID]/edit) and paste [ID] here.
const MASTER_SPREADSHEET_ID = 'PUT_MASTER_SPREADSHEET_ID_HERE';

// Name of the builder tab in the Google Sheet
const BUILDER_SHEET_NAME = 'all_manifest_builder_v1.0';

// Google Doc ID of the live master SOP document
// Extract from the Doc URL: docs.google.com/document/d/[DOC_ID]/edit
const SOP_DOC_ID = '10WMIZ9GuB0hj5pBzFkz1U2V3_KwIFH-3cAud6h3-Gow';

// Google Drive folder ID for all output files. A per-project subfolder is
// created/reused inside this folder on every run; new PI builder templates
// are also saved directly here.
// Extract from the folder URL: drive.google.com/drive/folders/[FOLDER_ID]
const OUTPUT_FOLDER_ID = '1hGB3WXCTcc78oW230iizswW5jQd2-5uE';

// First data row of the catalogue section in the builder sheet
const CATALOGUE_DATA_START = 14;

// Number of blank data rows to generate in the manifest
const MANIFEST_DATA_ROWS = 1920;
```

### Colour scheme
Colours are defined as a single source of truth — changing them here updates both the manifest sheet headers and the SOP document field name highlights:

```javascript
const COLOUR_MANDATORY        = '#2E6F40';  // Forest green      — mandatory headers (white text)
const COLOUR_MANDATORY_CELL   = '#FFFFFF';  // White             — mandatory data cell backgrounds (no tint)
const COLOUR_OPTIONAL_LIGHT   = '#DCEEFB';  // Very light blue   — optional headers (dark blue text)
const COLOUR_OPTIONAL_CELL    = '#FFFFFF';  // White             — optional data cell backgrounds (no tint)
const COLOUR_HIDDEN_BG        = '#FFFFFF';  // White             — hidden column headers
const COLOUR_HIDDEN_CELL      = '#FAFBF9';  // Off-white         — hidden data cell backgrounds
const COLOUR_HEADER_TEXT_DARK = '#FFFFFF';  // White             — text on mandatory headers
const COLOUR_HEADER_TEXT_LIGHT= '#1E2A24';  // Dark charcoal     — text on hidden headers
const COLOUR_HEADER_TEXT_BLUE = '#003366';  // Dark blue         — text on optional headers
const COLOUR_GRID_LINE        = '#CCCCCC';  // Grey              — cell borders
const COLOUR_MISSING_REQUIRED = '#C8E6C9';  // Light green       — blank mandatory cell highlight
const COLOUR_DATE_ERROR       = '#D97C6C';  // Muted coral       — date format validation error
const COLOUR_ROW_ALT          = '#EEF2EF';  // Pale moss-grey    — alternating row stripe
const COLOUR_EXCLUDED_CELL    = '#EFEFEF';  // Light grey        — excluded columns in catalogue row
```

> **Palette rationale:** Forest green for mandatory headers and light blue (with dark blue text) for optional headers were chosen specifically for biodiversity genomics manifests. It avoids red/green error/success semantics, is accessible for colourblind users, and the dark/light hierarchy (dark = must fill, light = supplementary) is more intuitive than arbitrary colour differences.

---

## Builder Sheet Structure

The `all_manifest_builder_v1.0` sheet is laid out as follows:

| Row | Label (col A) | Purpose |
|-----|---------------|---------|
| 1 | *(group labels, e.g. "mandatory fields, must be visible in all manifests")* | Reference only — not read by the script |
| 2 | Project Name and Version | **Col A:** Project name used in all filenames and SOP text. Must be filled in before generating (e.g. `DToL_Bats_v1.0`). **Cols B+:** Column field names |
| 3 | REQUIREMENT FOR NEW PROJECT MANIFEST | Project-level selection for each column — choose from the dropdown in each cell (see [Row 3 Dropdown Options](#row-3-dropdown-options)). The dropdown offered depends on row 5: system-mandatory columns get a restricted 3-option list, all others get the full 5-option list |
| 4 | Column order | Optional integer ordering numbers. Columns with numbers are placed first in that order; blank columns follow in their natural left-to-right order |
| 5 | System requirements | `Mandatory`, `Optional`, or `WOSPI Mandatory` — determines which row 3 dropdown list a column gets |
| 6 | Manifest requirements | Reference only — not read by the script |
| 7 | Bespoke autopopulate value | **Read by the script.** For hidden columns whose row 3 selection is `...use bespoke term`, the value here is written to every data row of that column in the generated manifest |
| 8 | Notes | Free-text design notes filled in as needed — reference only, not read by the script |
| 9 | Interpreted Validation Rules | Reference only — may be incorporated in a future version |
| 10 | Validation Rules | Reference only — may be incorporated in a future version |
| 11 | Example row | Reference only |
| 12 | ToL MANIFEST CATALOGUE | Section header |
| 13 | Manifest names and versions | Column header row for the catalogue |
| 14+ | *(catalogue entries)* | One row per existing manifest — col A = name, cols B+ = selection strings (see [Manifest Catalogue](#manifest-catalogue)) |

### Row 3 Dropdown Options

There is no `Exclude` option in the UI — leaving a column unset (`select option` or blank) has the same effect: it is silently left out of the generated manifest, with no error or blocking dialog.

Columns where row 5 says `Mandatory` (or `WOSPI Mandatory`) get a restricted 3-option dropdown; all other columns get the full 5-option dropdown (which includes the unset placeholder):

| Selection | Header colour | Meaning |
|-----------|--------------|---------|
| `select option` | *(not included)* | Unset — column silently excluded from the manifest. Only offered on non-system-mandatory columns |
| `Mandatory, visible` | 🟩 Forest green (white text) | Partner must fill this in |
| `Optional, visible` | 🔵 Very light blue (dark blue text) | Partner may fill this in |
| `Mandatory, hide, use NOT_COLLECTED` | ⬜ White | Hidden from partner; every data row pre-filled with `NOT_COLLECTED`. Offered on system-mandatory columns |
| `Include, hide, use NOT_COLLECTED` | ⬜ White | Hidden from partner; every data row pre-filled with `NOT_COLLECTED`. Offered on non-system-mandatory columns |
| `Mandatory, hide, use a bespoke term` | ⬜ White | Hidden from partner; every data row pre-filled with the value from row 7. Offered on system-mandatory columns |
| `Include, hide, use bespoke term` | ⬜ White | Hidden from partner; every data row pre-filled with the value from row 7. Offered on non-system-mandatory columns |

> **Bespoke term with no row 7 value:** If a `...use bespoke term` option is selected but row 7 is empty for that column, the manifest is still generated — but a warning is added as a cell comment on that column's header asking the curator to either fill in row 7 and regenerate, or populate the column manually.

---

## Menu

Which menu appears depends on whether the open spreadsheet's ID matches `MASTER_SPREADSHEET_ID` (see [Master vs PI Builder Template](#master-vs-pi-builder-template)).

### On the master manifest — SM Only

| Menu item | Function | Description |
|-----------|----------|-------------|
| 🆕 Create New Builder Template for a PI | `createBuilderTemplate()` | Makes a full, standalone Drive copy of the master (bound script included) and saves it into the shared output folder, ready to hand to a PI |
| 🔄 Sync SOP comments to builder headers | `syncSopCommentsToBuilder()` | Fetches the latest SOP descriptions from the master SOP Doc and writes them as cell comments on the row 2 column headers of the master's builder sheet. Run this whenever the SOP source document is updated — no generation needed. Every future template copy inherits whatever comments exist at copy-time |

### On a PI builder template — 📋 ToL Manifest Tools

| Menu item | Function | Description |
|-----------|----------|-------------|
| 🔍 Check catalogue for identical manifest | `checkCatalogue()` | Compares the current row 3 selections against every entry in this template's own catalogue. Reports exact matches (same columns + same mandatory/optional/hidden status) and near matches (same columns, different nuance) |
| 📂 Load from catalogue into row 3 | `loadFromCatalogue()` | Shows a numbered list of entries from this template's own catalogue; the user picks one and row 3 is pre-populated with that manifest's selections. The user can then adjust before generating |
| ▶ Generate my manifest | `generateManifest()` | Runs the full generation pipeline (see [What Gets Generated](#what-gets-generated)); the new catalogue row is appended to this same template, never to the master |

Running any of the above from the "wrong" spreadsheet (e.g. calling `generateManifest()` from the master, or `createBuilderTemplate()` from a template) shows a warning and does nothing — see the guard at the top of each function.

---

## Master vs PI Builder Template

This script is bound to two different kinds of spreadsheet, distinguished at open-time by `isMasterSpreadsheet_()` — which just compares the active spreadsheet's ID against `MASTER_SPREADSHEET_ID`. Beyond that one check, master and template are otherwise identical and fully independent: same column structure, same row 3 dropdowns, same kind of Manifest Catalogue — nothing ever reaches from one spreadsheet into another.

- **The master manifest** is the canonical spreadsheet the SM team maintains and preserves untouched. The SM team is the only audience — no PI edits the master directly, and the generator can never be run from it.
- **A PI builder template** is a full, standalone Drive copy of the master, made via **SM Only → Create New Builder Template for a PI**. Because copying a spreadsheet also copies its bound script, the template runs the exact same `ManifestGenerator.gs`, but since its spreadsheet ID never matches `MASTER_SPREADSHEET_ID`, it always renders the PI-facing menu instead of SM Only. From there it behaves exactly like a single all-in-one builder always has — checking, loading, and generating all read and write only within that one copy.

### Creating a New Builder Template for a PI
1. From the master manifest, run **SM Only → 🆕 Create New Builder Template for a PI**
2. Enter a short name for the PI/project when prompted (used only in the template's file name, e.g. `ToL_Builder_Template_DToL_Bats_2026-07-02`)
3. The new file is saved directly in the shared output folder (`OUTPUT_FOLDER_ID`) — the same folder generated manifests and SOPs land in
4. The template's project name cell (A2) is reset to the placeholder text so the PI is prompted for their own project name on first generation; row 3 selections and the existing catalogue rows are left exactly as copied from the master
5. **Share the new file with the PI yourself** — this is a manual step, not automatic

Because the template is a fully independent copy, the PI only ever needs access to their own template file — not to the master manifest.

---

## What Gets Generated

Running **▶ Generate my manifest** from a PI builder template triggers the generation pipeline (running it from the master manifest itself shows a warning and does nothing — see [Master vs PI Builder Template](#master-vs-pi-builder-template)):

1. **Project name validated** — reads cell A2; prompts if blank or still says `"Project Name and Version"`
2. **Duplicate check** — automatically compares the current row 3 selections against this template's own catalogue. If an identical manifest already exists, a Yes/No dialog warns the PI before proceeding — even if they skipped the manual 🔍 Check catalogue step
3. **Iteration suffix computed** — if this project name & version already appears in this template's catalogue, an `-N` suffix (`-1`, `-2`, …) is appended so the new run's files, folder, and catalogue row stay distinguishable from earlier ones
4. **Per-project subfolder resolved** — a subfolder named after the (possibly iterated) project name & version is found or created inside the shared output folder; falls back to the folder root if the subfolder can't be created
5. **Live SOP fetched** — opens the master SOP Google Doc and parses all bullet-point field descriptions. Generation is cancelled with an error if this fails (see [Error Messages](#error-messages))
6. **Remaining builder rows read** — rows 4–5 and 7 read
7. **Data Validation tab read** — dropdown lists loaded for applicable columns
8. **Column list built** — each column classified as mandatory/optional/hidden_nc/hidden_bespoke based on row 3; unset or unrecognised selections are silently skipped (no blocking). Hidden columns get a `prefillVal` — either `NOT_COLLECTED` or the bespoke value from row 7
9. **Empty-selection check** — generation only stops if *no* columns at all are selected
10. **Column ordering applied** — columns with order numbers in row 4 are placed first; remaining columns follow in natural order
11. **Manifest Google Sheet created** — named `ToL_Manifest_[ProjectName][-N]_[YYYY-MM-DD]`, moved into the per-project subfolder
12. **Header row written** — colour-coded, bold, text-wrapped, 60px tall, frozen. Hidden columns prefixed `[ignore]`
13. **Data rows formatted** — 1920 rows with light column tints, grey grid borders, dropdowns, date validation, prefill values for hidden columns, amber missing-value highlight (mandatory columns without a prefill only)
14. **Hidden columns hidden** — all `hidden_nc`/`hidden_bespoke` columns hidden in the sheet
15. **Partner SOP tab added** — green tab inside the manifest sheet
16. **Two SOP Google Docs created** — internal and partner-facing, both moved into the same per-project subfolder
17. **Catalogue row appended** — new row (with the iteration suffix, if any) added to this template's own catalogue section
18. **Summary popup shown** — links to all three output files, the output subfolder, and the catalogue row number, plus a note to contact the ToL Sample Management team for review

> **Row 3 dropdowns are never rebuilt automatically.** A template inherits working dropdowns from the master when it's copied, and rebuilding them (e.g. on every generation run) would strip any custom dropdown item colours configured in the sheet UI — Apps Script's data validation API can create a plain list but can't read or restore per-item colours. If you need to change a column's dropdown options, edit its data validation directly (Data → Data validation) on the master, then make new templates from it — existing templates won't pick up the change retroactively.

---

## Generated Manifest Format

### Header row
- **Forest green (`#2E6F40`) background, white text** — mandatory columns
- **Very light blue (`#DCEEFB`) background, dark blue text** — optional columns
- **White background, dark charcoal text** — hidden columns (prefixed `[ignore]`, column hidden in sheet)
- Text wraps; row height 60px to accommodate long field names
- Each header cell has a **cell comment** (small triangle in corner) containing the full SOP description for that field — hover to read

### Data rows (rows 2–1921)
- White, untinted — mandatory and optional columns
- Off-white — hidden columns
- Grey grid borders on all cells
- **Dropdown validation** on fields with controlled vocabularies (e.g. `ORGANISM_PART`, `LIFESTAGE`, `SEX`, `GAL`)
- **Prefill values** — hidden columns are pre-filled in every data row with either `NOT_COLLECTED` or the bespoke value from builder sheet row 7, so partners never need to touch them
- **Missing mandatory value highlight** — blank cells in mandatory columns *without* a prefill are highlighted **light green** (`#C8E6C9`), making missing required values immediately visible to data curators without being alarming
- **Date validation** on `DATE_OF_COLLECTION`:
  - Cells pre-formatted as Text so Excel doesn't corrupt `YYYY-MM-DD` on `.xlsx` download
  - **Muted coral** (`#D97C6C`) highlight if a non-empty cell doesn't match `YYYY-MM-DD` pattern (survives `.xlsx` export; a rejection rule would not)

### Tabs in the generated file
- **Metadata Entry** — the data-entry manifest tab
- **Partner SOP** — column-by-column instructions for visible columns only
- **`_DV_Lists`** *(hidden)* — helper sheet for long dropdown lists that exceed Google Sheets' inline validation limit

---

## SOP Documents

Two Google Docs are created per run, both saved into the per-project subfolder alongside the manifest sheet:

### Internal SOP (`ToL_Internal_SOP_[name]_[date]`)
- All columns listed including hidden ones
- Hidden column entries are greyed and marked `[HIDDEN]` in the column letter prefix (e.g. `B [HIDDEN]. SYMBIONT: …`)
- Field names highlighted in their manifest colour (green/light blue/grey)

### Partner SOP (`ToL_Partner_SOP_[name]_[date]`)
- Hidden columns omitted entirely
- A note at the start of the column section explains that hidden columns exist, have a white header, and require no input from the partner
- Field names highlighted in their manifest colour

Both documents follow the format of the master SOP:
- Column entries: `A. FIELDNAME: description text` with `FIELDNAME` bold and colour-highlighted
- Header on every page (suppressed page 1 requires a manual step — see [Known Limitations](#known-limitations))
- Footer: `Recording Sample Metadata for ToL Projects | Standard Operating Procedure | Project: [name] | Version: 1.0 | Internal/Partner Version`

---

## Manifest Catalogue

The catalogue section (rows 14+ of a builder sheet) records every manifest that has been generated **from that same spreadsheet**. Master and template each have their own independent catalogue — a PI template's catalogue starts as a copy of the master's at creation time, then grows on its own as that PI generates manifests; nothing is ever shared back to the master or to any other template. Each row contains:

- **Col A** — manifest name and version, with an `-N` iteration suffix if this project name & version has been generated more than once (bold, yellow background when newly added)
- **Cols B+** — full selection string for included columns (e.g. `Mandatory, visible`), empty for excluded columns; cells colour-coded to match the manifest headers (green/light blue/white for included, light grey for excluded)
- **Row formatting** — font size 8, text wrap enabled, solid border around the full row

> **Backwards compatibility:** Older catalogue rows using `TRUE`/`FALSE` checkboxes are still understood by both the catalogue checker and the load-from-catalogue function.

### Checking the catalogue
**🔍 Check catalogue** (run from a PI template) compares the template's current row 3 selections against every named entry in that same template's catalogue:
- ✅ **Exact match** — identical columns AND identical mandatory/optional/hidden status throughout
- 🔶 **Near match** — same set of columns included, but with different mandatory/optional/hidden nuance

### Loading from the catalogue
**📂 Load from catalogue** (run from a PI template) shows a numbered prompt built from that template's own catalogue:
```
1. DToL V2.6  (31 mandatory, 8 optional, 3 hidden)
2. DToL V2.6 WOSPI V1.0  (33 mandatory, 8 optional, 3 hidden)
3. BIOSCAN sent  (28 mandatory, 5 optional, 2 hidden)
```
The user types a number and row 3 is pre-populated with the exact selections from that entry. Columns not in the catalogue entry are set to `select option` (unset); columns whose catalogue value isn't a valid choice in that column's current dropdown (e.g. a "must stay visible" field) are left unchanged and reported in the summary. The user can then adjust selections before generating.

> **Future enhancement (Option B):** A searchable HTML sidebar (using Google Apps Script's `HtmlService`) could replace the text prompt for better usability as the catalogue grows. See the comment block above `loadFromCatalogue()` in the script for implementation notes.

---

## Error Messages

| Error | Cause | Resolution |
|-------|-------|------------|
| `Sheet "all_manifest_builder_v1.0" not found` | The builder tab has been renamed or deleted | Rename the tab to match `BUILDER_SHEET_NAME` in the script constants |
| `Sheet "Data Validation" not found` | The Data Validation tab is missing | Restore the tab or update `DATA_VAL_SHEET_NAME` |
| `Cell A2 is blank` | Project name not filled in | Enter the project name and version in cell A2 (e.g. `DToL_Bats_v1.0`) |
| `Generation cancelled — no project name provided` | User dismissed the project name prompt | Re-run and enter a name when prompted |
| `⚠️ SOP Sync Failed — Manifest NOT generated` | The master SOP Google Doc could not be opened | Check that the Doc (ID in `SOP_DOC_ID`) is shared with the account running the script. See full error for the specific reason |
| `The SOP file appears to be a .docx file` | `SOP_DOC_ID` points to a `.docx` file in Drive rather than a native Google Doc | One-time fix: open the file in Drive → **File → Save as Google Docs** → copy the new Doc ID from the URL → update `SOP_DOC_ID` in the script. `DocumentApp` cannot open `.docx` files even if you have edit access |
| `SOP Doc opened but only N column description(s) parsed` | The SOP Doc structure has changed or the wrong Doc ID is set | Check the Doc ID in `SOP_DOC_ID` and verify the Doc contains bullet-point field descriptions in the expected format (`FIELDNAME: description`) |
| `No columns are selected in row 3. Please choose an option for at least one column` | All columns are unset (`select option` or blank) | Select an option for at least one column in row 3. Individually unset columns no longer block generation — they are silently excluded |
| `No catalogue entries found` | This builder's own catalogue section is empty or starts below `CATALOGUE_DATA_START` | Check the builder sheet and update `CATALOGUE_DATA_START` if the section has moved |
| `Generation must be run from a PI builder template, not the master manifest` | `generateManifest()` (or `checkCatalogue()`/`loadFromCatalogue()`) was run from the master itself | Use SM Only → Create New Builder Template for a PI, then run it from that template instead |
| `Create New Builder Template is run from the master manifest, not a PI builder template` | `createBuilderTemplate()` was run from a PI template | Run it from the master manifest instead |

### SOP sync failure in detail

The SOP fetch is a **hard failure** — the script will not generate a manifest with stale or missing field descriptions. This is intentional: using the wrong SOP version could result in incorrect instructions being sent to partners.

If the SOP Doc cannot be opened, check:
1. The account running the script has at least **Viewer** access to the Doc
2. The `SOP_DOC_ID` constant matches the Doc ID in the URL (`docs.google.com/document/d/[ID]/edit`)
3. The Doc has not been moved to the Trash or had its sharing revoked

---

## Known Limitations

### Page 1 header suppression
Google Apps Script's `DocumentApp` does not support suppressing the header on the first page of a document. The generated SOPs will show the header on all pages. To suppress it on page 1 manually:
1. Open the generated Google Doc
2. Double-click the header area
3. Tick **"Different first page"** in the header toolbar

### Date validation in Excel (.xlsx)
Google Sheets data validation rejection rules are stripped when a file is downloaded as `.xlsx`. The script uses two mitigations:
- Date cells are pre-formatted as **Text** so Excel doesn't auto-convert `YYYY-MM-DD` into a date serial number
- A **muted coral highlight** conditional formatting rule is applied — this does survive `.xlsx` export and will flag incorrectly formatted dates visually

Partners working in Excel will not see a rejection popup for wrong dates, but they will see the coral highlighting.

### Dropdown lists in Excel (.xlsx)
Dropdown validation is not preserved in `.xlsx` downloads. Partners working in Excel should refer to the Partner SOP document for the list of accepted values for controlled-vocabulary fields.

### Shared folder permissions
Files are saved to the shared folder (inside a per-project subfolder) under the permissions of whoever runs the script. If a PI runs the generator and does not have Editor access to the shared folder (`OUTPUT_FOLDER_ID`), the subfolder can't be created/accessed and the files will be created in their personal Drive root instead. The script logs a warning and the summary popup notes this, but generation completes. The SM team should ensure all users who may run the script have Editor access to the shared folder.

### Automatic page numbers in SOP Docs
`DocumentApp` does not support inserting automatic page number fields. Page numbers must be added manually via **Insert → Page numbers** in the generated Google Doc.

---

## Workflow

### Recommended workflow (current)
1. **SM team** runs **SM Only → 🆕 Create New Builder Template for a PI** from the master manifest, entering a short name for the PI/project
2. **SM team** shares the newly created template file with the PI (Editor access) — a manual step
3. **PI** opens their template and fills in row 3 — selecting an option for each column using the dropdowns
4. **PI** runs **🔍 Check catalogue** to confirm this is not a duplicate of an existing manifest within their own template
5. **PI** runs **▶ Generate my manifest**
6. All three output files land automatically in a per-project subfolder (named after the project name & version) inside the **shared SM team folder** — the summary popup shows the folder name and link
7. A new **catalogue row** (highlighted yellow in col A, with an `-N` suffix if this is a repeat run) is appended to that same template's own catalogue for SM review
8. The summary popup asks the PI to contact the ToL Sample Management team (`treeoflifesamples@sanger.ac.uk`) if they'd like the row checked, or to update their selections and regenerate if it isn't what they need

### Future workflow (planned)
A Google Apps Script **Web App** (publishable as a URL) could allow PIs to fill in selections via a web form that runs the generator under the SM team's credentials — meaning files always land in the SM team's Drive without requiring the PI to have folder access. See the `createSopDoc_` section of the script for notes on this approach.

---

## Updating the SOP Source Document

The script fetches column descriptions from the master SOP Google Doc at run-time. To update the descriptions:
1. Edit the SOP Google Doc directly (no script changes needed)
2. Ensure field entries remain as bullet-point list items in the format `FIELDNAME: description text`
3. Field names must be `ALL_CAPS_WITH_UNDERSCORES` — the parser identifies them by the absence of lowercase letters before the first colon
4. Run **SM Only → 🔄 Sync SOP comments to builder headers** to update the comments on the builder sheet's row 2 headers immediately
5. The next manifest generation will automatically use the updated descriptions in the generated manifest and SOP docs

If the Doc structure changes significantly (e.g. bullet points replaced with a different format), the parser may return fewer than 5 entries and halt with an error. In this case, update the `fetchSopComments_()` function's parsing logic to match the new structure.

> **Important — Google Doc format required:** The script uses `DocumentApp.openById()` which only works with native Google Docs format. If the SOP is stored as a `.docx` file in Drive (even one you can open and edit in the browser), the script will fail with an "inaccessible" error. The fix is a one-time conversion: open the `.docx` in Drive → **File → Save as Google Docs** → update `SOP_DOC_ID` with the new Doc's ID.

---

## Updating the Shared Output Folder

To change where output files are saved:
1. Create or navigate to the new Google Drive folder
2. Copy the folder ID from the URL: `drive.google.com/drive/folders/[FOLDER_ID]`
3. Update `OUTPUT_FOLDER_ID` in the Constants section of `ManifestGenerator.gs`
4. Ensure all script users have Editor access to the new folder

Per-project subfolders are created automatically underneath `OUTPUT_FOLDER_ID` — there is nothing else to configure.

---

## Updating Dropdown Options

Unlike earlier versions, the script never rebuilds a builder sheet's row 3 dropdowns automatically (doing so would strip any custom dropdown item colours — see the note in [What Gets Generated](#what-gets-generated)). Row 3's actual dropdown lists live entirely in each sheet's own data validation rules, configured directly in the Sheets UI (**Data → Data validation**) on the master; new templates then inherit whatever's there when they're copied.

`BUILDER_DROPDOWN_OPTIONS_MANDATORY`/`BUILDER_DROPDOWN_OPTIONS_OPTIONAL` in the script are only used to recognise the standard wording (e.g. restoring canonical casing in `loadFromCatalogue()`) — they don't drive what appears in any dropdown. If the standard wording changes:
1. Update the master's row 3 data validation rules directly in the Sheets UI for the affected columns
2. Update the two arrays in the Constants section, and the corresponding `SEL_*` trigger constants and derived `HIDDEN_NC_TRIGGERS`/`HIDDEN_BESPOKE_TRIGGERS`/`ALL_HIDDEN_TRIGGERS` arrays, to match the new lowercase versions
3. Existing templates keep whatever dropdown wording they already had — only templates created after both changes will reflect the new wording

---

## Contributing

This script is maintained by the Tree of Life Sample Management team at the Wellcome Sanger Institute. For bugs, feature requests, or questions, please open a GitHub Issue on this repository.

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 0.13 | 2026-07 | Removed the automatic row 3 dropdown rebuild (`applyBuilderDropdowns_()`) that used to run at the start of every `generateManifest()` — it was silently stripping custom dropdown item colours on every single generation, since Apps Script's data validation API can build a plain list but can't read or restore per-item colours. Templates now rely entirely on the dropdowns they inherited from the master at copy-time; the removed function also had a latent bug where it would have overwritten the single-option "must stay visible" column dropdowns (B:I) with the generic 3-option list |
| 0.12 | 2026-07 | Split into a master/PI-template architecture: the master manifest now shows an "SM Only" menu (Create New Builder Template for a PI, Sync SOP comments) instead of ToL Manifest Tools, so the generator can never be run from it. "Create New Builder Template for a PI" makes a full, standalone Drive copy of the master (bound script included) into the shared output folder; that copy shows "📋 ToL Manifest Tools" (Check catalogue, Load from catalogue, Generate my manifest) and works entirely on its own — its own column selections, its own Manifest Catalogue, nothing shared with the master or any other template. New `MASTER_SPREADSHEET_ID` constant (required one-time setup) is how `isMasterSpreadsheet_()` tells the master apart from a template copy. `generateManifest()`/`checkCatalogue()`/`loadFromCatalogue()` now refuse to run from the master itself, and `createBuilderTemplate()`/`syncSopCommentsToBuilder()` refuse to run from a template |
| 0.11 | 2026-07 | Builder sheet rows shifted by one (new unused label row 1) plus an extra Notes row 8 — all row constants updated (selections now row 3, catalogue now starts row 14); output files now saved into a per-project subfolder (named by project & version) inside the shared folder; regenerating the same project name & version now appends an `-N` iteration suffix to the catalogue row and output filenames; removed the "pending SM team review" cell note; summary popup now points PIs to `treeoflifesamples@sanger.ac.uk` instead of asking them to copy the row to a master catalogue; new shared output folder ID; menu reorganised — Generate is back at the top level as "Generate my manifest", Sync SOP comments moved into a new "SM Only" submenu |
| 0.10 | 2026-06 | New colour palette: forest green mandatory headers, very light blue/dark blue text optional headers; mandatory/optional data cells now plain white (no tint); missing-mandatory highlight changed from amber to light green |
| 0.9 | 2026-06 | New row 2 vocabulary (`Mandatory, visible` / `Optional, visible` / hide-and-prefill options); row 6 bespoke autopopulate values; unset selections no longer block generation (silently excluded); hidden columns auto-prefilled with `NOT_COLLECTED` or bespoke term; `MANIFEST_DATA_ROWS` increased to 1920 |
| 0.8 | 2026-06 | Fix date CF false positives (remove TEXT() wrapper); auto duplicate-check before generation; white text on mandatory catalogue/SOP cells |
| 0.7 | 2026-06 | Teal/sage colour palette; amber missing-value highlight; muted coral date error; separate dark/light header text colours |
| 0.6 | 2026-05 | Sync SOP comments to builder headers (new menu item); catalogue row border, font-8, wrap, light grey excluded cells |
| 0.5 | 2026-05 | Live SOP fetch, catalogue checker, load from catalogue, shared folder output, two SOP doc versions, partner SOP tab |
| 0.4 | 2026-04 | Column reordering, [ignore] prefix, rich catalogue storage, date CF only |
| 0.3 | 2026-04 | Hidden columns, SOP generation, colour-coded headers |
| 0.2 | 2026-03 | Initial version — basic manifest generation |

---

*Tree of Life Programme · Wellcome Sanger Institute · treeoflifesamples@sanger.ac.uk*
