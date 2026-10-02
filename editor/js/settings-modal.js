/**
 * js/settings-modal.js - Управление интерфейсом модального окна настроек
 * 
 * Позволяет:
 * - Изменять все числовые пороги из рецензии
 * - Видеть допущение для коротких предложений (<=6) и формулу 3-грамм как read-only прокси
 * - Редактировать списки зачинов и сигнальных фраз
 * - Настраивать параметры A4 (поля, кегли, интервал)
 * - Сбрасывать настройки к эталонам рецензии одной кнопкой
 * - Экспортировать и импортировать настройки в формате JSON
 */

import { getSettings, saveSettings, resetToReviewDefaults, exportSettingsJSON, importSettingsJSON } from './settings.js';
import { showToast } from './editor.js';

let modalEl = null;

export function initSettingsModal() {
  modalEl = document.getElementById('settings-modal');
  const openBtn = document.getElementById('btn-open-settings');
  const closeBtn = document.getElementById('btn-close-settings');
  const resetBtn = document.getElementById('btn-reset-defaults');
  const saveBtn = document.getElementById('btn-save-settings');
  const exportBtn = document.getElementById('btn-export-settings');
  const importBtn = document.getElementById('btn-import-settings');
  const importFileInput = document.getElementById('settings-file-input');

  if (!modalEl) return;

  if (openBtn) {
    openBtn.addEventListener('click', openSettings);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeSettings);
  }

  // Закрытие по клику на оверлей или Esc
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeSettings();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalEl.classList.contains('visible')) {
      closeSettings();
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Сбросить все пороги и списки к исходным значениям из рецензии?')) {
        resetToReviewDefaults();
        loadSettingsIntoForm();
        showToast('Пороги сброшены к эталонам рецензии');
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      gatherAndSaveSettings();
      closeSettings();
      showToast('Настройки сохранены');
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const json = exportSettingsJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nysse_settings_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  if (importBtn && importFileInput) {
    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const res = importSettingsJSON(event.target.result);
        if (res.success) {
          loadSettingsIntoForm();
          showToast('Настройки успешно импортированы');
        } else {
          alert('Ошибка при чтении JSON: ' + res.error);
        }
        importFileInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  // Переключение вкладок внутри модального окна
  const tabs = modalEl.querySelectorAll('.settings-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const targetId = tab.getAttribute('data-target');
      modalEl.querySelectorAll('.settings-tab-content').forEach(c => c.classList.remove('active'));
      const activeContent = document.getElementById(targetId);
      if (activeContent) activeContent.classList.add('active');
    });
  });

  // Добавление новой сигнальной фразы
  const addPhraseBtn = document.getElementById('btn-add-signal-phrase');
  if (addPhraseBtn) {
    addPhraseBtn.addEventListener('click', () => {
      const phraseInput = document.getElementById('input-new-phrase');
      const severitySelect = document.getElementById('select-new-phrase-severity');
      const commentInput = document.getElementById('input-new-phrase-comment');
      const phrase = phraseInput.value.trim();

      if (!phrase) {
        alert('Введите фразу');
        return;
      }

      const settings = getSettings();
      settings.signalPhrases = settings.signalPhrases || [];
      settings.signalPhrases.push({
        phrase,
        severity: severitySelect.value,
        comment: commentInput.value.trim()
      });

      phraseInput.value = '';
      commentInput.value = '';
      renderSignalPhrasesList(settings.signalPhrases);
    });
  }
}

export function openSettings() {
  loadSettingsIntoForm();
  modalEl.classList.add('visible');
}

export function closeSettings() {
  modalEl.classList.remove('visible');
}

/**
 * Заполнение формы текущими значениями из settings.js
 */
