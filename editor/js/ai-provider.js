/**
 * js/ai-provider.js - Модуль интеграции с ИИ-провайдерами (OpenRouter, DeepSeek, OpenAI, Groq, Ollama)
 * Работает напрямую из браузера (CORS / direct fetch) без сторонних бэкендов.
 * API-ключ сохраняется строго локально в настройках пользователя.
 */

import { getSettings } from './settings.js?v=2.2.1';

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
    hint: 'Официальный прямой API DeepSeek'
  },
  openai: {
    name: 'OpenAI API',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'o3-mini'],
    hint: 'Официальный API OpenAI'
  },
  groq: {
    name: 'Groq Cloud (сверхбыстрый)',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    hint: 'Мгновенный инференс Llama-3'
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

  const systemPrompt = `Ты — ведущий эксперт по научному академическому стилю и аналитик сигнатур детекторов ИИ (Turnitin, GPTZero v3.4, CopyLeaks).
Твоя цель: найти в тексте научной статьи семантические, структурные и смысловые маркеры генеративного происхождения (которые невозможно задетектировать простыми регулярными выражениями) и предложить точные авторские формулировки для их устранения.

КЛЮЧЕВЫЕ КРИТЕРИИ АНАЛИЗА (7 МЕТОДОВ СНИЖЕНИЯ ОЦЕНКИ ИИ / BYPASS DETECTORS):
1. СТРУКТУРА И РИТМ АБЗАЦЕВ (Method 1 — Break the Paragraph-Length Pattern):
   - ИИ пишет абзацы одинаковой предсказуемой длины: 4–6 предложений с шаблонным битом: [Тезис → Аргумент 1 → Аргумент 2 → Синтетический переход]. Детектор Turnitin считывает это как первичную сигнатуру.
   - Живой автор ломает этот паттерн: чередует короткие абзацы по 2–3 предложения, вставляет одиночные предложения-акценты и разворачивает глубокие блоки на 8–10 предложений с детальным разбором кейса.
2. ВАРИАТИВНОСТЬ РИТМА ПРЕДЛОЖЕНИЙ / BURSTINESS (Method 2 — Sentence-Length Variance):
   - ИИ держит монотонную среднюю длину 15–25 слов в каждом предложении.
   - Человек создает взрывной ритм (burstiness): очень короткое рубленое предложение (1–6 слов), затем длинное сложноподчиненное с вводными оговорками и авторскими отступлениями (30–45 слов), затем среднее.
3. ЗАМЕНА ШАБЛОННЫХ СВЯЗОК (Method 3 — Replace Formulaic Transitions):
   - Устраняй классические ИИ-клише: "Moreover", "Furthermore", "In addition", "In conclusion", "It is important to note", "Таким образом", "В заключение стоит подчеркнуть", "Следует отметить", "Необходимо подчеркнуть", "Более того", "Кроме того".
   - Заменяй их не на синонимы, а на смысловую отсылку к предшествующей мысли («Опираясь на упомянутый тезис о...») либо удаляй связку вовсе, если мысль логична сама по себе.
4. АВТОРСКИЙ ГОЛОС И ПЕРВОЕ ЛИЦО (Method 4 — Add First-Person Voice Where Appropriate):
   - ИИ панически избегает первого лица или пишет стерильно («В данной статье рассматривается»).
   - Живой исследователь вставляет заземленный личный опыт («Первоначально мы предполагали X, однако при проверке...»).
5. ПРЕДМЕТНЫЕ ДЕТАЛИ ВМЕСТО АБСТРАКТНЫХ ГЕНЕРАЛИЗАЦИЙ (Method 5 — Ungoogleable Specifics):
   - ИИ маскирует незнание абстракциями: «многие исследователи сходятся во мнении», «ряд ученых полагает», «many studies show», «some researchers argue».
   - Заменяй их на конкретные фамилии, года, названия институтов, технологий или эмпирических выборок.
6. ВЫЧИТКА ВСЛУХ И СИНТАКСИЧЕСКАЯ ЕСТЕСТВЕННОСТЬ (Method 6 — Read Aloud & Awkward Syntax):
   - Находи тяжелые, бумажные, неестественные для живой речи синтаксические конструкции, характерные для перевода с английского промпта или машинного синтеза.
7. СТРУКТУРНОЕ ОЧЕЛОВЕЧИВАНИЕ (Method 7 — Structural Humanizer):
   - Не просто заменяй отдельные слова, а перестраивай саму логическую конструкцию фразы для разрыва тривиальных вероятностных цепочек токенов (LLM perplexity).

ФОРМАТ ОТВЕТА:
Верни СТРОГО валидный JSON (без вступительных и заключительных фраз, без markdown-кавычек):
{
  "overallAiRisk": "high" | "medium" | "low",
  "riskPercent": 82,
  "summary": "Краткий вывод для автора: ключевые семантические уязвимости текста перед детекторами",
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
      "category": "formulaic_transition" | "monotonous_rhythm" | "abstract_vagueness" | "awkward_phrasing" | "first_person_absence",
      "severity": "danger" | "warning",
      "originalSentence": "Точное предложение из текста статьи без искажений (чтобы можно было найти поиском в редакторе)",
      "flaw": "Конкретная причина: маркер Turnitin, монотонный ритм, штамп или абстракция",
      "suggestedRewrite": "Конкретный переписанный человеком вариант для мгновенной подстановки в текст",
      "benefit": "Какую именно сигнатуру ИИ это устраняет"
    }
  ]
}`;

  const metricsContext = `ДАННЫЕ ОБЪЕКТИВНЫХ СКРИПТОВЫХ ИЗМЕРЕНИЙ ДАННОГО ТЕКСТА:
- Слов: ${parsedDoc.totalWordsCount}, Знаков: ${parsedDoc.charsWithSpaces}
- Средняя длина предложения: ${metricsSummary.metrics.avgSentenceLength.value} (Норма: ${metricsSummary.metrics.avgSentenceLength.human}, ИИ: ${metricsSummary.metrics.avgSentenceLength.aiRed})
- Доля длинных 41+: ${metricsSummary.metrics.longSentenceRatio.value}% (ИИ: >=${metricsSummary.metrics.longSentenceRatio.aiRed}%)
- Доля служебных слов: ${metricsSummary.metrics.stopwordRatio.value}% (У ИИ дефицит: <=${metricsSummary.metrics.stopwordRatio.aiRed}%)
- Повтор зачинов: ${metricsSummary.extras.starters.maxPercent}% (слово «${metricsSummary.extras.starters.topWord}»)
- Вариативность ритма (SD): ${metricsSummary.extras.stdDev.value} сл.`;

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
