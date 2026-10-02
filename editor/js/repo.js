/**
 * js/repo.js - Локальная Git-подобная система контроля версий (Git-emulator)
 * Поддерживает:
 * - Проекты (репозитории)
 * - Ветки (каждый отдельный текст или черновик)
 * - Коммиты (автосохранение каждые 2 сек после паузы ввода)
 * - Дерево версий, возврат к коммиту (checkout), создание/переименование веток
 */

const STORAGE_KEY = 'nysse_git_repository_v2';

// Генерация короткого 7-значного git-хеша
function generateCommitHash() {
  const chars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 7; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

// Генерация уникального ID
function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
}

class GitRepository {
  constructor() {
    this.state = {
      version: 2,
      activeProjectId: null,
      projects: {}
    };
    this.subscribers = new Set();
    this.load();
  }

  // Загрузка состояния из localStorage
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.state = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Ошибка загрузки репозитория:', e);
    }

    // Если репозиторий пуст, инициализируем начальный проект
    if (!this.state.projects || Object.keys(this.state.projects).length === 0) {
      this.initDefaultProject();
    }
  }

  // Сохранение состояния в localStorage
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Ошибка записи репозитория в localStorage:', e);
    }
    this.notify();
  }

  // Восстановление состояния из внешнего архива (.ny)
  restoreArchive(archiveState) {
    if (!archiveState || !archiveState.projects) {
      throw new Error('Некорректная структура репозитория в архиве');
    }
    this.state = archiveState;
    this.save();
  }

  // Подписка на изменения
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    for (const cb of this.subscribers) {
      try {
        cb(this.state);
      } catch (e) {
        console.error('Ошибка в подписчике репозитория:', e);
      }
    }
  }

  // Создание дефолтного проекта
  initDefaultProject(initialText = '') {
    const projId = 'proj_default';
    const branchId = 'branch_main';
    const commitId = generateCommitHash();
    const now = Date.now();

    const initialCommit = {
      id: commitId,
      parentId: null,
      timestamp: now,
      message: 'Начальный коммит черновика',
      content: initialText,
      stats: this.calcStats(initialText)
    };

    const mainBranch = {
      id: branchId,
      name: 'main',
      createdAt: now,
      headCommitId: commitId
    };

    this.state = {
      version: 2,
      activeProjectId: projId,
      projects: {
        [projId]: {
          id: projId,
          name: 'Основная статья',
          createdAt: now,
          activeBranchId: branchId,
          branches: {
            [branchId]: mainBranch
          },
          commits: {
            [commitId]: initialCommit
          }
        }
      }
    };

    this.save();
  }

  // Расчет быстрой статистики текста для коммита
  calcStats(text) {
    if (!text || typeof text !== 'string') {
      return { words: 0, chars: 0, sentences: 0 };
    }
    const chars = text.length;
    const words = (text.trim().match(/\S+/g) || []).length;
    const sentences = (text.split(/[.!?]+(?:\s+|$)/).filter(s => s.trim().length > 0) || []).length;
    return { words, chars, sentences };
  }

  // Получить текущий активный проект
  getActiveProject() {
    const proj = this.state.projects[this.state.activeProjectId];
    if (!proj) {
      const firstId = Object.keys(this.state.projects)[0];
      if (firstId) {
        this.state.activeProjectId = firstId;
        return this.state.projects[firstId];
      }
      this.initDefaultProject();
      return this.state.projects[this.state.activeProjectId];
    }
    return proj;
  }

  // Получить текущую активную ветку
  getActiveBranch() {
    const proj = this.getActiveProject();
    if (!proj) return null;
    let branch = proj.branches[proj.activeBranchId];
    if (!branch) {
      const firstBranchId = Object.keys(proj.branches)[0];
      if (firstBranchId) {
        proj.activeBranchId = firstBranchId;
        branch = proj.branches[firstBranchId];
      }
    }
    return branch;
  }

  // Получить текущий HEAD коммит
  getHeadCommit() {
    const proj = this.getActiveProject();
    const branch = this.getActiveBranch();
    if (!proj || !branch || !branch.headCommitId) return null;
    return proj.commits[branch.headCommitId] || null;
  }

  // Создать новый коммит в текущую активную ветку
  commit(content, message = null, isManual = false) {
    const proj = this.getActiveProject();
    const branch = this.getActiveBranch();
    if (!proj || !branch) return null;

    const head = this.getHeadCommit();
    // Если содержимое совпадает с текущим HEAD, коммит не нужен
    if (head && head.content === content) {
      return head;
    }

    const commitId = generateCommitHash();
    const stats = this.calcStats(content);
    const now = Date.now();

    let autoMsg = message;
    if (!autoMsg) {
      if (head) {
        const deltaChars = stats.chars - head.stats.chars;
        const sign = deltaChars >= 0 ? `+${deltaChars}` : `${deltaChars}`;
        autoMsg = `Автосохранение (${sign} зн. • ${stats.words} сл.)`;
      } else {
        autoMsg = `Черновик (${stats.words} слов)`;
      }
    }

    const newCommit = {
      id: commitId,
      parentId: head ? head.id : null,
      timestamp: now,
      message: autoMsg,
      content: content,
      stats: stats,
      manual: isManual
    };

    proj.commits[commitId] = newCommit;
    branch.headCommitId = commitId;

    this.save();
    return newCommit;
  }

  // Создать новую ветку (новый отдельный текст)
  createBranch(branchName, startContent = '') {
    const proj = this.getActiveProject();
    if (!proj) return null;

    const trimmed = (branchName || '').trim();
    const name = trimmed.length > 0 ? trimmed : `draft-${Object.keys(proj.branches).length + 1}`;
    const branchId = generateId('branch');
    const now = Date.now();
    const commitId = generateCommitHash();

    const initialCommit = {
      id: commitId,
      parentId: null,
      timestamp: now,
      message: `Создание ветки "${name}"`,
      content: startContent,
      stats: this.calcStats(startContent)
    };

    proj.commits[commitId] = initialCommit;

    const newBranch = {
      id: branchId,
      name: name,
      createdAt: now,
      headCommitId: commitId
    };

    proj.branches[branchId] = newBranch;
    proj.activeBranchId = branchId;

    this.save();
    return newBranch;
  }

  // Переключить активную ветку
  checkoutBranch(branchId) {
    const proj = this.getActiveProject();
    if (!proj || !proj.branches[branchId]) return null;

    proj.activeBranchId = branchId;
    this.save();
    return this.getHeadCommit();
  }

  // Откат / загрузка конкретного коммита (создает новый коммит с восстановленным содержимым)
  checkoutCommit(commitId) {
    const proj = this.getActiveProject();
    const branch = this.getActiveBranch();
    if (!proj || !branch) return null;

    const targetCommit = proj.commits[commitId];
    if (!targetCommit) return null;

    // Создаем новый коммит на вершине текущей ветки с содержимым откаченного
    return this.commit(
      targetCommit.content,
      `Возврат к ревизии [${targetCommit.id}] (${targetCommit.stats.words} сл.)`,
      true
    );
  }

  // Получить линейную историю коммитов текущей ветки от HEAD к корню
  getBranchHistory(branchId = null) {
    const proj = this.getActiveProject();
    if (!proj) return [];

    const bId = branchId || proj.activeBranchId;
    const branch = proj.branches[bId];
    if (!branch || !branch.headCommitId) return [];

    const history = [];
    let currentId = branch.headCommitId;
    const visited = new Set();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const c = proj.commits[currentId];
      if (!c) break;
      history.push(c);
      currentId = c.parentId;
    }

    return history;
  }

  // Создать новый проект (репозиторий)
  createProject(projectName) {
    const trimmed = (projectName || '').trim();
    const name = trimmed.length > 0 ? trimmed : `Проект ${Object.keys(this.state.projects).length + 1}`;
    const projId = generateId('proj');
    const branchId = generateId('branch');
    const commitId = generateCommitHash();
    const now = Date.now();

    const initialCommit = {
      id: commitId,
      parentId: null,
      timestamp: now,
      message: 'Инициализация нового проекта',
      content: '',
      stats: { words: 0, chars: 0, sentences: 0 }
    };

    const mainBranch = {
      id: branchId,
      name: 'main',
      createdAt: now,
      headCommitId: commitId
    };

    const newProject = {
      id: projId,
      name: name,
      createdAt: now,
      activeBranchId: branchId,
      branches: {
        [branchId]: mainBranch
      },
      commits: {
        [commitId]: initialCommit
      }
    };

    this.state.projects[projId] = newProject;
    this.state.activeProjectId = projId;

    this.save();
    return newProject;
  }

  // Переключить активный проект
  switchProject(projectId) {
    if (!this.state.projects[projectId]) return null;
    this.state.activeProjectId = projectId;
    this.save();
    return this.getHeadCommit();
  }

  // Удалить ветку
  deleteBranch(branchId) {
    const proj = this.getActiveProject();
    if (!proj) return false;
    const branchKeys = Object.keys(proj.branches);
    if (branchKeys.length <= 1) {
      alert('Нельзя удалить единственную ветку в проекте.');
      return false;
    }
    if (proj.activeBranchId === branchId) {
      const nextId = branchKeys.find(id => id !== branchId);
      proj.activeBranchId = nextId;
    }
    delete proj.branches[branchId];
    this.save();
    return true;
  }

  // Переименовать ветку
  renameBranch(branchId, newName) {
    const proj = this.getActiveProject();
    if (!proj || !proj.branches[branchId]) return false;
    const trimmed = (newName || '').trim();
    if (!trimmed) return false;
    proj.branches[branchId].name = trimmed;
    this.save();
    return true;
  }
}

// Синглтон репозитория
export const gitRepo = new GitRepository();
