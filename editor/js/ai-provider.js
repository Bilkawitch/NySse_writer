/**
 * js/ai-provider.js - Модуль интеграции с ИИ-провайдерами (OpenRouter, DeepSeek, OpenAI, Groq, Ollama)
 * Работает напрямую из браузера (CORS / direct fetch) без сторонних бэкендов.
 * API-ключ сохраняется строго локально в настройках пользователя.
 */

import { getSettings } from './settings.js?v=2.2.4';

// Пресеты провайдеров
export const AI_PRESETS = {
  openrouter: {
    name: 'OpenRouter (рекомендуется для браузера)',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'deepseek/deepseek-chat',
    models: [
      'deepseek/deepseek-chat',
      'anthropic/claude-3.5-sonnet',
      'meta-llama/llama-3.3-70b-instruct',
      'google/gemini-2.0-flash-001'
    ],
    hint: 'Поддерживает любые модели, прямой CORS из браузера'
  },
  deepseek: {
    name: 'DeepSeek API',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    hint: 'Официальный китайский сервер DeepSeek (требует баланс)'
  },
  openai: {
    name: 'OpenAI API',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o'],
    hint: 'Официальный OpenAI API'
  },
  groq: {
    name: 'Groq Cloud',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    hint: 'Мгновенный инференс Llama-3'
  },
  inceptionlabs: {
    name: 'Inception Labs API',
    baseUrl: 'https://api.inceptionlabs.ai/v1',
    defaultModel: 'mercury-2.5',
    models: ['mercury-2.5'],
    hint: 'Inception Labs (Diffusion LLM Mercury-2.5)'
  },
  ollama: {
    name: 'Ollama (локально на вашем ПК)',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    models: ['llama3.2', 'qwen2.5', 'mistral'],
    hint: '100% бесплатно и офлайн, ключ не требуется'
  },
  custom: {
    name: 'Свой OpenAI-совместимый endpoint',
    baseUrl: '',
    defaultModel: '',
    models: [],
    hint: 'Любой сервер vLLM, LM Studio, LiteLLM'
  }
};

/**
 * Проверка соединения с выбранным провайдером
 */
