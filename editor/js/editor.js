/**
 * js/editor.js - Главный контроллер редактора: ввод, зеркальная подсветка,
 * синхронизация скролла, попапы предложений, выезжающая панель, сохранение.
 */

import { getSettings, saveSettings, resetToReviewDefaults, onSettingsChange, exportSettingsJSON, importSettingsJSON } from './settings.js';
import { parseDocument } from './parse.js';
import { computeAllMetrics } from './metrics.js';
import { estimateA4Pages } from './pages.js';
import { gitRepo } from './repo.js';
import { initHistoryPanel, toggleHistoryPanel } from './history-panel.js';
import { initAiPanel, renderAiPanel, triggerAiAudit, setAuditTriggerHandler } from './ai-panel.js';

// Селекторы элементов DOM
let textareaEl = null;
let mirrorEl = null;
let editorContainerEl = null;
let sidebarEl = null;
let toggleSidebarBtn = null;
let popupEl = null;
let saveStatusBadge = null;

// Состояние
let currentParsedDoc = null;
let currentMetrics = null;
let currentA4Pages = null;
let debounceTimer = null;
let autoSaveTimer = null;
let activeSentenceIndex = null;
let activeFilter = 'all'; // 'all' | 'danger' | 'warning' | 'starters'

const DOC_STORAGE_KEY = 'nysse_editor_document_text_v1';
const SIDEBAR_STATE_KEY = 'nysse_editor_sidebar_collapsed_v1';

/**
 * Экранирование HTML символов для безопасного зеркального слоя
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Инициализация редактора
 */
export function initEditor() {
  textareaEl = document.getElementById('editor-textarea');
  mirrorEl = document.getElementById('editor-mirror');
  editorContainerEl = document.getElementById('editor-wrapper');
  sidebarEl = document.getElementById('sidebar-panel');
  toggleSidebarBtn = document.getElementById('btn-toggle-sidebar');
  popupEl = document.getElementById('sentence-popup');
  saveStatusBadge = document.getElementById('save-status');

  if (!textareaEl || !mirrorEl) {
    console.error('Не найдены обязательные элементы редактора');
    return;
  }

  // 1. Восстановление состояния боковой панели
  try {
    const isCollapsed = localStorage.getItem(SIDEBAR_STATE_KEY) === 'true';
    if (isCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    }
  } catch (e) {
    console.warn('Ошибка чтения состояния панели:', e);
  }

  // 2. Восстановление сохраненного текста документа из Git-репозитория или fallback
  let initialText = '';
  const headCommit = gitRepo.getHeadCommit();
  if (headCommit && typeof headCommit.content === 'string') {
    initialText = headCommit.content;
  } else {
    try {
      const savedText = localStorage.getItem(DOC_STORAGE_KEY);
      if (savedText !== null && savedText.trim().length > 0) {
        initialText = savedText;
      } else {
        // Стартовый демо-текст с примером таблицы и разными предложениями
        initialText = getDemoReviewText();
      }
    } catch (e) {
      initialText = getDemoReviewText();
    }
    gitRepo.initDefaultProject(initialText);
  }

  textareaEl.value = initialText;

  // Инициализация боковой панели истории (Git-дерево и вертикальный таймлайн)
  initHistoryPanel((newText) => {
    textareaEl.value = newText;
    recalculateAll(true);
    closePopup();
    const curHead = gitRepo.getHeadCommit();
    if (curHead) {
      setSaveStatus(`Ревизия [${curHead.id}]`, true);
    }
  });

  // Инициализация панели ИИ-анализа (Turnitin / GPTZero)
  const aiPanelEl = document.getElementById('ai-panel');
  if (aiPanelEl) {
    initAiPanel(aiPanelEl, {
      onApplyRewrite: (orig, rewrite) => {
        const text = textareaEl.value;
        const idx = text.indexOf(orig);
        if (idx === -1) return false;
        textareaEl.value = text.substring(0, idx) + rewrite + text.substring(idx + orig.length);
        recalculateAll(true);
        gitRepo.commit(textareaEl.value);
        const newHead = gitRepo.getHeadCommit();
        if (newHead) setSaveStatus(`ИИ-правка [${newHead.id}]`, true);
        return true;
      },
      onLocateSentence: (orig) => {
        const text = textareaEl.value;
        const idx = text.indexOf(orig);
        if (idx !== -1) {
          textareaEl.focus();
          textareaEl.setSelectionRange(idx, idx + orig.length);
          const linesBefore = text.substring(0, idx).split('\n').length;
          textareaEl.scrollTop = Math.max(0, (linesBefore - 4) * 28);
        }
      }
    });

    setAuditTriggerHandler(() => {
      triggerAiAudit(textareaEl.value, currentMetrics, currentParsedDoc);
    });
  }

  // 3. Навешивание слушателей событий
  setupEventListeners();

  // 4. Подписка на обновление настроек
  onSettingsChange(() => {
    recalculateAll(true);
  });

  // 5. Первичный расчет и подсветка
  recalculateAll(true);
  const initialHead = gitRepo.getHeadCommit();
  if (initialHead) {
    setSaveStatus(`Сохранено [${initialHead.id}]`, true);
  }
}

