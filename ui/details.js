import { roles, policies, investorFields } from './investor-options.js?v=13';
import { choiceTrigger, bindChoicePicker } from './pickers.js?v=13';

const commonFormats = new Map();
function num(value, digits = 0) {
  if (!commonFormats.has(digits)) {
    commonFormats.set(digits, new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }));
  }
  return commonFormats.get(digits).format(value);
}
const rub = (value, digits = 0) => num(value, digits) + ' ₽';
const hours = (value) => num(value, 1) + ' ч';
const percent = (value) => num(100 * value, 1) + '%';
const ratio = (value, total) => (total > 0 ? value / total : 0);
const sum = (values) => values.reduce((a, b) => a + b, 0);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const axisLabel = (value) =>
  value >= 1000000
    ? num(value / 1000000, 1) + ' млн'
    : value >= 1000
      ? num(value / 1000) + ' тыс.'
      : num(value);
const dateFormat = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDateFormat = new Intl.DateTimeFormat('ru-RU', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});
function monthName(date, short = false) {
  const [year, month] = date.split('-').map(Number);
  const text = (short ? shortDateFormat : dateFormat)
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(/\s?г\.$/, '')
    .trim();
  return text[0].toUpperCase() + text.slice(1);
}
function days(date) {
  const [year, month] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
const groups = [
  { key: 'xl', label: 'Сверхгабарит', full: 'Сверхгабаритный принтер' },
  { key: 'engineering', label: 'Инженерные', full: 'Инженерные принтеры' },
  { key: 'series', label: 'Серийные', full: 'Предоставленные принтеры' },
];
const local = { group: 'all', machine: null, year: null, allPrinters: false };
const compact = window.matchMedia('(max-width: 700px)');
const expanded = new Set();
let activeDetails;

function disclosure(key, title, content) {
  return `<details class="d-disclosure" data-disclosure="${key}" ${expanded.has(key) ? 'open' : ''}>
    <summary>${title}${chevron}</summary>${content}</details>`;
}

function selectField(action, label, items, value) {
  return `<label class="d-select-field"><span>${esc(label)}</span><span class="d-select-wrap">
    <select data-dv-select="${action}">${items
      .map(
        ([key, text]) =>
          `<option value="${esc(key)}" ${key === value ? 'selected' : ''}>${esc(text)}</option>`,
      )
      .join('')}</select>${chevron}</span></label>`;
}

function metrics(items) {
  return `<dl class="d-mobile-metrics">${items
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join('')}</dl>`;
}
function select(ctx) {
  const c = ctx.plan;
  const m = c.months.find((row) => row.m === Number(ctx.state.month)) ?? c.months[0];
  return { c, m };
}
function meter(value, color = '') {
  return (
    '<span aria-hidden="true" class="d-meter ' +
    color +
    '"><i style="width:' +
    Math.max(0, Math.min(100, value * 100)).toFixed(2) +
    '%"></i></span>'
  );
}
function choice(key, value, label, active) {
  return (
    '<button type="button" data-dv-action="' +
    key +
    '" data-dv-value="' +
    value +
    '" aria-pressed="' +
    active +
    '">' +
    esc(label) +
    '</button>'
  );
}
function segments(label, buttons, extra = '') {
  return (
    '<div class="ui-segmented d-segments ' +
    extra +
    '" role="group" aria-label="' +
    esc(label) +
    '">' +
    buttons.join('') +
    '</div>'
  );
}
const chevron =
  '<svg class="d-chevron" viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true"><path d="m5 6 3 3 3-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function growthSchedule(ctx) {
  const rows = ctx.plan.months
    .slice(0, 13)
    .map((row) => {
      const selected = row.m === ctx.state.month;
      const load = ratio(row.printHours, sum(row.groupCapacity));
      return `<tr><th scope="row"><button type="button" class="text-btn" data-dv-action="month" data-dv-value="${row.m}" aria-pressed="${selected}">${monthName(row.date, true)}</button></th>
      <td>${num(row.orders, 1)}</td><td>${percent(load)}</td></tr>`;
    })
    .join('');
  return disclosure(
    'growth-schedule',
    'План роста до декабря 2027',
    `<table class="d-capacity-table d-growth-schedule">
    <thead><tr><th scope="col">Месяц</th><th scope="col">Партии</th><th scope="col">Загрузка</th></tr></thead>
    <tbody>${rows}</tbody></table>`,
  );
}

// A capsule spans the whole scale. Overloaded groups in short months expand the axis.
function capacityColumns(m, loads) {
  const maxScale = Math.max(1, Math.ceil(Math.max(...loads) * 10) / 10);
  const busiest = loads.indexOf(Math.max(...loads));
  const axis = [maxScale, maxScale / 2, 0].map((v) => `<span>${percent(v)}</span>`).join('');
  return `<div class="production-columns">
    <div class="production-scale" aria-hidden="true">${axis}</div>
    ${groups
      .map(
        (group, i) => `<button type="button" class="production-column"
      data-dv-action="capacity-group" data-dv-value="${group.key}"
      aria-label="${group.full}. Загрузка ${percent(loads[i])}, ${hours(m.groupHours[i])} из ${hours(m.groupCapacity[i])}. Показать принтеры группы.">
      <span class="production-column-hint" aria-hidden="true">${hours(m.groupHours[i])} из ${hours(m.groupCapacity[i])}</span>
      <span class="production-column-plot" aria-hidden="true"><i class="production-column-track"><i class="${i === busiest ? 'peak' : ''}" style="height:${(100 * loads[i]) / maxScale}%"></i></i></span>
      <span class="production-column-value">${percent(loads[i])}</span><span class="production-column-name">${group.key === 'xl' ? 'Giga' : group.label}</span>
    </button>`,
      )
      .join('')}
  </div>`;
}