function loadSettingsIntoForm() {
  const s = getSettings();

  // 1. Пороги таблицы рецензии
  setVal('set-avg-sent-human', s.avgSentenceLength.human);
  setVal('set-avg-sent-ai', s.avgSentenceLength.aiRed);

  setVal('set-long-sent-words', s.longSentenceRatio.thresholdWords);
  setVal('set-long-sent-human', s.longSentenceRatio.human);
  setVal('set-long-sent-ai', s.longSentenceRatio.aiRed);

  setVal('set-short-sent-words', s.shortSentenceRatio.thresholdWords);
  setVal('set-short-sent-human', s.shortSentenceRatio.human);
  setVal('set-short-sent-ai', s.shortSentenceRatio.aiRed);

  setVal('set-stopword-human', s.stopwordRatio.human);
  setVal('set-stopword-ai', s.stopwordRatio.aiRed);

  setVal('set-avg-word-human', s.avgWordLength.human);
  setVal('set-avg-word-ai', s.avgWordLength.aiRed);

  setVal('set-long-word-chars', s.longWordRatio.thresholdChars);
  setVal('set-long-word-human', s.longWordRatio.human);
  setVal('set-long-word-ai', s.longWordRatio.aiRed);

  setVal('set-3gram-human', s.threeGramRepetition.human);
  setVal('set-3gram-ai', s.threeGramRepetition.aiRed);

  // Дополнительные
  setVal('set-stddev-min', s.stdDevSentenceLength?.warningMin || 8.0);
  setVal('set-starter-max', s.starterUniformity?.warningMax || 20.0);
  setVal('set-warn-sent-words', s.highlight.warningWordCount || 30);
  setCheck('set-warn-sent-enabled', s.highlight.highlightWarningEnabled !== false);

  // Списки
  const startersText = (s.formulaicStarters || []).join('\n');
  setVal('textarea-formulaic-starters', startersText);

  renderSignalPhrasesList(s.signalPhrases || []);

  // Настройки страниц A4
  const p = s.pageEstimation || {};
  setVal('set-page-font', p.fontFamily || 'Times New Roman, serif');
  setVal('set-page-fontsize', p.fontSizePt || 14);
  setVal('set-page-table-fontsize', p.tableFontSizePt || 11);
  setVal('set-page-lineheight', p.lineHeight || 1.5);
  setVal('set-page-margin-top', p.marginTopMm || 20);
  setVal('set-page-margin-bottom', p.marginBottomMm || 20);
  setVal('set-page-margin-left', p.marginLeftMm || 20);
  setVal('set-page-margin-right', p.marginRightMm || 20);
  setVal('set-page-main-norm', p.charsPerA4MainNorm || 1800);
}

/**
 * Отрисовка списка пользовательских сигнальных фраз
 */
