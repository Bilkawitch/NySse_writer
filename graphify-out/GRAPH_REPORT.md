# Graph Report - NySse_writer  (2026-10-03)

## Corpus Check
- 16 files · ~20,031 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .bat 2, (none) 1, .exe 1)

## Summary
- 223 nodes · 352 edges · 33 communities (12 shown, 21 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1218448d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- settings.js
- settings-modal.js
- Design System: NySse Writer
- Product
- editor.js
- metrics.js
- GitRepository
- history-panel.js
- package.json
- cli.js
- ai-panel.js
- ai-provider.js
- ref_ai_panel_js_v_2_2_1
- ref_ai_provider_js_v_2_2_1
- ref_editor_js_v_2_2_1
- ref_history_panel_js_v_2_2_1
- ref_metrics_js_v_2_2_1
- ref_pages_js_v_2_2_1
- ref_parse_js_v_2_2_1
- ref_repo_js_v_2_2_1
- ref_settings_js_v_2_2_1
- ref_settings_modal_js_v_2_2_1
- ref_ai_panel_js_v_2_2_2
- ref_ai_provider_js_v_2_2_2
- ref_editor_js_v_2_2_2
- ref_history_panel_js_v_2_2_2
- ref_metrics_js_v_2_2_2
- ref_pages_js_v_2_2_2
- ref_parse_js_v_2_2_2
- ref_repo_js_v_2_2_2
- ref_settings_js_v_2_2_2
- ref_settings_modal_js_v_2_2_2

## God Nodes (most connected - your core abstractions)
1. `GitRepository` - 21 edges
2. `setupEventListeners()` - 14 edges
3. `initSettingsModal()` - 10 edges
4. `Product` - 10 edges
5. `Design System: NySse Writer` - 9 edges
6. `loadSettingsIntoForm()` - 8 edges
7. `renderAiPanel()` - 7 edges
8. `renderHistoryPanel()` - 7 edges
9. `getSettings()` - 7 edges
10. `initEditor()` - 6 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (33 total, 21 thin omitted)

### Community 0 - "settings.js"
Cohesion: 0.12
Nodes (27): DEFAULT_ABBREVIATIONS, DEFAULT_ABSTRACT_HEDGES, DEFAULT_FORMULAIC_STARTERS, DEFAULT_SIGNAL_PHRASES, DEFAULT_STOPWORDS, estimateA4Pages(), getSandbox(), ABBREV_SET (+19 more)

### Community 1 - "settings-modal.js"
Cohesion: 0.35
Nodes (13): closeSettings(), escapeHtml(), gatherAndSaveSettings(), getCheck(), getVal(), initSettingsModal(), loadSettingsIntoForm(), openSettings() (+5 more)

### Community 2 - "Design System: NySse Writer"
Cohesion: 0.09
Nodes (22): Colors, Components, Design System: NySse Writer, Diagnostic & Status, Do:, Do's and Don'ts, Don't:, Elevation & Depth (+14 more)

### Community 3 - "Product"
Cohesion: 0.18
Nodes (10): Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product, Product Principles (+2 more)

### Community 4 - "editor.js"
Cohesion: 0.15
Nodes (29): checkSentenceAtOffset(), closePopup(), escapeHtml(), exportPlainTextFile(), fillPopupContent(), getDemoReviewText(), handleEditorClick(), handleEditorCursorMove() (+21 more)

### Community 5 - "metrics.js"
Cohesion: 0.60
Nodes (5): calculateSentenceStdDev(), calculateStarterUniformity(), calculateThreeGramRepetition(), computeAllMetrics(), evaluateStatus()

### Community 6 - "GitRepository"
Cohesion: 0.22
Nodes (3): generateCommitHash(), generateId(), GitRepository

### Community 7 - "history-panel.js"
Cohesion: 0.42
Nodes (9): attachEventListeners(), escapeHtml(), formatCommitTime(), initHistoryPanel(), renderHistoryPanel(), renderProjectsTreeHtml(), renderTimelineHtml(), toggleHistoryPanel() (+1 more)

### Community 8 - "package.json"
Cohesion: 0.12
Nodes (16): author, bin, nysse, nysse-writer, description, keywords, license, main (+8 more)

### Community 9 - "cli.js"
Cohesion: 0.14
Nodes (13): { exec }, fs, http, MIME_TYPES, openBrowser(), path, ROOT_DIR, startServer() (+5 more)

### Community 11 - "ai-panel.js"
Cohesion: 0.24
Nodes (12): attachResultInteractions(), escapeHtml(), getCategoryLabel(), handleTriggerAudit(), initAiPanel(), renderAiPanel(), renderAuditResultsHtml(), renderPanelContent() (+4 more)

### Community 12 - "ai-provider.js"
Cohesion: 0.40
Nodes (4): AI_PRESETS, parseAiJsonResponse(), runAiSemanticAudit(), ref_settings_js_v_2_2_3

## Knowledge Gaps
- **50 isolated node(s):** `http`, `fs`, `path`, `{ exec }`, `MIME_TYPES` (+45 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 89 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getSettings()` connect `settings.js` to `metrics.js`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `setupEventListeners()` (e.g. with `exportPlainTextFile()` and `handleEditorClick()`) actually correct?**
  _`setupEventListeners()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `initSettingsModal()` (e.g. with `closeSettings()` and `openSettings()`) actually correct?**
  _`initSettingsModal()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `http`, `fs`, `path` to the rest of the system?**
  _50 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `settings.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12298387096774194 - nodes in this community are weakly interconnected._
- **Should `Design System: NySse Writer` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._