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
const compact = (value) => (value >= 1000000 ? num(value / 1000000, 2) + ' млн ₽' : rub(value));
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
const roles = [
  {
    key: 'lead',
    title: 'Инвестор',
    full: 'Инвестор с вкладом 1 млн ₽',
    idx: 1,
    fraction: 1,
    cash: 1000000,
    share: 0.33,
  },
  {
    key: 'pair',
    title: 'Пара вместе',
    full: 'Два инвестора вместе',
    idx: 2,
    fraction: 1,
    cash: 500000,
    share: 0.33,
  },
  {
    key: 'one',
    title: 'Один из пары',
    full: 'Один участник пары',
    idx: 2,
    fraction: 0.5,
    cash: 250000,
    share: 0.165,
  },
  { key: 'uk', title: 'УК ДИОНК', full: 'ООО «УК ДИОНК»', idx: 0, fraction: 1, cash: 0, share: 0.34 },
];
const policies = {
  balance: {
    label: '50% остатка',
    detail:
      'Каждый квартал можно распределить до половины всей накопленной нераспределённой прибыли. Остаток прошлого квартала снова участвует в расчёте.',
  },
  retained: {
    label: '50% прибыли остаётся',
    detail:
      'Половина заработанной с запуска прибыли постоянно остаётся в производстве. Уже выплаченные дивиденды уменьшают лимит следующего распределения.',
  },
};
const local = { group: 'all', machine: null, year: null };
function select(ctx) {
  const c = ctx.model.cases[ctx.state.scenario + '-' + ctx.state.portfolio];
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
function productionTop(ctx, m) {
  const people = m.m <= 6 ? 'Работа основателей' : 'Работа оператора';
  const total = sum(m.groupCapacity);
  const groupLines = groups
    .map((g, i) => {
      const load = ratio(m.groupHours[i], m.groupCapacity[i]);
      return (
        '<div class="d-group-load"><div><span>' +
        g.full +
        '</span><strong>' +
        percent(load) +
        '</strong></div>' +
        meter(load, 'd-tone-' + i) +
        '<small>' +
        hours(m.groupHours[i]) +
        ' из ' +
        hours(m.groupCapacity[i]) +
        '</small></div>'
      );
    })
    .join('');
  const breakdown = [
    'Параметры и запуск через ЛËН',
    'Столы и неудачные построения',
    'Приёмка и упаковка',
    'Заказанная постобработка',
  ];
  return (
    '<div class="d-top-grid"><section class="bento-card d-card"><h2>Загрузка парка</h2>' +
    '<div class="d-measure">' +
    percent(ratio(m.printHours, total)) +
    '</div><div class="d-submetric">' +
    hours(m.printHours) +
    ' печати из ' +
    hours(total) +
    ' доступных</div>' +
    '<div class="d-group-grid">' +
    groupLines +
    '</div></section>' +
    '<section class="bento-card d-card"><h2>' +
    people +
    '</h2><div class="d-measure">' +
    hours(m.operatorHours + m.roundsHours) +
    '</div>' +
    '<div class="d-submetric">' +
    hours(m.operatorHours) +
    ' на заказы и ' +
    hours(m.roundsHours) +
    ' на обходы</div>' +
    '<div class="d-labor-pair"><span>Свободно для заказов</span><strong>' +
    hours(Math.max(0, m.laborCapacity - m.operatorHours)) +
    '</strong></div>' +
    '<div class="d-labor-pair"><span>Подготовка у подрядчика</span><strong>' +
    hours(m.externalHours) +
    '</strong></div>' +
    '<details class="d-disclosure"><summary>Из чего складываются часы' +
    chevron +
    '</summary>' +
    '<dl class="d-breakdown">' +
    breakdown
      .map((label, i) => '<div><dt>' + label + '</dt><dd>' + hours(m.labor[i]) + '</dd></div>')
      .join('') +
    '</dl>' +
    '<p class="d-note">Отделка принята для трети партий каждого профиля. Нормативы проверяются хронометражем. Фонд на заказы — ' +
    hours(m.laborCapacity) +
    '.</p></details></section></div>'
  );
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
  const filters = [['all', 'Все'], ...groups.map((g) => [g.key, g.label])].map(([key, label]) =>
    choice('group', key, label, local.group === key),
  );
  const h = sum(selected.map(({ i }) => m.machineHours[i]));
  const revenue = sum(selected.map(({ i }) => m.machineRevenue[i]));
  const capacity =
    local.group === 'all'
      ? sum(m.groupCapacity)
      : m.groupCapacity[groups.findIndex((g) => g.key === local.group)];
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
          esc(p.name) +
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
  const warning =
    highLoad >= 0.9
      ? '<aside class="d-cap-note"><span class="d-warning-mark" aria-hidden="true">!</span><div><strong>Резерв серийной группы в феврале</strong><p>За 28 дней двум принтерам потребуется ' +
        hours(shortMonth.groupHours[2]) +
        ' из ' +
        hours(shortMonth.groupCapacity[2]) +
        '. Для дополнительных заказов остаётся ' +
        hours(Math.max(0, shortMonth.groupCapacity[2] - shortMonth.groupHours[2])) +
        '.</p></div></aside>'
      : '';
  return (
    '<div class="detail-view" data-detail-view="production">' +
    productionTop(ctx, m) +
    warning +
    fleet(ctx, m) +
    batches(ctx, m) +
    '</div>'
  );
}

function personSelect(role) {
  return (
    '<section class="bento-card d-card d-settings"><div class="d-setting"><h2>Участник</h2>' +
    segments(
      'Выбрать участника',
      roles.map((p) => choice('role', p.key, p.title, p.key === role.key)),
      'd-role-filter',
    ) +
    '</div></section>'
  );
}
function policySelect(ctx, c) {
  const state = ctx.state;
  const profit = c.months.reduce((total, row) => total + row.profit, ctx.model.meta.openingProfit);
  const distributed = c.policies[state.policy].totalGross;
  return (
    '<section class="bento-card d-card d-policy"><div class="d-head"><h2>Порядок распределения</h2>' +
    segments(
      'Регламент распределения прибыли',
      Object.entries(policies).map(([key, v]) => choice('policy', key, v.label, state.policy === key)),
      'd-policy-filter',
    ) +
    '</div><p>' +
    policies[state.policy].detail +
    '</p><div class="d-policy-result"><strong>' +
    percent(ratio(distributed, profit)) +
    '</strong><span>чистой прибыли будет распределено за 5 лет</span></div><p class="d-note">Выплаты рассчитываются после погашения модельного займа ' +
    rub(ctx.model.meta.loanAmount) +
    ' и пополнения денежных резервов. Даты зависят от решения участников.</p></section>'
  );
}
function personKPIs(ctx, c, m, role) {
  const policy = ctx.state.policy,
    profile = c.policies[policy],
    data = m.policies[policy];
  const recovery = profile.payback[role.idx],
    selectedSum = data.cumPayouts[role.idx] * role.fraction;
  const ret = profile.irr[role.idx],
    hasCash = role.cash > 0;
  const payback = hasCash ? (recovery ? 'М' + recovery : '> 60 мес.') : percent(role.share);
  const limit =
    hasCash && recovery
      ? monthName(c.months[recovery - 1].date)
      : hasCash
        ? 'Взнос не покрыт в горизонте модели'
        : 'Доля в производственном ООО';
  return (
    '<div class="d-person-kpis"><section class="bento-card d-card ui-grain-fill d-person-hero"><h3>' +
    (hasCash ? 'Возврат взноса' : 'Доля управляющей компании') +
    '</h3><div class="d-measure">' +
    payback +
    '</div><p>' +
    limit +
    '</p></section>' +
    '<section class="bento-card d-card"><h3>Чистые выплаты к М' +
    m.m +
    '</h3><div class="d-measure">' +
    compact(selectedSum) +
    '</div><p>За выбранный месяц ' +
    rub(data.payouts[role.idx] * role.fraction) +
    '</p></section>' +
    '<section class="bento-card d-card"><h3>' +
    (hasCash ? 'Годовая IRR за 5 лет' : 'Чистые выплаты за 5 лет') +
    '</h3><div class="d-measure">' +
    (hasCash
      ? Number.isFinite(ret)
        ? percent(ret)
        : 'Не определена'
      : compact(profile.totalPayouts[role.idx] * role.fraction)) +
    '</div><p>' +
    (hasCash
      ? 'Денежный вклад ' + rub(role.cash) + ' · доля ' + percent(role.share)
      : 'Стартовый денежный вклад 0 ₽. Работа УК учитывается отдельно.') +
    '</p></section></div>'
  );
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
  const pt = values[m.m];
  return (
    '<section class="bento-card d-card d-cash-chart"><div class="d-head"><div><h2>Накопленные выплаты</h2><p class="d-note">' +
    esc(role.full) +
    ' · после расчётного налога</p></div><div class="d-chart-key"><span><i></i>Выплаты</span>' +
    (cash > 0 ? '<span><i class="d-dashed"></i>Денежный вклад</span>' : '') +
    '</div></div>' +
    '<div class="d-chart-wrap"><div class="d-chart-axis" aria-hidden="true"><span>' +
    compact(top) +
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
    '" preserveAspectRatio="none">' +
    grid +
    depositLine +
    '<path d="' +
    path +
    ' V' +
    bottom +
    ' H' +
    left +
    ' Z" class="d-chart-area"/><path d="' +
    path +
    '" class="d-chart-series"/><line x1="' +
    xy(x(m.m)) +
    '" x2="' +
    xy(x(m.m)) +
    '" y1="' +
    yTop +
    '" y2="' +
    bottom +
    '" class="d-chart-selected"/><circle cx="' +
    xy(x(m.m)) +
    '" cy="' +
    xy(y(pt)) +
    '" r="4" class="d-chart-point"/></svg></div></div>' +
    '<div class="d-chart-labels" aria-hidden="true"><span>Старт</span><span>М12</span><span>М24</span><span>М36</span><span>М48</span><span>М60</span></div><div class="d-chart-caption"><span>' +
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
              ' <small>М' +
              row.m +
              '</small></dt><dd>' +
              rub(row.policies[policy].payouts[role.idx] * role.fraction) +
              '</dd></div>',
          )
          .join('') +
        '</dl>'
      : '<p>В этом году распределений не запланировано.</p>';
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
  return (
    '<section class="bento-card d-card"><div class="d-head"><h2>График выплат</h2><span class="d-head-unit">Чистые дивиденды, ₽</span></div><div class="ui-table-frame d-table-frame"><table class="ui-table d-ledger"><thead><tr><th scope="col">Период</th><th scope="col" class="is-number">За год</th><th scope="col" class="is-number">С запуска</th></tr></thead><tbody>' +
    yearRows.join('') +
    '</tbody></table></div></section>'
  );
}
export function renderInvestors(ctx) {
  const { c, m } = select(ctx),
    role = roles.find((r) => r.key === ctx.state.role) ?? roles[0],
    policy = ctx.state.policy;
  return (
    '<div class="detail-view" data-detail-view="investors">' +
    personSelect(role) +
    personKPIs(ctx, c, m, role) +
    policySelect(ctx, c) +
    payoutChart(c, m, role, policy) +
    payoutLedger(c, m, role, policy) +
    '</div>'
  );
}

const bound = new WeakSet();
export function bindDetails(root, ctx) {
  const panel = root.matches?.('[data-detail-view]') ? root : root.querySelector('[data-detail-view]');
  if (!panel || bound.has(panel)) return;
  bound.add(panel);
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
      val = control.dataset.dvValue,
      view = panel.dataset.detailView;
    if (action === 'policy' || action === 'role') {
      if (val !== ctx.state[action]) {
        ctx.update(
          { [action]: val },
          { focus: '[data-dv-action="' + action + '"][data-dv-value="' + val + '"]' },
        );
      }
      return;
    }
    if (action === 'group') {
      local.group = val;
      local.machine = null;
    } else if (action === 'machine') {
      local.machine = local.machine === val ? null : val;
    } else if (action === 'year') {
      const year = Number(val);
      local.year = (local.year ?? Math.ceil(Number(ctx.state.month) / 12)) === year ? 0 : year;
    } else return;
    const parent = panel.parentElement;
    const wasDetailsOpen = panel.querySelector('.d-disclosure')?.open;
    panel.outerHTML = view === 'production' ? renderProduction(ctx) : renderInvestors(ctx);
    const fresh = parent.querySelector('[data-detail-view]');
    bindDetails(fresh, ctx);
    if (wasDetailsOpen && fresh.querySelector('.d-disclosure'))
      fresh.querySelector('.d-disclosure').open = true;
    const target = fresh.querySelector('[data-dv-action="' + action + '"][data-dv-value="' + val + '"]');
    target?.focus({ preventScroll: true });
  });
}
