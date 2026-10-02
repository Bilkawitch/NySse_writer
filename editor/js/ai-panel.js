/**
 * js/ai-panel.js - Интерактивная консоль ИИ-анализа текста (Turnitin / GPTZero)
 * 
 * Отображает:
 * 1. Индикатор риска детекции (0-100%, 10-сегментная шкала)
 * 2. Разбор структуры ритма абзацев (Method 1: Beat Pattern)
 * 3. Тактические интерактивные карточки нарушений с кнопкой мгновенной замены [ Применить замену ]
 * 4. Управление и проверка подключения к кастомному ИИ-провайдеру
 */

import { getSettings } from './settings.js?v=2.2.1';
import { runAiSemanticAudit, AI_PRESETS } from './ai-provider.js?v=2.2.1';
import { openSettings } from './settings-modal.js?v=2.2.1';
import { showToast } from './editor.js?v=2.2.1';

let panelEl = null;
let currentAuditResult = null;
let onApplyRewriteCallback = null;
let onLocateSentenceCallback = null;
let isAuditing = false;

export function initAiPanel(containerEl, { onApplyRewrite, onLocateSentence }) {
  panelEl = containerEl;
  onApplyRewriteCallback = onApplyRewrite;
  onLocateSentenceCallback = onLocateSentence;

  renderAiPanel();
}

/**
 * Отрисовка текущего состояния панели ИИ-анализа
 */
export function renderAiPanel() {
  if (!panelEl) return;

  const settings = getSettings();
  const cfg = settings.aiConfig || {};
  const hasKey = !!cfg.apiKey || cfg.provider === 'ollama';

  const providerName = AI_PRESETS[cfg.provider]?.name || cfg.provider || 'OpenRouter';
  const modelName = cfg.model || 'deepseek/deepseek-chat';

  panelEl.innerHTML = `
    <div class="ai-panel-header">
      <div class="ai-panel-title-row">
        <span class="ai-panel-title">◇ —— ИИ АУДИТ (TURNITIN / GPTZERO) —— ◇</span>
        <button id="btn-ai-settings-shortcut" class="btn btn-tactical btn-xs" title="Настройки ИИ-провайдера">⚙ Настроить</button>
      </div>
      <div class="ai-model-badge-row">
        <span class="ai-model-badge" title="Активная модель">${escapeHtml(providerName)}: <strong>${escapeHtml(modelName)}</strong></span>
        ${!hasKey ? '<span class="ai-key-warning">[! Нет ключа]</span>' : '<span class="ai-key-ok">[✓ Готов]</span>'}
      </div>
    </div>

    <div class="ai-panel-actions-bar">
      <button id="btn-run-ai-audit" class="btn btn-tactical-accent btn-sm btn-run-audit" ${isAuditing ? 'disabled' : ''}>
        ${isAuditing ? '<span class="spinner-inline"></span> СКАНИРОВАНИЕ...' : '▶ ЗАПУСТИТЬ АУДИТ'}
      </button>
    </div>

    <div class="ai-panel-body" id="ai-panel-body">
      ${renderPanelContent(hasKey)}
    </div>
  `;

  // Навешивание обработчиков
  const shortcutBtn = panelEl.querySelector('#btn-ai-settings-shortcut');
  if (shortcutBtn) {
    shortcutBtn.addEventListener('click', () => {
      openSettings();
      // Переключаем на вкладку tab-ai
      const aiTabBtn = document.querySelector('.settings-tab-btn[data-target="tab-ai"]');
      if (aiTabBtn) aiTabBtn.click();
    });
  }

  const runBtn = panelEl.querySelector('#btn-run-ai-audit');
  if (runBtn) {
    runBtn.addEventListener('click', handleTriggerAudit);
  }

  attachResultInteractions();
}