/**
 * Привязка всех событий ввода, скролла, кнопок и попапов
 */
function setupEventListeners() {
  // Ввод текста с быстрым дебаунсом для синтаксиса и 2-секундным порогом для автокоммита в Git
  textareaEl.addEventListener('input', () => {
    setSaveStatus('Ввод...', false);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      recalculateAll(false);
    }, 70);
    scheduleGitAutoSave();
  });

  // Синхронизация скролла и калибровки геометрии между textarea и зеркальным слоем
  const syncMirrorDimensions = () => {
    if (!textareaEl || !mirrorEl) return;
    const scrollbarWidth = textareaEl.offsetWidth - textareaEl.clientWidth;
    mirrorEl.style.paddingRight = `${48 + scrollbarWidth}px`;
  };

  const syncScroll = () => {
    syncMirrorDimensions();
    mirrorEl.scrollTop = textareaEl.scrollTop;
    mirrorEl.scrollLeft = textareaEl.scrollLeft;
    hidePopupIfScrolledOut();
  };
  textareaEl.addEventListener('scroll', syncScroll, { passive: true });

  // Клик в поле ввода: проверка, не попал ли курсор в предложение с ошибкой
  textareaEl.addEventListener('click', handleEditorClick);
  textareaEl.addEventListener('keyup', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      handleEditorCursorMove();
    }
  });

  // Переключение боковой панели
  if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener('click', () => {
      const isNowCollapsed = document.body.classList.toggle('sidebar-collapsed');
      try {
        localStorage.setItem(SIDEBAR_STATE_KEY, isNowCollapsed ? 'true' : 'false');
      } catch (e) {}
      // Синхронизируем скролл после анимации
      setTimeout(syncScroll, 250);
    });
  }

  // Клик вне попапа закрывает его
  document.addEventListener('click', (e) => {
    if (popupEl && !popupEl.contains(e.target) && e.target !== textareaEl && !e.target.closest('.issue-item')) {
      closePopup();
    }
  });

  // Кнопка закрытия в попапе
  const popupCloseBtn = document.getElementById('popup-close-btn');
  if (popupCloseBtn) {
    popupCloseBtn.addEventListener('click', closePopup);
  }

  // Фильтры списка нарушений в панели
  const filterTabs = document.querySelectorAll('.issue-filter-tab');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.getAttribute('data-filter') || 'all';
      renderIssueList();
    });
  });

  // Кнопки тулбара: Новый документ, Загрузить файл, Сохранить txt, Копировать
  const btnNew = document.getElementById('btn-new-doc');
  if (btnNew) {
    btnNew.addEventListener('click', () => {
      // 1. Автосохранение/коммит старого текста перед созданием нового
      gitRepo.commit(textareaEl.value);

      // 2. Создание новой ветки (каждый текст — отдельная ветка)
      const curProj = gitRepo.getActiveProject();
      const branchCount = Object.keys(curProj.branches).length + 1;
      const defaultName = `Текст ${branchCount}`;
      const branchName = prompt('Создать новый документ. Введите название ветки:', defaultName);

      if (branchName !== null) {
        gitRepo.createBranch(branchName, '');
        textareaEl.value = '';
        recalculateAll(true);
        closePopup();
        textareaEl.focus();
        setSaveStatus('Новый черновик', true);
        showToast(`Создан новый черновик в ветке "${branchName}". Предыдущий текст сохранён.`);
      }
    });
  }

  const btnOpen = document.getElementById('btn-open-file');
  const fileInput = document.getElementById('file-upload-input');
  if (btnOpen && fileInput) {
    btnOpen.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        textareaEl.value = event.target.result;
        recalculateAll(true);
        scheduleAutoSave();
        closePopup();
        fileInput.value = '';
      };
      reader.readAsText(file, 'UTF-8');
    });
  }

  const btnSaveTxt = document.getElementById('btn-save-txt');
  if (btnSaveTxt) {
    btnSaveTxt.addEventListener('click', exportPlainTextFile);
  }

  const btnCopy = document.getElementById('btn-copy-text');
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      navigator.clipboard.writeText(textareaEl.value).then(() => {
        showToast('Текст скопирован в буфер обмена');
      }).catch(err => {
        console.error('Ошибка копирования:', err);
      });
    });
  }

  // Экспорт полного архива сессии в формате .ny (все проекты, ветки, коммиты, текст)
  const btnExportNy = document.getElementById('btn-export-ny');
  if (btnExportNy) {
    btnExportNy.addEventListener('click', async () => {
      // Автокоммит актуального состояния перед выгрузкой
      gitRepo.commit(textareaEl.value);

      const bundle = {
        format: 'nysse-archive',
        version: 1,
        appName: 'NySse Writer',
        exportedAt: new Date().toISOString(),
        repository: gitRepo.state,
        settings: getSettings(),
        activeDocumentText: textareaEl.value
      };

      const jsonStr = JSON.stringify(bundle, null, 2);
      const dateSlug = new Date().toISOString().slice(0, 10);
      const defaultName = `nysse_session_${dateSlug}.ny`;

      // 1. Попытка использовать File System Access API (выбор папки и имени)
      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: defaultName,
            types: [{
              description: 'Архив сессии NySse (*.ny)',
              accept: { 'application/json': ['.ny'] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(jsonStr);
          await writable.close();
          showToast('Архив сессии (.ny) успешно сохранен в выбранную папку');
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
          console.warn('showSaveFilePicker fallback:', err);
        }
      }

      // 2. Fallback: стандартное скачивание браузером
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Архив сессии (.ny) сохранён в загрузки');
    });
  }

  // Импорт полного архива сессии из формата .ny
  const btnImportNy = document.getElementById('btn-import-ny');
  const nyFileInput = document.getElementById('ny-file-upload-input');

  const processNyImport = (rawText) => {
    try {
      const data = JSON.parse(rawText);
      const repoData = data.repository || (data.projects ? data : null);
      if (!repoData || !repoData.projects) {
        alert('Ошибка: Файл не содержит корректных данных сессии или репозитория NySse.');
        return;
      }

      if (confirm('Импортировать архив сессии (.ny)? Все текущие проекты, ветки и история будут заменены версиями из архива.')) {
        gitRepo.restoreArchive(repoData);
        if (data.settings) {
          saveSettings(data.settings);
        }
        const head = gitRepo.getHeadCommit();
        textareaEl.value = head ? head.content : (data.activeDocumentText || '');
        recalculateAll(true);
        closePopup();
        showToast('Архив сессии .ny успешно импортирован!');
      }
    } catch (err) {
      console.error('Ошибка импорта .ny:', err);
      alert('Не удалось прочитать файл архива: ' + err.message);
    }
  };

  if (btnImportNy) {
    btnImportNy.addEventListener('click', async () => {
      // 1. Попытка использовать File System Access API
      if (window.showOpenFilePicker) {
        try {
          const [handle] = await window.showOpenFilePicker({
            types: [{
              description: 'Архив сессии NySse (*.ny)',
              accept: { 'application/json': ['.ny', '.json'] }
            }],
            multiple: false
          });
          const file = await handle.getFile();
          const content = await file.text();
          processNyImport(content);
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
          console.warn('showOpenFilePicker fallback:', err);
        }
      }

      // 2. Fallback: клик по скрытому input type="file"
      if (nyFileInput) {
        nyFileInput.click();
      }
    });
  }

  if (nyFileInput) {
    nyFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        processNyImport(event.target.result);
        nyFileInput.value = '';
      };
      reader.readAsText(file, 'UTF-8');
    });
  }

  const btnDemo = document.getElementById('btn-load-demo');
  if (btnDemo) {
    btnDemo.addEventListener('click', () => {
      if (textareaEl.value.trim() && !confirm('Заменить текущий текст демонстрационным фрагментом из рецензии?')) {
        return;
      }
      textareaEl.value = getDemoReviewText();
      recalculateAll(true);
      scheduleAutoSave();
      closePopup();
    });
  }

  // Тактические вкладки DOCUMENT / ANALYSIS / HISTORY
  const tacticalTabs = document.querySelectorAll('.tactical-tabs .tab-item');
  tacticalTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.getAttribute('data-view');

      if (view === 'history') {
        const isNowOpen = toggleHistoryPanel();
        if (!isNowOpen) {
          // Если панель истории закрыта, переключаем активную вкладку на DOCUMENT
          const docTab = document.getElementById('tab-document');
          if (docTab) {
            tacticalTabs.forEach(t => {
              t.classList.remove('active');
              t.setAttribute('aria-selected', 'false');
            });
            docTab.classList.add('active');
            docTab.setAttribute('aria-selected', 'true');
          }
        }
        return;
      }

      tacticalTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      if (view === 'analysis') {
        document.body.classList.add('view-analysis');
        document.body.classList.remove('history-open');
        renderAiPanel();
      } else if (view === 'document') {
        document.body.classList.remove('view-analysis');
        toggleHistoryPanel(false);
        textareaEl.focus();
      }
    });
  });

  // Горячие клавиши в стиле NieR: W/S для скролла, Enter для деталей
  window.addEventListener('keydown', (e) => {
    if (document.activeElement === textareaEl || document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
      return;
    }
    if (e.key === 'w' || e.key === 'W') {
      textareaEl.scrollBy({ top: -120, behavior: 'smooth' });
    } else if (e.key === 's' || e.key === 'S') {
      textareaEl.scrollBy({ top: 120, behavior: 'smooth' });
    } else if (e.key === 'Enter') {
      const firstIssue = currentMetrics?.issueSentences?.[0];
      if (firstIssue) {
        scrollToSentenceAndOpenPopup(firstIssue.index);
      }
    }
  });

  // Синхронизация при изменении размера окна
  window.addEventListener('resize', syncScroll);
}

