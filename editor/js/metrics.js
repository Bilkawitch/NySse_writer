/**
 * js/metrics.js - Расчет всех числовых метрик и светофоров
 * 
 * Логика светофора:
 * - Красная граница — сторона ИИ из рецензии (со значком «!»)
 * - Жёлтый — строго между человеческим и ИИ-ориентиром
 * - Зелёный — на человеческой стороне ориентира или лучше
 * - «Мало данных» — пока слов < 100 или предложений < 5 (доли на малом объеме врут)
 */

import { getSettings } from './settings.js?v=2.2.4';

/**
 * Определение статуса метрики (green / yellow / red / low_data)
 * @param {number} value - текущее значение
 * @param {number} human - человеческий ориентир
 * @param {number} aiRed - красная граница ИИ
 * @param {boolean} isLowerBetter - true если меньшее значение ближе к человеку (например, длина предложений)
 * @param {boolean} isLowData - флаг нехватки объема
 */
function evaluateStatus(value, human, aiRed, isLowerBetter, isLowData) {
  if (isLowData) {
    return {
      status: 'low_data',
      label: 'Мало данных',
      colorClass: 'status-low-data',
      badge: '...'
    };
  }

  if (isLowerBetter) {
    // Чем меньше, тем лучше (человек = human, ИИ = aiRed, где human < aiRed)
    if (value <= human) {
      return {
        status: 'green',
        label: 'Норма',
        colorClass: 'status-green',
        badge: '✓'
      };
    } else if (value >= aiRed) {
      return {
        status: 'red',
        label: 'Зона ИИ',
        colorClass: 'status-red',
        badge: '!'
      };
    } else {
      return {
        status: 'yellow',
        label: 'Внимание',
        colorClass: 'status-yellow',
        badge: '▲'
      };
    }
  } else {
    // Чем больше, тем лучше (человек = human, ИИ = aiRed, где aiRed < human)
    // Например, служебные слова, короткие предложения, повтор 3-грамм
    if (value >= human) {
      return {
        status: 'green',
        label: 'Норма',
        colorClass: 'status-green',
        badge: '✓'
      };
    } else if (value <= aiRed) {
      return {
        status: 'red',
        label: 'Зона ИИ',
        colorClass: 'status-red',
        badge: '!'
      };
    } else {
      return {
        status: 'yellow',
        label: 'Внимание',
        colorClass: 'status-yellow',
        badge: '▲'
      };
    }
  }
}

/**
 * Расчет 3-грамм слов
 * Формула: повтор = (N - U) / N, где N — число триграмм, U — число уникальных
 */
export function calculateThreeGramRepetition(words) {
  if (!words || words.length < 3) {
    return {
      totalGrams: 0,
      uniqueGrams: 0,
      repetitionRate: 0,
      topRepeats: []
    };
  }

  const cleanTokens = words.map(w => w.lower);
  const nGramsCount = cleanTokens.length - 2;
  const gramMap = new Map();

  for (let i = 0; i < nGramsCount; i++) {
    const gramKey = `${cleanTokens[i]} ${cleanTokens[i + 1]} ${cleanTokens[i + 2]}`;
    gramMap.set(gramKey, (gramMap.get(gramKey) || 0) + 1);
  }

  const totalGrams = nGramsCount;
  const uniqueGrams = gramMap.size;
  const repetitionRate = totalGrams > 0 ? ((totalGrams - uniqueGrams) / totalGrams) * 100 : 0;

  // Наиболее частые повторяющиеся 3-граммы
  const topRepeats = Array.from(gramMap.entries())
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([gram, count]) => ({ gram, count }));

  return {
    totalGrams,
    uniqueGrams,
    repetitionRate: Math.max(0, repetitionRate),
    topRepeats
  };
}

/**
 * Расчет стандартного отклонения длины предложений
 */
export function calculateSentenceStdDev(sentences, avgLength) {
  if (!sentences || sentences.length < 2) return 0;
  const sumSquares = sentences.reduce((acc, s) => {
    const diff = s.wordCount - avgLength;
    return acc + diff * diff;
  }, 0);
  return Math.sqrt(sumSquares / sentences.length);
}