function renderPanelContent(hasKey) {
  if (isAuditing) {
    return `
      <div class="ai-scanning-state">
        <div class="ai-scan-radar">
          <div class="scan-line"></div>
        </div>
        <div class="ai-scan-title">АНАЛИЗ СЕМАНТИЧЕСКИХ СИГНАТУР ИИ</div>
        <div class="ai-scan-sub">Проверка 7 критериев Turnitin / GPTZero: ритм абзацев, монотонность 15–25 слов, шаблонные связки, абстракции...</div>
        <div class="ai-scan-segments">
          <span class="seg active-yellow"></span><span class="seg active-yellow"></span><span class="seg active-yellow"></span>
          <span class="seg active-yellow"></span><span class="seg"></span><span class="seg"></span><span class="seg"></span>
        </div>
      </div>
    `;
  }

  if (!hasKey) {
    return `
      <div class="ai-empty-state">
        <div class="ai-empty-icon">⚠</div>
        <div class="ai-empty-title">ИИ-провайдер не настроен</div>
        <p class="ai-empty-desc">
          Для запуска семантического анализа Turnitin/GPTZero укажите API-ключ в настройках.
        </p>
        <button id="btn-open-ai-setup" class="btn btn-tactical btn-sm" style="margin-top: 10px;">
          ⚙ Открыть настройки ИИ
        </button>
        <div class="ai-privacy-note">
          🔒 <strong>Приватность:</strong> Ключи хранятся исключительно в LocalStorage вашего браузера. Запросы отправляются напрямую на выбранный шлюз (OpenRouter, DeepSeek, Groq, Ollama) без промежуточных серверов.
        </div>
      </div>
    `;
  }

  if (!currentAuditResult) {
    return `
      <div class="ai-ready-state">
        <div class="ai-methods-checklist">
          <div class="method-check-title">ГОТОВЫ К ПРОВЕРКЕ 7 СЕМАНТИЧЕСКИХ МЕТОДОВ:</div>
          <div class="method-item"><span class="m-num">1</span> Ритм и длина абзацев (Method 1: Paragraph-Length Pattern)</div>
          <div class="method-item"><span class="m-num">2</span> Вариативность длины предложений (Method 2: Sentence Variance / Burstiness)</div>
          <div class="method-item"><span class="m-num">3</span> Замена шаблонных связок (Method 3: Moreover / In addition / Таким образом)</div>
          <div class="method-item"><span class="m-num">4</span> Авторская субъектность (Method 4: First-person Voice)</div>
          <div class="method-item"><span class="m-num">5</span> Предметная конкретика (Method 5: Ungoogleable Specifics)</div>
          <div class="method-item"><span class="m-num">6</span> Вычитка естественности (Method 6: Read Aloud Awkwardness)</div>
          <div class="method-item"><span class="m-num">7</span> Структурное очеловечивание формулировок с заменой в 1 клик</div>
        </div>
        <div class="ai-ready-prompt">Нажмите <strong>[ ▶ ЗАПУСТИТЬ АУДИТ ]</strong> выше для старта анализа.</div>
      </div>
    `;
  }

  return renderAuditResultsHtml(currentAuditResult);
}