/**
 * Планирование автосохранения / коммита в Git-репозиторий (2 секунды после завершения ввода)
 */
function scheduleGitAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(DOC_STORAGE_KEY, textareaEl.value);
      const commit = gitRepo.commit(textareaEl.value);
      if (commit) {
        setSaveStatus(`Сохранено [${commit.id}]`, true);
      } else {
        setSaveStatus('Сохранено', true);
      }
    } catch (e) {
      console.warn('Ошибка автосохранения:', e);
      setSaveStatus('Ошибка памяти', false);
    }
  }, 2000); // 2-секундный порог после прекращения печати
}

function setSaveStatus(text, isSaved) {
  if (!saveStatusBadge) return;
  saveStatusBadge.textContent = text;
  saveStatusBadge.className = 'status-badge ' + (isSaved ? 'saved' : 'pending');
}

/**
 * Экспорт чистого текста без подсветки и тегов в .txt
 */
function exportPlainTextFile() {
  const text = textareaEl.value;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `draft_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Черновик выгружен в .txt без разметки');
}

/**
 * Полный пересчет синтаксиса, метрик, страниц и обновление зеркала
 */
export function recalculateAll(forceFullRender = false) {
  const text = textareaEl.value;
  const settings = getSettings();

  // 1. Синтаксический разбор
  currentParsedDoc = parseDocument(text, settings);

  // 2. Расчет метрик и светофоров
  currentMetrics = computeAllMetrics(currentParsedDoc, settings);

  // 3. Оценка объема страниц A4
  currentA4Pages = estimateA4Pages(currentParsedDoc, settings);

  // 4. Отрисовка зеркальной подсветки
  renderMirrorHighlights(text, currentParsedDoc);

  // 5. Обновление боковой панели
  renderSidebarStats(currentParsedDoc, currentMetrics, currentA4Pages);
  renderIssueList();
}

/**
 * Отрисовка зеркального слоя под прозрачным textarea
 * Зеркальный слой имеет точно такой же шрифт, размер, line-height и переносы.
 * Текст внутри color: transparent, а опасные предложения подсвечиваются фонами тегов <mark>.
 */
function renderMirrorHighlights(rawText, parsedDoc) {
  if (!rawText) {
    mirrorEl.innerHTML = '';
    return;
  }

  // Собираем все непересекающиеся диапазоны подсветки
  const spans = [];

  // Опасные и предупреждающие предложения
  for (const s of parsedDoc.sentences) {
    if (s.issues && s.issues.length > 0) {
      const isDanger = s.issues.some(i => i.severity === 'danger');
      spans.push({
        start: s.startOffset,
        end: s.endOffset,
        type: 'sentence',
        severity: isDanger ? 'danger' : 'warning',
        index: s.index
      });
    }
  }

  // Блоки таблиц
  for (let i = 0; i < parsedDoc.tables.length; i++) {
    const t = parsedDoc.tables[i];
    spans.push({
      start: t.startOffset,
      end: t.endOffset,
      type: 'table',
      severity: t.errors.length > 0 ? 'table-error' : 'table',
      index: i
    });
  }

  // Сортировка по начальному смещению
  spans.sort((a, b) => a.start - b.start);

  let html = '';
  let cursor = 0;

  for (const span of spans) {
    if (span.start > cursor) {
      html += escapeHtml(rawText.substring(cursor, span.start));
    }

    const chunk = rawText.substring(span.start, span.end);
    if (span.type === 'sentence') {
      const cls = span.severity === 'danger' ? 'hl-danger' : 'hl-warning';
      html += `<mark class="mirror-mark ${cls}" data-sentence-index="${span.index}">${escapeHtml(chunk)}</mark>`;
    } else if (span.type === 'table') {
      const cls = span.severity === 'table-error' ? 'hl-table-error' : 'hl-table';
      html += `<span class="mirror-table-box ${cls}" data-table-index="${span.index}">${escapeHtml(chunk)}</span>`;
    }

    cursor = Math.max(cursor, span.end);
  }

  if (cursor < rawText.length) {
    html += escapeHtml(rawText.substring(cursor));
  }

  // Коррекция последней пустой строки для pre-wrap, если текст кончается на \n
  if (rawText.endsWith('\n')) {
    html += '\n ';
  }

  // Распорный блок для компенсации выпадения padding-bottom из scrollHeight в overflow:hidden
  html += '<div class="mirror-bottom-spacer" aria-hidden="true"></div>';

  mirrorEl.innerHTML = html;

  // Синхронизация скролла
  mirrorEl.scrollTop = textareaEl.scrollTop;
  mirrorEl.scrollLeft = textareaEl.scrollLeft;
}

/**
 * Отрисовка счетчиков и метрик в боковой панели
 */
function renderSidebarStats(parsedDoc, metrics, a4Pages) {
  // 1. Верхние быстрые счетчики
  setText('stat-words-count', parsedDoc.totalWordsCount.toLocaleString('ru-RU'));
  setText('stat-chars-spaces', parsedDoc.charsWithSpaces.toLocaleString('ru-RU'));
  setText('stat-chars-nospaces', parsedDoc.charsNoSpaces.toLocaleString('ru-RU'));

  // 2. Страницы A4
  setText('a4-total-pages', a4Pages.formattedTotal);
  setText('a4-main-pages', `${a4Pages.mainPages} стр.`);
  setText('a4-table-pages', `${a4Pages.tablePages} стр.`);
  setText('a4-fractional', `+${a4Pages.fractionalPercent}% листа`);
  setText('a4-norm-fallback', `~${a4Pages.charNormPages} стр. (норматив 1800 зн.)`);

  // 3. Карточки 7 ключевых метрик
  const m = metrics.metrics;

  renderMetricCard('card-avg-sentence', m.avgSentenceLength);
  renderMetricCard('card-long-sentences', m.longSentenceRatio);
  renderMetricCard('card-short-sentences', m.shortSentenceRatio);
  renderMetricCard('card-stopwords', m.stopwordRatio);
  renderMetricCard('card-avg-word', m.avgWordLength);
  renderMetricCard('card-long-words', m.longWordRatio);
  renderMetricCard('card-three-grams', m.threeGramRepetition);

  // 4. Дополнительные метрики (SD и Зачины)
  setText('val-std-dev', metrics.extras.stdDev.formatted);
  const stdDevBadge = document.getElementById('badge-std-dev');
  if (stdDevBadge) {
    if (metrics.isLowData) {
      stdDevBadge.className = 'metric-status-badge status-low-data';
      stdDevBadge.textContent = '...';
    } else if (metrics.extras.stdDev.isWarning) {
      stdDevBadge.className = 'metric-status-badge status-yellow';
      stdDevBadge.textContent = '▲ ровно';
    } else {
      stdDevBadge.className = 'metric-status-badge status-green';
      stdDevBadge.textContent = '✓ ритм';
    }
  }

  setText('val-starter-uniformity', metrics.extras.starterUniformity.formatted);
  const starterBadge = document.getElementById('badge-starter-uniformity');
  if (starterBadge) {
    if (metrics.isLowData) {
      starterBadge.className = 'metric-status-badge status-low-data';
      starterBadge.textContent = '...';
    } else if (metrics.extras.starterUniformity.isWarning) {
      starterBadge.className = 'metric-status-badge status-yellow';
      starterBadge.textContent = '▲ повтор';
    } else {
      starterBadge.className = 'metric-status-badge status-green';
      starterBadge.textContent = '✓ норма';
    }
  }

  // 5. Блок глобальных дефицитов текста (то, что нельзя повесить на одно предложение)
  renderGlobalDeficits(metrics.globalDeficits, metrics.isLowData);
}

/**
 * Отрисовка отдельной карточки метрики со светофором
 */
function renderMetricCard(cardId, data) {
  const cardEl = document.getElementById(cardId);
  if (!cardEl) return;

  const valEl = cardEl.querySelector('.metric-current-val');
  const badgeEl = cardEl.querySelector('.metric-status-badge');
  const targetHumanEl = cardEl.querySelector('.metric-target-human');
  const targetAiEl = cardEl.querySelector('.metric-target-ai');
  const noteEl = cardEl.querySelector('.metric-note');

  if (valEl) valEl.textContent = data.formatted;
  if (targetHumanEl) targetHumanEl.textContent = data.human;
  if (targetAiEl) targetAiEl.textContent = data.aiRed;
  if (noteEl && data.note) noteEl.textContent = data.note;

  if (badgeEl) {
    badgeEl.className = `metric-status-badge ${data.colorClass}`;
    badgeEl.textContent = data.badge;
    badgeEl.title = data.label;
  }

  // Класс подсветки самой карточки
  cardEl.classList.remove('card-green', 'card-yellow', 'card-red', 'card-low-data');
  cardEl.classList.add(`card-${data.status}`);

  // Отрисовка тактического сегментированного индикатора
  const segmentsContainer = cardEl.querySelector('.metric-segments');
  if (segmentsContainer) {
    const segs = segmentsContainer.querySelectorAll('.seg');
    segs.forEach(s => {
      s.className = 'seg';
    });

    if (data.status !== 'low_data') {
      let activeCount = 4;
      if (data.status === 'green') activeCount = 3;
      else if (data.status === 'yellow') activeCount = 6;
      else if (data.status === 'red') activeCount = 9;

      const activeColorClass = `active-${data.status}`;
      for (let i = 0; i < Math.min(segs.length, activeCount); i++) {
        segs[i].classList.add(activeColorClass);
      }
    }
  }
}

/**
 * Отрисовка блока глобальных дефицитов
 */
function renderGlobalDeficits(deficits, isLowData) {
  const container = document.getElementById('global-deficits-container');
  if (!container) return;

  if (isLowData) {
    container.innerHTML = `
      <div class="low-data-notice">
        <span class="notice-icon">ℹ</span>
        <span>Мало текста для надежного анализа (нужно от 100 слов и 5 предложений). Доли и светофор пока не красятся.</span>
      </div>
    `;
    return;
  }

  if (!deficits || deficits.length === 0) {
    container.innerHTML = `
      <div class="deficits-clean-notice">
        <span class="notice-icon">✓</span>
        <span>Глобальных аномалий распределения не обнаружено: ритм, служебные слова и триграммы в человеческом диапазоне.</span>
      </div>
    `;
    return;
  }

  let html = '<div class="deficits-list">';
  for (const item of deficits) {
    const sevClass = item.severity === 'danger' ? 'deficit-danger' : 'deficit-warning';
    const icon = item.severity === 'danger' ? '!' : '▲';
    html += `
      <div class="deficit-item ${sevClass}">
        <div class="deficit-header">
          <span class="deficit-badge">${icon}</span>
          <strong class="deficit-title">${escapeHtml(item.title)}</strong>
        </div>
        <div class="deficit-body">${escapeHtml(item.text)}</div>
      </div>
    `;
  }
  html += '</div>';
  container.innerHTML = html;
}

/**
 * Отрисовка списка предложений, нарушающих правила
 */
function renderIssueList() {
  const listEl = document.getElementById('issues-list-container');
  const countBadge = document.getElementById('issues-total-count');
  if (!listEl) return;

  const issueSentences = currentMetrics?.issueSentences || [];

  if (countBadge) {
    countBadge.textContent = issueSentences.length;
  }

  if (issueSentences.length === 0) {
    listEl.innerHTML = `
      <div class="issues-empty">
        <span>Предложений с локальными нарушениями не найдено.</span>
      </div>
    `;
    return;
  }

  // Фильтрация
  const filtered = issueSentences.filter(item => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'danger') return item.maxSeverity === 'danger';
    if (activeFilter === 'warning') return item.maxSeverity === 'warning';
    if (activeFilter === 'starters') return item.issues.some(i => i.type === 'formulaic_starter');
    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="issues-empty">
        <span>Нет замечаний в выбранной категории.</span>
      </div>
    `;
    return;
  }

  let html = '';
  for (const item of filtered) {
    const sevClass = item.maxSeverity === 'danger' ? 'issue-danger' : 'issue-warning';
    const primaryIssue = item.issues[0]?.message || 'Замечание по структуре';
    const preview = item.cleanText.length > 95 ? item.cleanText.substring(0, 95) + '…' : item.cleanText;

    html += `
      <div class="issue-item ${sevClass}" data-sentence-index="${item.index}">
        <div class="issue-item-top">
          <span class="issue-word-badge">${item.wordCount} сл.</span>
          <span class="issue-reason">${escapeHtml(primaryIssue)}</span>
        </div>
        <div class="issue-preview">${escapeHtml(preview)}</div>
      </div>
    `;
  }

  listEl.innerHTML = html;

  // Привязка клика для перехода к предложению
  listEl.querySelectorAll('.issue-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.getAttribute('data-sentence-index'), 10);
      scrollToSentenceAndOpenPopup(idx);
    });
  });
}

