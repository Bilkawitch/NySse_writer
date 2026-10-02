---
name: NySse Writer
description: Тактический академический редактор и терминал анализа текста в эстетике NieR:Automata
colors:
  canvas-khaki: "#bcc0a4"
  header-sand: "#b5b99e"
  paper-parchment: "#d7dac0"
  sidebar-slate: "#20221b"
  card-black: "#171913"
  card-hover: "#1e2018"
  ticker-sand: "#cbd0b4"
  border-tactical: "#777b65"
  border-card: "#2f3227"
  border-paper-inner: "#9da288"
  text-ink: "#1f211a"
  text-ink-muted: "#4e5241"
  text-light: "#dcdfc7"
  text-light-muted: "#959a82"
  status-green: "#84a956"
  status-yellow: "#d69e2e"
  status-red: "#e05252"
  status-neutral: "#676c56"
  hl-danger: "rgba(224, 82, 82, 0.22)"
  hl-warning: "rgba(214, 158, 46, 0.20)"
  hl-table: "rgba(90, 105, 145, 0.15)"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "58px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.08em"
  document:
    fontFamily: "'Times New Roman', Georgia, serif"
    fontSize: "1.15rem"
    fontWeight: 400
    lineHeight: 1.75
  interface:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.78rem"
    fontWeight: 600
    lineHeight: 1.45
  badge:
    fontFamily: "-apple-system, BlinkMacSystemFont, monospace"
    fontSize: "0.68rem"
    fontWeight: 800
    letterSpacing: "0.04em"
rounded:
  none: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "24px"
components:
  tab-active:
    backgroundColor: "{colors.sidebar-slate}"
    textColor: "{colors.text-light}"
    rounded: "{rounded.none}"
    padding: "5px 16px"
  tab-inactive:
    backgroundColor: "transparent"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.none}"
    padding: "5px 16px"
  card-metric:
    backgroundColor: "{colors.card-black}"
    textColor: "{colors.text-light}"
    rounded: "{rounded.none}"
    padding: "8px 10px"
  button-tactical:
    backgroundColor: "transparent"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.none}"
    padding: "4px 10px"
  button-tactical-accent:
    backgroundColor: "{colors.sidebar-slate}"
    textColor: "{colors.text-light}"
    rounded: "{rounded.none}"
    padding: "4px 10px"
---

# Design System: NySse Writer

## Overview

**Creative North Star: "Tactical Archive"**

NySse Writer объединяет две контрастные среды: аналоговый академический лист на плотном песочно-оливковом пергаменте и прецизионный military-терминал в духе пользовательских интерфейсов *NieR:Automata*. Вся композиция строится на контрасте теплого оливкового холста (`#bcc0a4`) и глубокого матового тактического слейта правой панели (`#20221b`).

Интерфейс отвергает округлые потребительские формы современных SaaS и выдерживает эстетику инженерного инструмента: строгие контуры, нулевые радиусы скругления (`0px`), калибровочные треугольные линейки, фоновые прицельные дуги и клавиатурные плашки команд.

**Key Characteristics:**
- **Двухтональный контраст:** светлый бумажный центр для чтения и монохромная темная консоль данных справа.
- **Инженерная разметка:** линейки с ритмичным чередованием символов (`▲ · · · ▼`), водяной знак серии `NYSSS-W.`, двойные контуры листа.
- **Сегментированные индикаторы:** шкалы статусов выполнены в виде цепочки 10 дискретных квадратных блоков (`■■■■■■□□□□`).
- **Брутализм контуров:** абсолютно плоские стыки без радиусов скругления.

## Colors

Палитра вдохновлена архивными военными схемами, матовым анодированным металлом и бумажными картотеками полевых штабов.

### Primary
- **Canvas Khaki** (`#bcc0a4`): Базовый тон холста и рабочего пространства. Создает ощущение приглушенного технического экрана.
- **Paper Parchment** (`#d7dac0`): Плотный бумажный фон документа-черновика с высокой контрастностью для черного текста.
- **Sidebar Slate** (`#20221b`): Глубокий оливково-черный тон боковой консоли аудита.

### Secondary
- **Header Sand** (`#b5b99e`): Тон шапки приложения и полосы вкладок.
- **Ticker Sand** (`#cbd0b4`): Нижняя полоса подсказок и статуса клавиш.
- **Border Tactical** (`#777b65`): Четкий графитовый контур разделителей, линеек и таблиц.

### Neutral
- **Text Ink** (`#1f211a`): Глубокий матовый чернильный цвет для текста документа и заголовков шапки.
- **Text Light** (`#dcdfc7`): Светло-оливковый цвет значений и меток в темной консоли.
- **Card Black** (`#171913`): Фон карточек метрик и счетчиков объема.

### Diagnostic & Status
- **Status Green** (`#84a956`): Естественная человеческая норма.
- **Status Yellow** (`#d69e2e`): Переходная пограничная зона между ориентиром человека и ИИ.
- **Status Red** (`#e05252`): Красная граница стороны ИИ со знаком `!`.

