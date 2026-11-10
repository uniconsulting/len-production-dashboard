import { investorReturns } from './faq-returns.js';
import { roles, policies } from './investor-options.js';
import { plans } from './pickers.js?v=5';

// Both annual answers use the first full calendar year after the target December 2027.
// Stocks are averaged between the start and end of each month (including December 2027).
function year2028(plan, meta, policy) {
  const opening = plan.months.find((row) => row.date === '2027-12');
  const year = plan.months.filter((row) => row.date.startsWith('2028-'));
  if (!opening || year.length !== 12) return null;
  const closing = year.at(-1);
  const total = (key) => year.reduce((sum, row) => sum + row[key], 0);
  const averageBalance = (key) => (total(key) + (opening[key] - closing[key]) / 2) / year.length;
  const revenue = total('revenue');
  const days = total('days');
  const cost = total('materialCost');
  const equity =
    meta.principal.reduce((sum, amount) => sum + amount, 0) + closing.policies[policy].retainedProfit;
  return {
    yearDays: days,
    revenue,
    equity,
    // Receivables include VAT. Sales and material consumption in the P&L exclude it.
    stockDays: cost > 0 ? (days * averageBalance('stock')) / cost : null,
    collectionDays:
      revenue > 0 ? (days * averageBalance('receivables')) / (revenue * (1 + meta.vat)) : null,
  };
}

function turnoverAnswer(annual, { n, money }) {
  if (!annual || annual.stockDays === null || annual.collectionDays === null) {
    return '<p>Для расчёта денежного цикла нужны продажи, расход материала и остатки за полный год.</p>';
  }
  // The workbook assumes immediate supplier payment and models no work in progress.
  const cycle = annual.stockDays + annual.collectionDays;
  const turns = cycle > 0 ? ` Это около ${n(annual.yearDays / cycle, 1)} оборота в год.` : '';
  return `<p>В 2028 году от оплаты материала до поступления денег от заказчиков проходит в среднем <strong>${n(cycle, 1)} дня</strong>.${turns}</p>
    <p>Запас материала покрывает ${n(annual.stockDays, 1)} дня работы, ожидание оплаты после отгрузки занимает ещё ${n(annual.collectionDays, 1)} дня. Поставщикам платим без отсрочки. Расчёт использует средние остатки за год. Плановая выручка за год — ${money(annual.revenue)} без НДС.</p>`;
}

function firstAnswer(first, { state, money, fullMonth, model }) {
  const timing = first
    ? `<strong>${fullMonth(first.date)} · ${money(first.net)} на руки.</strong> Это ${first.m}-й месяц с запуска.`
    : `За ${model.meta.horizon} месяцев у выбранного участника по этому сценарию выплат нет.`;
  return `<p>${timing}</p><p>${policies[state.policy].detail} Выплата возможна после погашения стартового займа, пополнения резервов и решения участников. В сумме уже учтён налог получателя по модели.</p>`;
}

function paybackAnswer(result, role, { state, cs, money, fullMonth, model }) {
  if (role.cash === 0) {
    return `<p><strong>Стартовый денежный вклад УК — 0 ₽.</strong> УК участвует работой. Модель засчитывает согласованную стоимость работы в пределах ${money(model.meta.ownerCreditLimit)}. Последующие часы основатели предоставляют без оплаты и дополнительного зачёта.</p>`;
  }
  const cutoff = result.payback;
  const last = cs.months.at(-1);
  const paid = last.policies[state.policy].cumPayouts[role.idx] * role.fraction;
  const timing = cutoff
    ? `<strong>${fullMonth(cutoff.date)}, ${cutoff.m}-й месяц.</strong> К этому моменту накопленные дивиденды на руки составят ${money(cutoff.net)} и покроют стартовый вклад ${money(role.cash)}.`
    : `<strong>В пределах ${last.m} месяцев вклад ещё не окупится.</strong> При стартовом вложении ${money(role.cash)} участник получит ${money(paid)} на руки. До возврата останется ${money(Math.max(0, role.cash - paid))}.`;
  return `<p>${timing}</p><p>Доля остаётся у участника после окупаемости. Расчёт охватывает внесённые на старте деньги. Суммы и даты последующих взносов для выравнивания ещё предстоит согласовать.</p>`;
}

function earningsAnswer(period, role, { money, fullMonth }) {
  if (!period) return '<p>Трёхлетний период выходит за горизонт выбранного расчёта.</p>';
  const dates = `${fullMonth(period.from, true)} — ${fullMonth(period.to, true)}`;
  if (role.cash === 0) {
    const work =
      period.workCost === null
        ? 'В этом сценарии отдельная оценка всего труда основателей за три года отсутствует.'
        : `Стоимость неоплаченной работы за этот период — ${money(period.workCost)}. С учётом этой работы экономический результат УК составит ${money(period.afterWork)}.`;
    return `<p>За первые 36 месяцев УК получит <strong>${money(period.paid)} дивидендов</strong> после налога по модели. Это поступления юридическому лицу за период ${dates}.</p><p>${work}</p>`;
  }
  const outcome =
    period.gain >= 0
      ? `<strong>${money(period.gain)} сверх стартового вклада.</strong>`
      : `<strong>До возврата вклада останется ${money(-period.gain)}.</strong>`;
  return `<p>${outcome} За первые 36 месяцев (${dates}) дивиденды на руки по плану составят ${money(period.paid)} при денежном вложении ${money(role.cash)}.</p><p>Здесь учтены только деньги, полученные участником. Стоимость доли можно посмотреть в следующем ответе.</p>`;
}