/**
 * Прокрутка к предложению, выделение и открытие попапа
 */
export function scrollToSentenceAndOpenPopup(sentenceIndex) {
  if (!currentParsedDoc || !currentParsedDoc.sentences[sentenceIndex]) return;

  const sentence = currentParsedDoc.sentences[sentenceIndex];
  activeSentenceIndex = sentenceIndex;

  // Ставим выделение в textarea
  textareaEl.focus();
  textareaEl.setSelectionRange(sentence.startOffset, sentence.endOffset);

  // Находим соответствующий mark элемент в зеркальном слое для точных координат
  const markEl = mirrorEl.querySelector(`mark[data-sentence-index="${sentenceIndex}"]`);
  if (markEl) {
    // Вычисляем целевой скролл: центрируем предложение в окне textarea
    const targetScrollTop = Math.max(0, markEl.offsetTop - (textareaEl.clientHeight / 2) + 40);
    textareaEl.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth'
    });

    // Открываем попап рядом с предложением
    setTimeout(() => {
      positionAndShowPopup(sentence, markEl);
    }, 150);
  } else {
    // Если у предложения нет собственного mark (например, обычное предложение),
    // все равно показываем инспектор
    openInspectorForSentence(sentence);
  }
}

/**
 * Позиционирование и отображение всплывающего попапа с проверяемыми фактами
 */