function renderSignalPhrasesList(phrases) {
  const container = document.getElementById('signal-phrases-list');
  if (!container) return;

  if (phrases.length === 0) {
    container.innerHTML = '<div class="empty-list-notice">Список пуст. Вы можете добавить фразы выше.</div>';
    return;
  }

  let html = '';
  phrases.forEach((item, idx) => {
    const isDanger = item.severity === 'danger';
    const tagClass = isDanger ? 'badge-danger' : 'badge-warning';
    const tagLabel = isDanger ? 'Красный' : 'Жёлтый';

    html += `
      <div class="signal-phrase-row">
        <div class="phrase-info">
          <span class="phrase-text">«${escapeHtml(item.phrase)}»</span>
          <span class="phrase-badge ${tagClass}">${tagLabel}</span>
          ${item.comment ? `<span class="phrase-comment">${escapeHtml(item.comment)}</span>` : ''}
        </div>
        <button class="btn-icon-danger btn-delete-phrase" data-index="${idx}" title="Удалить">✕</button>
      </div>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.btn-delete-phrase').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      const settings = getSettings();
      settings.signalPhrases.splice(idx, 1);
      renderSignalPhrasesList(settings.signalPhrases);
    });
  });
}

/**
 * Сбор настроек из формы и сохранение
 */
function gatherAndSaveSettings() {
  const s = getSettings();

  s.avgSentenceLength.human = parseFloat(getVal('set-avg-sent-human')) || 23.2;
  s.avgSentenceLength.aiRed = parseFloat(getVal('set-avg-sent-ai')) || 29.2;

  s.longSentenceRatio.thresholdWords = parseInt(getVal('set-long-sent-words'), 10) || 41;
  s.longSentenceRatio.human = parseFloat(getVal('set-long-sent-human')) || 6.2;
  s.longSentenceRatio.aiRed = parseFloat(getVal('set-long-sent-ai')) || 17.0;

  s.shortSentenceRatio.thresholdWords = parseInt(getVal('set-short-sent-words'), 10) || 6;
  s.shortSentenceRatio.human = parseFloat(getVal('set-short-sent-human')) || 5.8;
  s.shortSentenceRatio.aiRed = parseFloat(getVal('set-short-sent-ai')) || 2.4;

  s.stopwordRatio.human = parseFloat(getVal('set-stopword-human')) || 40.2;
  s.stopwordRatio.aiRed = parseFloat(getVal('set-stopword-ai')) || 33.0;

  s.avgWordLength.human = parseFloat(getVal('set-avg-word-human')) || 5.24;
  s.avgWordLength.aiRed = parseFloat(getVal('set-avg-word-ai')) || 5.86;

  s.longWordRatio.thresholdChars = parseInt(getVal('set-long-word-chars'), 10) || 8;
  s.longWordRatio.human = parseFloat(getVal('set-long-word-human')) || 23.1;
  s.longWordRatio.aiRed = parseFloat(getVal('set-long-word-ai')) || 30.7;

  s.threeGramRepetition.human = parseFloat(getVal('set-3gram-human')) || 3.5;
  s.threeGramRepetition.aiRed = parseFloat(getVal('set-3gram-ai')) || 1.4;

  s.stdDevSentenceLength = s.stdDevSentenceLength || {};
  s.stdDevSentenceLength.warningMin = parseFloat(getVal('set-stddev-min')) || 8.0;

  s.starterUniformity = s.starterUniformity || {};
  s.starterUniformity.warningMax = parseFloat(getVal('set-starter-max')) || 20.0;

  s.highlight.dangerWordCount = s.longSentenceRatio.thresholdWords;
  s.highlight.warningWordCount = parseInt(getVal('set-warn-sent-words'), 10) || 30;
  s.highlight.highlightWarningEnabled = getCheck('set-warn-sent-enabled');

  // Зачины
  const startersRaw = getVal('textarea-formulaic-starters');
  s.formulaicStarters = startersRaw
    .split('\n')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  // Страницы A4
  s.pageEstimation = s.pageEstimation || {};
  s.pageEstimation.fontFamily = getVal('set-page-font') || 'Times New Roman, serif';
  s.pageEstimation.fontSizePt = parseFloat(getVal('set-page-fontsize')) || 14;
  s.pageEstimation.tableFontSizePt = parseFloat(getVal('set-page-table-fontsize')) || 11;
  s.pageEstimation.lineHeight = parseFloat(getVal('set-page-lineheight')) || 1.5;
  s.pageEstimation.marginTopMm = parseFloat(getVal('set-page-margin-top')) || 20;
  s.pageEstimation.marginBottomMm = parseFloat(getVal('set-page-margin-bottom')) || 20;
  s.pageEstimation.marginLeftMm = parseFloat(getVal('set-page-margin-left')) || 20;
  s.pageEstimation.marginRightMm = parseFloat(getVal('set-page-margin-right')) || 20;
  s.pageEstimation.charsPerA4MainNorm = parseInt(getVal('set-page-main-norm'), 10) || 1800;

  saveSettings(s);
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function getCheck(id) {
  const el = document.getElementById(id);
  return el ? el.checked : false;
}

function setCheck(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = !!val;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