/**
 * Расчет математической бёрстиности (Burstiness) предложений
 * Ключевой математический ориентир детекторов ZeroGPT, GPTZero, CopyLeaks
 * 
 * Метрики:
 * 1. Коэффициент вариации длины предложений: CV = stdDev / avgSentenceLength (в %)
 * 2. Нормализованный индекс Гоха-Барабаши (Goh-Barabási): B = (σ - μ) / (σ + μ) in [-1, +1]
 * 3. Локальный скачок между соседними предложениями (Mean Delta): средний перепад длины
 * 
 * Границы:
 * - ИИ: CV < 38% (нулевая/низкая бёрстиность, монотонные предложения), Mean Delta < 6 сл.
 * - Человек: CV >= 50% (высокая взрывная бёрстиность), Mean Delta >= 8-12 сл.
 */
export function calculateBurstiness(sentences, avgSentenceLength, stdDev) {
  if (!sentences || sentences.length < 2 || avgSentenceLength <= 0) {
    return {
      cv: 0,
      cvPercent: 0,
      gohB: 0,
      meanDelta: 0,
      status: 'low_data',
      formatted: '0%',
      isWarning: false
    };
  }

  // 1. Коэффициент вариации (CV)
  const cv = stdDev / avgSentenceLength;
  const cvPercent = Math.round(cv * 100);

  // 2. Индекс Гоха-Барабаши
  const gohB = (stdDev + avgSentenceLength > 0)
    ? (stdDev - avgSentenceLength) / (stdDev + avgSentenceLength)
    : -1;

  // 3. Средний локальный скачок между соседними предложениями
  let totalDelta = 0;
  for (let i = 0; i < sentences.length - 1; i++) {
    totalDelta += Math.abs(sentences[i + 1].wordCount - sentences[i].wordCount);
  }
  const meanDelta = Math.round((totalDelta / (sentences.length - 1)) * 10) / 10;

  // 4. Оценка статуса для детектора
  let status = 'green';
  let isWarning = false;
  if (cvPercent < 38) {
    status = 'red';
    isWarning = true;
  } else if (cvPercent < 50) {
    status = 'yellow';
    isWarning = true;
  }

  return {
    cv,
    cvPercent,
    gohB: Math.round(gohB * 100) / 100,
    meanDelta,
    status,
    formatted: `${cvPercent}%`,
    isWarning
  };
}

/**
 * Анализ однообразия зачинов предложений
 */
