import { icon } from './ui/icons.js';
import { chart, bindChart } from './ui/chart.js';
import { renderProduction, renderInvestors, bindDetails } from './ui/details.js';

const app = document.querySelector('#app'),
  dialog = document.querySelector('#dialog');
const labels = { overview: 'Обзор', production: 'Производство', investors: 'Выплаты' };
const pageTitles = {
  overview: 'Обзор производства',
  production: 'Производственный план',
  investors: 'Выплаты участникам',
};
const navIcons = { overview: 'overview', production: 'production', investors: 'investors' };
const defaults = {
  view: 'overview',
  portfolio: 30,
  scenario: 'base',
  policy: 'balance',
  month: 13,
  span: 24,
  role: 'lead',
  target: 36,
};
const allowed = {
  view: Object.keys(labels),
  portfolio: [22, 30, 40],
  scenario: ['base', 'fast'],
  policy: ['balance', 'retained'],
  span: [12, 24, 60],
  role: ['lead', 'pair', 'one', 'uk'],
  target: [24, 36],
};
const fmt = new Map();
function n(v, d = 0) {
  if (!Number.isFinite(v)) return '—';
  if (!fmt.has(d)) fmt.set(d, new Intl.NumberFormat('ru-RU', { maximumFractionDigits: d }));
  return fmt.get(d).format(v);
}
const money = (v, d = 0) => n(v, d) + ' ₽',
  pct = (v, d = 1) => n(100 * v, d) + '%';
const months = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
function fullMonth(iso, lower = false) {
  const text = months.format(new Date(iso + '-01T12:00:00Z')).replace(/\s*г\.$/, '');
  return lower ? text : text[0].toUpperCase() + text.slice(1);
}
function sanitize(raw) {
  const out = { ...defaults };
  for (const [key, opts] of Object.entries(allowed)) {
    const v = typeof defaults[key] === 'number' ? Number(raw[key]) : raw[key];
    if (opts.includes(v)) out[key] = v;
  }
  const m = Number(raw.month);
  if (Number.isInteger(m) && m >= 1 && m <= 60) out.month = m;
  return out;
}
const read = () => sanitize(Object.fromEntries(new URL(location.href).searchParams));
let state = read(),
  model;
