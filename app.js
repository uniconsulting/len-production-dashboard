import { filterSummary, openFilters } from './ui/mobile-filters.js?v=4';
import { mobileBatchList } from './ui/mobile-overview.js?v=4';
import { kpiChart } from './ui/kpi-charts.js?v=4';
import { icon } from './ui/icons.js';
import { chart, bindChart } from './ui/chart.js?v=4';
import { renderPickers, bindPickers } from './ui/pickers.js?v=4';
import { bindBento } from './ui/bento.js?v=4';
import { renderProduction, renderInvestors, bindDetails } from './ui/details.js?v=4';

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
const expandedSections = { trends: false, funnel: false };
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
function toolbar() {
  return (
    filterSummary(ctx(), current().months[state.month - 1], batchNoun(state.portfolio)) +
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
    renderPickers({ state, months: current().months, fullMonth, icon }) +
    '</div></div>'
  );
}
function overview() {
  const cs = current(),
    r = cs.months[state.month - 1],
    capacity = r.groupCapacity.reduce((a, b) => a + b, 0);
  const pnlButton =
    '<button type="button" class="signal-open" data-action="pnl" aria-label="Открыть расчёт прибыли за месяц">' +
    icon('arrowUpRight', 18) +
    '</button>';
  const hero =
    '<section class="hero-card bento-card"><div class="depth-fill" aria-hidden="true"><i class="depth-field"></i><i class="depth-core"></i><i class="depth-grain"></i></div><div class="signal-head"><h2>Выручка за месяц</h2>' +
    pnlButton +
    '</div><div class="hero-reading"><p class="hero-num"><span>' +
    n(r.revenue) +
    '</span><small>₽</small></p><span class="hero-tax">без НДС</span></div><dl class="hero-bottom"><div><dt>Принятые партии</dt><dd>' +
    n(r.orders, 1) +
    '</dd></div><div><dt>Средний чек</dt><dd>' +
    money(r.avgCheck) +
    '</dd></div></dl></section>';
  const metric = (type, label, explanation, cls) =>
    '<section class="bento-card mini-card ' +
    cls +
    '"><div class="signal-head"><h2>' +
    label +
    '</h2>' +
    pnlButton +
    '</div><p class="metric-value">' +
    n(r[type]) +
    ' <small>₽</small></p><p class="metric-caption">' +
    explanation +
    '</p>' +
    '<div class="metric-trend" id="trend-' +
    type +
    '">' +
    kpiChart(type, cs.months, state.month) +
    '</div></section>';
  const kpis =
    metric('margin', 'Маржинальный доход', pct(r.margin / r.revenue) + ' от выручки', 'margin-card') +
    metric('profit', 'Чистая прибыль', pct(r.profit / r.revenue) + ' от выручки', 'profit-card');
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
    '<section class="bento-card batch-card"><div class="card-head"><h2>Экономика партии</h2></div>' +
    mobileBatchList(ctx(), r) +
    '<div class="ui-table-frame"><table class="ui-table"><thead><tr><th scope="col">Профиль</th><th scope="col" class="is-number">Партий</th><th scope="col" class="is-number">Чек, ₽</th><th scope="col" class="is-number">Затраты¹, ₽</th><th scope="col" class="is-number">Маржа, ₽</th><th scope="col" class="is-number">Печать, ч</th><th scope="col" class="is-number">Труд, ч</th></tr></thead><tbody>' +
    model.profiles
      .map((p, i) => {
        const q = r.profileOrders[i],
          rev = q ? r.profileRevenue[i] / q : 0,
          margin = q ? r.profileMargin[i] / q : 0;
        return (
          '<tr><th scope="row"><button class="row-more" data-profile="' +
          i +
          '"><span>' +
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
    '<div class="financial-cards bento-card">' +
    kpis +
    `<div class="financial-actions"><button type="button" data-action="trends" aria-expanded="${expandedSections.trends}" aria-controls="trend-margin trend-profit">` +
    icon('chart', 16) +
    'Динамика</button><button type="button" data-action="pnl">Расчёт прибыли ' +
    icon('arrowUpRight', 16) +
    '</button></div></div></div><div class="analytics-grid">' +
    chart(ctx()) +
    fleet +
    '</div>' +
    batches +
    commercialPlan(r, cs) +
    '</div>'
  );
}
function render() {
  document.title = labels[state.view] + ' · ЛËН Производство';
  const brand =
    '<img class="brand-lockup" src="./assets/brand/len.svg?v=4" alt="ЛËН"><img class="brand-sign" src="./assets/brand/len-mark.svg" alt="">';
  const share =
    '<button type="button" class="share-btn" data-action="share" aria-label="Поделиться сценарием">' +
    icon('share', 18) +
    '<span>Поделиться</span></button>';
  const header =
    '<header class="mobile-header"><a data-view="overview" href="./" class="mobile-brand" aria-label="ЛËН Производство, обзор">' +
    brand +
    '</a>' +
    share +
    '</header>';
  const sidebar =
    '<aside class="sidebar"><a class="brand" href="./" data-view="overview" aria-label="ЛËН Производство, обзор">' +
    brand +
    '</a>' +
    nav() +
    '<div class="side-bottom"><button type="button" data-action="terms" aria-label="Условия расчёта" title="Условия расчёта">' +
    icon('info', 19) +
    '<span>Условия расчёта</span></button><div class="side-context">' +
    icon('pin', 15) +
    'Ульяновск</div></div></aside>';
  const titles =
    '<div class="page-title"><h1 tabindex="-1" id="title">' +
    pageTitles[state.view] +
    '</h1>' +
    share +
    '</div>';
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
  bindBento(app);
  bindPickers(app, { ...ctx(), months: current().months });
  if (state.view === 'overview') bindChart(slot, ctx());
  else bindDetails(slot, ctx());
}
function returnPlan(cs) {
  const target = cs.thresholds?.[state.target];
  const choices = [24, 36]
    .map(
      (months) =>
        `<button type="button" data-action="target" data-val="${months}" aria-pressed="${state.target === months}">${months} мес.</button>`,
    )
    .join('');
  const head = `<div class="card-head return-heading"><h2>Возврат 1 млн ₽</h2>
    <div class="chart-ranges" role="group" aria-label="Целевой срок возврата">${choices}</div></div>`;
  if (!target)
    return `<section class="bento-card payback-plan">${head}<p>При выбранном портфеле цель недостижима.</p></section>`;

  // The reverse model is evaluated at full monthly demand (December 2027).
  const planned = cs.months[12].avgCheck;
  const threshold = target.avgCheck;
  const scale = Math.max(threshold, planned, 1) * 1.12;
  const minimumPosition = (100 * threshold) / scale;
  const planPosition = (100 * planned) / scale;
  const gap = planned - threshold;
  return `<section class="bento-card payback-plan">${head}
    <div class="payback-layout">
      <div class="price-comparison">
        <dl class="check-pair">
          <div><dt>Минимальный чек</dt><dd class="goal-num">${money(threshold)}</dd></div>
          <div><dt>Плановый чек</dt><dd>${money(planned)}</dd></div>
        </dl>
        <div class="price-track" style="--minimum:${minimumPosition}%;--planned:${planPosition}%" aria-hidden="true"><i></i><b></b></div>
        <p class="price-difference">${gap >= 0 ? 'Запас по чеку' : 'До минимального чека'} <strong>${money(Math.abs(Math.round(gap)))}</strong></p>
      </div>
      <div class="monthly-thresholds">
        <h3>Для ${n(cs.target)} партий в месяц</h3>
        <dl><div><dt>Выручка от</dt><dd>${money(Math.ceil(target.revenue))}</dd></div>
          <div><dt>Маржинальный доход от</dt><dd>${money(Math.ceil(target.margin))}</dd></div></dl>
      </div>
    </div>
    <details class="return-assumptions"><summary>Условия для инвестора с долей 33%</summary>
      <p>Доля инвестора — 33%. Раз в квартал распределяется до 50% накопленного остатка прибыли. Чеки указаны без НДС. Выручка и маржинальный доход рассчитаны для полного объёма в декабре 2027 года.</p></details>
    </section>`;
}
function commercialPlan(r, cs) {
  const steps = [
    ['Квалифицированные запросы', r.theoryLeads],
    ['Коммерческие предложения', r.offers],
    ['Новые заказы', r.newOrders],
  ];
  const funnel = steps
    .map(
      ([label, value]) => `<li>
    <div class="funnel-reading"><span>${label}</span><strong>${n(value)}</strong></div>
    <div class="funnel-track" aria-hidden="true"><i style="width:${(100 * value) / Math.max(1, r.theoryLeads)}%"></i></div></li>`,
    )
    .join('');
  return `<div class="commercial-plan">
    <section class="bento-card sales-plan">
      <div class="sales-origin"><h2>План продаж</h2><p class="volume-reading">${n(r.orders, 1)} <small>${batchNoun(r.orders)}</small></p>
        <p class="volume-caption">К отгрузке в этом месяце</p></div>
      <button class="sales-toggle" type="button" data-action="funnel" aria-expanded="${expandedSections.funnel}" aria-controls="sales-route">Воронка продаж ${icon('chevron', 16)}</button>
      <div id="sales-route" class="sales-route"><ol class="funnel">${funnel}</ol>
        <p class="sales-assumptions">В заказ переходят ${pct(model.meta.conversion, 0)} запросов. Доля повторных заказов — ${pct(model.meta.repeatShare, 0)}.</p></div>
    </section>
    ${returnPlan(cs)}
  </div>`;
}
function batchNoun(value) {
  const category = new Intl.PluralRules('ru').select(Math.round(10 * value) / 10);
  return category === 'one'
    ? 'партия'
    : category === 'few' || category === 'other'
      ? 'партии'
      : 'партий';
}
function profitDetails(trigger) {
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
    trigger,
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
          ' годовых на ' +
          m.loanDue +
          ' месяцев. Стоимость электромонтажа предстоит подтвердить. Если декабрьские оплаты поступят 31-го числа при равномерных расходах рабочего плана на 30 партий, потребуется ещё около 111 тыс. ₽ для сохранения стартового резерва.',
      ],
      [
        'Портфель и цена',
        '22, 30 и 40 партий — три цели продаж. Рабочий сценарий набирает спрос к шестому месяцу. Ускоренный достигает его к третьему месяцу и предполагает более высокие цены. Цены и выручка отражают отгрузку без НДС. На продажи заложено 20 тыс. ₽/мес. на старте с индексацией. Отдельного штата отдела продаж в модели нет.',
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
function openDialog(title, body, trigger) {
  dialogTrigger = trigger;
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
function openProfile(i, trigger) {
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
    trigger,
  );
}
function periodTable(trigger) {
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
    trigger,
  );
}
function shareDialog(trigger) {
  openDialog(
    'Поделиться сценарием',
    '<p class="dialog-lead">Ссылка сохранит раздел, выбранный портфель, месяц и правило выплат.</p><label class="link-label">Публичная ссылка<input id="share-link" readonly></label><button class="primary-action" data-copy>' +
      icon('copy', 16) +
      'Скопировать ссылку</button><span class="copy-feedback" role="status"></span>',
    trigger,
  );
  dialog.querySelector('#share-link').value = location.href;
}
dialog.addEventListener('click', async (e) => {
  const bounds = dialog.getBoundingClientRect();
  const outside =
    e.target === dialog &&
    (e.clientX < bounds.left ||
      e.clientX > bounds.right ||
      e.clientY < bounds.top ||
      e.clientY > bounds.bottom);
  if (outside || e.target.closest('[data-close]')) {
    dialog.close();
    return;
  }
  const go = e.target.closest('[data-goto]');
  if (go) {
    dialog.close();
    update({ month: Number(go.dataset.goto) }, { focus: '.chart-area' });
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
  if (b.dataset.profile !== undefined) openProfile(Number(b.dataset.profile), b);
  if (b.dataset.action === 'filters')
    openFilters(dialog, openDialog, { ...ctx(), months: current().months }, allowed.portfolio, b);
  if (b.dataset.action === 'trends' || b.dataset.action === 'funnel') {
    const section = b.dataset.action;
    expandedSections[section] = !expandedSections[section];
    b.setAttribute('aria-expanded', String(expandedSections[section]));
  }
  if (b.dataset.action === 'pnl') profitDetails(b);
  if (b.dataset.action === 'target') {
    update({ target: Number(b.dataset.val) }, { focus: '[data-val="' + b.dataset.val + '"]' });
  }
  if (b.dataset.action === 'terms') openDialog('Условия расчёта', termContent(), b);
  if (b.dataset.action === 'share') shareDialog(b);
  if (b.dataset.action === 'period-table') periodTable(b);
});
addEventListener('popstate', () => {
  if (!model) return;
  if (dialog.open) dialog.close();
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