export function calculateStarterUniformity(sentences) {
  if (!sentences || sentences.length === 0) {
    return {
      maxRatio: 0,
      topStarter: '',
      topCount: 0,
      entropy: 0
    };
  }

  const starterMap = new Map();
  for (const s of sentences) {
    if (!s.starterWord) continue;
    starterMap.set(s.starterWord, (starterMap.get(s.starterWord) || 0) + 1);
  }

  let maxCount = 0;
  let topStarter = '';
  let entropy = 0;
  const total = sentences.length;

  for (const [word, count] of starterMap.entries()) {
    if (count > maxCount) {
      maxCount = count;
      topStarter = word;
    }
    const p = count / total;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  const maxRatio = total > 0 ? (maxCount / total) * 100 : 0;

  return {
    maxRatio,
    topStarter,
    topCount: maxCount,
    entropy: Math.round(entropy * 100) / 100
  };
}

/**
 * Полный расчет всех метрик документа
 */
export function computeAllMetrics(parsedDoc, settings = getSettings()) {
  const { sentences, mainWords, totalWordsCount, charsWithSpaces, charsNoSpaces } = parsedDoc;
  const sentenceCount = sentences.length;
  const wordCount = mainWords.length;

  // Проверка на минимальный объем данных
  const minWords = settings.minVolume?.words || 100;
  const minSentences = settings.minVolume?.sentences || 5;
  const isLowData = wordCount < minWords || sentenceCount < minSentences;

  // 1. Средняя длина предложения (слов / предложений)
  const avgSentenceLengthVal = sentenceCount > 0 ? wordCount / sentenceCount : 0;
  const avgSentenceStatus = evaluateStatus(
    avgSentenceLengthVal,
    settings.avgSentenceLength.human,
    settings.avgSentenceLength.aiRed,
    true, // lower is better
    isLowData
  );

  // 2. Доля очень длинных предложений (41+ слов)
  const longThreshold = settings.longSentenceRatio?.thresholdWords || 41;
  const longSentences = sentences.filter(s => s.wordCount >= longThreshold);
  const longSentenceRatioVal = sentenceCount > 0 ? (longSentences.length / sentenceCount) * 100 : 0;
  const longSentenceStatus = evaluateStatus(
    longSentenceRatioVal,
    settings.longSentenceRatio.human,
    settings.longSentenceRatio.aiRed,
    true, // lower is better
    isLowData
  );

  // 3. Доля очень коротких предложений (<= 6 слов по умолчанию)
  const shortThreshold = settings.shortSentenceRatio?.thresholdWords || 6;
  const shortSentences = sentences.filter(s => s.wordCount <= shortThreshold);
  const shortSentenceRatioVal = sentenceCount > 0 ? (shortSentences.length / sentenceCount) * 100 : 0;
  const shortSentenceStatus = evaluateStatus(
    shortSentenceRatioVal,
    settings.shortSentenceRatio.human,
    settings.shortSentenceRatio.aiRed,
    false, // higher is better (AI uses fewer short sentences!)
    isLowData
  );

  // 4. Доля служебных слов
  const stopwords = mainWords.filter(w => w.isStopWord);
  const stopwordRatioVal = wordCount > 0 ? (stopwords.length / wordCount) * 100 : 0;
  const stopwordStatus = evaluateStatus(
    stopwordRatioVal,
    settings.stopwordRatio.human,
    settings.stopwordRatio.aiRed,
    false, // higher is better (AI has deficit of stopwords)
    isLowData
  );

  // 5. Средняя длина слова (буквы и цифры токена)
  const totalLetters = mainWords.reduce((acc, w) => acc + w.length, 0);
  const avgWordLengthVal = wordCount > 0 ? totalLetters / wordCount : 0;
  const avgWordLengthStatus = evaluateStatus(
    avgWordLengthVal,
    settings.avgWordLength.human,
    settings.avgWordLength.aiRed,
    true, // lower is better
    isLowData
  );

  // 6. Доля длинных слов (8+ символов)
  const longWordsThreshold = settings.longWordRatio?.thresholdChars || 8;
  const longWords = mainWords.filter(w => w.length >= longWordsThreshold);
  const longWordRatioVal = wordCount > 0 ? (longWords.length / wordCount) * 100 : 0;
  const longWordStatus = evaluateStatus(
    longWordRatioVal,
    settings.longWordRatio.human,
    settings.longWordRatio.aiRed,
    true, // lower is better
    isLowData
  );

  // 7. Повтор 3-грамм
  const threeGramResult = calculateThreeGramRepetition(mainWords);
  const threeGramStatus = evaluateStatus(
    threeGramResult.repetitionRate,
    settings.threeGramRepetition.human,
    settings.threeGramRepetition.aiRed,
    false, // higher is better (AI has lower repetition)
    isLowData
  );

  // 8. Стандартное отклонение длины предложений
  const stdDevVal = calculateSentenceStdDev(sentences, avgSentenceLengthVal);
  const stdDevWarningMin = settings.stdDevSentenceLength?.warningMin || 8.0;
  const stdDevIsWarning = !isLowData && stdDevVal < stdDevWarningMin;

  // 9. Математическая бёрстиность (Burstiness - ZeroGPT / GPTZero)
  const burstinessResult = calculateBurstiness(sentences, avgSentenceLengthVal, stdDevVal);

  // 10. Однообразие зачинов
  const starterResult = calculateStarterUniformity(sentences);
  const starterWarningMax = settings.starterUniformity?.warningMax || 20.0;
  const starterIsWarning = !isLowData && starterResult.maxRatio > starterWarningMax;

  // Глобальные сигналы и дефициты текста
  const globalDeficits = [];
  if (!isLowData) {
    if (shortSentenceStatus.status === 'red') {
      globalDeficits.push({
        type: 'short_sentence_deficit',
        severity: 'danger',
        title: 'Дефицит коротких предложений',
        text: `Доля ≤ ${shortSentenceRatioVal.toFixed(1)}% (порог ИИ: ≤ ${settings.shortSentenceRatio.aiRed}%). Текст излишне монотонен, не хватает кратких динамичных фраз.`
      });
    }
    if (stopwordStatus.status === 'red') {
      globalDeficits.push({
        type: 'stopword_deficit',
        severity: 'danger',
        title: 'Дефицит служебных слов',
        text: `Доля ${stopwordRatioVal.toFixed(1)}% (порог ИИ: ≤ ${settings.stopwordRatio.aiRed}%). Текст перегружен терминологией и искусственно уплотнен.`
      });
    }
    if (threeGramStatus.status === 'red') {
      globalDeficits.push({
        type: 'three_gram_deficit',
        severity: 'danger',
        title: 'Слишком низкий повтор 3-грамм',
        text: `Повтор ${threeGramResult.repetitionRate.toFixed(1)}% (ориентир ИИ: ≤ ${settings.threeGramRepetition.aiRed}%). Чекер штрафует за искусственное избегание естественных повторов.`
      });
    }
    if (stdDevIsWarning) {
      globalDeficits.push({
        type: 'rhythm_uniformity',
        severity: 'warning',
        title: 'Слишком «ровные» предложения',
        text: `Стандартное отклонение длины — ${stdDevVal.toFixed(1)} слов (ниже вашего порога ${stdDevWarningMin}). Предложения одинаковы по размеру.`
      });
    }
    if (burstinessResult.status === 'red') {
      globalDeficits.push({
        type: 'low_burstiness',
        severity: 'danger',
        title: 'Низкая бёрстиность (Burstiness) — сигнатура ZeroGPT / GPTZero',
        text: `Коэффициент вариации длины предложений — всего ${burstinessResult.cvPercent}% (красная зона ИИ: <38%, норма живого автора: ≥50%, средний скачок: ${burstinessResult.meanDelta} сл.). Монотонно выверенный синтаксис сразу распознается детекторами. Разбавьте текст короткими рублено-акцентными фразами (3–6 слов) и сложными развернутыми периодами (35–45 слов).`
      });
    } else if (burstinessResult.status === 'yellow') {
      globalDeficits.push({
        type: 'moderate_burstiness',
        severity: 'warning',
        title: 'Умеренная бёрстиность (Burstiness)',
        text: `Вариативность ритма ${burstinessResult.cvPercent}% (рекомендуется ≥50%, средний скачок длины: ${burstinessResult.meanDelta} сл.). Желательно усилить перепад объемов предложений для надежного прохождения чекеров.`
      });
    }
    if (starterIsWarning) {
      globalDeficits.push({
        type: 'starter_uniformity',
        severity: 'warning',
        title: 'Однообразные зачины',
        text: `${starterResult.maxRatio.toFixed(1)}% предложений начинаются со слова «${starterResult.topStarter}».`
      });
    }

    // Turnitin Method 1: Проверка монотонности длины абзацев (4–6 предложений)
    const paragraphs = parsedDoc.paragraphs || [];
    if (paragraphs.length >= 3) {
      const fourToSixCount = paragraphs.filter(p => p.sentenceCount >= 4 && p.sentenceCount <= 6).length;
      const shortCount = paragraphs.filter(p => p.sentenceCount <= 2).length;
      const longCount = paragraphs.filter(p => p.sentenceCount >= 8).length;
      const ratioFourToSix = fourToSixCount / paragraphs.length;

      if (ratioFourToSix >= 0.7 && shortCount === 0 && longCount === 0) {
        globalDeficits.push({
          type: 'paragraph_monotony',
          severity: 'warning',
          title: 'Монотонная структура абзацев (сигнатура Turnitin)',
          text: `${Math.round(ratioFourToSix * 100)}% абзацев содержат по 4–6 предложений со стандартным ритмом (тезис → 2 поддержки → связка). Разбейте часть абзацев на 2–3 предложения, добавьте одно предложение-акцент или увеличьте один абзац с фактами до 8–10 предложений (Turnitin Method 1).`
        });
      }
    }

    // Turnitin / GPTZero Method 2: Серии предложений по 15–25 слов подряд
    let maxConsecutiveAiLength = 0;
    let curConsecutive = 0;
    for (const s of sentences) {
      if (s.wordCount >= 15 && s.wordCount <= 25) {
        curConsecutive++;
        if (curConsecutive > maxConsecutiveAiLength) maxConsecutiveAiLength = curConsecutive;
      } else {
        curConsecutive = 0;
      }
    }
    if (maxConsecutiveAiLength >= 4) {
      globalDeficits.push({
        type: 'rhythm_monotony_run',
        severity: 'warning',
        title: 'Монотонный ритм предложений (серия по 15–25 слов)',
        text: `Обнаружена серия из ${maxConsecutiveAiLength} предложений подряд длиной 15–25 слов (сигнатура GPTZero v3.4). Человеческий текст чередует очень короткие фразы и развернутые предложения с придаточными (burstiness).`
      });
    }

    // Turnitin Method 5: Абстрактные обобщения без конкретики
    const hedgesFound = sentences.filter(s => s.issues && s.issues.some(i => i.type === 'abstract_hedge')).length;
    if (hedgesFound > 0) {
      globalDeficits.push({
        type: 'abstract_hedges_flag',
        severity: 'warning',
        title: 'Абстрактные обобщения без конкретики',
        text: `Найдено ${hedgesFound} предложений с абстрактными штампами («многие авторы», «some researchers argue»). Замените их на конкретную фамилию, год или ссылку на работу (Turnitin Method 5).`
      });
    }
  }

  // Сбор всех предложений с нарушениями
  const issueSentences = sentences
    .filter(s => s.issues && s.issues.length > 0)
    .map(s => ({
      index: s.index,
      cleanText: s.cleanText,
      wordCount: s.wordCount,
      startOffset: s.startOffset,
      endOffset: s.endOffset,
      issues: s.issues,
      highWordLengthNote: s.highWordLengthNote,
      maxSeverity: s.issues.some(i => i.severity === 'danger') ? 'danger' : 'warning'
    }));

  return {
    isLowData,
    minWords,
    minSentences,
    sentenceCount,
    wordCount,
    totalWordsCount,
    charsWithSpaces,
    charsNoSpaces,

    // Семь базовых метрик
    metrics: {
      avgSentenceLength: {
        value: avgSentenceLengthVal,
        formatted: avgSentenceLengthVal.toFixed(1),
        unit: 'слов',
        human: settings.avgSentenceLength.human,
        aiRed: settings.avgSentenceLength.aiRed,
        name: 'Средняя длина предложения',
        ...avgSentenceStatus
      },
      longSentenceRatio: {
        value: longSentenceRatioVal,
        formatted: `${longSentenceRatioVal.toFixed(1)}%`,
        count: longSentences.length,
        total: sentenceCount,
        threshold: longThreshold,
        human: `${settings.longSentenceRatio.human}%`,
        aiRed: `≥ ${settings.longSentenceRatio.aiRed}%`,
        name: 'Доля очень длинных (41+)',
        ...longSentenceStatus
      },
      shortSentenceRatio: {
        value: shortSentenceRatioVal,
        formatted: `${shortSentenceRatioVal.toFixed(1)}%`,
        count: shortSentences.length,
        total: sentenceCount,
        threshold: shortThreshold,
        human: `${settings.shortSentenceRatio.human}%`,
        aiRed: `≤ ${settings.shortSentenceRatio.aiRed}%`,
        name: 'Доля очень коротких (≤6)',
        note: 'порог ≤6 — допущение',
        ...shortSentenceStatus
      },
      stopwordRatio: {
        value: stopwordRatioVal,
        formatted: `${stopwordRatioVal.toFixed(1)}%`,
        count: stopwords.length,
        total: wordCount,
        human: `${settings.stopwordRatio.human}%`,
        aiRed: `≤ ${settings.stopwordRatio.aiRed}%`,
        name: 'Доля служебных слов',
        ...stopwordStatus
      },
      avgWordLength: {
        value: avgWordLengthVal,
        formatted: avgWordLengthVal.toFixed(2),
        unit: 'букв',
        human: settings.avgWordLength.human,
        aiRed: settings.avgWordLength.aiRed,
        name: 'Средняя длина слова',
        ...avgWordLengthStatus
      },
      longWordRatio: {
        value: longWordRatioVal,
        formatted: `${longWordRatioVal.toFixed(1)}%`,
        count: longWords.length,
        total: wordCount,
        threshold: longWordsThreshold,
        human: `${settings.longWordRatio.human}%`,
        aiRed: `≥ ${settings.longWordRatio.aiRed}%`,
        name: 'Доля длинных слов (8+)',
        ...longWordStatus
      },
      threeGramRepetition: {
        value: threeGramResult.repetitionRate,
        formatted: `${threeGramResult.repetitionRate.toFixed(1)}%`,
        totalGrams: threeGramResult.totalGrams,
        uniqueGrams: threeGramResult.uniqueGrams,
        topRepeats: threeGramResult.topRepeats,
        human: `${settings.threeGramRepetition.human}%`,
        aiRed: `≤ ${settings.threeGramRepetition.aiRed}%`,
        name: 'Повтор 3-грамм',
        note: 'локальный прокси',
        ...threeGramStatus
      }
    },

    // Дополнительные показатели
    extras: {
      stdDev: {
        value: stdDevVal,
        formatted: `${stdDevVal.toFixed(1)} сл.`,
        isWarning: stdDevIsWarning
      },
      burstiness: {
        ...burstinessResult,
        formatted: `${burstinessResult.cvPercent}%`,
        isWarning: !isLowData && burstinessResult.isWarning
      },
      starterUniformity: {
        ...starterResult,
        formatted: `${starterResult.maxRatio.toFixed(1)}%`,
        isWarning: starterIsWarning
      }
    },

    globalDeficits,
    issueSentences
  };
}