function renderAuditResultsHtml(res) {
  const risk = res.overallAiRisk || 'medium';
  const percent = res.riskPercent ?? 50;

  let riskColorClass = 'risk-yellow';
  let riskLabel = 'СРЕДНИЙ РИСК ДЕТЕКЦИИ';
  if (risk === 'high' || percent >= 70) {
    riskColorClass = 'risk-red';
    riskLabel = 'ВЫСОКИЙ РИСК ДЕТЕКЦИИ ИИ';
  } else if (risk === 'low' || percent < 40) {
    riskColorClass = 'risk-green';
    riskLabel = 'НИЗКИЙ РИСК (ЕСТЕСТВЕННЫЙ ТЕКСТ)';
  }

  // 10 сегментов для полосы риска
  const filledSegments = Math.round((percent / 100) * 10);
  const segmentsHtml = Array.from({ length: 10 }).map((_, i) => {
    const isFilled = i < filledSegments;
    const segClass = isFilled ? (percent >= 70 ? 'active-red' : percent >= 40 ? 'active-yellow' : 'active-green') : '';
    return `<span class="seg ${segClass}"></span>`;
  }).join('');

  // Заметки по ритму абзацев
  let beatsHtml = '';
  if (res.paragraphBeatNotes && res.paragraphBeatNotes.length > 0) {
    const beatsItems = res.paragraphBeatNotes.map(b => `
      <div class="beat-item ${b.isMonotonous ? 'beat-monotonous' : ''}">
        <div class="beat-header">
          <span class="beat-index">Абзац #${b.paragraphIndex}</span>
          ${b.isMonotonous ? '<span class="beat-flag">! Монотонный паттерн</span>' : '<span class="beat-ok">✓ Живой ритм</span>'}
        </div>
        <div class="beat-pattern">Схема: <em>${escapeHtml(b.pattern || '—')}</em></div>
        ${b.advice ? `<div class="beat-advice">${escapeHtml(b.advice)}</div>` : ''}
      </div>
    `).join('');

    beatsHtml = `
      <div class="ai-section beats-section">
        <div class="ai-section-title">◇ РИТМ И СТРУКТУРА АБЗАЦЕВ (METHOD 1) ◇</div>
        <div class="beats-list">${beatsItems}</div>
      </div>
    `;
  }

  // Карточки замечаний
  let issuesHtml = '';
  const issues = res.issues || [];
  if (issues.length === 0) {
    issuesHtml = '<div class="ai-no-issues">Критических семантических маркеров ИИ не обнаружено. Текст звучит естественно.</div>';
  } else {
    const cards = issues.map((iss, idx) => {
      const isDanger = iss.severity === 'danger';
      const catLabel = getCategoryLabel(iss.category);

      return `
        <div class="ai-issue-card ${isDanger ? 'border-danger' : 'border-warning'}" data-index="${idx}">
          <div class="issue-card-top">
            <span class="issue-category-tag">${escapeHtml(catLabel)}</span>
            <span class="issue-severity-tag ${isDanger ? 'sev-danger' : 'sev-warning'}">
              ${isDanger ? '! КРИТИЧНО' : '▲ ВНИМАНИЕ'}
            </span>
          </div>

          <div class="issue-quote-box" title="Нажмите, чтобы найти предложение в редакторе">
            <span class="quote-marker">«</span>
            <span class="quote-text">${escapeHtml(iss.originalSentence || '')}</span>
            <span class="quote-marker">»</span>
          </div>

          <div class="issue-flaw-row">
            <span class="flaw-label">Проблема:</span>
            <span class="flaw-text">${escapeHtml(iss.flaw || '')}</span>
          </div>

          ${iss.suggestedRewrite ? `
            <div class="issue-rewrite-box">
              <div class="rewrite-label">Предлагаемый авторский вариант:</div>
              <div class="rewrite-content">${escapeHtml(iss.suggestedRewrite)}</div>
              ${iss.benefit ? `<div class="rewrite-benefit">✓ ${escapeHtml(iss.benefit)}</div>` : ''}
              <button class="btn btn-tactical-accent btn-xs btn-apply-rewrite" data-index="${idx}">
                ➔ ПРИМЕНИТЬ ЗАМЕНУ
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    issuesHtml = `
      <div class="ai-section issues-section">
        <div class="ai-section-title">◇ НАЙДЕННЫЕ СИГНАТУРЫ И ПРЕДЛОЖЕНИЯ ПО УЛУЧШЕНИЮ (${issues.length}) ◇</div>
        <div class="issues-cards-list">${cards}</div>
      </div>
    `;
  }

  return `
    <div class="ai-results-container">
      <!-- Блок оценки риска -->
      <div class="ai-risk-card ${riskColorClass}">
        <div class="risk-card-header">
          <span class="risk-label">${riskLabel}</span>
          <span class="risk-score">${percent}%</span>
        </div>
        <div class="risk-segments-bar">
          ${segmentsHtml}
        </div>
        <div class="risk-summary-text">
          ${escapeHtml(res.summary || '')}
        </div>
      </div>

      ${beatsHtml}
      ${issuesHtml}
    </div>
  `;
}

function getCategoryLabel(cat) {
  switch (cat) {
    case 'formulaic_transition': return 'ШАБЛОННАЯ СВЯЗКА (Method 3)';
    case 'monotonous_rhythm': return 'МОНОТОННЫЙ РИТМ (Method 2)';
    case 'abstract_vagueness': return 'АБСТРАКЦИЯ (Method 5)';
    case 'awkward_phrasing': return 'ТЯЖЕЛЫЙ СИНТАКСИС (Method 6)';
    case 'first_person_absence': return 'АВТОРСКИЙ ГОЛОС (Method 4)';
    default: return 'СЕМАНТИЧЕСКИЙ МАРКЕР';
  }
}

function attachResultInteractions() {
  if (!panelEl) return;

  const openSetupBtn = panelEl.querySelector('#btn-open-ai-setup');
  if (openSetupBtn) {
    openSetupBtn.addEventListener('click', () => {
      openSettings();
      const aiTabBtn = document.querySelector('.settings-tab-btn[data-target="tab-ai"]');
      if (aiTabBtn) aiTabBtn.click();
    });
  }

  // Клики по цитате предложения: прокрутка и фокус
  panelEl.querySelectorAll('.issue-quote-box').forEach(box => {
    box.addEventListener('click', () => {
      const card = box.closest('.ai-issue-card');
      const idx = parseInt(card.getAttribute('data-index'), 10);
      const issue = currentAuditResult?.issues?.[idx];
      if (issue && onLocateSentenceCallback) {
        onLocateSentenceCallback(issue.originalSentence);
      }
    });
  });

  // Клик по кнопке [ Применить замену ]
  panelEl.querySelectorAll('.btn-apply-rewrite').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      const issue = currentAuditResult?.issues?.[idx];
      if (!issue) return;

      if (onApplyRewriteCallback) {
        const success = onApplyRewriteCallback(issue.originalSentence, issue.suggestedRewrite);
        if (success) {
          btn.textContent = '✓ ПРИМЕНЕНО';
          btn.disabled = true;
          btn.classList.remove('btn-tactical-accent');
          btn.classList.add('btn-tactical');
          btn.style.opacity = '0.7';
          showToast('Замена применена и зафиксирована в Git');
        } else {
          showToast('Не удалось найти исходное предложение (возможно, текст был изменен)');
        }
      }
    });
  });
}

/**
 * Запуск ИИ аудита
 */
export async function triggerAiAudit(rawText, metricsSummary, parsedDoc) {
  if (isAuditing) return;
  if (!rawText || rawText.trim().length === 0) {
    showToast('Введите текст для аудита');
    return;
  }

  isAuditing = true;
  renderAiPanel();

  try {
    currentAuditResult = await runAiSemanticAudit(rawText, metricsSummary, parsedDoc);
    isAuditing = false;
    renderAiPanel();
    showToast('ИИ-аудит успешно завершен');
  } catch (err) {
    isAuditing = false;
    renderAiPanel();
    alert('Ошибка ИИ-анализа: ' + err.message);
  }
}

let triggerAuditExternalHandler = null;
export function setAuditTriggerHandler(handler) {
  triggerAuditExternalHandler = handler;
}

function handleTriggerAudit() {
  if (triggerAuditExternalHandler) {
    triggerAuditExternalHandler();
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
