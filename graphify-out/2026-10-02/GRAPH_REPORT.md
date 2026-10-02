# Graph Report - NySse_writer  (2026-10-02)

## Corpus Check
- 7 files · ~11,018 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 73 nodes · 190 edges · 9 communities (8 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8ac192a0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- parse.js
- settings-modal.js
- settings.js
- initEditor
- editor.js
- metrics.js
- setupEventListeners
- showToast
- pages.js

## God Nodes (most connected - your core abstractions)
1. `getSettings()` - 15 edges
2. `setupEventListeners()` - 14 edges
3. `initSettingsModal()` - 11 edges
4. `recalculateAll()` - 10 edges
5. `computeAllMetrics()` - 7 edges
6. `loadSettingsIntoForm()` - 7 edges
7. `renderSignalPhrasesList()` - 7 edges
8. `saveSettings()` - 7 edges
9. `importSettingsJSON()` - 7 edges
10. `showToast()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `recalculateAll()` --calls--> `computeAllMetrics()`  [EXTRACTED]
  editor/js/editor.js → editor/js/metrics.js
- `recalculateAll()` --calls--> `estimateA4Pages()`  [EXTRACTED]
  editor/js/editor.js → editor/js/pages.js
- `recalculateAll()` --calls--> `parseDocument()`  [EXTRACTED]
  editor/js/editor.js → editor/js/parse.js
- `recalculateAll()` --calls--> `getSettings()`  [EXTRACTED]
  editor/js/editor.js → editor/js/settings.js
- `fillPopupContent()` --calls--> `getSettings()`  [EXTRACTED]
  editor/js/editor.js → editor/js/settings.js

## Import Cycles
- None detected.

## Communities (9 total, 1 thin omitted)

### Community 0 - "parse.js"
Cohesion: 0.23
Nodes (14): DEFAULT_ABBREVIATIONS, DEFAULT_FORMULAIC_STARTERS, DEFAULT_SIGNAL_PHRASES, DEFAULT_STOPWORDS, ABBREV_SET, analyzeSentenceIssues(), cleanWord(), escapeRegex() (+6 more)

### Community 1 - "settings-modal.js"
Cohesion: 0.34
Nodes (13): exportSettingsJSON(), getSettings(), closeSettings(), escapeHtml(), gatherAndSaveSettings(), getCheck(), getVal(), initSettingsModal() (+5 more)

### Community 2 - "settings.js"
Cohesion: 0.44
Nodes (8): deepClone(), deepMerge(), importSettingsJSON(), listeners, notifySettingsChanged(), resetToReviewDefaults(), REVIEW_DEFAULTS, saveSettings()

### Community 3 - "initEditor"
Cohesion: 0.67
Nodes (3): getDemoReviewText(), initEditor(), onSettingsChange()

### Community 4 - "editor.js"
Cohesion: 0.47
Nodes (8): escapeHtml(), recalculateAll(), renderGlobalDeficits(), renderIssueList(), renderMetricCard(), renderMirrorHighlights(), renderSidebarStats(), setText()

### Community 5 - "metrics.js"
Cohesion: 0.60
Nodes (5): calculateSentenceStdDev(), calculateStarterUniformity(), calculateThreeGramRepetition(), computeAllMetrics(), evaluateStatus()

### Community 6 - "setupEventListeners"
Cohesion: 0.39
Nodes (8): checkSentenceAtOffset(), closePopup(), handleEditorClick(), handleEditorCursorMove(), hidePopupIfScrolledOut(), scheduleAutoSave(), setSaveStatus(), setupEventListeners()

### Community 7 - "showToast"
Cohesion: 0.40
Nodes (5): exportPlainTextFile(), fillPopupContent(), positionAndShowPopup(), scrollToSentenceAndOpenPopup(), showToast()

## Knowledge Gaps
- **3 isolated node(s):** `ABBREV_SET`, `REVIEW_DEFAULTS`, `listeners`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 3 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getSettings()` connect `settings-modal.js` to `parse.js`, `settings.js`, `editor.js`, `metrics.js`, `showToast`, `pages.js`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Why does `computeAllMetrics()` connect `metrics.js` to `editor.js`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `parseDocument()` connect `parse.js` to `editor.js`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `setupEventListeners()` (e.g. with `exportPlainTextFile()` and `handleEditorClick()`) actually correct?**
  _`setupEventListeners()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `initSettingsModal()` (e.g. with `closeSettings()` and `openSettings()`) actually correct?**
  _`initSettingsModal()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ABBREV_SET`, `REVIEW_DEFAULTS`, `listeners` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._