function positionAndShowPopup(sentence, markEl) {
  if (!popupEl) return;

  const rect = markEl.getBoundingClientRect();
  const wrapperRect = editorContainerEl.getBoundingClientRect();

  // Заполняем фактами
  fillPopupContent(sentence);

  // Координаты относительно контейнера редактора
  const top = rect.bottom - wrapperRect.top + textareaEl.scrollTop + 6;
  const left = Math.min(
    Math.max(16, rect.left - wrapperRect.left),
    wrapperRect.width - 340
  );

  popupEl.style.top = `${top}px`;
  popupEl.style.left = `${left}px`;
  popupEl.classList.add('visible');
}

/**
 * Заполнение содержимого попапа ТОЛЬКО проверяемыми фактами
 * Никаких фраз «здесь тон ИИ»!
 */
function fillPopupContent(sentence) {
  const titleEl = document.getElementById('popup-title');
  const factsListEl = document.getElementById('popup-facts-list');
  const copyBtn = document.getElementById('popup-copy-btn');

  if (titleEl) {
    titleEl.textContent = `Предложение #${sentence.index + 1} (${sentence.wordCount} слов)`;
  }

  if (factsListEl) {
    let factsHtml = '';

    // Факт 1: Длина предложения
    const settings = getSettings();
    const dangerTh = settings.highlight.dangerWordCount || 41;
    if (sentence.wordCount >= dangerTh) {
      factsHtml += `<li class="fact-danger"><strong>${sentence.wordCount} слов:</strong> превышает красную границу очень длинного (${dangerTh} слов).</li>`;
    } else if (sentence.wordCount >= (settings.highlight.warningWordCount || 30)) {
      factsHtml += `<li class="fact-warning"><strong>${sentence.wordCount} слов:</strong> приближается к границе 41 слова.</li>`;
    } else {
      factsHtml += `<li class="fact-normal">Длина: ${sentence.wordCount} слов.</li>`;
    }

    // Факт 2: Нарушения из списка
    if (sentence.issues) {
      for (const issue of sentence.issues) {
        if (issue.type === 'formulaic_starter') {
          factsHtml += `<li class="fact-warning">${escapeHtml(issue.message)}.</li>`;
        } else if (issue.type === 'signal_phrase') {
          const cls = issue.severity === 'danger' ? 'fact-danger' : 'fact-warning';
          factsHtml += `<li class="${cls}">${escapeHtml(issue.message)}.</li>`;
        }
      }
    }

    // Факт 3: Длинные слова внутри предложения
    if (sentence.highWordLengthNote) {
      factsHtml += `<li class="fact-info">${escapeHtml(sentence.highWordLengthNote)}</li>`;
    }

    factsListEl.innerHTML = factsHtml;
  }

  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(sentence.cleanText).then(() => {
        showToast('Предложение скопировано');
      });
    };
  }
}