function machineCapacity(ctx, m, warning) {
  const capacity = sum(m.groupCapacity);
  const loads = groups.map((group, i) => ratio(m.groupHours[i], m.groupCapacity[i]));
  const busiest = loads.indexOf(Math.max(...loads));
  const groupRows = groups
    .map((group, i) => {
      const count = ctx.model.printers.filter((printer) => printer.group === group.key).length;
      return `<div><dt>${group.label} <small>×${count}</small></dt><dd>${hours(m.groupHours[i])} из ${hours(m.groupCapacity[i])}</dd></div>`;
    })
    .join('');
  const route = Number.isFinite(m.engineerSeriesShare)
    ? `<p class="d-note d-route-share">Инженерные машины выполняют ${percent(m.engineerSeriesShare)} совместимых часов профилей B и D.</p>`
    : '';
  const detail = `<dl class="d-breakdown">${groupRows}</dl>
    <p class="d-note">Свободно по парку ${hours(Math.max(0, capacity - m.printHours))}. В самой загруженной группе «${groups[busiest].label}» остаётся ${hours(Math.max(0, m.groupCapacity[busiest] - m.groupHours[busiest]))}.</p>
    ${route}${compact.matches ? warning : ''}`;
  return `<section class="bento-card d-card d-resource d-util-card production-panel bento-contour production-fleet" data-bento-profile="rounded">
      <span class="bento-paint" aria-hidden="true"></span>
    <div class="d-resource-head"><h2>Загрузка парка</h2><span>${ctx.model.printers.length} машин</span></div>
    <div class="production-metric"><strong>${percent(ratio(m.printHours, capacity))}</strong></div>
    <p class="production-subvalue">${hours(m.printHours)} печати из ${hours(capacity)} доступных</p>
    ${capacityColumns(m, loads)}
    <div class="production-links">${disclosure('capacity', 'Машино-часы по группам', detail)}
    ${ctx.state.scenario === 'growth' ? growthSchedule(ctx) : ''}</div>
  </section>`;
}

// Free Cash and Goals use longer graduation marks at regular intervals.
function workTicks(share) {
  const count = 40;
  const marks = Array.from({ length: count }, (_, i) => {
    const x = 2 + (236 * i) / (count - 1);
    return `<line x1="${x}" x2="${x}" y1="${i % 5 === 0 ? 2 : 7}" y2="17" class="${(i + 0.5) / count <= share ? 'filled' : ''}" />`;
  }).join('');
  return `<svg class="production-ticks" viewBox="0 0 240 20" preserveAspectRatio="none" aria-hidden="true" focusable="false">${marks}</svg>`;
}