const current = () => model.cases[state.scenario + '-' + state.portfolio];
function urlFor(next) {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  for (const k of Object.keys(defaults))
    if (next[k] !== defaults[k]) url.searchParams.set(k, String(next[k]));
  return url;
}
function update(patch, opts = {}) {
  const old = state;
  state = sanitize({ ...state, ...patch });
  if (Object.keys(defaults).every((k) => old[k] === state[k])) return;
  const action = state.view !== old.view ? 'pushState' : 'replaceState';
  history[action](null, '', urlFor(state));
  render();
  if (old.view !== state.view) {
    scrollTo({ top: 0, behavior: 'instant' });
    document.querySelector('#title')?.focus({ preventScroll: true });
  } else if (opts.focus) {
    document.querySelector(opts.focus)?.focus({ preventScroll: true });
  }
}
function ctx() {
  return { state, model, update, money, n, pct, icon, fullMonth };
}
function nav(mobile = false) {
  return (
    '<nav class="' +
    (mobile ? 'mobile-nav' : 'side-nav') +
    '" aria-label="' +
    (mobile ? 'Разделы на мобильном' : 'Основные разделы') +
    '">' +
    Object.entries(labels)
      .map(
        ([key, label]) =>
          '<a aria-label="' +
          label +
          '" data-view="' +
          key +
          '" href="' +
          urlFor({ ...state, view: key }).pathname +
          urlFor({ ...state, view: key }).search +
          '" ' +
          (state.view === key ? 'aria-current="page"' : '') +
          '>' +
          icon(navIcons[key], 19) +
          '<span>' +
          label +
          '</span></a>',
      )
      .join('') +
    '</nav>'
  );
}
function scenarioControl() {
  return (
    '<label class="select-control pace-control">' +
    icon('settings', 16) +
    '<select id="scenario" aria-label="Темп роста и цены"><option value="base" ' +
    (state.scenario === 'base' ? 'selected' : '') +
    '>Рабочий план</option><option value="fast" ' +
    (state.scenario === 'fast' ? 'selected' : '') +
    '>Ускоренный план</option></select>' +
    icon('chevron', 13) +
    '</label>'
  );
}
function periodControl() {
  const groups = new Map();
  for (const r of current().months) {
    const year = r.date.slice(0, 4);
    if (!groups.has(year)) groups.set(year, []);
    groups
      .get(year)
      .push(
        '<option value="' +
          r.m +
          '" ' +
          (state.month === r.m ? 'selected' : '') +
          '>' +
          fullMonth(r.date) +
          '</option>',
      );
  }
  return (
    '<label class="select-control period-control">' +
    icon('calendar', 16) +
    '<select id="month" aria-label="Расчётный месяц">' +
    Array.from(
      groups,
      ([y, opts]) => '<optgroup label="' + y + '">' + opts.join('') + '</optgroup>',
    ).join('') +
    '</select>' +
    icon('chevron', 13) +
    '</label>'
  );
}
function toolbar() {
  return (
    '<div class="toolbar"><div class="portfolio"><span id="portfolio-label">Партий в месяц</span><div class="ui-segmented" role="group" aria-labelledby="portfolio-label">' +
    allowed.portfolio
      .map(
        (v) =>
          '<button type="button" data-portfolio="' +
          v +
          '" aria-pressed="' +
          (v === state.portfolio) +
          '">' +
          v +
          '</button>',
      )
      .join('') +
    '</div></div><div class="toolbar-right">' +
    scenarioControl() +
    periodControl() +
    '</div></div>'
  );
}
function spark(series, type) {
  const values = series.map((r) => r[type]),
    lo = Math.min(0, ...values),
    hi = Math.max(...values, lo + 1),
    w = 112,
    h = 29;
  const coords = values.map(
    (v, i) =>
      ((i * w) / (values.length - 1)).toFixed(1) +
      ',' +
      (h - 2 - ((v - lo) / (hi - lo)) * (h - 5)).toFixed(1),
  );
  return (
    '<svg viewBox="0 0 112 31" preserveAspectRatio="none" class="spark" aria-hidden="true"><path d="M' +
    coords.join(' L') +
    '" fill="none" stroke="currentColor" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>'
  );
}
function overview() {
  const cs = current(),
    r = cs.months[state.month - 1],
    capacity = r.groupCapacity.reduce((a, b) => a + b, 0);
  const ks = cs.months.slice(0, Math.max(2, state.month));
  const hero =
    '<section class="hero-card bento-card ui-grain-fill"><div class="hero-photo"></div><div class="hero-scrim"></div><div class="hero-inner"><div class="hero-caption"><span class="hero-mark">' +
    icon('chart', 17) +
    '</span>Выручка за месяц</div><h2 class="hero-num">' +
    n(r.revenue) +
    ' <small>₽</small></h2><span class="hero-tax">без НДС</span><div class="hero-bottom"><div><span>Принятые партии</span><strong>' +
    n(r.orders, 1) +
    '</strong></div><div><span>Средний чек</span><strong>' +
    money(r.avgCheck) +
    '</strong></div></div></div></section>';
  const metric = (type, label, expl, cls) =>
    '<article class="bento-card mini-card ' +
    cls +
    '"><button data-action="pnl" class="metric-link" aria-label="Открыть расчёт прибыли за месяц">' +
    icon('arrowUpRight', 14) +
    '</button><div class="metric-label"><span class="mini-dot"></span>' +
    label +
    '</div><strong>' +
    money(r[type]) +
    '</strong><div class="mini-foot"><span>' +
    expl +
    '</span>' +
    spark(ks, type) +
    '</div></article>';
  const kpis =
    '<div class="kpi-column">' +
    metric('margin', 'Маржинальный доход', pct(r.margin / r.revenue) + ' выручки', 'margin-card') +
    metric('profit', 'Чистая прибыль', 'После налога на прибыль', 'profit-card') +
    '</div>';
  const fleet =
    '<section class="bento-card fleet-preview"><div class="card-head"><h2>Загрузка парка</h2><a href="' +
    urlFor({ ...state, view: 'production' }) +
    '" data-view="production" class="round-link" aria-label="Подробная загрузка принтеров">' +
    icon('arrowUpRight', 17) +
    '</a></div><div class="fleet-big">' +
    pct(r.printHours / capacity) +
    '</div><div class="fleet-desc">' +
    n(r.printHours) +
    ' из ' +
    n(capacity) +
    ' доступных маш.-ч</div><div class="meters">' +
    ['Сверхгабаритный', 'Инженерные', 'Серийные']
      .map((name, i) => {
        const rate = r.groupCapacity[i] ? r.groupHours[i] / r.groupCapacity[i] : 0;
        return (
          '<div class="meter-line"><div><span>' +
          name +
          '</span><b>' +
          pct(rate) +
          '</b></div><div class="meter"><i class="group-' +
          i +
          '" style="width:' +
          Math.min(100, rate * 100) +
          '%"></i></div></div>'
        );
      })
      .join('') +
    '</div></section>';
  const batches =
    '<section class="bento-card batch-card"><div class="card-head"><h2>Экономика партии</h2><span class="fine-label">По профилям заказов</span></div><div class="ui-table-frame"><table class="ui-table"><thead><tr><th scope="col">Профиль</th><th scope="col" class="is-number">Партий</th><th scope="col" class="is-number">Чек, ₽</th><th scope="col" class="is-number">Затраты¹, ₽</th><th scope="col" class="is-number">Маржа, ₽</th><th scope="col" class="is-number">Печать, ч</th><th scope="col" class="is-number">Труд, ч</th></tr></thead><tbody>' +
    model.profiles
      .map((p, i) => {
        const q = r.profileOrders[i],
          rev = q ? r.profileRevenue[i] / q : 0,
          margin = q ? r.profileMargin[i] / q : 0;
        return (
          '<tr><th scope="row"><button class="row-more" data-profile="' +
          i +
          '"><i>' +
          p.id +
          '</i><span>' +
          p.name +
          '</span>' +
          icon('right', 12) +
          '</button></th><td class="is-number">' +
          n(q, 1) +
          '</td><td class="is-number">' +
          n(rev) +
          '</td><td class="is-number">' +
          n(rev - margin) +
          '</td><td class="is-number">' +
          n(margin) +
          '</td><td class="is-number">' +
          n(p.printHours, 1) +
          '</td><td class="is-number">' +
          n(p.operatorHours, 1) +
          '</td></tr>'
        );
      })
      .join('') +
    '</tbody></table></div><p class="table-note">¹ Переменные затраты на одну принятую партию. Цены без НДС.</p></section>';
  return (
    '<div class="overview"><div class="kpi-grid">' +
    hero +
    kpis +
    '</div><div class="analytics-grid">' +
    chart(ctx()) +
    fleet +
    '</div>' +
    batches +
    salesCards(r, cs) +
    '</div>'
  );
}
function render() {
  const cs = current(),
    r = cs.months[state.month - 1];
  document.title = labels[state.view] + ' · ЛËН Производство';
  const header =
    '<header class="topbar"><div class="crumb"><span>ЛËН Производство</span>' +
    icon('right', 12) +
    '<b>Финансовая модель</b></div><div class="mobile-brand"><img src="./assets/brand/len.svg" alt="">ЛËН <span>Производство</span></div><button class="share-btn" data-action="share" aria-label="Поделиться сценарием">' +
    icon('share', 16) +
    '<span>Поделиться</span></button></header>';
  const sidebar =
    '<aside class="sidebar"><a class="brand" href="./" data-view="overview"><img src="./assets/brand/len.svg" alt=""><span><strong>ЛËН</strong><small>Производство</small></span></a>' +
    nav() +
    '<div class="side-bottom"><button data-action="terms">' +
    icon('info', 18) +
    'Условия расчёта</button><div class="side-context"><i></i><span>Ульяновск<br><small>Производственная ферма</small></span></div></div></aside>';
  const titles =
    '<div class="page-title"><div><p class="kicker"><i></i>Декабрь 2026 — ноябрь 2031</p><h1 tabindex="-1" id="title">' +
    pageTitles[state.view] +
    '</h1></div><span class="month-index">М' +
    String(state.month).padStart(2, '0') +
    ' <span>/ 60</span></span></div>';
  const content =
    state.view === 'overview'
      ? overview()
      : state.view === 'production'
        ? renderProduction(ctx())
        : renderInvestors(ctx());
  app.innerHTML =
    sidebar +
    '<div class="workspace">' +
    header +
    '<main id="main" tabindex="-1">' +
    titles +
    toolbar() +
    '<div id="view-slot"></div><footer><span>ЛËН Производство · Расчётный сценарий</span><button data-action="terms">Условия расчёта ' +
    icon('arrowUpRight', 12) +
    '</button></footer></main></div>' +
    nav(true);
  const slot = app.querySelector('#view-slot');
  if (typeof content === 'string') slot.innerHTML = content;
  else slot.append(content);
  app.setAttribute('aria-busy', 'false');
  if (state.view === 'overview') bindChart(slot, ctx());
  else bindDetails(slot, ctx());
}
function salesCards(r, cs) {
  const target = cs.thresholds?.[state.target];
  const reverse = target
    ? '<div class="goal-num">' +
      money(target.avgCheck) +
      '</div><div class="fine-label">Минимальный средний чек партии без НДС</div><p class="goal-detail">При полном портфеле требуется ' +
      money(Math.ceil(target.revenue)) +
      ' выручки и ' +
      money(Math.ceil(target.margin)) +
      ' маржинального дохода за месяц.</p>'
    : '<p class="goal-detail">При выбранных условиях порог в пределах модели не достигнут.</p>';
  return (
    '<div class="sales-grid"><section class="bento-card sales-card"><div class="card-head"><h2>План продаж</h2><span class="fine-label">За выбранный месяц</span></div><div class="sales-steps">' +
    [
      [r.theoryLeads, 'Запросы'],
      [r.offers, 'Предложения'],
      [r.newOrders, 'Новые заказы'],
    ]
      .map(([v, t]) => '<div><strong>' + n(v) + '</strong><span>' + t + '</span></div>')
      .join('') +
    '</div><p class="goal-detail">При конверсии квалифицированного запроса в заказ 20% и доле повторных заказов 50%.</p></section><section class="bento-card sales-card"><div class="card-head"><h2>Возврат 1 млн ₽</h2><div class="chart-ranges" role="group" aria-label="Целевой срок возврата">' +
    [24, 36]
      .map(
        (v) =>
          '<button data-action="target" data-val="' +
          v +
          '" aria-pressed="' +
          (state.target === v) +
          '">' +
          v +
          ' мес.</button>',
      )
      .join('') +
    '</div></div>' +
    reverse +
    '<p class="table-note">Для инвестора с долей 33%. Каждый квартал распределяется до 50% накопленного остатка. Нормы полного месяца показаны для М13.</p></section></div>'
  );
}
function profitDetails() {
  const r = current().months[state.month - 1],
    p = r.policies[state.policy];
  const rows = [
    ['Выручка без НДС', r.revenue],
    ['Филамент', -r.materialCost],
    ['Прочие переменные расходы', -r.otherVariableCosts],
    ['Маржинальный доход', r.margin],
    ['Постоянные денежные расходы', -r.fixedCosts],
    ['EBITDA', r.ebitda],
    ['Амортизация', -r.depreciation],
    ['Проценты по займу', -r.interest],
    ['Налог на прибыль', -r.profitTax],
    ['Чистая прибыль', r.profit],
    ['Поступления клиентов без НДС', r.receipts],
    ['Остаток денег с резервами', p.cash],
  ];
  const row = (a, b) => '<div><span>' + a + '</span><strong>' + money(b) + '</strong></div>';
  openDialog(
    'Финансовый результат',
    '<p class="dialog-lead">' +
      fullMonth(r.date) +
      ' · ' +
      n(r.orders, 1) +
      ' принятых партий</p><div class="dialog-metrics">' +
      rows.map(([a, b]) => row(a, b)).join('') +
      '</div><p class="table-note">Средний счёт клиенту с НДС 22% — ' +
      money(r.avgCheck * (1 + model.meta.vat)) +
      '. Прибыль начисляется по отгрузке, поступления зависят от сроков оплаты.</p>',
  );
}
function termContent() {
  const m = model.meta;
  return (
    '<div class="dialog-list">' +
    [
      [
        'Финансирование запуска',
        'Смета ' +
          money(m.startupBudget) +
          ', денежные взносы 1 500 000 ₽ и отдельный резерв ' +
          money(m.startupReserve) +
          '. В расчёте предусмотрен заём ' +
          money(m.loanAmount) +
          ' под ' +
          pct(m.loanApr, 0) +
          ' годовых до М' +
          m.loanDue +
          '. Стоимость электромонтажа предстоит подтвердить. Если декабрьские оплаты поступят 31-го числа при равномерных расходах рабочего плана на 30 партий, потребуется ещё около 111 тыс. ₽ для сохранения стартового резерва.',
      ],
      [
        'Портфель и цена',
        '22, 30 и 40 партий — три цели продаж. Рабочий сценарий набирает спрос к М6. Ускоренный достигает его к М3 и предполагает более высокие цены. Цены и выручка отражают отгрузку без НДС. На продажи заложено 20 тыс. ₽/мес. на старте с индексацией. Отдельного штата отдела продаж в модели нет.',
      ],
      [
        'Выпуск и труд',
        'Первые шесть месяцев работают два основателя, суммарно 4 производственных часа в день. Затем — один оператор 6/1. Учтены централизованный запуск, обходы и дополнительная отделка в среднем у трети партий. Часы и цены требуют проверки на заказах.',
      ],
      [
        'Политика выплат',
        'По рабочему правилу каждый квартал можно распределить половину накопленного остатка прибыли. Во втором варианте половина всей заработанной прибыли постоянно сохраняется в производстве. В обоих действуют денежные резервы, обслуживание займа и условный налог участника.',
      ],
      [
        'Данные модели',
        'Горизонт с декабря 2026 по ноябрь 2031 года. Данные финансово-производственной модели от 10 ноября 2026 года. Экономика учитывает производство отдельно от бизнеса автоматизации.',
      ],
    ]
      .map(([a, b]) => '<section><h3>' + a + '</h3><p>' + b + '</p></section>')
      .join('') +
    '</div>'
  );
}
let dialogTrigger;
function openDialog(title, body) {
  dialogTrigger = document.activeElement;
  dialog.innerHTML =
    '<div class="dialog-head"><h2 id="dialog-title">' +
    title +
    '</h2><button class="close-btn" aria-label="Закрыть" data-close>' +
    icon('close') +
    '</button></div>' +
    body;
  dialog.showModal();
  dialog.scrollTop = 0;
}
function openProfile(i) {
  const r = current().months[state.month - 1],
    p = model.profiles[i],
    q = r.profileOrders[i],
    rev = q ? r.profileRevenue[i] / q : 0,
    mg = q ? r.profileMargin[i] / q : 0;
  openDialog(
    p.name + ' · одна партия',
    '<div class="dialog-metrics">' +
      [
        ['Годные изделия', n(p.units) + ' шт.'],
        ['Материал с потерями', n(p.materialKg, 2) + ' кг'],
        ['Печатное время', n(p.printHours, 1) + ' маш.-ч'],
        ['Работа по партии', n(p.operatorHours, 2) + ' чел.-ч'],
        ['Внешняя подготовка', n(p.externalHours, 1) + ' чел.-ч'],
        ['Чек без НДС', money(rev)],
        ['Переменные затраты', money(rev - mg)],
        ['Маржинальный доход', money(mg)],
      ]
        .map(([a, b]) => '<div><span>' + a + '</span><strong>' + b + '</strong></div>')
        .join('') +
      '</div>',
  );
}
function periodTable() {
  const c = current();
  openDialog(
    'Результаты по месяцам',
    '<div class="dialog-table"><table class="ui-table"><thead><tr><th>Месяц</th><th class="is-number">Выручка, ₽</th><th class="is-number">Прибыль, ₽</th></tr></thead><tbody>' +
      c.months
        .map(
          (r) =>
            '<tr><th scope="row"><button class="text-btn" data-goto="' +
            r.m +
            '">' +
            fullMonth(r.date) +
            '</button></th><td class="is-number">' +
            n(r.revenue) +
            '</td><td class="is-number">' +
            n(r.profit) +
            '</td></tr>',
        )
        .join('') +
      '</tbody></table></div>',
  );
}
function shareDialog() {
  openDialog(
    'Поделиться сценарием',
    '<p class="dialog-lead">Ссылка сохранит раздел, выбранный портфель, месяц и правило выплат.</p><label class="link-label">Публичная ссылка<input id="share-link" readonly></label><button class="primary-action" data-copy>' +
      icon('copy', 16) +
      'Скопировать ссылку</button><span class="copy-feedback" role="status"></span>',
  );
  dialog.querySelector('#share-link').value = location.href;
}
dialog.addEventListener('click', async (e) => {
  if (e.target === dialog || e.target.closest('[data-close]')) {
    dialog.close();
    return;
  }
  const go = e.target.closest('[data-goto]');
  if (go) {
    dialog.close();
    update({ month: Number(go.dataset.goto) });
    return;
  }
  if (e.target.closest('[data-copy]')) {
    const input = dialog.querySelector('input');
    let copied = false;
    try {
      await navigator.clipboard.writeText(input.value);
      copied = true;
    } catch {
      input.focus();
      input.select();
      try {
        copied = document.execCommand('copy');
      } catch {}
    }
    dialog.querySelector('.copy-feedback').textContent = copied
      ? 'Ссылка скопирована'
      : 'Выделите и скопируйте ссылку';
  }
});
dialog.addEventListener('close', () => {
  if (dialogTrigger?.isConnected) dialogTrigger.focus({ preventScroll: true });
});
app.addEventListener('click', (e) => {
  const b = e.target.closest('[data-view],[data-action],[data-portfolio],[data-span],[data-profile]');
  if (!b) return;
  if (b.dataset.view) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    update({ view: b.dataset.view });
  }
  if (b.dataset.portfolio)
    update(
      { portfolio: Number(b.dataset.portfolio) },
      { focus: '[data-portfolio="' + b.dataset.portfolio + '"]' },
    );
  if (b.dataset.span)
    update({ span: Number(b.dataset.span) }, { focus: '[data-span="' + b.dataset.span + '"]' });
  if (b.dataset.profile !== undefined) openProfile(Number(b.dataset.profile));
  if (b.dataset.action === 'pnl') profitDetails();
  if (b.dataset.action === 'target') {
    update({ target: Number(b.dataset.val) }, { focus: '[data-val="' + b.dataset.val + '"]' });
  }
  if (b.dataset.action === 'terms') openDialog('Условия расчёта', termContent());
  if (b.dataset.action === 'share') shareDialog();
  if (b.dataset.action === 'period-table') periodTable();
});
app.addEventListener('change', (e) => {
  if (e.target.id === 'month') update({ month: Number(e.target.value) }, { focus: '#month' });
  if (e.target.id === 'scenario') update({ scenario: e.target.value }, { focus: '#scenario' });
});
addEventListener('popstate', () => {
  if (!model) return;
  state = read();
  render();
});
try {
  const res = await fetch('./data/model.json');
  if (!res.ok) throw Error();
  model = await res.json();
  render();
} catch (err) {
  app.innerHTML =
    '<div class="initial"><h1>Не удалось открыть расчёт</h1><p>Обновите страницу, чтобы загрузить данные модели.</p><button class="primary-action" onclick="location.reload()">Повторить загрузку</button></div>';
  app.setAttribute('aria-busy', 'false');
  console.error(err);
}
