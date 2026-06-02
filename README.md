# ToL Master Manifest Generator

A Google Apps Script tool for generating tailored sample metadata manifests and Standard Operating Procedure (SOP) documents for Tree of Life (ToL) genomic projects at the Wellcome Sanger Institute.

---

## Overview

The Manifest Generator reads a configuration Google Sheet (`all_manifest_builder_v1.0`) where a project investigator (PI) or sample manager selects which metadata fields to include in a project-specific manifest. On generation, the script produces:

1. **A Google Sheets manifest file** — pre-formatted with colour-coded headers, dropdown validation, date format checking, and 96 blank data-entry rows ready for partner use
2. **An internal SOP Google Doc** — full column-by-column instructions for all fields including hidden ones (marked `[HIDDEN]`)
3. **A partner-facing SOP Google Doc** — instructions for visible fields only, with a note about hidden columns
4. **A Partner SOP tab** inside the generated manifest Google Sheet
5. **A new catalogue row** — appended to the builder sheet's manifest catalogue, colour-coded and flagged for SM team review

All outputs are saved to a shared Google Drive folder accessible to the sample management team.

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

### Google Account Permissions
When first run, Apps Script will request the following permissions:
- **Google Sheets** — read configuration, write catalogue rows, apply validation
- **Google Drive** — create and move output files to the shared folder
- **Google Docs** — read the live SOP document, create SOP output documents

### SOP Google Doc
The script fetches column descriptions live from a master SOP Google Doc at run-time. The Doc must be shared (at minimum **Viewer** access) with every Google account that will run the script. The Doc ID is set in the `SOP_DOC_ID` constant.

### Shared Output Folder
All generated files are saved to a shared Google Drive folder. The folder ID is set in the `OUTPUT_FOLDER_ID` constant. Every account running the script needs **Editor** access to this folder. If a user lacks access, files will still be created (in their Drive root) but will not land in the shared folder — a warning is logged but generation completes.

---

## Installation

1. Open your Google Sheet containing the `all_manifest_builder_v1.0` tab
2. Go to **Extensions → Apps Script**
3. Delete any existing code in the editor
4. Paste the entire contents of `ManifestGenerator.gs`
5. Click **Save** (💾)
6. Close the Apps Script editor and **reload the Google Sheet**
7. A new menu **📋 ToL Manifest Tools** will appear in the menu bar

> **First-run permissions:** The first time you run any function, Google will ask you to authorise the script. Click **Review permissions → Advanced → Go to [project name] (unsafe) → Allow**. This is expected for unverified scripts within your own organisation.

---

## Configuration

All configurable values are in the **Constants** section at the top of `ManifestGenerator.gs`. The key ones to update are:

```javascript
// Name of the builder tab in the Google Sheet
const BUILDER_SHEET_NAME = 'all_manifest_builder_v1.0';

// Google Doc ID of the live master SOP document
// Extract from the Doc URL: docs.google.com/document/d/[DOC_ID]/edit
const SOP_DOC_ID = '10WMIZ9GuB0hj5pBzFkz1U2V3_KwIFH-3cAud6h3-Gow';

// Google Drive folder ID for all output files
// Extract from the folder URL: drive.google.com/drive/folders/[FOLDER_ID]
const OUTPUT_FOLDER_ID = '1pHO9F18QAF96UQjpNUN23L7WUX1XNFfc';

// First data row of the catalogue section in the builder sheet
const CATALOGUE_DATA_START = 12;

// Number of blank data rows to generate in the manifest
const MANIFEST_DATA_ROWS = 96;
```

### Colour scheme
Colours are defined as a single source of truth — changing them here updates both the manifest sheet headers and the SOP document field name highlights:

```javascript
const COLOUR_MANDATORY        = '#355C4B';  // Deep forest teal  — mandatory headers (white text)
const COLOUR_MANDATORY_CELL   = '#F5F8F6';  // Very pale moss    — mandatory data cell backgrounds
const COLOUR_OPTIONAL_LIGHT   = '#C8DDD3';  // Soft sage         — optional headers (charcoal text)
const COLOUR_OPTIONAL_CELL    = '#F5F8F6';  // Very pale moss    — optional data cell backgrounds
const COLOUR_HIDDEN_BG        = '#FFFFFF';  // White             — hidden column headers
const COLOUR_HIDDEN_CELL      = '#FAFBF9';  // Off-white         — hidden data cell backgrounds
const COLOUR_HEADER_TEXT_DARK = '#FFFFFF';  // White             — text on mandatory headers
const COLOUR_HEADER_TEXT_LIGHT= '#1E2A24';  // Dark charcoal     — text on optional/hidden headers
const COLOUR_GRID_LINE        = '#CCCCCC';  // Grey              — cell borders
const COLOUR_MISSING_REQUIRED = '#F3D27A';  // Soft amber        — blank mandatory cell highlight
const COLOUR_DATE_ERROR       = '#D97C6C';  // Muted coral       — date format validation error
const COLOUR_ROW_ALT          = '#EEF2EF';  // Pale moss-grey    — alternating row stripe
const COLOUR_EXCLUDED_CELL    = '#EFEFEF';  // Light grey        — excluded columns in catalogue row
```

> **Palette rationale:** The deep teal/sage family was chosen specifically for biodiversity genomics manifests. It avoids red/green error/success semantics, is accessible for colourblind users, and the dark/light hierarchy (dark = must fill, light = supplementary) is more intuitive than arbitrary colour differences. The palette subtly evokes field ecology and natural history collections.

---

## Builder Sheet Structure

The `all_manifest_builder_v1.0` sheet is laid out as follows:

| Row | Label (col A) | Purpose |
|-----|---------------|---------|
| 1 | Project Name and Version | **Col A:** Project name used in all filenames and SOP text. Must be filled in before generating (e.g. `DToL_Bats_v1.0`). **Cols B+:** Column field names |
| 2 | REQUIREMENT FOR NEW PROJECT MANIFEST | Project-level selection for each column — choose from the dropdown in each cell (see [Row 2 Dropdown Options](#row-2-dropdown-options)) |
| 3 | Column order | Optional integer ordering numbers. Columns with numbers are placed first in that order; blank columns follow in their natural left-to-right order |
| 4 | System requirements | `Mandatory`, `Optional`, or `WOSPI Mandatory` — system-level requirement used as a fallback when row 2 says plain `Include and visible` |
| 5 | Manifest requirements | Reference only — not read by the script |
| 6 | For hidden fields, what and how populate? | SM team reference only — not read by the script |
| 7 | *(blank)* | — |
| 8 | Interpreted Validation Rules | Reference only — may be incorporated in a future version |
| 9 | Validation Rules | Reference only — may be incorporated in a future version |
| 10 | Example row | Reference only |
| 11 | ToL MANIFEST CATALOGUE | Section header |
| 12 | Manifest names and versions | Column header row for the catalogue |
| 13+ | *(catalogue entries)* | One row per existing manifest — col A = name, cols B+ = selection strings (see [Manifest Catalogue](#manifest-catalogue)) |

### Row 2 Dropdown Options

| Selection | Header colour | Meaning |
|-----------|--------------|---------|
| `Include and visible (mandatory)` | 🟩 Deep teal (white text) | Partner must fill this in |
| `Include, visible and mandatory` | 🟩 Deep teal (white text) | Partner must fill this in (alternate wording) |
| `Include, visible and optional` | 🫧 Soft sage (charcoal text) | Partner may fill this in |
| `Include and visible` | 🟩 Teal or 🫧 Sage | If row 4 = Mandatory or WOSPI Mandatory → teal; otherwise → sage |
| `Include and hidden` | ⬜ White | Column included but hidden from partner; header prefixed `[ignore]` |
| `Exclude` | *(not included)* | Column not in the generated manifest at all |

> **Unset columns:** If a cell in row 2 is blank or still says `select option`, the script will block generation and list the columns that need a selection.

---

## Menu

After reloading the sheet, the **📋 ToL Manifest Tools** menu contains:

| Menu item | Function | Description |
|-----------|----------|-------------|
| 🔍 Check catalogue for identical manifest | `checkCatalogue()` | Compares the current row 2 selections against all catalogue entries. Reports exact matches (same columns + same mandatory/optional/hidden status) and near matches (same columns, different nuance) |
| 📂 Load from catalogue into row 2 | `loadFromCatalogue()` | Shows a numbered list of catalogue entries; the user picks one and row 2 is pre-populated with that manifest's selections. The user can then adjust before generating |
| 🔄 Sync SOP comments to builder headers | `syncSopCommentsToBuilder()` | Fetches the latest SOP descriptions from the master SOP Doc and writes them as cell comments on the row 1 column headers of the builder sheet. Run this whenever the SOP source document is updated — no generation needed |
| Generate manifest + SOP → ▶ Run generator | `generateManifest()` | Runs the full generation pipeline (see [What Gets Generated](#what-gets-generated)) |

> **Why is Generate inside a submenu?** To prevent accidental triggering — generation creates and saves files to Google Drive and cannot be undone easily. The other functions are at the top level for quick access.

---

## What Gets Generated

Running **▶ Run generator** triggers a 17-step pipeline:

1. **Row 2 dropdowns refreshed** — validation rules applied to all row 2 cells automatically
2. **Project name validated** — reads cell A1; prompts if blank or still says `"Project Name and Version"`
3. **Duplicate check** — automatically compares the current row 2 selections against the catalogue. If an identical manifest already exists, a Yes/No dialog warns the PI before proceeding — even if they skipped the manual 🔍 Check catalogue step
4. **Live SOP fetched** — opens the master SOP Google Doc and parses all bullet-point field descriptions. Generation is cancelled with an error if this fails (see [Error Messages](#error-messages))
5. **Remaining builder rows read** — rows 3–4 read (rows 1–2 already read for the duplicate check)
6. **Data Validation tab read** — dropdown lists loaded for applicable columns
7. **Column list built** — each column classified as mandatory/optional/hidden/excluded based on row 2 (with row 4 as fallback for ambiguous selections)
8. **Missing selections checked** — if any columns have no selection, generation is blocked and the missing columns are listed
9. **Column ordering applied** — columns with order numbers in row 3 are placed first; remaining columns follow in natural order
10. **Manifest Google Sheet created** — named `ToL_Manifest_[ProjectName]_[YYYY-MM-DD]`, moved to shared folder
11. **Header row written** — colour-coded, bold, text-wrapped, 60px tall, frozen. Hidden columns prefixed `[ignore]`
12. **Data rows formatted** — 96 rows with light column tints, grey grid borders, dropdowns, date validation, amber missing-value highlight
13. **Hidden columns hidden** — all `Include and hidden` columns hidden in the sheet
14. **Partner SOP tab added** — green tab inside the manifest sheet
15. **Two SOP Google Docs created** — internal and partner-facing, both moved to shared folder
16. **Catalogue row appended** — new row added to the builder sheet catalogue section
17. **Summary popup shown** — links to all three output files, plus the catalogue row number

---

## Generated Manifest Format

### Header row
- **Deep forest teal (`#355C4B`) background, white text** — mandatory columns
- **Soft sage (`#C8DDD3`) background, dark charcoal text** — optional columns
- **White background, dark charcoal text** — hidden columns (prefixed `[ignore]`, column hidden in sheet)
- Text wraps; row height 60px to accommodate long field names
- Each header cell has a **cell comment** (small triangle in corner) containing the full SOP description for that field — hover to read

### Data rows (rows 2–97)
- Very pale moss tint — mandatory and optional columns
- Off-white — hidden columns
- Grey grid borders on all cells
- **Dropdown validation** on fields with controlled vocabularies (e.g. `ORGANISM_PART`, `LIFESTAGE`, `SEX`, `GAL`)
- **Missing mandatory value highlight** — blank cells in mandatory columns are highlighted **soft amber** (`#F3D27A`), making missing required values immediately visible to data curators without being alarming
- **Date validation** on `DATE_OF_COLLECTION`:
  - Cells pre-formatted as Text so Excel doesn't corrupt `YYYY-MM-DD` on `.xlsx` download
  - **Muted coral** (`#D97C6C`) highlight if a non-empty cell doesn't match `YYYY-MM-DD` pattern (survives `.xlsx` export; a rejection rule would not)

### Tabs in the generated file
- **Metadata Entry** — the data-entry manifest tab
- **Partner SOP** — column-by-column instructions for visible columns only
- **`_DV_Lists`** *(hidden)* — helper sheet for long dropdown lists that exceed Google Sheets' inline validation limit

---

## SOP Documents

Two Google Docs are created per run, both saved to the shared output folder:

### Internal SOP (`ToL_Internal_SOP_[name]_[date]`)
- All columns listed including hidden ones
- Hidden column entries are greyed and marked `[HIDDEN]` in the column letter prefix (e.g. `B [HIDDEN]. SYMBIONT: …`)
- Field names highlighted in their manifest colour (teal/sage/grey)

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

The catalogue section (rows 13+ of the builder sheet) records every manifest that has been generated. Each row contains:

- **Col A** — manifest name and version (bold, yellow background when newly added, with a cell note for SM review)
- **Cols B+** — full selection string for included columns (e.g. `Include, visible and mandatory`), empty for excluded columns; cells colour-coded to match the manifest headers (teal/sage/white for included, light grey for excluded)
- **Row formatting** — font size 8, text wrap enabled, solid border around the full row

> **Backwards compatibility:** Older catalogue rows using `TRUE`/`FALSE` checkboxes are still understood by both the catalogue checker and the load-from-catalogue function.

### Checking the catalogue
**🔍 Check catalogue** compares the current row 2 selections against every named catalogue entry:
- ✅ **Exact match** — identical columns AND identical mandatory/optional/hidden status throughout
- 🔶 **Near match** — same set of columns included, but with different mandatory/optional/hidden nuance

### Loading from the catalogue
**📂 Load from catalogue** shows a numbered prompt:
```
1. DToL V2.6  (31 mandatory, 8 optional, 3 hidden)
2. DToL V2.6 WOSPI V1.0  (33 mandatory, 8 optional, 3 hidden)
3. BIOSCAN sent  (28 mandatory, 5 optional, 2 hidden)
```
The user types a number and row 2 is pre-populated with the exact selections from that entry. Columns not in the catalogue entry are set to `Exclude`. The user can then adjust selections before generating.

> **Future enhancement (Option B):** A searchable HTML sidebar (using Google Apps Script's `HtmlService`) could replace the text prompt for better usability as the catalogue grows. See the comment block above `loadFromCatalogue()` in the script for implementation notes.

---

## Error Messages

| Error | Cause | Resolution |
|-------|-------|------------|
| `Sheet "all_manifest_builder_v1.0" not found` | The builder tab has been renamed or deleted | Rename the tab to match `BUILDER_SHEET_NAME` in the script constants |
| `Sheet "Data Validation" not found` | The Data Validation tab is missing | Restore the tab or update `DATA_VAL_SHEET_NAME` |
| `Cell A1 is blank` | Project name not filled in | Enter the project name and version in cell A1 (e.g. `DToL_Bats_v1.0`) |
| `Generation cancelled — no project name provided` | User dismissed the project name prompt | Re-run and enter a name when prompted |
| `⚠️ SOP Sync Failed — Manifest NOT generated` | The master SOP Google Doc could not be opened | Check that the Doc (ID in `SOP_DOC_ID`) is shared with the account running the script. See full error for the specific reason |
| `The SOP file appears to be a .docx file` | `SOP_DOC_ID` points to a `.docx` file in Drive rather than a native Google Doc | One-time fix: open the file in Drive → **File → Save as Google Docs** → copy the new Doc ID from the URL → update `SOP_DOC_ID` in the script. `DocumentApp` cannot open `.docx` files even if you have edit access |
| `SOP Doc opened but only N column description(s) parsed` | The SOP Doc structure has changed or the wrong Doc ID is set | Check the Doc ID in `SOP_DOC_ID` and verify the Doc contains bullet-point field descriptions in the expected format (`FIELDNAME: description`) |
| `⚠️ Please fill in row 2 for these columns before generating` | One or more columns have no selection in row 2 | Use the dropdown in each listed cell to select an option. Unset cells and `select option` are treated as missing |
| `No columns selected. Please update row 2` | All columns are set to `Exclude` | At least one column must be included |
| `No catalogue entries found` | The catalogue section is empty or starts below `CATALOGUE_DATA_START` | Check the builder sheet and update `CATALOGUE_DATA_START` if the section has moved |

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
Files are saved to the shared folder under the permissions of whoever runs the script. If a PI runs the generator and does not have Editor access to the shared folder (`OUTPUT_FOLDER_ID`), the files will be created in their personal Drive root instead. The script logs a warning but generation completes. The SM team should ensure all users who may run the script have Editor access to the shared folder.

### Automatic page numbers in SOP Docs
`DocumentApp` does not support inserting automatic page number fields. Page numbers must be added manually via **Insert → Page numbers** in the generated Google Doc.

---

## Workflow

### Recommended workflow (current)
1. **SM team** shares the master builder sheet with the PI (or the PI makes a copy)
2. **PI** fills in row 2 — selecting an option for each column using the dropdowns
3. **PI** (or SM team) runs **🔍 Check catalogue** to confirm this is not a duplicate of an existing manifest
4. **PI** (or SM team) runs **▶ Run generator**
5. All three output files appear in the **shared SM team folder** automatically
6. A new **catalogue row** (highlighted yellow in col A) is appended to the builder sheet for SM review
7. **SM team** reviews the catalogue row, removes the yellow highlight, and copies it to the master catalogue if approved

### Future workflow (planned)
A Google Apps Script **Web App** (publishable as a URL) could allow PIs to fill in selections via a web form that runs the generator under the SM team's credentials — meaning files always land in the SM team's Drive without requiring the PI to have folder access. See the `createSopDoc_` section of the script for notes on this approach.

---

## Updating the SOP Source Document

The script fetches column descriptions from the master SOP Google Doc at run-time. To update the descriptions:
1. Edit the SOP Google Doc directly (no script changes needed)
2. Ensure field entries remain as bullet-point list items in the format `FIELDNAME: description text`
3. Field names must be `ALL_CAPS_WITH_UNDERSCORES` — the parser identifies them by the absence of lowercase letters before the first colon
4. Run **🔄 Sync SOP comments to builder headers** to update the comments on the builder sheet's row 1 headers immediately
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

---

## Updating Dropdown Options

The row 2 dropdown options are defined in `BUILDER_DROPDOWN_OPTIONS`. If the wording needs to change:
1. Update the array in the Constants section
2. Update the corresponding trigger arrays (`ORANGE_TRIGGERS`, `BLUE_TRIGGER`, `HIDDEN_TRIGGER`, `EXCLUDE_TRIGGER`) to match the new lowercase versions
3. Re-run the generator once — the updated dropdowns will be applied to row 2 automatically at the start of the next generation run

---

## Contributing

This script is maintained by the Tree of Life Sample Management team at the Wellcome Sanger Institute. For bugs, feature requests, or questions, please open a GitHub Issue on this repository.

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 0.7 | 2026-06 | Teal/sage colour palette; amber missing-value highlight; alternating row stripe; muted coral date error; separate dark/light header text colours |
| 0.6 | 2026-05 | Sync SOP comments to builder headers (new menu item); catalogue row border, font-8, wrap, light grey excluded cells |
| 0.5 | 2026-05 | Live SOP fetch, catalogue checker, load from catalogue, shared folder output, two SOP doc versions, partner SOP tab |
| 0.4 | 2026-04 | Column reordering, [ignore] prefix, rich catalogue storage, date CF only |
| 0.3 | 2026-04 | Hidden columns, SOP generation, colour-coded headers |
| 0.2 | 2026-03 | Initial version — basic manifest generation |

---

*Tree of Life Programme · Wellcome Sanger Institute · treeoflifesamples@sanger.ac.uk*
