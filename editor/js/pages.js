/**
 * js/pages.js - Оценка объема текста в страницах A4
 * 
 * Принцип:
 * 1. Основная оценка — физическое измерение высоты вёрстки в скрытом блоке
 *    с шириной печатной области A4 (210 мм минус поля) при 14 pt / 1.5 интервал для текста
 *    и 11 pt для таблиц.
 * 2. Вспомогательная грубая оценка — стандартные нормативы учебных/научных работ:
 *    1800 знаков с пробелами на страницу для 14 pt, ~2900 знаков для 11 pt.
 */

import { getSettings } from './settings.js';

let sandboxEl = null;
let gaugeEl = null;
let mainTextEl = null;
let tablesEl = null;

/**
 * Инициализация или получение элементов песочницы для замера
 */
function getSandbox() {
  if (!sandboxEl) {
    sandboxEl = document.createElement('div');
    sandboxEl.id = 'a4-measure-sandbox';
    sandboxEl.setAttribute('aria-hidden', 'true');
    sandboxEl.style.cssText = `
      position: absolute !important;
      left: -99999px !important;
      top: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      overflow: hidden !important;
      contain: layout style !important;
    `;

    // Калибровочный элемент высоты одного листа A4 без полей
    gaugeEl = document.createElement('div');
    gaugeEl.className = 'a4-gauge';
    sandboxEl.appendChild(gaugeEl);

    // Контейнер основного текста (14 pt)
    mainTextEl = document.createElement('div');
    mainTextEl.className = 'a4-main-text-measure';
    sandboxEl.appendChild(mainTextEl);

    // Контейнер таблиц (11 pt)
    tablesEl = document.createElement('div');
    tablesEl.className = 'a4-tables-measure';
    sandboxEl.appendChild(tablesEl);

    document.body.appendChild(sandboxEl);
  }
  return { sandboxEl, gaugeEl, mainTextEl, tablesEl };
}

/**
 * Оценка страниц A4 на основе синтаксического разбора документа
 */
export function estimateA4Pages(parsedDoc, settings = getSettings()) {
  const pageConf = settings.pageEstimation || {
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
  };

  const {
    sentences,
    tables,
    charsWithSpaces,
    charsNoSpaces,
    tableCharsWithSpaces,
    tableCharsNoSpaces
  } = parsedDoc;

  // Если текста совсем нет
  if ((!sentences || sentences.length === 0) && (!tables || tables.length === 0)) {
    return {
      totalPages: 0,
      formattedTotal: '0',
      mainPages: 0,
      tablePages: 0,
      wholePages: 0,
      fractional: 0,
      fractionalPercent: 0,
      charNormPages: 0,
      printableWidthMm: 210 - (pageConf.marginLeftMm + pageConf.marginRightMm),
      printableHeightMm: 297 - (pageConf.marginTopMm + pageConf.marginBottomMm),
      disclaimer: 'оценка вёрсткой, не пагинация Word'
    };
  }

  const { gaugeEl, mainTextEl, tablesEl } = getSandbox();

  // Рассчитываем физические размеры печатной области
  const printableWidthMm = Math.max(50, 210 - (pageConf.marginLeftMm + pageConf.marginRightMm));
  const printableHeightMm = Math.max(50, 297 - (pageConf.marginTopMm + pageConf.marginBottomMm));

  // Настройка стилей песочницы под текущие настройки
  gaugeEl.style.height = `${printableHeightMm}mm`;

  const commonStyle = `
    width: ${printableWidthMm}mm;
    box-sizing: border-box;
    font-family: ${pageConf.fontFamily};
    line-height: ${pageConf.lineHeight};
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
    letter-spacing: normal;
    text-rendering: optimizeLegibility;
  `;

  mainTextEl.style.cssText = `
    ${commonStyle}
    font-size: ${pageConf.fontSizePt}pt;
  `;

  tablesEl.style.cssText = `
    ${commonStyle}
    font-size: ${pageConf.tableFontSizePt}pt;
  `;

  // Подготовка текста для основного блока (только предложения, без таблиц)
  const fullMainText = sentences.map(s => s.rawText).join('');
  mainTextEl.textContent = fullMainText;

  // Подготовка DOM таблиц для 11 pt
  tablesEl.innerHTML = '';
  for (const table of tables) {
    const tableTable = document.createElement('table');
    tableTable.style.cssText = `
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
      font-size: ${pageConf.tableFontSizePt}pt;
      line-height: 1.25;
    `;
    for (const row of table.rows) {
      const tr = document.createElement('tr');
      for (const col of row) {
        const td = document.createElement('td');
        td.style.border = '1px solid #aaa';
        td.style.padding = '4px 6px';
        td.textContent = col;
        tr.appendChild(td);
      }
      tableTable.appendChild(tr);
    }
    tablesEl.appendChild(tableTable);
  }

  // Измерение высоты в пикселях
  const printableHeightPx = gaugeEl.getBoundingClientRect().height || 1;
  const mainHeightPx = mainTextEl.getBoundingClientRect().height;
  const tablesHeightPx = tablesEl.getBoundingClientRect().height;

  const mainPages = mainHeightPx / printableHeightPx;
  const tablePages = tablesHeightPx / printableHeightPx;
  const totalPages = mainPages + tablePages;

  const wholePages = Math.floor(totalPages);
  const fractional = totalPages - wholePages;
  const fractionalPercent = Math.round(fractional * 100);

  // Расчет по нормативу знаков (1800 для 14 pt, 2900 для 11 pt)
  const mainChars = Math.max(0, charsWithSpaces - tableCharsWithSpaces);
  const mainNormPages = mainChars / (pageConf.charsPerA4MainNorm || 1800);
  const tableNormPages = tableCharsWithSpaces / (pageConf.charsPerA4TableNorm || 2900);
  const charNormPages = mainNormPages + tableNormPages;

  return {
    totalPages: Math.round(totalPages * 10) / 10,
    formattedTotal: totalPages < 0.1 && totalPages > 0 ? totalPages.toFixed(2) : totalPages.toFixed(1),
    mainPages: Math.round(mainPages * 10) / 10,
    tablePages: Math.round(tablePages * 10) / 10,
    wholePages,
    fractional: Math.round(fractional * 100) / 100,
    fractionalPercent,
    charNormPages: Math.round(charNormPages * 10) / 10,
    printableWidthMm,
    printableHeightMm,
    mainChars,
    tableChars: tableCharsWithSpaces,
    disclaimer: 'оценка вёрсткой, не пагинация Word'
  };
}
