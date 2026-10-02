# Graph Report - NySse_writer  (2026-10-02)

## Corpus Check
- 8 files · ~11,533 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 84 nodes · 200 edges · 10 communities (9 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c8877052`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- parse.js
- settings-modal.js
- settings.js
- Product
- editor.js
- metrics.js
- setupEventListeners
- escapeHtml
- pages.js
- gatherAndSaveSettings

## God Nodes (most connected - your core abstractions)
1. `getSettings()` - 15 edges
2. `setupEventListeners()` - 14 edges
3. `initSettingsModal()` - 11 edges
4. `recalculateAll()` - 10 edges
5. `Product` - 10 edges
6. `computeAllMetrics()` - 7 edges
7. `loadSettingsIntoForm()` - 7 edges
8. `renderSignalPhrasesList()` - 7 edges
9. `saveSettings()` - 7 edges
10. `importSettingsJSON()` - 7 edges

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

## Communities (10 total, 1 thin omitted)

### Community 0 - "parse.js"
Cohesion: 0.23
Nodes (14): DEFAULT_ABBREVIATIONS, DEFAULT_FORMULAIC_STARTERS, DEFAULT_SIGNAL_PHRASES, DEFAULT_STOPWORDS, ABBREV_SET, analyzeSentenceIssues(), cleanWord(), escapeRegex() (+6 more)

### Community 1 - "settings-modal.js"
Cohesion: 0.44
Nodes (10): exportSettingsJSON(), getSettings(), closeSettings(), escapeHtml(), initSettingsModal(), loadSettingsIntoForm(), openSettings(), renderSignalPhrasesList() (+2 more)

### Community 2 - "settings.js"
Cohesion: 0.44
Nodes (8): deepClone(), deepMerge(), importSettingsJSON(), listeners, notifySettingsChanged(), resetToReviewDefaults(), REVIEW_DEFAULTS, saveSettings()

### Community 3 - "Product"
Cohesion: 0.18
Nodes (10): Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product, Product Principles (+2 more)

### Community 4 - "editor.js"
Cohesion: 0.38
Nodes (9): getDemoReviewText(), initEditor(), recalculateAll(), renderGlobalDeficits(), renderMetricCard(), renderMirrorHighlights(), renderSidebarStats(), setText() (+1 more)

### Community 5 - "metrics.js"
Cohesion: 0.60
Nodes (5): calculateSentenceStdDev(), calculateStarterUniformity(), calculateThreeGramRepetition(), computeAllMetrics(), evaluateStatus()

### Community 6 - "setupEventListeners"
Cohesion: 0.31
Nodes (10): checkSentenceAtOffset(), closePopup(), exportPlainTextFile(), handleEditorClick(), handleEditorCursorMove(), hidePopupIfScrolledOut(), scheduleAutoSave(), setSaveStatus() (+2 more)

### Community 7 - "escapeHtml"
Cohesion: 0.50
Nodes (5): escapeHtml(), fillPopupContent(), positionAndShowPopup(), renderIssueList(), scrollToSentenceAndOpenPopup()

### Community 9 - "gatherAndSaveSettings"
Cohesion: 0.67
Nodes (3): gatherAndSaveSettings(), getCheck(), getVal()

## Knowledge Gaps
- **12 isolated node(s):** `ABBREV_SET`, `REVIEW_DEFAULTS`, `listeners`, `Platform`, `Users` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 13 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getSettings()` connect `settings-modal.js` to `parse.js`, `settings.js`, `editor.js`, `metrics.js`, `escapeHtml`, `pages.js`, `gatherAndSaveSettings`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `computeAllMetrics()` connect `metrics.js` to `editor.js`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `parseDocument()` connect `parse.js` to `editor.js`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `setupEventListeners()` (e.g. with `exportPlainTextFile()` and `handleEditorClick()`) actually correct?**
  _`setupEventListeners()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `initSettingsModal()` (e.g. with `closeSettings()` and `openSettings()`) actually correct?**
  _`initSettingsModal()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ABBREV_SET`, `REVIEW_DEFAULTS`, `listeners` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._