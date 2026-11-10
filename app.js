import { filterSummary, openFilters } from './ui/mobile-filters.js?v=13';
import { mobileBatchList } from './ui/mobile-overview.js?v=5';
import { renderLead, bindLead } from './ui/reference-lead.js?v=11';
import { renderStrip } from './ui/reference-strip.js?v=11';
import { renderAnalytics } from './ui/reference-analytics.js?v=11';
import { renderFAQ, bindFAQ, rememberFAQ } from './ui/investor-faq.js?v=13';
import { icon } from './ui/icons.js';
import { chart, bindChart } from './ui/chart.js?v=5';
import { renderPickers, bindPickers } from './ui/pickers.js?v=13';
import { bindBento } from './ui/bento.js?v=11';
import { renderProduction, renderInvestors, bindDetails } from './ui/details.js?v=13';

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
  scenario: 'growth',
  policy: 'balance',
  month: 13,
  span: 24,
  role: 'lead',
};
const allowed = {
  view: Object.keys(labels),
  portfolio: [22, 30, 40],
  scenario: ['growth', 'base', 'fast'],
  policy: ['balance', 'retained'],
  span: [12, 24, 60],
  role: ['lead', 'pair', 'one', 'uk'],
};
const fmt = new Map();
let historyExpanded = false;
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
  if (out.scenario === 'growth') out.portfolio = defaults.portfolio;
  const m = Number(raw.month);
  if (Number.isInteger(m) && m >= 1 && m <= 60) out.month = m;
  return out;
}
function read() {
  const raw = Object.fromEntries(new URL(location.href).searchParams);
  // Previously a shared fixed-volume case could specify only its portfolio.
  if (!raw.scenario && allowed.portfolio.includes(Number(raw.portfolio))) raw.scenario = 'base';
  return sanitize(raw);
}
let state = read(),
  model;
const current = () =>
  model.cases[state.scenario === 'growth' ? 'growth' : state.scenario + '-' + state.portfolio];