function operatorCapacity(ctx, m) {
  const founders = m.m <= ctx.model.meta.ownersMonths;
  const people = founders ? 'Работа основателей' : 'Работа оператора';
  const booked = m.operatorHours - (m.ownerSupportHours ?? 0);
  const available = m.laborCapacity;
  const breakdown = [
    'Настройки и запуск через ЛËН',
    'Столы и неудачные построения',
    'Приёмка и упаковка',
    'Дополнительная отделка',
  ];
  const support =
    !founders && Number.isFinite(m.ownerSupportCapacity)
      ? `<div class="production-work-row d-owner-support"><div><span>Помощь основателей</span><strong>${hours(m.ownerSupportHours)} <small>из ${hours(m.ownerSupportCapacity)}</small></strong></div>
      ${workTicks(ratio(m.ownerSupportHours, m.ownerSupportCapacity))}</div>`
      : '';
  const hasContractorCapacity = Number.isFinite(m.contractorCapacity);
  const contractor = `<div class="production-work-row"><div><span>У подрядчика</span><strong>${hours(m.externalHours)} ${hasContractorCapacity ? `<small>из ${hours(m.contractorCapacity)}</small>` : ''}</strong></div>
    ${hasContractorCapacity ? workTicks(ratio(m.externalHours, m.contractorCapacity)) : ''}</div>`;
  const detail = `<dl class="d-breakdown">${breakdown.map((name, i) => `<div><dt>${name}</dt><dd>${hours(m.labor[i])}</dd></div>`).join('')}
      <div><dt>Обходы</dt><dd>${hours(m.roundsHours)}</dd></div><div><dt>Всего на площадке</dt><dd>${hours(m.operatorHours + m.roundsHours)}</dd></div></dl>
      <p class="d-note">Отделка требуется трети принятых партий. Обходы покрываются резервом рабочего графика.</p>
      ${m.ownerSupportHours > 0 ? `<p class="d-note">Работа основателей по партиям оценена в ${rub(m.ownerSupportCost)} за месяц по ставке ${rub(m.ownerSupportCost / m.ownerSupportHours, 2)} за час. Её стоимость учтена в экономической прибыли.</p>` : ''}`;
  return `<section class="bento-card d-card d-resource d-work-card production-panel bento-contour production-work" data-bento-profile="rounded">
      <span class="bento-paint" aria-hidden="true"></span>
    <div class="d-resource-head"><h2>${people}</h2><span>${founders ? 'Двое в офисе' : 'График 6/1'}</span></div>
    <div class="production-metric"><strong>${hours(booked)}</strong></div>
    <p class="production-subvalue">по заказам из ${hours(available)} доступных</p>
    <div class="production-work-allocation">
      <div class="production-work-row production-work-main"><div><span>Загрузка ${founders ? 'основателей' : 'оператора'}</span><strong>${percent(ratio(booked, available))}</strong></div>
      ${workTicks(ratio(booked, available))}<p>Свободно ${hours(Math.max(0, available - booked))}</p></div>
      ${support}${contractor}
    </div>
    <div class="production-links">${disclosure('labor', 'Состав работ и обходы', detail)}</div>
  </section>`;
}
function fleetRows(ctx, m, machines) {
  return machines
    .map(({ printer, i }) => {
      const gi = groups.findIndex((g) => g.key === printer.group);
      const group = groups[gi];
      const count = ctx.model.printers.filter((p) => p.group === printer.group).length;
      const cap = m.groupCapacity[gi] / count;
      const busy = m.machineHours[i];
      const load = ratio(busy, cap);
      const revenue = m.machineRevenue[i];
      const open = printer.id === local.machine;
      const id = esc(printer.id),
        name = esc(printer.name);
      if (compact.matches) {
        return `<li class="d-mobile-record"><button type="button" data-dv-action="machine" data-dv-value="${id}"
          aria-controls="d-row-${id}" aria-expanded="${open}">
          <span class="d-record-title">${name}</span>${chevron}
          <span class="d-record-sub"><strong>${rub(revenue)}</strong> · ${percent(load)} загрузки</span>
        </button><div id="d-row-${id}" ${open ? '' : 'hidden'}>
          <p class="d-record-context">${id.toUpperCase()} · ${group.label}</p>
          ${metrics([
            ['Занято в месяце', hours(busy)],
            ['Свободно в месяце', hours(Math.max(0, cap - busy))],
            ['Печать в день', hours(busy / days(m.date))],
            ['Выручка на занятый час', rub(ratio(revenue, busy))],
          ])}
        </div></li>`;
      }
      const row =
        '<tr class="d-fleet-row' +
        (open ? ' d-selected-row' : '') +
        '"><th scope="row"><button class="d-machine-button" type="button" data-dv-action="machine" data-dv-value="' +
        id +
        '" aria-expanded="' +
        open +
        '" aria-controls="d-row-' +
        id +
        '">' +
        '<span class="d-machine-mark d-tone-' +
        gi +
        '" aria-hidden="true"></span><span class="d-machine-name"><strong>' +
        name +
        '</strong><small>' +
        id.toUpperCase() +
        ' · ' +
        group.label +
        '</small></span></button></th>' +
        '<td class="is-number d-machine-hours">' +
        hours(busy) +
        '</td><td class="d-table-usage"><span>' +
        percent(load) +
        '</span>' +
        meter(load, 'd-tone-' + gi) +
        '</td>' +
        '<td class="is-number d-table-money">' +
        rub(revenue) +
        '</td><td class="d-table-toggle"><button class="d-icon-btn" data-dv-action="machine" data-dv-value="' +
        id +
        '" type="button" aria-label="' +
        (open ? 'Свернуть' : 'Подробнее') +
        ' · ' +
        name +
        ' · ' +
        id +
        '" aria-controls="d-row-' +
        id +
        '" aria-expanded="' +
        open +
        '">' +
        chevron +
        '</button></td></tr>';
      const detail =
        '<tr id="d-row-' +
        id +
        '" class="d-fleet-detail"' +
        (open ? '' : ' hidden') +
        '><td colspan="5"><div class="d-inline-metrics">' +
        '<div><span>Занято в месяце</span><strong>' +
        hours(busy) +
        '</strong></div><div><span>Свободно в месяце</span><strong>' +
        hours(Math.max(0, cap - busy)) +
        '</strong></div>' +
        '<div><span>Печать в день</span><strong>' +
        hours(busy / days(m.date)) +
        '</strong></div><div><span>Выручка на занятый час</span><strong>' +
        rub(ratio(revenue, busy)) +
        '</strong></div></div></td></tr>';
      return row + detail;
    })
    .join('');
}
function fleet(ctx, m) {
  const all = ctx.model.printers.map((printer, i) => ({ printer, i }));
  const selected = all.filter(({ printer }) => local.group === 'all' || printer.group === local.group);
  const groupOptions = [['all', 'Все группы'], ...groups.map((g) => [g.key, g.label])];
  const filters = groupOptions.map(([key, label]) =>
    choice('group', key, key === 'all' ? 'Все' : label, local.group === key),
  );
  const h = sum(selected.map(({ i }) => m.machineHours[i]));
  const revenue = sum(selected.map(({ i }) => m.machineRevenue[i]));
  const capacity =
    local.group === 'all'
      ? sum(m.groupCapacity)
      : m.groupCapacity[groups.findIndex((g) => g.key === local.group)];
  if (compact.matches) {
    const initialCount = 3;
    const shown = local.allPrinters ? selected : selected.slice(0, initialCount);
    const toggle =
      selected.length > initialCount
        ? `<button class="d-list-toggle" type="button" data-dv-action="allPrinters" data-dv-value="more"
          aria-controls="d-printer-list" aria-expanded="${local.allPrinters}">
          ${local.allPrinters ? 'Свернуть список' : 'Показать ещё ' + (selected.length - initialCount)}${chevron}</button>`
        : '';
    return `<section class="bento-card d-card d-registry"><h2>Принтеры</h2>
      ${selectField('group', 'Группа принтеров', groupOptions, local.group)}
      <p class="d-registry-total"><strong>${rub(revenue)}</strong> выручки без НДС</p>
      <p class="d-record-context">${selected.length} маш. · ${hours(h)} · ${percent(ratio(h, capacity))} загрузки</p>
      <ul class="d-records" id="d-printer-list">${fleetRows(ctx, m, shown)}</ul>${toggle}
      ${disclosure('fleet-method', 'Как рассчитана выручка', '<p class="d-note">Выручка без НДС распределена по времени работы машин в принятых партиях. Внутри группы задания делятся поровну между совместимыми машинами. Загрузка учитывает график и простои.</p>')}
    </section>`;
  }
  return (
    '<section class="bento-card d-card d-registry"><div class="d-head"><div><h2>Принтеры</h2><p class="d-note">Выручка без НДС распределена по времени работы машин в принятых партиях.</p></div>' +
    segments('Группа принтеров', filters, 'd-fleet-filter') +
    '</div><div class="ui-table-frame d-table-frame"><table class="ui-table d-fleet-table"><thead><tr><th scope="col">Модель</th><th scope="col" class="is-number d-machine-hours">Печать</th><th scope="col">Загрузка</th><th scope="col" class="is-number">Выручка</th><th scope="col" aria-label="Подробнее"></th></tr></thead><tbody>' +
    fleetRows(ctx, m, selected) +
    '</tbody><tfoot><tr class="ui-total"><th scope="row">Итого <span class="d-count">' +
    selected.length +
    '</span></th><td class="is-number d-machine-hours">' +
    hours(h) +
    '</td><td>' +
    percent(ratio(h, capacity)) +
    '</td><td class="is-number">' +
    rub(revenue) +
    '</td><td></td></tr></tfoot></table></div>' +
    '<p class="d-note d-table-note">Внутри группы задания делятся поровну между совместимыми машинами. Загрузка рассчитана от доступного фонда с учётом графика и простоев.</p></section>'
  );
}
function batches(ctx, m) {
  if (compact.matches) {
    const items = ctx.model.profiles.map((profile, i) => {
      const body = metrics([
        ['Партий', num(m.profileOrders[i], 1)],
        ['Часы печати', hours(profile.printHours * m.profileOrders[i])],
        ['Маржинальный доход', rub(m.profileMargin[i])],
      ]);
      return `<li>${disclosure('batch-' + i, `<span class="d-record-title">Профиль ${esc(profile.id)}</span><span class="d-record-sub">${rub(m.profileRevenue[i])} выручки</span>`, body)}</li>`;
    });
    return `<section class="bento-card d-card"><h2>Состав партий</h2>
      <p class="d-record-context">${num(m.orders, 1)} партий · ${num(m.materialKg, 1)} кг филамента</p>
      <ul class="d-records d-batch-list">${items.join('')}</ul>
      <p class="d-note d-table-note">Дробные партии в период разгона — месячный эквивалент отгрузок.</p></section>`;
  }
  return (
    '<section class="bento-card d-card"><div class="d-head"><h2>Состав партий</h2><span class="d-head-unit">' +
    num(m.orders, 1) +
    ' партий · ' +
    num(m.materialKg, 1) +
    ' кг филамента</span></div>' +
    '<div class="ui-table-frame d-table-frame"><table class="ui-table d-batch-table"><thead><tr><th scope="col">Профиль</th><th scope="col" class="is-number">Партии</th><th scope="col" class="is-number d-batch-extra">Печать</th><th scope="col" class="is-number">Выручка</th><th scope="col" class="is-number">Марж. доход</th></tr></thead><tbody>' +
    ctx.model.profiles
      .map(
        (p, i) =>
          '<tr><th scope="row">' +
          esc(p.id) +
          '</th><td class="is-number">' +
          num(m.profileOrders[i], 1) +
          '</td><td class="is-number d-batch-extra">' +
          hours(p.printHours * m.profileOrders[i]) +
          '</td><td class="is-number">' +
          rub(m.profileRevenue[i]) +
          '</td><td class="is-number">' +
          rub(m.profileMargin[i]) +
          '</td></tr>',
      )
      .join('') +
    '</tbody></table></div><p class="d-note d-table-note">Дробные партии в период разгона — месячный эквивалент отгрузок.</p></section>'
  );
}
export function renderProduction(ctx) {
  const { c, m } = select(ctx);
  const shortMonth = c.months.find(
    (row) => days(row.date) === 28 && row.profileOrders.every((count, i) => count >= c.mix[i] - 0.01),
  );
  const highLoad = shortMonth ? ratio(shortMonth.groupHours[2], shortMonth.groupCapacity[2]) : 0;
  const alreadyShown =
    days(m.date) === 28 && Math.abs(ratio(m.groupHours[2], m.groupCapacity[2]) - highLoad) < 0.0001;
  const warning =
    highLoad >= 0.9 && !alreadyShown
      ? '<aside class="d-cap-note"><div><strong>Резерв серийной группы в феврале</strong><p>За 28 дней двум принтерам потребуется ' +
        hours(shortMonth.groupHours[2]) +
        ' из ' +
        hours(shortMonth.groupCapacity[2]) +
        '. Для дополнительных заказов остаётся ' +
        hours(Math.max(0, shortMonth.groupCapacity[2] - shortMonth.groupHours[2])) +
        '.</p></div></aside>'
      : '';
  return (
    '<div class="detail-view" data-detail-view="production">' +
    '<div class="d-top-grid">' +
    machineCapacity(ctx, m, warning) +
    operatorCapacity(ctx, m) +
    '</div>' +
    (compact.matches ? '' : warning) +
    fleet(ctx, m) +
    batches(ctx, m) +
    '</div>'
  );
}

