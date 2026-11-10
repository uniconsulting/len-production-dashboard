import { investorReturns } from './faq-returns.js';
import { roles, policies, investorFields } from './investor-options.js?v=13';
import { choiceTrigger, bindChoicePicker, plans } from './pickers.js?v=13';
import { businessYear2028, comparables, saleMultiples } from './business-value.js?v=13';

function turnoverAnswer(annual, { n, money }) {
  if (!annual) return '<p>Для ответа нужен полный календарный год работы производства.</p>';
  const assetReading =
    annual.assetTurns === null
      ? ''
      : `<p><strong>Оборачиваемость активов — ${n(annual.assetTurns, 2)} раза в год.</strong>
    Каждый рубль в активах фермы приносит ${n(annual.assetTurns, 2)} ₽ выручки за год. В расчёте участвуют оборудование, материалы, деньги и задолженность клиентов. Средняя стоимость всех активов за 2028 год — ${money(annual.averageAssets)}.</p>`;
  return `<p>По выбранному плану оборот всего производства за 2028 год составит <strong>${money(annual.revenue)}</strong> без НДС, в среднем ${money(annual.monthlySales)} в месяц.</p>${assetReading}`;
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

function valueAnswer(annual, role, { n, money, pct }) {
  if (!annual) return '<p>Для оценки продажи нужен полный год выручки и прибыли.</p>';
  const methods = [
    ['По выручке', annual.byRevenue],
    ['По прибыли', annual.byProfit],
  ].filter(([, price]) => Number.isFinite(price) && price > 0);
  if (!methods.length)
    return '<p>При этих результатах рассчитать положительную цену действующего производства по мультипликаторам не удаётся.</p>';
  const mln = (value) => n(value / 1000000, 2);
  const prices = methods.map(([, price]) => price);
  const bounds = (fraction) => {
    const low = mln(Math.min(...prices) * fraction);
    const high = mln(Math.max(...prices) * fraction);
    return (low === high ? low : low + '–' + high) + ' млн ₽';
  };
  const costOfOwners = Number.isFinite(annual.normalizedProfit)
    ? annual.profit - annual.normalizedProfit
    : null;
  const profitBasis =
    costOfOwners === null
      ? 'Для оценки по прибыли требуется стоимость замены неоплаченной работы основателей.'
      : `Из ${money(annual.profit)} чистой прибыли по плану вычитаем ${money(costOfOwners)} стоимости неоплаченной работы УК. Для покупателя остаётся ${money(annual.normalizedProfit)} за год.`;
  const sourceLinks = comparables
    .map(
      (offer) =>
        `<li><a href="${offer.url}" target="_blank" rel="noopener noreferrer">${offer.label}</a> · цена ${money(offer.price)}, выручка ${money(offer.revenue)} и прибыль ${money(offer.profit)} в месяц.</li>`,
    )
    .join('');
  return `<p>Если план 2028 года выполнен, ориентир цены за 100% «ЛËН Производство» на 31 декабря — <strong>${bounds(1)}</strong>. При продаже всей компании на вашу долю ${pct(role.share)} приходится <strong>${bounds(role.share)}</strong> до налогов и расходов продавца.</p>
    <table class="faq-sale-table"><caption>Расчёт цены, млн ₽</caption><thead><tr><th scope="col">Метод</th><th scope="col">Вся компания</th><th scope="col">Доля ${pct(role.share)}</th></tr></thead><tbody>
    ${methods.map(([name, price]) => `<tr><th scope="row">${name}</th><td>${mln(price)}</td><td>${mln(price * role.share)}</td></tr>`).join('')}</tbody></table>
    <p>Два ориентира рассчитаны по запрашиваемым ценам трёх российских 3D-производств. Фактические цены закрытия этих сделок неизвестны. При продаже отдельной доли цену согласуют с учётом прав и влияния её покупателя.</p>
    <details class="sale-calculation"><summary>Как рассчитана стоимость</summary>
      <p>К годовой выручке без НДС ${money(annual.revenue)} применяем коэффициент ${n(saleMultiples.revenue, 3)}×, к годовой прибыли с учётом работы УК — ${n(saleMultiples.profit, 3)}×. ${profitBasis}</p>
      <p>В расчёте предполагаем, что покупателю передадут действующий парк, оборотный капитал, клиентские договоры и право работать под брендом «ЛËН Производство». Ценность бренда учтена через продажи и прибыль. Права на SaaS «ЛËН Автоматизация» остаются у отдельной компании.</p>
      <p>В каждом методе к цене действующего производства прибавляем остаток денег сверх резервов (${money(annual.cashAfterReserves)}) и вычитаем остаток займа (${money(annual.debt)}). Необходимые резервы — ${money(annual.reserves)}. Уже выплаченные дивиденды учтены в расчёте заработка участника.</p>
      <p>По каждому объявлению сопоставили цену с годовой выручкой и чистой прибылью. Для каждого метода взяли средний по порядку коэффициент из трёх. Предприятия различаются масштабом, каналами продаж и участием владельца. Остатки денег и порядок учёта НДС у продавцов раскрыты не полностью. Данные объявлений проверены 10 ноября 2026 года.</p>
      <ul>${sourceLinks}</ul>
    </details>`;
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

function faqSetting(field, state, icon) {
  const id = 'faq-' + field.key;
  return `<div class="len-picker-field"><label for="${id}">${field.label}</label>
    ${choiceTrigger(id, field.label, state[field.key], field.choices, icon)}
  </div>`;
}

export function renderFAQ(ctx) {
  const { state, cs, model, money, n, pct, icon } = ctx;
  const role = roles.find((option) => option.key === state.role);
  const result = investorReturns(cs, state.policy, role);
  const annual = businessYear2028(cs, model.meta, state.policy);
  const scenario = plans.find((option) => option.value === state.scenario).title;
  const planName =
    state.scenario === 'growth' ? scenario : `${scenario} · ${n(state.portfolio)} партий в месяц`;
  const questions = [
    [
      'cycle',
      'Какой оборот у производства и сколько выручки приносит рубль активов?',
      turnoverAnswer(annual, ctx),
    ],
    [
      'start',
      'Когда начнутся выплаты и сколько я получу в первый раз?',
      firstAnswer(result.firstPayout, ctx),
    ],
    ['payback', 'Когда вернутся вложенные деньги?', paybackAnswer(result, role, ctx)],
    ['earnings', 'Сколько я заработаю за три года?', earningsAnswer(result.threeYears, role, ctx)],
    [
      'value',
      'За сколько можно продать бизнес и мою долю в конце 2028 года?',
      valueAnswer(annual, role, ctx),
    ],
    ['sales', 'Сколько заказов нужно для выполнения плана?', salesAnswer(ctx)],
    ['funding', 'Хватает ли стартовых денег на запуск?', fundingAnswer(ctx)],
  ];
  return `<section id="faq" class="bento-card faq-card" aria-labelledby="faq-title">
    <header class="faq-head"><h2 id="faq-title">Быстрые ответы</h2><p class="faq-context">${planName} · доля ${pct(role.share)} · денежный вклад ${money(role.cash)}</p></header>
    <div class="faq-controls">${Object.values(investorFields)
      .map((field) => faqSetting(field, state, icon))
      .join('')}</div>
    <div class="faq-list">${questions
      .map(
        ([id, question, answer]) =>
          `<details class="faq-item" data-faq-id="${id}" name="investor-faq" ${openItem === id ? 'open' : ''}>
        <summary><span>${question}</span>${icon('chevron', 18)}</summary><div class="faq-answer">${answer}</div></details>`,
      )
      .join('')}</div>
  </section>`;
}

export function bindFAQ(slot, ctx) {
  for (const field of Object.values(investorFields)) {
    bindChoicePicker(slot.querySelector('#faq-' + field.key), ctx, field);
  }
}

// Read the live disclosure before a full dashboard render. The browser's
// toggle event can arrive after a change to the role or monthly scenario.
export function rememberFAQ(root) {
  const faq = root.querySelector('#faq');
  if (faq) openItem = faq.querySelector('.faq-item[open]')?.dataset.faqId ?? null;
}
