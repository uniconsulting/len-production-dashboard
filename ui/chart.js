const intFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const shortMonth = new Intl.DateTimeFormat('ru-RU', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});
const xDate = (iso) =>
  shortMonth
    .format(new Date(iso + '-01T12:00:00Z'))
    .replace(/\s*г\./, '')
    .replace('. ', ' ');
const money = (v) => intFmt.format(v) + ' ₽';
const short = (v) =>
  v === 0
    ? '0'
    : Math.abs(v) >= 1e6
      ? (v / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' млн'
      : (v / 1e3).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' тыс.';
const windows = [12, 24, 60];
function chartRange(state, rows) {
  const span = state.span;
  const start = Math.min(Math.floor((state.month - 1) / span) * span, rows.length - span);
  return rows.slice(start, start + span);
}
export function chart(ctx) {
  const { state, plan: cs, icon } = ctx;
  const points = chartRange(state, cs.months);
  const W = 660,
    H = 162;
  const peak = Math.max(...points.map((r) => Math.max(r.profit, r.revenue)), 1);
  const rough = peak / 3,
    power = 10 ** Math.floor(Math.log10(rough)),
    step = [1, 2, 2.5, 5, 10].map((t) => t * power).find((t) => t >= rough);
  const top = Math.ceil(peak / step) * step,
    bottom = Math.min(0, Math.floor(Math.min(...points.map((r) => r.profit)) / step) * step);
  const y = (v) => 6 + ((top - v) / (top - bottom)) * (H - 12),
    slot = W / points.length,
    x = (i) => (i + 0.5) * slot;
  const ticks = [];
  for (let t = bottom; t <= top + 1; t += step) ticks.push(t);
  const line = points
    .map((r, i) => (i ? 'L' : 'M') + x(i).toFixed(2) + ' ' + y(r.profit).toFixed(2))
    .join(' ');
  const active = points.findIndex((r) => r.m === state.month);
  const dots = points
    .map(
      (r, i) =>
        '<rect x="' +
        (x(i) - slot * 0.3).toFixed(2) +
        '" y="' +
        y(r.revenue).toFixed(2) +
        '" width="' +
        (slot * 0.6).toFixed(2) +
        '" height="' +
        Math.max(0, y(0) - y(r.revenue)).toFixed(2) +
        '" rx="2" class="revenue-bar ' +
        (i === active ? 'is-active' : '') +
        '"/>',
    )
    .join('');
  const labels = [
    ...new Set([
      0,
      ...[0.25, 0.5, 0.75].map((z) => Math.round(z * (points.length - 1))),
      points.length - 1,
    ]),
  ];
  const header =
    '<div class="card-head"><h2>Выручка и прибыль</h2><div class="chart-ranges" aria-label="Диапазон графика">' +
    windows
      .map(
        (v) =>
          '<button type="button" data-span="' +
          v +
          '" aria-pressed="' +
          (v === state.span) +
          '">' +
          (v === 60 ? '5 лет' : v + ' мес.') +
          '</button>',
      )
      .join('') +
    '</div></div>';

  const selected = points[active];
  const monthLabel = ctx.fullMonth(selected.date);
  const legend = `<div class="chart-labels">
    <div><span><i class="legend-bar"></i>Выручка</span><strong class="chart-selected-value">${money(selected.revenue)}</strong></div>
    <div><span><i class="legend-line"></i>Чистая прибыль</span><strong class="chart-selected-value">${money(selected.profit)}</strong></div>
  </div>`;
  const stepper = `<div class="chart-month-stepper" role="group" aria-label="Выбор месяца">
    <button type="button" data-chart-step="-1" aria-label="Предыдущий месяц" ${selected.m === 1 ? 'disabled' : ''}>${icon('right', 16)}</button>
    <button type="button" class="chart-month-open" data-action="period-table" aria-haspopup="dialog" aria-label="Результаты по месяцам. Выбран ${monthLabel}">${icon('calendar', 16)} ${monthLabel}</button>
    <button type="button" data-chart-step="1" aria-label="Следующий месяц" ${selected.m === cs.months.length ? 'disabled' : ''}>${icon('right', 16)}</button>
  </div>`;
  return (
    '<section class="bento-card chart-card">' +
    header +
    '<div class="chart-sub">' +
    legend +
    '</div><div class="plot"><div class="plot-y">' +
    ticks.map((t) => '<span style="top:' + (y(t) / H) * 100 + '%">' + short(t) + '</span>').join('') +
    '</div><div class="chart-area" tabindex="0" role="slider" aria-label="Месяц на графике. Стрелки меняют выбранный месяц" aria-valuemin="' +
    points[0].m +
    '" aria-valuemax="' +
    points.at(-1).m +
    '" aria-valuenow="' +
    state.month +
    '" aria-valuetext="' +
    monthLabel +
    ', выручка ' +
    money(selected.revenue) +
    ', чистая прибыль ' +
    money(selected.profit) +
    '" data-start="' +
    points[0].m +
    '" data-count="' +
    points.length +
    '" style="--chart-month-x:' +
    (x(active) / W) * 100 +
    '%;--chart-profit-y:' +
    (y(selected.profit) / H) * 100 +
    '%"><svg viewBox="0 0 ' +
    W +
    ' ' +
    H +
    '" preserveAspectRatio="none" aria-hidden="true">' +
    ticks
      .map((t) => '<line x1="0" x2="' + W + '" y1="' + y(t) + '" y2="' + y(t) + '" class="grid-line"/>')
      .join('') +
    dots +
    '<path d="' +
    line +
    '" class="profit-line"/><circle cx="' +
    x(active) +
    '" cy="' +
    y(points[active].profit) +
    '" r="3.4" class="plot-dot"/></svg><div class="plot-tip" hidden></div></div><div class="plot-x">' +
    labels
      .map(
        (i, li) =>
          '<span class="' +
          (li === 0 ? 'first' : li === labels.length - 1 ? 'last' : '') +
          '" style="left:' +
          (x(i) / W) * 100 +
          '%">' +
          xDate(points[i].date) +
          '</span>',
      )
      .join('') +
    '</div></div><div class="chart-foot">' +
    stepper +
    '<span class="chart-selected-desktop">' +
    icon('calendar', 14) +
    'Выбран ' +
    ctx.fullMonth(cs.months[state.month - 1].date, true) +
    '</span><button type="button" class="text-btn" data-action="period-table">По месяцам ' +
    icon('right', 13) +
    '</button></div></section>'
  );
}
export function bindChart(root, ctx) {
  const area = root.querySelector('.chart-area');
  if (!area) return;
  const months = ctx.plan.months;
  const points = chartRange(ctx.state, months);
  for (const button of root.querySelectorAll('[data-chart-step]')) {
    button.onclick = () => {
      const step = Number(button.dataset.chartStep);
      const month = ctx.state.month + step;
      if (month < 1 || month > months.length) return;
      const canContinue = month + step >= 1 && month + step <= months.length;
      const focus = `[data-chart-step="${canContinue ? step : -step}"]`;
      ctx.update({ month }, { focus });
    };
  }
  const hit = (e) => {
    const b = area.getBoundingClientRect();
    return Math.max(
      0,
      Math.min(points.length - 1, Math.floor(((e.clientX - b.left) / b.width) * points.length)),
    );
  };
  const tip = area.querySelector('.plot-tip');
  area.onpointermove = (e) => {
    if (e.pointerType === 'touch') return;
    const i = hit(e),
      row = points[i];
    tip.hidden = false;
    tip.innerHTML =
      '<b>' +
      ctx.fullMonth(row.date) +
      '</b><span>Выручка ' +
      money(row.revenue) +
      '</span><span>Прибыль ' +
      money(row.profit) +
      '</span>';
    const width = area.clientWidth;
    tip.style.left =
      Math.max(
        0,
        Math.min(width - tip.offsetWidth, ((i + 0.5) / points.length) * width - tip.offsetWidth / 2),
      ) + 'px';
  };
  area.onpointerleave = () => {
    tip.hidden = true;
  };
  area.onclick = (e) => ctx.update({ month: points[hit(e)].m }, { focus: '.chart-area' });
  area.onkeydown = (e) => {
    const next =
      e.key === 'ArrowLeft'
        ? Math.max(points[0].m, ctx.state.month - 1)
        : e.key === 'ArrowRight'
          ? Math.min(points.at(-1).m, ctx.state.month + 1)
          : e.key === 'Home'
            ? points[0].m
            : e.key === 'End'
              ? points.at(-1).m
              : 0;
    if (next) {
      e.preventDefault();
      ctx.update({ month: next }, { focus: '.chart-area' });
    }
  };
}