function personSelect(role, ctx) {
  if (compact.matches) {
    const fields = Object.values(investorFields).map((field) => {
      const id = 'investor-' + field.key;
      const label = field.key === 'policy' ? 'Режим выплат' : field.label;
      return `<div class="len-picker-field"><label for="${id}">${label}</label>
        ${choiceTrigger(id, label, ctx.state[field.key], field.choices, ctx.icon)}</div>`;
    });
    return `<div class="d-person-inputs">${fields.join('')}</div>`;
  }
  return `<div class="d-head d-person-head">
    <h2>Участник</h2>
    ${segments(
      'Выбрать участника',
      roles.map((p) => choice('role', p.key, p.title, p.key === role.key)),
      'd-role-filter',
    )}
  </div>`;
}
function policySelect(ctx, c) {
  const { state } = ctx;
  const profit = c.months.reduce((total, row) => total + row.profit, ctx.model.meta.openingProfit);
  const distributed = c.policies[state.policy].totalGross;
  return `<section class="bento-card d-card d-policy"><h2>Распределение прибыли</h2>
    ${
      compact.matches
        ? ''
        : segments(
            'Регламент распределения прибыли',
            Object.entries(policies).map(([key, v]) =>
              choice('policy', key, v.label, state.policy === key),
            ),
            'd-policy-filter',
          )
    }
    <div class="d-policy-result"><strong>${percent(ratio(distributed, profit))}</strong><span>прибыли распределяется за 5 лет</span></div>
    <div class="d-policy-bar" aria-hidden="true"><i style="width:${Math.min(100, Math.max(0, 100 * ratio(distributed, profit)))}%"></i></div>
    <dl class="d-policy-amounts"><div><dt>Участникам, до налога</dt><dd>${rub(distributed)}</dd></div><div><dt>Остаётся в ООО</dt><dd>${rub(profit - distributed)}</dd></div></dl>
    ${compact.matches ? '' : `<p>${policies[state.policy].detail}</p>`}
    <details class="d-disclosure" data-disclosure="policy" ${expanded.has('policy') ? 'open' : ''}><summary>Условия выплаты ${chevron}</summary>
      ${compact.matches ? `<p class="d-note">${policies[state.policy].detail}</p>` : ''}
      <p class="d-note">Выплаты рассчитаны после погашения займа ${rub(ctx.model.meta.loanAmount)} и пополнения резервов. Даты требуют решения участников.</p>
    </details>
  </section>`;
}
function personKPIs(ctx, c, m, role) {
  const profile = c.policies[ctx.state.policy],
    data = m.policies[ctx.state.policy];
  const recovery = profile.payback[role.idx],
    hasCash = role.cash > 0;
  const payback = hasCash ? (recovery ? num(recovery) + ' мес.' : 'Свыше 5 лет') : percent(role.share);
  const paybackDetail = hasCash
    ? recovery
      ? monthName(c.months[recovery - 1].date)
      : 'Взнос не покрыт в горизонте модели'
    : 'Доля в производственном ООО';
  const rate = profile.irr[role.idx];
  const paid = rub(data.cumPayouts[role.idx] * role.fraction);
  const thisMonth = rub(data.payouts[role.idx] * role.fraction);
  const roleNote = hasCash
    ? 'Вклад ' + rub(role.cash) + ' · доля ' + percent(role.share)
    : 'Денежный вклад 0 ₽. Работа УК учитывается отдельно.';
  const mobile = compact.matches;
  const recoveryTitle = hasCash ? 'Возврат взноса' : mobile ? 'Доля УК' : 'Доля управляющей компании';
  const rateTitle = hasCash
    ? mobile
      ? 'Годовая IRR'
      : 'Годовая IRR за 5 лет'
    : mobile
      ? 'Чистые выплаты'
      : 'Чистые выплаты за 5 лет';
  const paybackCell = `<div class="d-person-cell d-person-hero">
    <h3>${recoveryTitle}</h3>
    <strong class="d-measure">${payback}</strong><p>${paybackDetail}</p></div>`;
  const paidCell = `<div class="d-person-cell d-person-paid">
    <h3>Выплачено с запуска</h3><strong class="d-measure">${paid}</strong>
    <p>${mobile ? 'За месяц ·' : 'В выбранном месяце'} ${thisMonth}</p></div>`;
  const rateCell = `<div class="d-person-cell d-person-rate">
    <h3>${rateTitle}</h3>
    <strong class="d-measure">${hasCash ? (Number.isFinite(rate) ? percent(rate) : 'Не определена') : rub(profile.totalPayouts[role.idx] * role.fraction)}</strong>
    <p>${mobile ? 'За 5 лет' : roleNote}</p></div>`;
  return `<section class="bento-card d-card d-person-summary" data-role="${role.key}">${personSelect(role, ctx)}
    <div class="d-person-kpis">${compact.matches ? paidCell + paybackCell : paybackCell + paidCell}${rateCell}</div>
    ${compact.matches ? `<p class="d-person-contribution">${roleNote}</p>` : ''}
    ${
      role.key === 'uk' && Number.isFinite(m.ownerWorkCredit)
        ? disclosure(
            'owner-credit',
            'Учёт труда УК',
            `
      <dl class="d-breakdown"><div><dt>Зачтено с запуска</dt><dd>${rub(m.ownerWorkCredit)}</dd></div>
      <div><dt>Остаток до лимита вклада</dt><dd>${rub(m.ownerWorkCreditRemaining)}</dd></div>
      <div><dt>Оценка труда сверх лимита с запуска</dt><dd>${rub(m.ownerWorkAboveCredit)}</dd></div></dl>
      <p class="d-note">Базовая оценка производственного часа основателей — ${rub(ctx.model.meta.ownerHourRate, 2)}. Модель индексирует ставку по годам. После достижения лимита ${rub(ctx.model.meta.ownerCreditLimit)} основатели продолжают работу без оплаты и дополнительного зачёта.</p>`,
          )
        : ''
    }
  </section>`;
}