function closePopup() {
  if (popupEl) {
    popupEl.classList.remove('visible');
  }
  activeSentenceIndex = null;
}

function hidePopupIfScrolledOut() {
  // При быстром скролле можно закрывать попап или двигать его
  // Закрываем, если позиция ушла
  if (popupEl && popupEl.classList.contains('visible')) {
    closePopup();
  }
}

/**
 * Обработка клика мыши в textarea для вызова фактов о предложении
 */
function handleEditorClick(e) {
  const offset = textareaEl.selectionStart;
  checkSentenceAtOffset(offset);
}

function handleEditorCursorMove() {
  const offset = textareaEl.selectionStart;
  checkSentenceAtOffset(offset);
}

function checkSentenceAtOffset(offset) {
  if (!currentParsedDoc || !currentParsedDoc.sentences) return;

  const foundSentence = currentParsedDoc.sentences.find(s => offset >= s.startOffset && offset <= s.endOffset);
  if (foundSentence && foundSentence.issues && foundSentence.issues.length > 0) {
    const markEl = mirrorEl.querySelector(`mark[data-sentence-index="${foundSentence.index}"]`);
    if (markEl) {
      positionAndShowPopup(foundSentence, markEl);
    }
  } else {
    closePopup();
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * Всплывающее короткое уведомление (Toast)
 */
export function showToast(message, duration = 2500) {
  let toastEl = document.getElementById('app-toast');
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'app-toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  toastEl.classList.add('visible');
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => {
    toastEl.classList.remove('visible');
  }, duration);
}

/**
 * Пример текста, иллюстрирующий пороги из рецензии:
 * - длинное предложение (44 слова) -> красится красным
 * - зачин «Таким образом» -> красится желтым
 * - короткое предложение (6 слов) -> иллюстрирует допущение
 * - таблица :::table ... ::: -> 11 pt
 */
function getDemoReviewText() {
  return `Развитие речевых интерфейсов на основе современных нейросетевых моделей требует непрерывной оптимизации как акустического тракта, так и семантического анализатора для достижения максимально естественного и плавного взаимодействия с пользователем в режиме реального времени.

Однако существующие подходы к синтезу речи по-прежнему сталкиваются с заметными задержками при формировании развернутых ответов в диалоговых сценариях высокой сложности.

Но у такого формата есть очевидный изъян.

Таким образом, последовательное применение сквозных архитектур позволяет сократить общее время отклика системы на четверть, обеспечивая синхронную передачу акустических параметров непосредственно в звуковой тракт без промежуточного преобразования в текстовые токены и обратно, что кардинально повышает естественность восприятия диалога человеком при сохранении высокой эмоциональной выразительности речи.

:::table
Архитектура | Время отклика (мс) | Оценка качества MOS
Классический каскад ASR-LLM-TTS | 840 | 3.82
Сквозной Speech-to-Speech | 215 | 4.35
:::

В заключение стоит подчеркнуть, что баланс между вариативностью синтаксических конструкций и строгостью академического стиля является ключевым условием подготовки качественного научно-технического материала.`;
}
