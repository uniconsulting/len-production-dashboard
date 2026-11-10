import { icon } from './icons.js';

const groups = [
  { id: 'series', label: 'Серийные', color: '#f5f4ff', capacityIndex: 2 },
  { id: 'engineering', label: 'Инженерные', color: '#a9b2ff', capacityIndex: 1 },
  { id: 'xl', label: 'Сверхгабарит', color: '#ffb37a', capacityIndex: 0 },
];

const number = new Intl.NumberFormat('ru-RU');
const decimal = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const shortMonth = new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: 'UTC' });
const monthNames = [
  'январю',
  'февралю',
  'марту',
  'апрелю',
  'маю',
  'июню',
  'июлю',
  'августу',
  'сентябрю',
  'октябрю',
  'ноябрю',
  'декабрю',
];
const sum = (items) => items.reduce((total, value) => total + value, 0);
const formatMonth = (iso) =>
  shortMonth.format(new Date(iso + '-01T12:00:00Z')).replace(/\.$/, '') + ' ’' + iso.slice(2, 4);
const formatRate = (value) => decimal.format(value * 100) + '%';

function compactMoney(value) {
  if (value >= 1e6) return compact.format(value / 1e6) + ' млн';
  if (value >= 1000) return number.format(Math.round(value / 1000)) + ' тыс.';
  return number.format(value);
}

// Same layered, centre-out stream and softened tangents as the supplied Net Worth chart.
// Restrict vertical tangents to the segment range so a flat plan remains flat.
function smoothPath(points, move = 'M') {
  const coord = (p) => p.map((v) => +v.toFixed(2)).join(' ');
  let path = move + coord(points[0]);
  for (let i = 0; i < points.length - 1; i++) {
    const before = points[i - 1] || points[i];
    const start = points[i];
    const end = points[i + 1];
    const after = points[i + 2] || end;
    const bounded = (value) =>
      Math.min(Math.max(start[1], end[1]), Math.max(Math.min(start[1], end[1]), value));
    const c1 = [start[0] + (end[0] - before[0]) * 0.17, bounded(start[1] + (end[1] - before[1]) * 0.17)];
    const c2 = [end[0] - (after[0] - start[0]) * 0.17, bounded(end[1] - (after[1] - start[1]) * 0.17)];
    path += 'C' + coord(c1) + ' ' + coord(c2) + ' ' + coord(end);
  }
  return path;
}

function streamChart(model, rows, selected) {
  const indexes = groups.map((group) =>
    model.printers.flatMap((p, i) => (p.group === group.id ? [i] : [])),
  );
  const totals = rows.map((row) =>
    indexes.map((machines) => sum(machines.map((i) => row.machineRevenue[i]))),
  );
  const maximum = Math.max(...rows.map((row) => row.revenue), 1);
  const width = 1000,
    middle = 100,
    height = 77;
  const positions = rows.map((_, i) => ((i + 0.5) / rows.length) * width);
  const paths = groups
    .map((group, g) => {
      const half = totals.map((values) => (sum(values.slice(0, g + 1)) / maximum) * height);
      const edge = (sign) => [
        [0, middle + sign * half[0]],
        ...half.map((v, i) => [positions[i], middle + sign * v]),
        [width, middle + sign * half.at(-1)],
      ];
      return `<path fill="${group.color}" d="${smoothPath(edge(-1))}${smoothPath(edge(1).reverse(), 'L')}Z"/>`;
    })
    .reverse()
    .join('');

  const marks = new Set([
    Math.round((rows.length - 1) * 0.18),
    Math.round((rows.length - 1) * 0.55),
    rows.length - 1,
  ]);
  const buttons = rows
    .map((row, i) => {
      const edge = i === 0 ? 'is-first' : i === rows.length - 1 ? 'is-last' : '';
      const isActive = row.m === selected;
      const description =
        `${formatMonth(row.date)}, выручка ${number.format(Math.round(row.revenue))} ₽. ` +
        groups
          .map((group, g) => `${group.label} ${number.format(Math.round(totals[i][g]))} ₽`)
          .join(', ');
      return `<button type="button" class="ref-month ${edge} ${marks.has(i) ? 'is-mark' : ''}" data-lead-month="${row.m}"
      aria-pressed="${isActive}" tabindex="${isActive ? 0 : -1}" aria-label="${description}" title="${description}"><span class="ref-month-wire"></span>
      <span class="ref-month-label ref-month-amount">${compactMoney(row.revenue)}</span>
      <span class="ref-month-label ref-month-date">${formatMonth(row.date)}</span></button>`;
    })
    .join('');
  return {
    ink: `<svg class="ref-stream-ink" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true" focusable="false">${paths}</svg>`,
    controls: `<div class="ref-stream" role="group" aria-label="Выручка без НДС по группам принтеров. Стрелки влево и вправо выбирают месяц.">
      <div class="ref-months">${buttons}</div></div>`,
  };
}

