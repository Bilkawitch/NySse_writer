# Graph Report - NySse_writer  (2026-10-02)

## Corpus Check
- 9 files · ~12,544 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 107 nodes · 222 edges · 7 communities (6 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2de6a7ba`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- parse.js
- settings.js
- Design System: NySse Writer
- Product
- editor.js
- metrics.js
- pages.js

## God Nodes (most connected - your core abstractions)
1. `getSettings()` - 15 edges
2. `setupEventListeners()` - 14 edges
3. `initSettingsModal()` - 11 edges
4. `recalculateAll()` - 10 edges
5. `Product` - 10 edges
6. `Design System: NySse Writer` - 9 edges
7. `computeAllMetrics()` - 7 edges
8. `loadSettingsIntoForm()` - 7 edges
9. `renderSignalPhrasesList()` - 7 edges
10. `saveSettings()` - 7 edges

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

## Communities (7 total, 1 thin omitted)

### Community 0 - "parse.js"
Cohesion: 0.23
Nodes (14): DEFAULT_ABBREVIATIONS, DEFAULT_FORMULAIC_STARTERS, DEFAULT_SIGNAL_PHRASES, DEFAULT_STOPWORDS, ABBREV_SET, analyzeSentenceIssues(), cleanWord(), escapeRegex() (+6 more)

### Community 1 - "settings.js"
Cohesion: 0.23
Nodes (21): deepClone(), deepMerge(), exportSettingsJSON(), getSettings(), importSettingsJSON(), listeners, closeSettings(), escapeHtml() (+13 more)

### Community 2 - "Design System: NySse Writer"
Cohesion: 0.09
Nodes (22): Colors, Components, Design System: NySse Writer, Diagnostic & Status, Do:, Do's and Don'ts, Don't:, Elevation & Depth (+14 more)

### Community 3 - "Product"
Cohesion: 0.18
Nodes (10): Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product, Product Principles (+2 more)

### Community 4 - "editor.js"
Cohesion: 0.20
Nodes (24): checkSentenceAtOffset(), closePopup(), escapeHtml(), exportPlainTextFile(), fillPopupContent(), getDemoReviewText(), handleEditorClick(), handleEditorCursorMove() (+16 more)

### Community 5 - "metrics.js"
Cohesion: 0.60
Nodes (5): calculateSentenceStdDev(), calculateStarterUniformity(), calculateThreeGramRepetition(), computeAllMetrics(), evaluateStatus()

## Knowledge Gaps
- **29 isolated node(s):** `ABBREV_SET`, `REVIEW_DEFAULTS`, `listeners`, `Overview`, `Primary` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 31 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getSettings()` connect `settings.js` to `pages.js`, `parse.js`, `editor.js`, `metrics.js`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `setupEventListeners()` (e.g. with `exportPlainTextFile()` and `handleEditorClick()`) actually correct?**
  _`setupEventListeners()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `initSettingsModal()` (e.g. with `closeSettings()` and `openSettings()`) actually correct?**
  _`initSettingsModal()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ABBREV_SET`, `REVIEW_DEFAULTS`, `listeners` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Design System: NySse Writer` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._