function payoutChart(c, m, role, policy) {
  const cash = role.cash,
    values = [0, ...c.months.map((row) => row.policies[policy].cumPayouts[role.idx] * role.fraction)];
  const top = Math.max(1, cash, ...values) * 1.08,
    w = 640,
    h = 153,
    left = 8,
    right = 632,
    bottom = 145,
    yTop = 7;
  const x = (i) => left + ((right - left) * i) / (values.length - 1),
    y = (v) => bottom - ((bottom - yTop) * v) / top;
  const xy = (n) => n.toFixed(2);
  let path = 'M' + xy(x(0)) + ' ' + xy(y(0));
  for (let i = 1; i < values.length; i++) path += ' H' + xy(x(i)) + ' V' + xy(y(values[i]));
  const grid = [0, 0.5, 1]
    .map(
      (fr) =>
        '<line x1="' +
        left +
        '" x2="' +
        right +
        '" y1="' +
        xy(y(top * fr)) +
        '" y2="' +
        xy(y(top * fr)) +
        '" class="d-chart-grid"/>',
    )
    .join('');
  const depositLine =
    cash > 0
      ? '<line x1="' +
        left +
        '" x2="' +
        right +
        '" y1="' +
        xy(y(cash)) +
        '" y2="' +
        xy(y(cash)) +
        '" class="d-chart-deposit"/>'
      : '';
  const payback = c.policies[policy].payback[role.idx];
  const returnPoint =
    cash > 0 && Number.isInteger(payback) && payback >= 1 && payback <= values.length - 1
      ? `<circle cx="${xy(x(payback))}" cy="${xy(y(values[payback]))}" r="5.8" class="d-chart-return"><title>Возврат вклада · ${monthName(c.months[payback - 1].date)}</title></circle>`
      : '';
  const paybackCaption = returnPoint
    ? `<span class="d-return-key"><i></i>Возврат${compact.matches ? '' : ' · ' + monthName(c.months[payback - 1].date, true)}</span>`
    : '';
  const pt = values[m.m];
  return (
    '<section class="bento-card d-card d-cash-chart"><div class="d-head"><div><h2>Накопленные выплаты</h2><p class="d-note">' +
    (compact.matches ? 'За 5 лет' : esc(role.full)) +
    ' · после расчётного налога</p></div><div class="d-chart-key"><span><i></i>Выплаты</span>' +
    (cash > 0
      ? `<span><i class="d-dashed"></i>${compact.matches ? 'Вклад' : 'Денежный вклад'}</span>`
      : '') +
    paybackCaption +
    '</div></div>' +
    '<div class="d-chart-wrap"><div class="d-chart-axis" aria-hidden="true"><span>' +
    axisLabel(top) +
    '</span><span>0 ₽</span></div><div class="d-chart-touch" tabindex="0" role="slider" aria-label="Месяц графика выплат" aria-valuemin="1" aria-valuemax="60" aria-valuenow="' +
    m.m +
    '" aria-valuetext="' +
    monthName(m.date) +
    ', ' +
    rub(pt) +
    '"><svg class="d-cash-svg" aria-hidden="true" viewBox="0 0 ' +
    w +
    ' ' +
    h +
    '" preserveAspectRatio="none"><defs><linearGradient id="dividend-wash" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--ui-accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--ui-accent)" stop-opacity=".03"/></linearGradient></defs>' +
    grid +
    depositLine +
    '<path d="' +
    path +
    ' V' +
    bottom +
    ' H' +
    left +
    ' Z" class="d-chart-area" fill="url(#dividend-wash)"/><path d="' +
    path +
    '" class="d-chart-series"/><line x1="' +
    xy(x(m.m)) +
    '" x2="' +
    xy(x(m.m)) +
    '" y1="' +
    yTop +
    '" y2="' +
    bottom +
    '" class="d-chart-selected"/>' +
    returnPoint +
    '<circle cx="' +
    xy(x(m.m)) +
    '" cy="' +
    xy(y(pt)) +
    '" r="4" class="d-chart-point"/></svg></div></div>' +
    '<div class="d-chart-labels" aria-hidden="true"><span>' +
    c.months[0].date.slice(0, 4) +
    '</span>' +
    [12, 24, 36, 48, 60].map((k) => '<span>' + c.months[k - 1].date.slice(0, 4) + '</span>').join('') +
    '</div><div class="d-chart-caption"><span>' +
    monthName(m.date) +
    '</span><b>' +
    rub(pt) +
    '</b></div></section>'
  );
}
function payoutLedger(c, m, role, policy) {
  const chosenYear = local.year ?? Math.ceil(m.m / 12);
  const yearRows = [];
  for (let y = 1; y <= 5; y++) {
    const mo = c.months.slice((y - 1) * 12, y * 12),
      end = mo.at(-1);
    const total = sum(mo.map((e) => e.policies[policy].payouts[role.idx] * role.fraction));
    const cum = end.policies[policy].cumPayouts[role.idx] * role.fraction,
      open = chosenYear === y;
    if (!compact.matches)
      yearRows.push(
        '<tr' +
          (open ? ' class="d-selected-row"' : '') +
          '><th scope="row"><button class="d-ledger-year" type="button" data-dv-action="year" data-dv-value="' +
          y +
          '" aria-expanded="' +
          open +
          '" aria-controls="d-year-' +
          y +
          '">' +
          chevron +
          '<span>Год ' +
          y +
          '<small>' +
          monthName(mo[0].date, true) +
          ' — ' +
          monthName(end.date, true) +
          '</small></span></button></th><td class="is-number">' +
          rub(total) +
          '</td><td class="is-number">' +
          rub(cum) +
          '</td></tr>',
      );
    const paid = mo.filter((row) => row.policies[policy].payouts[role.idx] * role.fraction > 0.005);
    const body = paid.length
      ? '<dl>' +
        paid
          .map(
            (row) =>
              '<div><dt>' +
              monthName(row.date) +
              '</dt><dd>' +
              rub(row.policies[policy].payouts[role.idx] * role.fraction) +
              '</dd></div>',
          )
          .join('') +
        '</dl>'
      : '<p>В этом году распределений не запланировано.</p>';
    if (compact.matches) {
      yearRows.push(`<li class="d-mobile-record"><button type="button" data-dv-action="year" data-dv-value="${y}"
        aria-expanded="${open}" aria-controls="d-year-${y}">
        <span class="d-record-title">Год ${y}</span><strong class="d-year-total">${rub(total)}</strong>${chevron}
        <span class="d-record-sub">${monthName(mo[0].date, true)} — ${monthName(end.date, true)}</span></button>
        <div id="d-year-${y}" class="d-mobile-year" ${open ? '' : 'hidden'}>
        ${metrics([['С запуска', rub(cum)]])}${body}</div></li>`);
      continue;
    }
    yearRows.push(
      '<tr id="d-year-' +
        y +
        '" class="d-ledger-detail"' +
        (open ? '' : ' hidden') +
        '><td colspan="3">' +
        body +
        '</td></tr>',
    );
  }
  if (compact.matches) {
    return `<section class="bento-card d-card d-payout-years"><h2>График выплат</h2>
      <p class="d-record-context">Чистые дивиденды по годам</p><ul class="d-records">${yearRows.join('')}</ul></section>`;
  }
  return (
    '<section class="bento-card d-card"><div class="d-head"><h2>График выплат</h2><span class="d-head-unit">Чистые дивиденды, ₽</span></div><div class="ui-table-frame d-table-frame"><table class="ui-table d-ledger"><thead><tr><th scope="col">Период</th><th scope="col" class="is-number">За год</th><th scope="col" class="is-number">С запуска</th></tr></thead><tbody>' +
    yearRows.join('') +
    '</tbody></table></div></section>'
  );
}
export function renderInvestors(ctx) {
  const { c, m } = select(ctx);
  const role = roles.find((item) => item.key === ctx.state.role) ?? roles[0];
  const policy = ctx.state.policy;
  const chart = payoutChart(c, m, role, policy);
  const ledger = payoutLedger(c, m, role, policy);
  const distribution = policySelect(ctx, c);
  const content = compact.matches
    ? chart + ledger + distribution
    : `<div class="d-invest-grid">${chart}${distribution}</div>${ledger}`;
  return `<div class="detail-view" data-detail-view="investors">
    ${personKPIs(ctx, c, m, role)}${content}</div>`;
}