function revenueCard(model, cs, r) {
  const initialYear = Number(cs.months[0].date.slice(0, 4));
  const currentYear = Number(r.date.slice(0, 4));
  // Keep launch December with its first operating year; every other page is a calendar year.
  const period = cs.months.filter((row) => {
    const year = Number(row.date.slice(0, 4));
    return currentYear <= initialYear + 1 ? year <= initialYear + 1 : year === currentYear;
  });
  const previous = cs.months[r.m - 2];
  const rate = previous?.revenue ? r.revenue / previous.revenue - 1 : null;
  const trend =
    rate === null
      ? '<span>Старт плана</span>'
      : `<strong class="${rate < 0 ? 'is-down' : ''}">${rate > 0 ? '↑ ' : rate < 0 ? '↓ ' : ''}${formatRate(Math.abs(rate))}</strong><span>к ${monthNames[Number(previous.date.slice(5)) - 1]}</span>`;
  const legend = groups
    .map((g) => `<span><i style="--swatch:${g.color}"></i>${g.label}</span>`)
    .join('');
  const { ink, controls } = streamChart(model, period, r.m);
  return `<section class="ref-lead ref-revenue bento-contour" data-bento-profile="rounded" aria-label="Выручка за месяц">
    <div class="bento-paint" aria-hidden="true">${ink}</div>
    <div class="ref-revenue-summary">
    <div class="ref-lead-head"><h2><button class="ref-title-link" type="button" data-action="pnl" aria-label="Выручка за месяц. Открыть расчёт прибыли">Выручка за месяц</button></h2><div class="ref-legend" aria-label="Группы принтеров">${legend}</div></div>
    <div class="ref-reading"><p class="ref-dots">${number.format(Math.round(r.revenue))}<small>₽</small></p><div class="ref-change">${trend}</div></div>
    <p class="ref-tax">Без НДС · Средний чек ${number.format(Math.round(r.avgCheck))} ₽</p>
    </div>${controls}</section>`;
}

function occupancyCard(model, r, state) {
  const capacity = sum(r.groupCapacity);
  const used = sum(r.groupHours);
  const utilization = capacity > 0 ? used / capacity : 0;
  const fractions = groups.map((g) => (capacity > 0 ? r.groupHours[g.capacityIndex] / capacity : 0));
  // The original Allocation gauge uses exactly 57 round ticks with a longer tick every seventh position.
  const ticks = Array.from({ length: 57 }, (_, i) => {
    const fraction = (i + 0.5) / 57;
    const index = fractions.findIndex((_, j) => fraction <= sum(fractions.slice(0, j + 1)));
    const angle = Math.PI * (1 + i / 56);
    const radius = i % 7 === 0 ? 112 : 118;
    const x = (v) => (Math.cos(angle) * v).toFixed(2);
    const y = (v) => (Math.sin(angle) * v).toFixed(2);
    return `<line x1="${x(136)}" y1="${y(136)}" x2="${x(radius)}" y2="${y(radius)}" stroke="${groups[index]?.color || '#55555e'}"/>`;
  }).join('');
  const rows = groups
    .map((group, i) => {
      const hours = r.groupHours[group.capacityIndex];
      const groupCapacity = r.groupCapacity[group.capacityIndex];
      return `<li title="${group.label}. Занято ${number.format(Math.round(hours))} из ${number.format(Math.round(groupCapacity))} часов группы, ${formatRate(fractions[i])} от общего фонда фермы.">
      <span class="ref-group-name"><i style="--swatch:${group.color}"></i>${group.label}</span><span class="ref-share" aria-label="Доля общего фонда">${formatRate(fractions[i])}</span><b>${number.format(Math.round(hours))} ч</b></li>`;
    })
    .join('');
  const hours = `${number.format(Math.round(used))} из ${number.format(Math.round(capacity))} ч`;
  const params = new URLSearchParams({ ...state, view: 'production' });
  return `<section class="ref-lead ref-occupancy bento-contour" data-bento-profile="rounded">
    <div class="bento-paint" aria-hidden="true"></div>
    <div class="ref-lead-head"><h2>Загрузка парка</h2>
    <a class="ref-fleet-link" data-view="production" href="?${params}" aria-label="Подробная загрузка принтеров" title="Загрузка ${model.printers.length} принтеров"><span class="ref-fleet-count">${model.printers.length} машин</span> ${icon('arrowUpRight', 12)}</a></div>
    <div class="ref-gauge" role="img" aria-label="Занято ${formatRate(utilization)} доступного фонда парка. ${hours}.">
      <svg viewBox="-150 -145 300 155" aria-hidden="true"><g stroke-width="3.2" stroke-linecap="round">${ticks}</g></svg>
      <div class="ref-gauge-reading" aria-hidden="true"><span>${decimal.format(utilization * 100)}<sup>%</sup></span><small>${hours}</small></div></div>
    <div class="ref-fleet-detail"><div class="ref-fleet-captions" aria-hidden="true"><span>Группа</span><span>Доля фонда</span><span>Часы</span></div>
    <ul class="ref-fleet-list" aria-label="Доля общего фонда и занятые машино-часы по группам">${rows}</ul></div></section>`;
}

export function renderLead({ model, cs, r, state }) {
  return revenueCard(model, cs, r) + occupancyCard(model, r, state);
}

export function bindLead(host, { update, plan }) {
  const chart = host.querySelector('.ref-months');
  if (!chart) return;
  const select = (month) => update({ month }, { focus: `[data-lead-month="${month}"]` });
  chart.addEventListener('click', (event) => {
    const button = event.target.closest('[data-lead-month]');
    if (button) select(Number(button.dataset.leadMonth));
  });
  chart.addEventListener('keydown', (event) => {
    const button = event.target.closest('[data-lead-month]');
    if (!button || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const next = Number(button.dataset.leadMonth) + (event.key === 'ArrowRight' ? 1 : -1);
    select(Math.max(1, Math.min(plan.months.length, next)));
  });
}
