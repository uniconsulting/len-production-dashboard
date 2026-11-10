// Compact row from the supplied FinanceBento: Return, Free Cash, Payments, Goals.
// Every reading is for the selected scenario and month.
import { icon } from './icons.js';

const fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
function moneyParts(value) {
  const abs = Math.abs(value);
  if (abs >= 1e6) return [fmt.format(value / 1e6), 'млн ₽'];
  if (abs >= 10000) return [fmt.format(value / 1e3), 'тыс. ₽'];
  return [integer.format(value), '₽'];
}

function ticks(fraction, count = 38) {
  const filled = Math.round(count * Math.max(0, Math.min(1, fraction)));
  return `<svg class="ref-ticks" viewBox="0 0 200 17" preserveAspectRatio="none" aria-hidden="true">
    ${Array.from({ length: count }, (_, i) => {
      const x = (2 + (i * 196) / (count - 1)).toFixed(2);
      return `<line x1="${x}" x2="${x}" y1="${i % 6 ? 6 : 2}" y2="15" class="${i < filled ? 'on' : ''}"/>`;
    }).join('')}</svg>`;
}

export function renderStrip({ model, r, state, n, pct, money, urlFor }) {
  const payout = r.policies[state.policy].cumPayouts;
  const amount = (value) => {
    const [digits, unit] = moneyParts(value);
    return `<p class="strip-amount" title="${money(value)}"><span>${digits}</span> <small>${unit}</small></p>`;
  };
  const opener = (title, action, label) =>
    `<h2><button type="button" data-action="${action}" aria-label="${label}">${title}${icon('arrowUpRight', 14)}</button></h2>`;
  const recovery = (idx, label) => {
    const ratio = Math.min(1, Math.max(0, payout[idx] / model.meta.principal[idx]));
    return `<div class="strip-goal"><div><span>${label}</span><b>${pct(ratio, 0)}</b></div>${ticks(ratio)}</div>`;
  };
  const marginShare = r.revenue > 0 ? r.margin / r.revenue : 0;
  return `<div class="ref-strip">
    <section class="ref-mini bento-contour strip-result">
      <span class="bento-paint" aria-hidden="true"></span>
      ${opener('Чистая прибыль', 'pnl', 'Чистая прибыль: открыть расчёт')}
      <div>${amount(r.profit)}<p class="strip-caption">${r.revenue > 0 ? pct(r.profit / r.revenue, 1) + ' от выручки' : 'Выручки в этом месяце нет'}</p></div>
    </section>
    <section class="ref-mini bento-contour strip-margin">
      <span class="bento-paint" aria-hidden="true"></span>
      ${opener('Маржинальный доход', 'pnl', 'Маржинальный доход: открыть расчёт')}
      <div>${amount(r.margin)}<p class="strip-caption">${r.revenue > 0 ? pct(marginShare, 1) + ' от выручки' : 'Выручки в этом месяце нет'}</p></div>
      ${ticks(marginShare)}
    </section>
    <section class="ref-mini bento-contour strip-sales">
      <span class="bento-paint" aria-hidden="true"></span>
      ${opener('План продаж', 'sales', 'План продаж: заказы, средний чек и конверсия')}
      <dl>${[
        ['stack', 'Запросы', r.theoryLeads],
        ['file', 'Предложения', r.offers],
        ['check', 'Новые заказы', r.newOrders],
      ]
        .map(([i, label, val]) => `<div><dt><i>${icon(i, 13)}</i>${label}</dt><dd>${n(val)}</dd></div>`)
        .join('')}</dl>
    </section>
    <section class="ref-mini bento-contour strip-goals">
      <span class="bento-paint" aria-hidden="true"></span>
      <h2><a data-view="investors" href="${urlFor({ ...state, view: 'investors' })}" aria-label="Возврат вкладов: открыть выплаты участникам">Возврат вкладов${icon('arrowUpRight', 14)}</a></h2>
      ${recovery(1, 'Инвестор · 1 млн ₽')}${recovery(2, 'Пара · 500 тыс. ₽')}
    </section>
  </div>`;
}
