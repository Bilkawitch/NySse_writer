/**
 * js/parse.js - Синтаксический разбор текста: предложения, слова, таблицы
 * 
 * Обеспечивает:
 * 1. Выделение блоков таблиц :::table ... ::: с отдельным подсчетом и проверкой разметки
 * 2. Точное разбиение на предложения с защитой от ложных разрывов на сокращениях,
 *    инициалах и десятичных дробях
 * 3. Токенизацию слов с сохранением внутренних дефисов (Speech-to-Speech, по-прежнему)
 * 4. Сохранение точных символьных смещений (startOffset, endOffset) для зеркальной подсветки
 */

import { DEFAULT_ABBREVIATIONS, DEFAULT_STOPWORDS } from './dicts.js';
import { getSettings } from './settings.js';

// Регулярные выражения для защиты сокращений
const ABBREV_SET = new Set(DEFAULT_ABBREVIATIONS.map(a => a.toLowerCase().replace(/\./g, '')));

/**
 * Очистка внешних знаков пунктуации у слова
 * Сохраняет дефисы и апострофы внутри токена
 */
export function cleanWord(rawToken) {
  if (!rawToken) return '';
  // Убираем внешние кавычки, скобки, тире, точки, запятые и т.д.
  return rawToken.replace(/^[\s\.,;:!?"'«»()—–\[\]{}<>/\\|*~`@#$%^&+=№]+|[\s\.,;:!?"'«»()—–\[\]{}<>/\\|*~`@#$%^&+=№]+$/gu, '');
}

/**
 * Проверка, является ли токен валидным словом (буквы и цифры)
 */
export function isValidWord(token) {
  const cleaned = cleanWord(token);
  if (!cleaned) return false;
  // Должна быть хотя бы одна буква или цифра (любой алфавит, в т.ч. кириллица/латиница)
  return /[\p{L}\p{N}]/u.test(cleaned);
}

/**
 * Извлечение блоков таблиц формата:
 * :::table
 * колонка 1 | колонка 2
 * значение 1 | значение 2
 * :::
 */
export function extractTables(rawText) {
  const tables = [];
  const tableRegex = /:::table\b([\s\S]*?)(?::::|$)/g;
  let match;

  while ((match = tableRegex.exec(rawText)) !== null) {
    const fullMatch = match[0];
    const innerContent = match[1];
    const startOffset = match.index;
    const endOffset = match.index + fullMatch.length;
    const isClosed = fullMatch.endsWith(':::') && fullMatch.length > 8;

    // Разбор строк и колонок
    const lines = innerContent.trim().split('\n').filter(l => l.trim().length > 0);
    const rows = lines.map(line => line.split('|').map(col => col.trim()));
    const colCounts = rows.map(r => r.length);
    const maxCols = Math.max(0, ...colCounts);
    const minCols = Math.min(999, ...colCounts);

    // Проверка корректности синтаксиса таблицы
    const errors = [];
    if (!isClosed) {
      errors.push('Блок таблицы не закрыт завершающим «:::»');
    }
    if (lines.length === 0) {
      errors.push('Пустая таблица');
    } else if (maxCols !== minCols && rows.length > 1) {
      errors.push(`Неодинаковое число колонок в строках (от ${minCols} до ${maxCols})`);
    }

    // Подсчет слов и символов в ячейках таблицы
    const tableWords = [];
    let tableCharsWithSpaces = 0;
    let tableCharsNoSpaces = 0;

    for (const row of rows) {
      for (const cell of row) {
        tableCharsWithSpaces += cell.length + 1; // + пробел между ячейками
        tableCharsNoSpaces += cell.replace(/\s+/g, '').length;
        const tokens = cell.split(/\s+/);
        for (const t of tokens) {
          if (isValidWord(t)) {
            tableWords.push(cleanWord(t));
          }
        }
      }
    }

    tables.push({
      startOffset,
      endOffset,
      raw: fullMatch,
      innerContent,
      rows,
      errors,
      wordsCount: tableWords.length,
      words: tableWords,
      charsWithSpaces: tableCharsWithSpaces,
      charsNoSpaces: tableCharsNoSpaces,
      isClosed
    });
  }

  return tables;
}

/**
 * Проверка, не является ли точка частью сокращения, инициала или числа
 */
function isFalseSentenceBreak(text, matchIndex) {
  // 1. Десятичные дроби: цифра перед точкой/запятой и цифра после
  if (matchIndex > 0 && matchIndex < text.length - 1) {
    const prevChar = text[matchIndex - 1];
    const nextChar = text[matchIndex + 1];
    if (/\d/.test(prevChar) && /\d/.test(nextChar)) {
      return true;
    }
  }

  // Смотрим фрагмент перед точкой до 25 символов назад
  const lookbackStart = Math.max(0, matchIndex - 25);
  const lookback = text.substring(lookbackStart, matchIndex);

  // 2. Инициалы вида: «А.С. Пушкин» или «И. Иванов»
  // Последняя буква перед точкой заглавная, и перед ней начало строки/пробел или другая точка
  if (/(?:^|[\s\.\(])([А-ЯЁA-Z])$/.test(lookback)) {
    return true;
  }

  // 3. Сложные сокращения с точками внутри: «т.е.», «т.д.», «т.п.», «т.к.»
  if (/(?:^|\s)[а-яёa-z]\.[а-яёa-z]$/i.test(lookback)) {
    return true;
  }

  // 4. Общепринятые сокращения из словаря: «стр.», «рис.», «гг.», «проф.»
  const wordBeforeMatch = lookback.match(/([а-яёa-z]+)$/i);
  if (wordBeforeMatch) {
    const wordClean = wordBeforeMatch[1].toLowerCase();
    if (ABBREV_SET.has(wordClean)) {
      return true;
    }
  }

  return false;
}

/**
 * Токенизация текста на слова
 * Дефисы внутри токена не разрывают слово (Speech-to-Speech, по-прежнему)
 */
export function tokenizeWords(text) {
  const words = [];
  // Токен: последовательность букв, цифр с возможными внутренними дефисами или апострофами
  // Например: Speech-to-Speech, AI-модель, во-первых, O'Connor
  const tokenRegex = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu;
  let match;

  while ((match = tokenRegex.exec(text)) !== null) {
    const raw = match[0];
    const cleaned = cleanWord(raw);
    if (!cleaned) continue;

    const lower = cleaned.toLowerCase();
    const length = cleaned.replace(/[^\p{L}\p{N}]/gu, '').length || cleaned.length;
    const isStopWord = DEFAULT_STOPWORDS.has(lower);
    const isLong = length >= 8;

    words.push({
      raw,
      cleaned,
      lower,
      length,
      isStopWord,
      isLong,
      startOffset: match.index,
      endOffset: match.index + raw.length
    });
  }

  return words;
}

/**
 * Проверка зачина и сигнальных фраз в предложении
 */
export function analyzeSentenceIssues(sentence, settings = getSettings()) {
  const issues = [];
  const words = sentence.words;
  const wordCount = words.length;

  const dangerThreshold = settings.highlight.dangerWordCount || 41;
  const warningThreshold = settings.highlight.warningWordCount || 30;

  // 1. Длина предложения (Красный порог: 41+ слов)
  if (wordCount >= dangerThreshold) {
    issues.push({
      type: 'long_danger',
      severity: 'danger',
      message: `${wordCount} слова (красная граница рецензии — ${dangerThreshold} слов)`
    });
  } else if (settings.highlight.highlightWarningEnabled && wordCount >= warningThreshold) {
    issues.push({
      type: 'long_warning',
      severity: 'warning',
      message: `${wordCount} слов (приближение к границе 41, ваша настройка — ${warningThreshold})`
    });
  }

  // 2. Длинные слова внутри предложения (справочно для попапа)
  const longWords = words.filter(w => w.isLong);
  if (longWords.length >= 5 && words.length > 0) {
    const longShare = Math.round((longWords.length / words.length) * 100);
    if (longShare >= 35) {
      sentence.highWordLengthNote = `В этом предложении ${longWords.length} из ${words.length} слов длиннее 7 букв (${longShare}%), оно тянет среднюю длину слова вверх.`;
    }
  }

  // 3. Формульные зачины из списка настроек
  if (settings.highlight.highlightFormulaicStarters && settings.formulaicStarters) {
    const cleanLowerText = sentence.cleanText.toLowerCase();
    for (const starter of settings.formulaicStarters) {
      const st = starter.trim().toLowerCase();
      if (!st) continue;
      // Проверяем начало предложения с учетом знаков препинания (запятая, тире)
      const starterRegex = new RegExp(`^(?:«|"|\\(|—|–)?\\s*${escapeRegex(st)}(?:[\\s,.:;—–]|$)`, 'i');
      if (starterRegex.test(cleanLowerText)) {
        issues.push({
          type: 'formulaic_starter',
          severity: 'warning',
          phrase: starter,
          message: `Формульный зачин из списка: «${starter}»`
        });
        break; // Один зачин на предложение
      }
    }
  }

  // 4. Сигнальные и запретные фразы пользователя
  if (settings.highlight.highlightSignalPhrases && settings.signalPhrases) {
    const cleanLowerText = sentence.cleanText.toLowerCase();
    for (const item of settings.signalPhrases) {
      const phrase = (item.phrase || '').trim().toLowerCase();
      if (!phrase) continue;
      if (cleanLowerText.includes(phrase)) {
        const severity = item.severity === 'danger' ? 'danger' : 'warning';
        issues.push({
          type: 'signal_phrase',
          severity,
          phrase: item.phrase,
          comment: item.comment,
          message: `Сигнальная фраза: «${item.phrase}»${item.comment ? ` (${item.comment})` : ''}`
        });
      }
    }
  }

  return issues;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Полный синтаксический разбор документа
 */
export function parseDocument(rawText, settings = getSettings()) {
  if (!rawText) {
    return {
      rawText: '',
      tables: [],
      sentences: [],
      mainWords: [],
      totalWordsCount: 0,
      charsWithSpaces: 0,
      charsNoSpaces: 0,
      tableCharsWithSpaces: 0,
      tableCharsNoSpaces: 0
    };
  }

  // 1. Извлекаем таблицы
  const tables = extractTables(rawText);

  // Карта занятых диапазонов таблицами
  const isInsideTable = (offset) => {
    return tables.some(t => offset >= t.startOffset && offset < t.endOffset);
  };

  // 2. Разбиение на предложения по основному тексту
  const sentences = [];
  let currentSentenceStart = -1;
  let inTable = false;

  const len = rawText.length;
  let i = 0;

  while (i < len) {
    // Пропуск таблиц
    const tableBlock = tables.find(t => i >= t.startOffset && i < t.endOffset);
    if (tableBlock) {
      if (currentSentenceStart !== -1) {
        // Завершаем предложение перед таблицей
        pushSentence(rawText, currentSentenceStart, i, sentences, settings);
        currentSentenceStart = -1;
      }
      i = tableBlock.endOffset;
      continue;
    }

    const char = rawText[i];

    // Начало нового предложения, если еще не начато
    if (currentSentenceStart === -1) {
      if (!/\s/.test(char)) {
        currentSentenceStart = i;
      }
    }

    if (currentSentenceStart !== -1) {
      // Проверка знаков окончания предложения: . ! ? …
      const isPunctEnd = char === '.' || char === '!' || char === '?' || char === '…';
      const isNewlineBreak = char === '\n' && (i + 1 < len && rawText[i + 1] === '\n'); // Двойной перенос — явный конец абзаца

      if (isPunctEnd) {
        // Проверяем, не ложный ли это разрыв (сокращение, дробь, инициал)
        if (char === '.' && isFalseSentenceBreak(rawText, i)) {
          i++;
          continue;
        }

        // Пропускаем возможные закрывающие кавычки, скобки и т.д.
        let endIdx = i + 1;
        while (endIdx < len && /["'»\)\]]/.test(rawText[endIdx])) {
          endIdx++;
        }

        // Проверяем, что дальше: пробел/перенос и заглавная буква/цифра, или конец документа
        let nextCharIdx = endIdx;
        while (nextCharIdx < len && /\s/.test(rawText[nextCharIdx])) {
          nextCharIdx++;
        }

        const isEndOfText = nextCharIdx >= len;
        const nextChar = rawText[nextCharIdx];
        const isCapitalOrDigit = nextChar && /[\p{Lu}\p{N}«"\(—–]/u.test(nextChar);
        const hasDoubleNewline = rawText.substring(endIdx, nextCharIdx).includes('\n\n');

        if (isEndOfText || isCapitalOrDigit || hasDoubleNewline) {
          pushSentence(rawText, currentSentenceStart, endIdx, sentences, settings);
          currentSentenceStart = -1;
          i = endIdx - 1; // Цикл инкрементирует i
        }
      } else if (isNewlineBreak) {
        // Конец абзаца завершает текущее предложение
        pushSentence(rawText, currentSentenceStart, i, sentences, settings);
        currentSentenceStart = -1;
      }
    }

    i++;
  }

  // Если остался хвост текста
  if (currentSentenceStart !== -1 && currentSentenceStart < len) {
    pushSentence(rawText, currentSentenceStart, len, sentences, settings);
  }

  // 3. Подсчет всех слов основного текста
  const allMainWords = [];
  for (const s of sentences) {
    for (const w of s.words) {
      allMainWords.push(w);
    }
  }

  // 4. Общие символьные счетчики
  let charsWithSpaces = rawText.length;
  let charsNoSpaces = rawText.replace(/\s+/g, '').length;

  let tableWordsTotal = tables.reduce((acc, t) => acc + t.wordsCount, 0);
  let tableCharsWithSpaces = tables.reduce((acc, t) => acc + t.charsWithSpaces, 0);
  let tableCharsNoSpaces = tables.reduce((acc, t) => acc + t.charsNoSpaces, 0);

  return {
    rawText,
    tables,
    sentences,
    mainWords: allMainWords,
    totalWordsCount: allMainWords.length + tableWordsTotal,
    mainWordsCount: allMainWords.length,
    tableWordsCount: tableWordsTotal,
    charsWithSpaces,
    charsNoSpaces,
    tableCharsWithSpaces,
    tableCharsNoSpaces
  };
}

function pushSentence(rawText, startOffset, endOffset, sentencesArray, settings) {
  const rawChunk = rawText.substring(startOffset, endOffset);
  const cleanText = rawChunk.trim();
  if (!cleanText) return;

  // Токенизация слов предложения
  const words = tokenizeWords(cleanText);
  if (words.length === 0) return;

  const starterWord = words[0]?.lower || '';
  const starterRaw = words[0]?.cleaned || '';

  const sentenceObj = {
    index: sentencesArray.length,
    rawText: rawChunk,
    cleanText,
    startOffset,
    endOffset,
    words,
    wordCount: words.length,
    starterWord,
    starterRaw,
    issues: []
  };

  // Поиск нарушений
  sentenceObj.issues = analyzeSentenceIssues(sentenceObj, settings);

  sentencesArray.push(sentenceObj);
}
