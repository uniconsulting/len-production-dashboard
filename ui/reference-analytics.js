// The flow chart, the cost split with sparklines, and the capsule columns
// follow the three lower panels of the supplied Finance Bento component.
const integer = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const shortMonth = new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: 'UTC' });
const longMonth = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dateOf = (month) => new Date(month.date + '-01T12:00:00Z');
const monthName = (month) => shortMonth.format(dateOf(month)).replace('.', '');
const dateName = (month) => longMonth.format(dateOf(month)).replace(/\s*г\.$/, '');
const rubles = (value) => integer.format(value) + ' ₽';
const pct = (value) => decimal.format(100 * value) + '%';

function moneyParts(value) {
  const scale = Math.abs(value) >= 1e6 ? 1e6 : 1e3;
  const formatted = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: scale === 1e6 ? 2 : 1,
  }).format(value / scale);
  return [formatted, scale === 1e6 ? 'млн ₽' : 'тыс. ₽'];
}

// Show the first full window at launch and a trailing window thereafter.
// The highlighted plan month can therefore be anywhere in the plot.
function monthsAround(months, current, length) {
  const end = Math.max(Math.min(length, months.length), current.m);
  return months.slice(Math.max(0, end - length), end);
}

// Smooth chords from the reference chart. Monotone slopes constrain the
// displayed curve to the range between consecutive monthly observations.
function smoothPath(points) {
  if (!points.length) return '';
  const slopes = points.slice(1).map(([x, y], i) => (y - points[i][1]) / (x - points[i][0]));
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0] || 0;
    if (i === points.length - 1) return slopes[i - 1];
    const left = slopes[i - 1],
      right = slopes[i];
    return left * right <= 0 ? 0 : (2 * left * right) / (left + right);
  });
  return points.slice(1).reduce(
    (path, [x, y], i) => {
      const [startX, startY] = points[i],
        dx = (x - startX) / 3;
      return (
        path +
        ' C' +
        (startX + dx) +
        ',' +
        (startY + dx * tangents[i]) +
        ' ' +
        (x - dx) +
        ',' +
        (y - dx * tangents[i + 1]) +
        ' ' +
        x +
        ',' +
        y
      );
    },
    'M' + points[0].join(','),
  );
}

function axisMax(value) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, value)));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((n) => n * magnitude >= value) * magnitude;
}

function sparkline(months, key) {
  const values = months.map((m) => m[key]);
  const low = Math.min(...values),
    high = Math.max(...values);
  const points = values.map((value, i) => [
    3 + (88 * i) / Math.max(1, values.length - 1),
    high === low ? 15 : 24 - (18 * (value - low)) / (high - low),
  ]);
  const line = smoothPath(points),
    [endX, endY] = points.at(-1);
  return `<svg class="ra-spark" viewBox="0 0 96 30" aria-hidden="true">
    <defs><linearGradient id="ra-wash-${key}" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <path d="${line} L${endX},30 L3,30 Z" fill="url(#ra-wash-${key})"/>
    <path class="ra-spark-line" d="${line}"/><circle cx="${endX}" cy="${endY}" r="2.9" fill="#fff"/></svg>`;
}

function tooltip(month, lines, placement = '') {
  const content = lines
    .map(([label, value]) => `<span><span>${label}</span><b>${value}</b></span>`)
    .join('');
  return `<span class="ra-tip ${placement}"><strong>${dateName(month)}</strong>${content}</span>`;
}

function cashFlow(cs, current, vat) {
  const months = monthsAround(cs.months, current, 6);
  // Excel «Деньги»: row 7 is net of VAT, row 8 is gross client receipts.
  // Row 27 = row 8 – operating payments – VAT paid – profit tax paid.
  const flows = months.map((month) => {
    const incoming = month.receipts * (1 + vat);
    return { month, incoming, outgoing: incoming - month.opCashFlow };
  });
  const maximum = axisMax(Math.max(...flows.flatMap((point) => [point.incoming, point.outgoing])));
  const unit = maximum >= 1e6 ? ['млн ₽', 1e6] : ['тыс. ₽', 1e3];
  const positions = flows.map((_, i) => (100 * i) / Math.max(1, flows.length - 1));
  const path = (key, direction) =>
    smoothPath(
      flows.map((p, i) => [10 * positions[i], 100 + direction * (13 + (78 * p[key]) / maximum)]),
    );
  const grid = [0, 1, 2]
    .flatMap((step) =>
      [-1, 1].map((direction) => {
        const y = (100 + direction * (13 + 39 * step)) / 2;
        return `<span class="ra-grid-line" style="top:${y}%"><span>${decimal.format((step * maximum) / (2 * unit[1]))}</span></span>`;
      }),
    )
    .join('');
  const labels = flows
    .map(({ month, incoming, outgoing }, i) => {
      const place = positions[i] < 34 ? 'ra-tip-start' : positions[i] > 66 ? 'ra-tip-end' : '';
      const rows = [
        ['Поступило', rubles(incoming)],
        ['Уплачено', rubles(outgoing)],
        ['Поток', rubles(month.opCashFlow)],
      ];
      return `<details class="ra-flow-point" name="ra-point" style="left:${positions[i]}%">
      <summary aria-label="${dateName(month)}, показать поступления и платежи" ${month.m === current.m ? 'aria-current="date"' : ''}>${monthName(month)}</summary>
      ${tooltip(month, rows, place)}</details>`;
    })
    .join('');
  const [amount, suffix] = moneyParts(current.opCashFlow);
  return `<section class="ra-card bento-contour ref-flow" aria-labelledby="ra-flow-heading">
      <span class="bento-paint" aria-hidden="true"></span>
    <div class="ra-flow-head"><div><h2 id="ra-flow-heading">Денежный поток</h2>
      <p class="ra-sub">От операций <strong>${current.opCashFlow > 0 ? '+' : ''}${amount} ${suffix}</strong></p></div>
      <div class="ra-key"><span>Поступления</span><span>Платежи</span></div></div>
    <div class="ra-flow-chart" aria-label="Операционные поступления и платежи, ${unit[0]}, с НДС и налогами">
      <small class="ra-y-unit">${unit[0]} · с НДС</small>
      <div class="ra-flow-plot">${grid}<svg viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true">
        <path class="ra-flow-in" d="${path('incoming', -1)}"/><path class="ra-flow-out" d="${path('outgoing', 1)}"/>
      </svg>${labels}</div>
    </div></section>`;
}

