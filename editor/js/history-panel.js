/**
 * js/history-panel.js - Контроллер боковой панели истории (Git-дерево и вертикальный таймлайн коммитов)
 * Стиль: NieR / Military Terminal (0px radius, тактическая разметка, монохромные SVG)
 */

import { gitRepo } from './repo.js';

let historyPanelEl = null;
let onTextChangeCallback = null;

/**
 * Инициализация панели истории
 */
export function initHistoryPanel(onTextChange) {
  historyPanelEl = document.getElementById('history-panel');
  onTextChangeCallback = onTextChange;

  if (!historyPanelEl) {
    console.error('Не найден элемент #history-panel');
    return;
  }

  // Подписка на обновление данных репозитория
  gitRepo.subscribe(() => {
    renderHistoryPanel();
  });

  // Первичный рендер
  renderHistoryPanel();
}

/**
 * Открытие / закрытие панели истории
 */
export function toggleHistoryPanel(forceOpen = null) {
  const isOpen = forceOpen !== null ? forceOpen : !document.body.classList.contains('history-open');
  if (isOpen) {
    document.body.classList.add('history-open');
    renderHistoryPanel();
  } else {
    document.body.classList.remove('history-open');
  }

  // Обновляем состояние вкладки HISTORY
  const historyTab = document.getElementById('tab-history');
  if (historyTab) {
    historyTab.setAttribute('aria-selected', isOpen ? 'true' : 'false');
    if (isOpen) {
      document.querySelectorAll('.tactical-tabs .tab-item').forEach(t => t.classList.remove('active'));
      historyTab.classList.add('active');
    }
  }

  return isOpen;
}

/**
 * Отрисовка всей панели истории
 */
export function renderHistoryPanel() {
  if (!historyPanelEl) return;

  const proj = gitRepo.getActiveProject();
  if (!proj) return;

  const branch = gitRepo.getActiveBranch();
  const commits = gitRepo.getBranchHistory();
  const allProjects = Object.values(gitRepo.state.projects);

  historyPanelEl.innerHTML = `
    <!-- Заголовок панели истории -->
    <div class="hist-header">
      <div class="hist-header-title">
        <span class="hist-status-dot">■</span>
        <span>РЕПОЗИТОРИЙ И ВЕРСИИ</span>
      </div>
      <button id="hist-close-btn" class="btn-icon-btn" aria-label="Закрыть панель истории" title="Закрыть историю">
        <svg class="btn-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square">
          <path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>
        </svg>
      </button>
    </div>

    <!-- Быстрое создание новой версии вручную -->
    <div class="hist-commit-box">
      <input type="text" id="hist-commit-input" class="hist-commit-input" placeholder="Имя точки сохранения..." maxlength="60">
      <button id="hist-commit-btn" class="btn btn-tactical btn-xs" title="Создать коммит сейчас">
        <span>Коммит</span>
      </button>
    </div>

    <!-- Секция 1: Древо проектов и веток -->
    <div class="hist-section hist-tree-section">
      <div class="hist-section-title">
        <span>ПРОЕКТЫ И ВЕТКИ (ТЕКСТЫ)</span>
        <button id="hist-new-branch-btn" class="btn-xs-link" title="Создать новую ветку в проекте">+ Ветка</button>
      </div>

      <div class="hist-projects-tree">
        ${renderProjectsTreeHtml(allProjects, proj, branch)}
      </div>
    </div>

    <!-- Секция 2: Вертикальный граф коммитов активной ветки (IDE Style) -->
    <div class="hist-section hist-commits-section">
      <div class="hist-section-title">
        <span>ВЕРСИИ: <strong class="hist-branch-name">${escapeHtml(branch ? branch.name : '—')}</strong></span>
        <span class="hist-commit-count">${commits.length} ревизий</span>
      </div>

      <div class="hist-timeline-container">
        ${renderTimelineHtml(commits, branch ? branch.headCommitId : null)}
      </div>
    </div>
  `;

  attachEventListeners();
}

/**
 * Рендер HTML дерева проектов и веток
 */