export async function testAiConnection(config) {
  const cfg = config || getSettings().aiConfig;
  if (!cfg.baseUrl) throw new Error('Не указан URL провайдера');
  if (!cfg.apiKey && cfg.provider !== 'ollama') throw new Error('Не указан API-ключ');

  const url = `${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json'
  };

  if (cfg.apiKey) {
    headers['Authorization'] = `Bearer ${cfg.apiKey.trim()}`;
  }
  if (cfg.provider === 'openrouter') {
    headers['HTTP-Referer'] = window.location.origin || 'https://bilkawitch.github.io';
    headers['X-Title'] = 'NySse Writer';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: cfg.model || 'deepseek/deepseek-chat',
        messages: [{ role: 'user', content: 'Ответь одним словом: OK' }],
        max_tokens: 10
      })
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      let msg = errorBody.slice(0, 150);
      try {
        const json = JSON.parse(errorBody);
        if (json.error?.message) msg = json.error.message;
      } catch (e) {}
      throw new Error(`Статус ${response.status}: ${msg}`);
    }

    return true;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Таймаут соединения (12 сек). Проверьте URL или интернет.');
    }
    throw err;
  }
}

/**
 * Вызов семантического аудита текста через LLM с детальными критериями Turnitin / GPTZero
 */
export async function runAiSemanticAudit(rawText, metricsSummary, parsedDoc) {
  const cfg = getSettings().aiConfig;
  if (!cfg || (!cfg.apiKey && cfg.provider !== 'ollama')) {
    throw new Error('ИИ-провайдер не настроен. Перейдите в Настройки (⚙) -> вкладка "ИИ Провайдер" и укажите API-ключ.');
  }

  const systemPrompt = `Ты — ведущий эксперт по научному академическому стилю и аналитик математических сигнатур детекторов ИИ (ZeroGPT, GPTZero v3.4, CopyLeaks, Turnitin).
Твоя цель: найти в тексте научной статьи семантические, структурные и математические маркеры генеративного происхождения и предложить точные авторские формулировки для их устранения.

МАТЕМАТИЧЕСКИЙ ФУНДАМЕНТ ДЕТЕКЦИИ ИИ:
Детекторы ИИ анализируют текст не по «смыслу», а по двум математическим метрикам: перплексии (perplexity) и бёрстиности (burstiness).

1. ПЕРПЛЕКСИЯ (Perplexity — мера статистической неожиданности/непредсказуемости следующего токена для языковой модели):
   - Нулевая / низкая перплексия (главная сигнатура ИИ): текст вычищен до статистически идеальных академических штампов, предсказуемых цепочек токенов (top-1 вероятностей) и бесконфликтно гладких конструкций. Каждое следующее слово предсказывается трансформером со 100% вероятностью.
   - Высокая перплексия (почерк живого исследователя): присутствуют органичные речевые шероховатости, авторская лексическая несогласованность, неоптимальный/нетривиальный порядок слов, инверсии, специфические терминологические связки и редкие авторские синонимы.
   - ТВОЯ ЗАДАЧА: выявлять в тексте фразы с «зализанной» нулевой перплексией и предлагать варианты их огрубления и очеловечивания: ломать тривиальный порядок слов, заменять статистически заезженные академические коллокации на живую авторскую речь с высокой перплексией.

2. БЁРСТИНОСТЬ (Burstiness — неравномерность и взрывной характер длины предложений и синтаксических конструкций):
   - Нулевая / низкая бёрстиность (сигнатура ИИ): монотонный ритм, предложения выровнены по длине (15–25 слов подряд), предсказуемая структура (подлежащее + сказуемое + придаточное).
   - Высокая бёрстиность (почерк живого человека): резкий взрывной ритм — короткие рубленые тезисы и акценты (3–6 слов) чередуются со сложными развернутыми периодами (35–45+ слов) с тире, оговорками и сменой темпа.
   - ТВОЯ ЗАДАЧА: отслеживать монотонные серии предложений с низкой бёрстиностью и предлагать перестройку фрагментов с резким перепадом длины.

КЛЮЧЕВЫЕ ПРАКТИЧЕСКИЕ МЕТОДЫ (7 СТРАТЕГИЙ СНИЖЕНИЯ ОЦЕНКИ ИИ):
1. СТРУКТУРА И РИТМ АБЗАЦЕВ (Method 1 — Break the Paragraph-Length Pattern):
   - ИИ пишет абзацы одинаковой предсказуемой длины: 4–6 предложений со стандартным битом [Тезис → Аргумент 1 → Аргумент 2 → Синтетический переход].
   - Живой автор ломает паттерн: чередует короткие абзацы по 2–3 предложения, вставляет одиночные предложения-акценты и разворачивает глубокие блоки на 8–10 предложений с детальным разбором кейса.
2. ВАРИАТИВНОСТЬ РИТМА ПРЕДЛОЖЕНИЙ / BURSTINESS (Method 2 — Sentence-Length Variance):
   - Устраняй монотонные серии предложений средней длины 15–25 слов. Создавай контрастный взрывной ритм.
3. ЗАМЕНА ШАБЛОННЫХ СВЯЗОК (Method 3 — Replace Formulaic Transitions):
   - Устраняй клише: "Moreover", "Furthermore", "In addition", "In conclusion", "It is important to note", "Таким образом", "В заключение стоит подчеркнуть", "Следует отметить", "Необходимо подчеркнуть", "Более того", "Кроме того".
   - Заменяй их смысловой отсылкой («Опираясь на упомянутый тезис о...») либо удаляй вовсе, если мысль логична.
4. АВТОРСКИЙ ГОЛОС И ПЕРВОЕ ЛИЦО (Method 4 — Add First-Person Voice Where Appropriate):
   - Заменяй безликую стерильность («В данной статье рассматривается») на живую позицию исследователя («Первоначально мы предполагали X, однако при проверке...»).
5. ПРЕДМЕТНЫЕ ДЕТАЛИ ВМЕСТО АБСТРАКТНЫХ ГЕНЕРАЛИЗАЦИЙ (Method 5 — Ungoogleable Specifics):
   - ИИ маскирует незнание абстракциями («многие исследователи сходятся во мнении», «ряд ученых полагает», «many studies show»). Заменяй их на конкретные фамилии, года, названия институтов, технологий или эмпирических выборок.
6. ВЫЧИТКА ВСЛУХ И СИНТАКСИЧЕСКАЯ ЕСТЕСТВЕННОСТЬ (Method 6 — Read Aloud & Awkward Syntax):
   - Находи тяжелые, бумажные, неестественные для живой речи синтаксические конструкции машинного синтеза.
7. СТРУКТУРНОЕ ОЧЕЛОВЕЧИВАНИЕ (Method 7 — Structural Humanizer & Perplexity Boost):
   - Перестраивай саму логическую конструкцию фразы для разрыва тривиальных вероятностных цепочек токенов (LLM perplexity).

ФОРМАТ ОТВЕТА:
Верни СТРОГО валидный JSON (без вступительных и заключительных фраз, без markdown-кавычек):
{
  "overallAiRisk": "high" | "medium" | "low",
  "riskPercent": 82,
  "summary": "Краткий вывод для автора: оценка перплексии, бёрстиности и ключевые уязвимости перед детекторами",
  "paragraphBeatNotes": [
    {
      "paragraphIndex": 1,
      "pattern": "Тезис -> Обоснование -> Синтетический переход",
      "isMonotonous": true,
      "advice": "Разбейте на два коротких абзаца или добавьте живой эмпирический пример"
    }
  ],
  "issues": [
    {
      "category": "low_perplexity" | "low_burstiness" | "formulaic_transition" | "monotonous_rhythm" | "abstract_vagueness" | "awkward_phrasing" | "first_person_absence",
      "severity": "danger" | "warning",
      "originalSentence": "Точное предложение из текста статьи без искажений (чтобы можно было найти поиском в редакторе)",
      "flaw": "Конкретная причина: нулевая перплексия / академический штамп, монотонная бёрстиность, абстракция или машинный синтаксис",
      "suggestedRewrite": "Конкретный переписанный человеком вариант с высокой перплексией / взрывным ритмом для мгновенной подстановки в текст",
      "benefit": "Какую именно математическую сигнатуру ИИ (перплексию или бёрстиность) это исправляет"
    }
  ]
}`;

  const wordsCount = parsedDoc?.totalWordsCount || 0;
  const charsCount = parsedDoc?.charsWithSpaces || 0;
  const avgLen = metricsSummary?.metrics?.avgSentenceLength?.value ? metricsSummary.metrics.avgSentenceLength.value.toFixed(1) : '—';
  const avgHuman = metricsSummary?.metrics?.avgSentenceLength?.human ?? 23.2;
  const avgAi = metricsSummary?.metrics?.avgSentenceLength?.aiRed ?? 29.2;
  const longRatio = metricsSummary?.metrics?.longSentenceRatio?.value ? metricsSummary.metrics.longSentenceRatio.value.toFixed(1) : '0.0';
  const longAi = metricsSummary?.metrics?.longSentenceRatio?.aiRed ?? 17.0;
  const shortRatio = metricsSummary?.metrics?.shortSentenceRatio?.value ? metricsSummary.metrics.shortSentenceRatio.value.toFixed(1) : '0.0';
  const shortAi = metricsSummary?.metrics?.shortSentenceRatio?.aiRed ?? 2.4;
  const stopRatio = metricsSummary?.metrics?.stopwordRatio?.value ? metricsSummary.metrics.stopwordRatio.value.toFixed(1) : '0.0';
  const stopAi = metricsSummary?.metrics?.stopwordRatio?.aiRed ?? 33.0;
  const starterPercent = metricsSummary?.extras?.starterUniformity?.maxRatio ? metricsSummary.extras.starterUniformity.maxRatio.toFixed(1) : '0.0';
  const topWord = metricsSummary?.extras?.starterUniformity?.topStarter || '—';
  const stdDev = metricsSummary?.extras?.stdDev?.value ? metricsSummary.extras.stdDev.value.toFixed(1) : '0.0';
  const burstinessCv = metricsSummary?.extras?.burstiness?.cvPercent ?? '0';
  const burstinessDelta = metricsSummary?.extras?.burstiness?.meanDelta ?? '0.0';
  const threeGramRatio = metricsSummary?.metrics?.threeGramRepetition?.value ? metricsSummary.metrics.threeGramRepetition.value.toFixed(1) : '0.0';
  const threeGramAi = metricsSummary?.metrics?.threeGramRepetition?.aiRed ?? 1.4;

  const metricsContext = `ДАННЫЕ ОБЪЕКТИВНЫХ СКРИПТОВЫХ ИЗМЕРЕНИЙ ДАННОГО ТЕКСТА:
- Слов: ${wordsCount}, Знаков: ${charsCount}
- Бёрстиность (Burstiness CV): ${burstinessCv}% (Красная зона ИИ: <38%, Норма живого автора: ≥50%)
- Средний скачок длины предложений (Mean Delta): ${burstinessDelta} сл.
- Вариативность ритма (SD): ${stdDev} сл.
- Средняя длина предложения: ${avgLen} (Норма: ${avgHuman}, ИИ: ${avgAi})
- Доля длинных 41+: ${longRatio}% (ИИ: >=${longAi}%)
- Доля коротких <=6: ${shortRatio}% (У ИИ дефицит: <=${shortAi}%)
- Доля служебных слов: ${stopRatio}% (У ИИ дефицит: <=${stopAi}%)
- Повтор зачинов: ${starterPercent}% (слово «${topWord}»)
- Повтор 3-грамм: ${threeGramRatio}% (У ИИ неестественно низкий: <=${threeGramAi}%)`;

  const userContent = `${metricsContext}\n\nТЕКСТ СТАТЬИ ДЛЯ АНАЛИЗА:\n"""\n${rawText}\n"""`;

  const url = `${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json'
  };
  if (cfg.apiKey) {
    headers['Authorization'] = `Bearer ${cfg.apiKey.trim()}`;
  }
  if (cfg.provider === 'openrouter') {
    headers['HTTP-Referer'] = window.location.origin || 'https://bilkawitch.github.io';
    headers['X-Title'] = 'NySse Writer';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: cfg.model || 'deepseek/deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.2,
      max_tokens: 4000
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Ошибка ИИ-сервера (${response.status}): ${errorBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const rawReply = data.choices?.[0]?.message?.content || '';

  return parseAiJsonResponse(rawReply);
}

/**
 * Безопасный парсинг JSON из ответа языковой модели
 */
function parseAiJsonResponse(text) {
  if (!text) throw new Error('Пустой ответ от ИИ-модели');

  // Очистка от ```json ... ``` если модель завернула в markdown
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Попытка извлечь JSON через regex поиска первого { и последнего }
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    console.error('Сырой ответ ИИ:', text);
    throw new Error('ИИ вернул ответ не в формате JSON: ' + err.message);
  }
}