function refreshDetails(panel, ctx) {
  const parent = panel.parentElement;
  panel.outerHTML =
    panel.dataset.detailView === 'production' ? renderProduction(ctx) : renderInvestors(ctx);
  const fresh = parent.querySelector('[data-detail-view]');
  bindDetails(fresh, ctx);
  return fresh;
}

compact.addEventListener('change', () => {
  if (!activeDetails?.panel.isConnected) return;
  const { panel, ctx } = activeDetails;
  const el = document.activeElement;
  const hadFocus = panel.contains(el);
  const action =
    el.dataset.dvAction ??
    el.dataset.dvSelect ??
    (el.id.startsWith('investor-') ? el.id.slice('investor-'.length) : null);
  const value = el.dataset.dvValue ?? (el.id.startsWith('investor-') ? ctx.state[action] : el.value);
  const disclosureId = el.closest('[data-disclosure]')?.dataset.disclosure;
  const fresh = refreshDetails(panel, ctx);
  if (hadFocus) {
    const target = action
      ? fresh.querySelector(
          `#investor-${action}, [data-dv-select="${action}"], [data-dv-action="${action}"][data-dv-value="${CSS.escape(value)}"]`,
        )
      : disclosureId
        ? fresh.querySelector(`[data-disclosure="${disclosureId}"] summary`)
        : el.matches('.d-chart-touch')
          ? fresh.querySelector('.d-chart-touch')
          : null;
    (target ?? fresh.querySelector('button, select, summary'))?.focus({ preventScroll: true });
  }
});