### Named Rules
**The Paper Separation Rule.** Текст автора всегда живет на светлой подложке (`#d7dac0`) с темным шрифтом (`#1f211a`), сохраняя комфорт чтения физического документа. Темная тема консоли (`#20221b`) никогда не проникает внутрь самого листа.

## Typography

**Display/Watermark Font:** `-apple-system, BlinkMacSystemFont, sans-serif`  
**Document Body Font:** `Times New Roman, Georgia, serif`  
**Interface & Terminal Font:** `-apple-system, BlinkMacSystemFont, monospace`

**Character:** Контраст строгой классической антиквы научного издания и рубленого инженерного гротеска тактического терминала.

### Hierarchy
- **Display Watermark** (Weight 900, 58px, letter-spacing 0.08em): Фоновая маркировка `NYSSS-W.`, полупрозрачная (0.35 opacity).
- **Document Body** (Weight 400, 1.15rem / 18.5px, line-height 1.75): Основное поле текста и зеркальной подсветки.
- **Card Hero Value** (Weight 800, 1.25rem, line-height 1.1): Числовое значение метрики.
- **Interface Label** (Weight 700, 0.72rem, letter-spacing 0.08em): Заголовки блоков с ромбами `◇ —— НАЗВАНИЕ —— ◇`.
- **Keyboard Cap** (Weight 800, 0.72rem, monospace): Клавиатурные подсказки `[W]`, `[S]`, `[Enter]`.

## Layout

Пространственная модель фиксирована и оптимизирована под десктопное рабочее место редактора:
- **Шапка (Header):** высота 48px, фиксированная верхняя граница.
- **Подшапка (Sub-bar):** высота 36px с блоком вкладок и калибровочной треугольной линейкой.
- **Центральный вьюпорт:** центрированный контейнер документа максимальной шириной 860px.
- **Правая панель аудита:** ширина 380px, скроллируемая независимая консоль с возможностью складывания.
- **Нижний статус-бар (Ticker):** высота 38px, прижатый к нижнему краю экрана.

## Elevation & Depth

Система строго сдержанно-тактильная. Исключены размытые парящие тени (`box-shadow`), многослойные градиенты и неоновые свечения.

- Поверхности лежат в единой физической плоскости и разделяются линиями толщиной 1px (`#777b65`).
- Единственная допустимая тень — легкий вес бумажного листа над холстом (`0 8px 30px rgba(32, 35, 27, 0.22)`), имитирующий лежащий на столе документ.

## Shapes

- **Нулевые радиусы (`0px`):** все кнопки, карточки, вкладки, поля ввода и сегменты шкал имеют строго прямоугольные углы.
- **Двойные контуры:** лист документа обрамлен внешним контуром и внутренней рамкой с отступом 6px, а также угловыми L-образными засечками.
- **Декоративная планка:** на левом краю листа располагается вертикальная полоса переплета шириной 3px (`#8c9078`).

## Components

### Tactical Tabs
- Вкладки `■ DOCUMENT`, `■ ANALYSIS`, `■ HISTORY`.
- Активная: фон `#20221b`, цвет текста `#dcdfc7`, нулевой радиус.
- Неактивная: прозрачный фон, тонкий контур `#777b65`, цвет `#1f211a`.

### Triangle Ruler
- Тонкая разделительная полоса высотой 14px с циклическим микропаттерном треугольников `▲ · · · ▼ · · · ▲`.

### Metric Cards
- Фон: глубокий черный графит `#171913`, контур `#2f3227`.
- Заголовок в верхнем ряду с круглым знаком статуса: `(!)` при опасности, `(✓)` при норме.
- Сегментированная шкала: полоса из 10 квадратных сегментов, зажигающихся цветом статуса (`active-green`, `active-yellow`, `active-red`).

### Keyboard Badges
- Прямоугольные плашки клавиш `#21231c` с бежевым текстом `#dcdfc7` и микротенью, создающие тактильное ощущение аппаратных клавиш.

### Sentence Popup
- Консольная карточка `#20221b` с контуром `#3c4031`, отображающая исключительно проверенные математические факты с маркерами `◇`.

## Do's and Don'ts

### Do:
- **Do** сохранять сплошную прямоугольную геометрию (`border-radius: 0px`) для всех интерактивных элементов.
- **Do** использовать только фактологические формулировки в попапах («44 слова, порог 41»).
- **Do** сохранять дискретные 10-сегментные полосы для визуализации числовых шкал.
- **Do** проверять выравнивание зеркального слоя подсветки пиксель-в-пиксель с `textarea`.

### Don't:
- **Don't** добавлять круглые «pill» кнопки, стеклянный морфизм (glassmorphism) или размытые градиенты.
- **Don't** выводить эмоциональные или недоказуемые суждения («здесь тон ИИ»).
- **Don't** изменять цвет бумаги черновика на темный: документ должен оставаться читаемым светлым листом.