function valueAnswer(annual, role, { money, pct }) {
  if (!annual || !Number.isFinite(annual.equity))
    return '<p>Для расчёта нужен управленческий баланс на конец 2028 года.</p>';
  return `<p>Рыночная цена доли пока неизвестна. По плановому балансу на 31 декабря 2028 года на долю ${pct(role.share)} приходится <strong>${money(annual.equity * role.share)} чистых активов</strong> «ЛËН Производство». По выбранной политике выплат в балансе всего ООО — ${money(annual.equity)} собственного капитала.</p>
    <p>Для оценки цены продажи понадобятся фактическая прибыль, подтверждённые контракты и условия сделки. Оценки бренда и согласованной цены выкупа в модели нет.</p>`;
}

function salesAnswer({ r, fullMonth, n, pct, money, batchNoun }) {
  const capacity = r.groupCapacity.reduce((sum, hours) => sum + hours, 0);
  return `<p><strong>${fullMonth(r.date)} · ${n(r.orders, 1)} ${batchNoun(r.orders)}</strong> при среднем чеке ${money(r.avgCheck)} без НДС. Это даёт ${money(r.revenue)} выручки.</p>
    <p>На такой объём потребуется ${n(r.printHours)} машино-часов из ${n(capacity)} доступных (${capacity > 0 ? pct(r.printHours / capacity) : 'фонд часов отсутствует'}). Воронка продаж на этот месяц предусматривает ${n(r.theoryLeads)} квалифицированных запросов.</p>`;
}

function fundingAnswer({ model, money, pct }) {
  const { meta } = model;
  const capital = meta.principal.reduce((sum, amount) => sum + amount, 0);
  return `<p>На старте участники вносят деньгами ${money(capital)}. Смета — ${money(meta.startupBudget)}, денежный резерв — ${money(meta.startupReserve)}. Для покрытия сметы и резерва требуется ещё <strong>${money(meta.startupBudget + meta.startupReserve - capital)}</strong>.</p>
    <p>Модель предполагает заём на ${meta.loanDue} месяцев под ${pct(meta.loanApr, 0)} годовых. Предоставление займа и стоимость электромонтажа требуют подтверждения.</p>`;
}

let openItem = 'cycle';

function selectSetting(key, label, choices, current) {
  const options = choices
    .map(
      ([value, text]) =>
        `<option value="${value}" ${value === current ? 'selected' : ''}>${text}</option>`,
    )
    .join('');
  return `<label><span>${label}</span><select class="ui-select" data-faq-setting="${key}">${options}</select></label>`;
}

export function renderFAQ(ctx) {
  const { state, cs, model, money, n, pct, icon } = ctx;
  const role = roles.find((option) => option.key === state.role);
  const result = investorReturns(cs, state.policy, role);
  const annual = year2028(cs, model.meta, state.policy);
  const scenario = plans.find((option) => option.value === state.scenario).title;
  const planName =
    state.scenario === 'growth' ? scenario : `${scenario} · ${n(state.portfolio)} партий в месяц`;
  const questions = [
    ['cycle', 'Какая оборачиваемость у производства?', turnoverAnswer(annual, ctx)],
    [
      'start',
      'Когда начнутся выплаты и сколько я получу в первый раз?',
      firstAnswer(result.firstPayout, ctx),
    ],
    ['payback', 'Когда вернутся вложенные деньги?', paybackAnswer(result, role, ctx)],
    ['earnings', 'Сколько я заработаю за три года?', earningsAnswer(result.threeYears, role, ctx)],
    ['value', 'Сколько будет стоить моя доля в 2028 году?', valueAnswer(annual, role, ctx)],
    ['sales', 'Сколько заказов нужно для выполнения плана?', salesAnswer(ctx)],
    ['funding', 'Хватает ли стартовых денег на запуск?', fundingAnswer(ctx)],
  ];
  return `<section id="faq" class="bento-card faq-card" aria-labelledby="faq-title">
    <header class="faq-head"><h2 id="faq-title">Быстрые ответы</h2><p class="faq-context">${planName} · доля ${pct(role.share)} · денежный вклад ${money(role.cash)}</p></header>
    <div class="faq-controls">${selectSetting(
      'role',
      'Участник',
      roles.map((r) => [r.key, r.title]),
      state.role,
    )}
      ${selectSetting(
        'policy',
        'Распределение прибыли',
        Object.entries(policies).map(([key, p]) => [key, p.label]),
        state.policy,
      )}</div>
    <div class="faq-list">${questions
      .map(
        ([id, question, answer]) =>
          `<details class="faq-item" data-faq-id="${id}" name="investor-faq" ${openItem === id ? 'open' : ''}>
        <summary><span>${question}</span>${icon('chevron', 18)}</summary><div class="faq-answer">${answer}</div></details>`,
      )
      .join('')}</div>
  </section>`;
}

export function bindFAQ(slot, { update }) {
  const faq = slot.querySelector('.faq-card');
  faq.addEventListener('change', (event) => {
    const select = event.target.closest('select[data-faq-setting]');
    if (!select) return;
    const key = select.dataset.faqSetting;
    update({ [key]: select.value }, { focus: `[data-faq-setting="${key}"]` });
  });
}

// Read the live disclosure before a full dashboard render. The browser's
// toggle event can arrive after a change to the role or monthly scenario.
export function rememberFAQ(root) {
  const faq = root.querySelector('#faq');
  if (faq) openItem = faq.querySelector('.faq-item[open]')?.dataset.faqId ?? null;
}