const costRows = [
  ['materialCost', 'Материалы'],
  ['otherVariableCosts', 'Прочие переменные'],
  ['fixedCosts', 'Постоянные'],
];

function costBreakdown(cs, current) {
  const total = costRows.reduce((sum, [key]) => sum + current[key], 0);
  // A sparkline ends at its displayed value, including in the launch month.
  const months = cs.months.slice(Math.max(0, current.m - 6), current.m);
  const [amount, suffix] = moneyParts(total);
  const shares = costRows.map(([key]) => (total ? current[key] / total : 0));
  const split = shares
    .map((share, i) => `<i style="flex-grow:${share};--ra-tone:${[1, 0.62, 0.36][i]}"></i>`)
    .join('');
  const rows = costRows
    .map(([key, label], i) => {
      const [value, unit] = moneyParts(current[key]);
      return `<li><div class="ra-cost-label"><b>${label}</b><small>${pct(shares[i])}</small></div>
      ${sparkline(months, key)}<span class="ra-cost-value" title="${rubles(current[key])}">${value} <small>${unit}</small></span></li>`;
    })
    .join('');
  return `<section class="ra-card bento-contour ref-cost" aria-labelledby="ra-cost-heading">
      <span class="bento-paint" aria-hidden="true"></span>
    <h2 id="ra-cost-heading">Операционные затраты</h2><p class="ra-stat" title="${rubles(total)}">${amount} <small>${suffix}</small></p>
    <div class="ra-cost-split" aria-hidden="true">${split}</div>
    <ul class="ra-cost-list" aria-label="Расходы за выбранный месяц и динамика с ${monthName(months[0])} по ${monthName(current)}">${rows}</ul>
  </section>`;
}

function orderBars(cs, current) {
  const months = monthsAround(cs.months, current, 5);
  const previous = cs.months[current.m - 2];
  let change = 'Месяц запуска';
  if (previous) {
    const difference = current.orders - previous.orders;
    change =
      difference === 0
        ? 'Как в прошлом месяце'
        : `<strong>${difference > 0 ? '+' : '−'}${decimal.format(Math.abs(difference))}</strong> к прошлому месяцу`;
  }
  const maximum = axisMax(Math.max(...months.map((m) => m.orders)));
  const ticks = [maximum, maximum / 2, 0].map((n) => `<span>${decimal.format(n)}</span>`).join('');
  const columns = months
    .map((month, i) => {
      const selected = month.m === current.m;
      const place = i < 2 ? 'ra-tip-start' : i > 2 ? 'ra-tip-end' : '';
      return `<details class="ra-bar" name="ra-point"><summary ${selected ? 'aria-current="date"' : ''} aria-label="${dateName(month)}, ${decimal.format(month.orders)} партий, показать план продаж">
      <span class="ra-track"><i style="height:${(100 * month.orders) / maximum}%"></i></span><small>${monthName(month)}</small></summary>
      ${tooltip(
        month,
        [
          ['Партии', decimal.format(month.orders)],
          ['Средний чек', rubles(month.avgCheck)],
        ],
        place,
      )}</details>`;
    })
    .join('');
  return `<section class="ra-card bento-contour ref-orders" aria-labelledby="ra-orders-heading">
      <span class="bento-paint" aria-hidden="true"></span>
    <h2 id="ra-orders-heading">Партии</h2><p class="ra-stat">${decimal.format(current.orders)}</p>
    <p class="ra-sub">${change}</p>
    <div class="ra-order-plot" aria-label="План продаж, партий за месяц"><div class="ra-bar-axis" aria-hidden="true">${ticks}</div>${columns}</div>
  </section>`;
}

export function renderAnalytics({ model, cs, r }) {
  return cashFlow(cs, r, model.meta.vat) + costBreakdown(cs, r) + orderBars(cs, r);
}