const bound = new WeakSet();
export function bindDetails(root, ctx) {
  const panel = root.matches?.('[data-detail-view]') ? root : root.querySelector('[data-detail-view]');
  if (!panel || bound.has(panel)) return;
  bound.add(panel);
  activeDetails = { panel, ctx };
  if (compact.matches && panel.dataset.detailView === 'investors') {
    for (const field of Object.values(investorFields)) {
      bindChoicePicker(panel.querySelector('#investor-' + field.key), ctx, field);
    }
  }
  panel.addEventListener(
    'toggle',
    (event) => {
      const key = event.target.dataset.disclosure;
      if (key) {
        if (event.target.open) expanded.add(key);
        else expanded.delete(key);
      }
    },
    true,
  );
  panel.addEventListener('change', (event) => {
    const control = event.target.closest('select[data-dv-select]');
    if (!control) return;
    const action = control.dataset.dvSelect;
    const focus = `[data-dv-select="${action}"]`;
    if (action === 'group') {
      local.group = control.value;
      local.machine = null;
      local.allPrinters = false;
      refreshDetails(panel, ctx).querySelector(focus)?.focus({ preventScroll: true });
    } else {
      ctx.update({ [action]: control.value }, { focus });
    }
  });
  const plot = panel.querySelector('.d-chart-touch');
  if (plot) {
    const { c, m } = select(ctx),
      role = roles.find((r) => r.key === ctx.state.role) ?? roles[0],
      policy = ctx.state.policy;
    const caption = panel.querySelector('.d-chart-caption');
    const hit = (e) => {
      const box = plot.getBoundingClientRect(),
        x = (640 * (e.clientX - box.left)) / box.width;
      return Math.max(1, Math.min(60, Math.round(((x - 8) * 60) / 624)));
    };
    const describe = (number) => {
      const row = c.months[number - 1];
      caption.firstElementChild.textContent = monthName(row.date);
      caption.lastElementChild.textContent = rub(
        row.policies[policy].cumPayouts[role.idx] * role.fraction,
      );
    };
    plot.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch') describe(hit(e));
    });
    plot.addEventListener('pointerleave', () => describe(m.m));
    plot.addEventListener('click', (e) => ctx.update({ month: hit(e) }, { focus: '.d-chart-touch' }));
    plot.addEventListener('keydown', (e) => {
      const next = {
        ArrowLeft: Math.max(1, m.m - 1),
        ArrowRight: Math.min(60, m.m + 1),
        Home: 1,
        End: 60,
      }[e.key];
      if (next) {
        e.preventDefault();
        ctx.update({ month: next }, { focus: '.d-chart-touch' });
      }
    });
  }
  panel.addEventListener('click', (event) => {
    const control = event.target.closest('button[data-dv-action]');
    if (!control || !panel.contains(control)) return;
    const action = control.dataset.dvAction,
      val = control.dataset.dvValue;
    if (action === 'policy' || action === 'role') {
      if (val !== ctx.state[action]) {
        ctx.update(
          { [action]: val },
          { focus: '[data-dv-action="' + action + '"][data-dv-value="' + val + '"]' },
        );
      }
      return;
    }
    if (action === 'month') {
      ctx.update({ month: Number(val) }, { focus: `[data-dv-action="month"][data-dv-value="${val}"]` });
      return;
    }
    if (action === 'capacity-group') {
      local.group = val;
      local.machine = null;
      local.allPrinters = false;
      const registry = refreshDetails(panel, ctx).querySelector('.d-registry');
      const filter =
        registry.querySelector('[data-dv-select="group"]') ??
        registry.querySelector('[data-dv-action="group"][data-dv-value="' + val + '"]');
      filter?.focus({ preventScroll: true });
      registry.scrollIntoView({ block: 'start' });
      return;
    }
    if (action === 'group') {
      local.group = val;
      local.machine = null;
      local.allPrinters = false;
    } else if (action === 'allPrinters') {
      local.allPrinters = !local.allPrinters;
    } else if (action === 'machine') {
      local.machine = local.machine === val ? null : val;
    } else if (action === 'year') {
      const year = Number(val);
      local.year = (local.year ?? Math.ceil(Number(ctx.state.month) / 12)) === year ? 0 : year;
    } else return;
    const fresh = refreshDetails(panel, ctx);
    const target = fresh.querySelector('[data-dv-action="' + action + '"][data-dv-value="' + val + '"]');
    if (!target) return;
    target.focus({ preventScroll: true });
    if (compact.matches) {
      const box = target.getBoundingClientRect();
      const navTop = document.querySelector('.mobile-nav')?.getBoundingClientRect().top ?? innerHeight;
      if (box.top < 0 || box.bottom > navTop) {
        target.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    }
  });
}