function renderProjectsTreeHtml(allProjects, activeProj, activeBranch) {
  return allProjects.map(p => {
    const isProjActive = p.id === activeProj.id;
    const branches = Object.values(p.branches || {});

    return `
      <div class="tree-project-item ${isProjActive ? 'active-proj' : ''}" data-project-id="${p.id}">
        <div class="tree-proj-header">
          <span class="tree-icon">${isProjActive ? '▼' : '▶'}</span>
          <span class="tree-proj-name" title="Переключить проект">${escapeHtml(p.name)}</span>
          ${isProjActive ? '<span class="tree-badge-active">ТЕКУЩИЙ</span>' : ''}
        </div>

        ${isProjActive ? `
          <div class="tree-branches-list">
            ${branches.map(b => {
              const isBranchActive = activeBranch && b.id === activeBranch.id;
              return `
                <div class="tree-branch-item ${isBranchActive ? 'active-branch' : ''}" data-branch-id="${b.id}">
                  <span class="branch-connector">├─</span>
                  <svg class="branch-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">
                    <circle cx="4" cy="4" r="1.8"/>
                    <circle cx="4" cy="12" r="1.8"/>
                    <circle cx="12" cy="5.5" r="1.8"/>
                    <path d="M4 5.8v4.4M4 8.5c2.2 0 4.5-1 6.2-2"/>
                  </svg>
                  <span class="branch-name" title="Переключить на текст ветки">${escapeHtml(b.name)}</span>
                  ${isBranchActive ? '<span class="branch-badge">HEAD</span>' : ''}
                  <div class="branch-actions">
                    <button class="branch-rename-btn" data-branch-id="${b.id}" title="Переименовать ветку">✎</button>
                    ${branches.length > 1 ? `<button class="branch-del-btn" data-branch-id="${b.id}" title="Удалить ветку">✕</button>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('') + `
    <div class="tree-add-project-row">
      <button id="hist-new-project-btn" class="btn-xs-link">+ Новый репозиторий (проект)</button>
    </div>
  `;
}

/**
 * Рендер вертикальной железнодорожной линии коммитов (IDE Railway Graph)
 */
function renderTimelineHtml(commits, headCommitId) {
  if (!commits || commits.length === 0) {
    return `<div class="hist-empty-notice">В этой ветке пока нет коммитов. Начните печатать — автосохранение создаст ревизию через 2 секунды.</div>`;
  }

  return commits.map((c, idx) => {
    const isHead = c.id === headCommitId;
    const dateStr = formatCommitTime(c.timestamp);
    const words = c.stats ? c.stats.words : 0;
    const chars = c.stats ? c.stats.chars : 0;

    return `
      <div class="timeline-row ${isHead ? 'is-head-commit' : ''}" data-commit-id="${c.id}">
        <!-- Графическая колонка с вертикальной линией и точкой -->
        <div class="timeline-track">
          <div class="timeline-node ${isHead ? 'node-head' : 'node-history'}">
            ${isHead ? '<div class="node-inner-dot"></div>' : ''}
          </div>
          ${idx < commits.length - 1 ? '<div class="timeline-rail"></div>' : ''}
        </div>

        <!-- Карточка ревизии -->
        <div class="timeline-card">
          <div class="timeline-card-header">
            <span class="commit-hash" title="Идентификатор ревизии">${c.id}</span>
            <span class="commit-time">${dateStr}</span>
            ${isHead ? '<span class="commit-head-pill">HEAD</span>' : ''}
          </div>
          <div class="commit-msg" title="${escapeHtml(c.message)}">${escapeHtml(c.message)}</div>
          <div class="timeline-card-footer">
            <span class="commit-stats-tag">${words} сл. • ${chars} зн.</span>
            ${!isHead ? `
              <button class="btn btn-xs btn-tactical commit-checkout-btn" data-commit-id="${c.id}" title="Откатить редактор к этой версии">
                Откатить сюда
              </button>
            ` : '<span class="commit-current-tag">Активная версия</span>'}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Слушатели кликов в панели истории
 */
function attachEventListeners() {
  // Закрытие панели
  const closeBtn = document.getElementById('hist-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => toggleHistoryPanel(false));
  }

  // Создание новой ветки
  const newBranchBtn = document.getElementById('hist-new-branch-btn');
  if (newBranchBtn) {
    newBranchBtn.addEventListener('click', () => {
      const name = prompt('Введите название новой ветки (текста):', `draft-${Date.now().toString(36).slice(-3)}`);
      if (name) {
        const curText = document.getElementById('editor-textarea')?.value || '';
        // Сохраняем текущий текст в старую ветку
        gitRepo.commit(curText);
        // Создаем чистую новую ветку
        gitRepo.createBranch(name, '');
        if (onTextChangeCallback) onTextChangeCallback('');
      }
    });
  }

  // Создание нового проекта
  const newProjBtn = document.getElementById('hist-new-project-btn');
  if (newProjBtn) {
    newProjBtn.addEventListener('click', () => {
      const name = prompt('Введите название нового проекта (репозитория):', 'Новая статья');
      if (name) {
        gitRepo.createProject(name);
        if (onTextChangeCallback) onTextChangeCallback('');
      }
    });
  }

  // Ручной коммит
  const commitBtn = document.getElementById('hist-commit-btn');
  const commitInput = document.getElementById('hist-commit-input');
  if (commitBtn && commitInput) {
    const doManualCommit = () => {
      const msg = commitInput.value.trim() || 'Пользовательская точка сохранения';
      const curText = document.getElementById('editor-textarea')?.value || '';
      gitRepo.commit(curText, msg, true);
      commitInput.value = '';
    };
    commitBtn.addEventListener('click', doManualCommit);
    commitInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doManualCommit();
    });
  }

  // Переключение веток
  const branchItems = historyPanelEl.querySelectorAll('.tree-branch-item');
  branchItems.forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.branch-actions')) return;
      const branchId = item.getAttribute('data-branch-id');
      if (!branchId) return;

      // Автосохранение текущего текста перед переключением
      const curText = document.getElementById('editor-textarea')?.value || '';
      gitRepo.commit(curText);

      const targetHead = gitRepo.checkoutBranch(branchId);
      if (onTextChangeCallback) {
        onTextChangeCallback(targetHead ? targetHead.content : '');
      }
    });
  });

  // Переключение проектов
  const projItems = historyPanelEl.querySelectorAll('.tree-proj-header');
  projItems.forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.tree-project-item');
      const projId = item.getAttribute('data-project-id');
      if (projId && projId !== gitRepo.getActiveProject()?.id) {
        const curText = document.getElementById('editor-textarea')?.value || '';
        gitRepo.commit(curText);

        const targetHead = gitRepo.switchProject(projId);
        if (onTextChangeCallback) {
          onTextChangeCallback(targetHead ? targetHead.content : '');
        }
      }
    });
  });

  // Переименование ветки
  const renameBtns = historyPanelEl.querySelectorAll('.branch-rename-btn');
  renameBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const bId = btn.getAttribute('data-branch-id');
      const curBranch = gitRepo.getActiveProject()?.branches[bId];
      if (!curBranch) return;
      const newName = prompt('Новое название ветки:', curBranch.name);
      if (newName) {
        gitRepo.renameBranch(bId, newName);
      }
    });
  });

  // Удаление ветки
  const delBtns = historyPanelEl.querySelectorAll('.branch-del-btn');
  delBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const bId = btn.getAttribute('data-branch-id');
      if (confirm('Удалить эту ветку и всю её историю?')) {
        gitRepo.deleteBranch(bId);
        const head = gitRepo.getHeadCommit();
        if (onTextChangeCallback) {
          onTextChangeCallback(head ? head.content : '');
        }
      }
    });
  });

  // Откат к конкретному коммиту (Checkout)
  const checkoutBtns = historyPanelEl.querySelectorAll('.commit-checkout-btn');
  checkoutBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const cId = btn.getAttribute('data-commit-id');
      if (!cId) return;
      if (confirm(`Откатить редактор к ревизии [${cId}]? Будет создан новый коммит восстановления.`)) {
        const recoveredCommit = gitRepo.checkoutCommit(cId);
        if (recoveredCommit && onTextChangeCallback) {
          onTextChangeCallback(recoveredCommit.content);
        }
      }
    });
  });
}

function formatCommitTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