function urlFor(next) {
  const url = new URL(location.href);
  url.search = '';
  if (next.view !== 'overview' || url.hash !== '#faq') url.hash = '';
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
  return { state, model, plan: current(), update, money, n, pct, icon, fullMonth };
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
  const plan = current();
  const row = plan.months[state.month - 1];
  const batchLabel = n(row.orders, 1) + ' ' + batchNoun(row.orders);
  const volume =
    state.scenario === 'growth'
      ? `<div class="portfolio"><span>План на месяц</span><strong>${batchLabel}</strong></div>`
      : `<div class="portfolio"><span id="portfolio-label">Партий после разгона</span>
        <div class="ui-segmented" role="group" aria-labelledby="portfolio-label">
          ${allowed.portfolio.map((v) => `<button type="button" data-portfolio="${v}" aria-pressed="${v === state.portfolio}">${v}</button>`).join('')}
        </div></div>`;
  return (
    filterSummary(ctx(), row, batchLabel) +
    `<div class="toolbar">${volume}<div class="toolbar-right">${renderPickers({ state, months: plan.months, fullMonth, icon })}</div></div>`
  );
}
function overview() {
  const cs = current(),
    r = cs.months[state.month - 1];
  const cardContext = { ...ctx(), cs, r, urlFor, batchNoun };
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
  return `<div class="overview">
    <div class="ref-board"><div class="ref-lead-pair">${renderLead(cardContext)}</div>
      ${renderStrip(cardContext)}
      <div class="ref-analytics-row">${renderAnalytics(cardContext)}</div>
    </div>
    <details class="ref-history" ${historyExpanded ? 'open' : ''}>
      <summary>Выручка и прибыль по месяцам ${icon('chevron', 18)}</summary>${chart(ctx())}
    </details>
    ${batches}${renderFAQ(cardContext)}
  </div>`;
}
function render() {
  rememberFAQ(app);
  document.title = labels[state.view] + ' · ЛËН Производство';
  const brand =
    '<img class="brand-lockup" src="./assets/brand/len.svg?v=5" alt="ЛËН"><img class="brand-sign" src="./assets/brand/len-mark.svg" alt="">';
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
  if (state.view === 'overview') {
    bindLead(slot, ctx());
    bindFAQ(slot, ctx());
    bindChart(slot, ctx());
    const history = slot.querySelector('.ref-history');
    history.addEventListener('toggle', () => {
      if (history.isConnected) historyExpanded = history.open;
    });
  } else bindDetails(slot, ctx());
}
function salesDetails(trigger) {
  const r = current().months[state.month - 1];
  const rows = [
    ['Принятые партии', n(r.orders, 1)],
    ['Средний чек партии без НДС', money(r.avgCheck)],
    ['Активные клиенты', n(r.activeClients)],
    ['Квалифицированные запросы', n(r.theoryLeads)],
    ['Коммерческие предложения', n(r.offers)],
    ['Новые заказы', n(r.newOrders)],
    ['Конверсия запросов в заказы', pct(model.meta.conversion, 0)],
    ['Доля повторных заказов', pct(model.meta.repeatShare, 0)],
  ];
  openDialog(
    'План продаж',
    `<p class="dialog-lead">${fullMonth(r.date)}</p><div class="dialog-metrics">
    ${rows.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</div>`,
    trigger,
  );
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
    ...(Number.isFinite(r.economicProfit)
      ? [
          ['Неоплаченный труд УК за месяц', -(r.profit - r.economicProfit)],
          ['Экономическая прибыль с учётом труда УК', r.economicProfit],
        ]
      : []),
    ['Поступления клиентов без НДС', r.receipts],
    ['Операционный денежный поток', r.opCashFlow],
    ['Запас материалов на конец месяца', r.stock],
    ['Дебиторская задолженность с НДС', r.receivables],
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
          ' месяцев. Стоимость электромонтажа предстоит подтвердить. Потребность в оборотных средствах зависит от графика поступлений клиентов.',
      ],
      [
        'Портфель и цена',
        'План роста предусматривает 30 партий в мае 2027 года и загрузку парка выше 80% в декабре 2027 года. Для сравнения доступны планы с постоянным объёмом 22, 30 или 40 партий после разгона. Цены и выручка отражают отгрузку без НДС. На продажи заложено 20 тыс. ₽/мес. на старте с индексацией. Отдельного штата отдела продаж в модели нет.',
      ],
      [
        'Выпуск и труд',
        'Первые шесть месяцев работают два основателя, суммарно 4 производственных часа в день. Затем — один оператор 6/1. В плане роста основатели берут на себя часы сверх фонда оператора. Производственные часы УК засчитываются в согласованный лимит вклада. После его достижения основатели продолжают работу без оплаты и дополнительного зачёта. Учтены централизованный запуск, обходы и дополнительная отделка у трети партий. Часы и цены требуют проверки на заказах.',
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
    update(
      { month: Number(go.dataset.goto) },
      { focus: historyExpanded ? '.chart-area' : '.ref-history summary' },
    );
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
  if (b.dataset.action === 'sales') salesDetails(b);
  if (b.dataset.action === 'pnl') profitDetails(b);
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
  const res = await fetch('./data/model.json?v=13');
  if (!res.ok) throw Error();
  model = await res.json();
  render();
  if (location.hash === '#faq') {
    requestAnimationFrame(() => document.querySelector('#faq')?.scrollIntoView({ block: 'start' }));
  }
} catch (err) {
  app.innerHTML =
    '<div class="initial"><h1>Не удалось открыть расчёт</h1><p>Обновите страницу, чтобы загрузить данные модели.</p><button class="primary-action" onclick="location.reload()">Повторить загрузку</button></div>';
  app.setAttribute('aria-busy', 'false');
  console.error(err);
}
