/**
 * js/settings.js - Управление пороговыми значениями, списками и настройками редактора
 * 
 * Все числовые пороги из рецензии являются константами по умолчанию и могут
 * изменяться пользователем. Поддерживается сброс к эталонам рецензии,
 * сохранение в localStorage, экспорт и импорт в JSON.
 */

import { DEFAULT_FORMULAIC_STARTERS, DEFAULT_SIGNAL_PHRASES } from './dicts.js';

export const REVIEW_DEFAULTS = {
  // 1. Средняя длина предложения (слов / предложений)
  avgSentenceLength: {
    human: 23.2,
    aiRed: 29.2,
    name: 'Средняя длина предложения',
    unit: 'слов',
    description: 'Отношение общего числа слов к числу предложений'
  },

  // 2. Доля очень длинных предложений (41+ слов)
  longSentenceRatio: {
    thresholdWords: 41,
    human: 6.2,
    aiRed: 17.0,
    name: 'Доля очень длинных предложений (41+)',
    unit: '%',
    description: 'Доля предложений длиной 41 и более слов'
  },

  // 3. Доля очень коротких предложений (<= 6 слов по умолчанию)
  shortSentenceRatio: {
    thresholdWords: 6, // Оговорка: в рецензии пример 6 слов, число не задано строго чекером
    isAssumption: true,
    human: 5.8,
    aiRed: 2.4, // ИИ использует МЕНЬШЕ очень коротких предложений!
    name: 'Доля очень коротких предложений (≤6)',
    unit: '%',
    description: 'Порог ≤6 слов — допущение из примера рецензии (не точное число чекера)'
  },

  // 4. Доля служебных слов
  stopwordRatio: {
    human: 40.2,
    aiRed: 33.0, // У ИИ нехватка служебных слов (перегружен терминами)
    name: 'Доля служебных слов',
    unit: '%',
    description: 'Предлоги, союзы, частицы, местоимения и связки по закрытому словарю'
  },

  // 5. Средняя длина слова
  avgWordLength: {
    human: 5.24,
    aiRed: 5.86,
    name: 'Средняя длина слова',
    unit: 'букв',
    description: 'Буквы и цифры токена после очистки внешней пунктуации'
  },

  // 6. Доля длинных слов (8+ символов)
  longWordRatio: {
    thresholdChars: 8,
    human: 23.1,
    aiRed: 30.7,
    name: 'Доля длинных слов (8+ букв)',
    unit: '%',
    description: 'Токены длиной от 8 букв и цифр (включая сложные дефисные слова)'
  },

  // 7. Повтор 3-грамм (локальный прокси)
  threeGramRepetition: {
    human: 3.5,
    aiRed: 1.4, // У ИИ повторов МЕНЬШЕ (искусственное избегание повторов)
    name: 'Повтор 3-грамм',
    unit: '%',
    isProxy: true,
    formulaReadonly: '(N - U) / N',
    description: 'Локальная формула: (N - U) / N, где N — всего 3-грамм, U — уникальных. Прозрачный прокси, не закрытая формула чекера'
  },

  // Дополнительные локальные метрики качества
  stdDevSentenceLength: {
    warningMin: 8.0,
    name: 'Стандартное отклонение длины предложений',
    unit: 'слов',
    description: 'Мера разнообразия ритма текста. Низкое значение указывает на монотонность («ровные» предложения)'
  },

  starterUniformity: {
    warningMax: 20.0,
    name: 'Однообразие зачинов',
    unit: '%',
    description: 'Максимальная доля предложений, начинающихся с одного и того же слова'
  },

  // Пороги подсветки предложений
  highlight: {
    dangerWordCount: 41,        // Красный порог
    warningWordCount: 30,       // Жёлтый порог (пользовательский ориентир)
    highlightWarningEnabled: true,
    highlightFormulaicStarters: true,
    highlightSignalPhrases: true
  },

  // Минимальный объем для достоверности метрик
  minVolume: {
    words: 100,
    sentences: 5
  },

  // Настройки страниц A4
  pageEstimation: {
    fontFamily: 'Times New Roman, serif',
    fontSizePt: 14,
    tableFontSizePt: 11,
    lineHeight: 1.5,
    marginTopMm: 20,
    marginBottomMm: 20,
    marginLeftMm: 20,
    marginRightMm: 20,
    charsPerA4MainNorm: 1800,
    charsPerA4TableNorm: 2900
  },

  // Списки фраз
  formulaicStarters: [...DEFAULT_FORMULAIC_STARTERS],
  signalPhrases: [...DEFAULT_SIGNAL_PHRASES]
};

const STORAGE_KEY = 'nysse_editor_settings_v1';
let currentSettings = null;
const listeners = new Set();

/**
 * Глубокое клонирование объекта
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Загрузка текущих настроек
 */
export function getSettings() {
  if (currentSettings) return currentSettings;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Сливаем с дефолтными для гарантии наличия всех полей
      currentSettings = deepMerge(deepClone(REVIEW_DEFAULTS), parsed);
      return currentSettings;
    }
  } catch (e) {
    console.warn('Ошибка чтения настроек из localStorage:', e);
  }

  currentSettings = deepClone(REVIEW_DEFAULTS);
  return currentSettings;
}

/**
 * Сохранение настроек
 */
export function saveSettings(newSettings) {
  currentSettings = deepMerge(deepClone(currentSettings || REVIEW_DEFAULTS), newSettings);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
  } catch (e) {
    console.error('Ошибка сохранения настроек в localStorage:', e);
  }
  notifySettingsChanged();
  return currentSettings;
}

/**
 * Сброс к эталонам рецензии
 */
export function resetToReviewDefaults() {
  currentSettings = deepClone(REVIEW_DEFAULTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
  } catch (e) {
    console.error('Ошибка записи при сбросе настроек:', e);
  }
  notifySettingsChanged();
  return currentSettings;
}

/**
 * Экспорт настроек в JSON строку
 */
export function exportSettingsJSON() {
  return JSON.stringify(getSettings(), null, 2);
}

/**
 * Импорт настроек из JSON
 */
export function importSettingsJSON(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    currentSettings = deepMerge(deepClone(REVIEW_DEFAULTS), parsed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
    notifySettingsChanged();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Подписка на изменение настроек
 */
export function onSettingsChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifySettingsChanged() {
  for (const listener of listeners) {
    try {
      listener(currentSettings);
    } catch (e) {
      console.error('Ошибка в подписчике настроек:', e);
    }
  }
}

/**
 * Простое глубокое слияние объектов
 */
function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Array) {
      target[key] = [...source[key]];
    } else if (source[key] && typeof source[key] === 'object' && !(source[key] instanceof RegExp)) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
