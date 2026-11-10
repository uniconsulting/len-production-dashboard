const windowMonths = 12;
const width = 240;
const height = 54;
const inset = 5;
const rubles = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const labels = new Intl.DateTimeFormat('ru-RU', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});
const dates = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function monthDate(iso, formatter) {
  return formatter
    .format(new Date(iso + '-01T12:00:00Z'))
    .replace(/\s*г\.$/, '')
    .replace(/\.(?=\s)/, '');
}

function pointsFor(rows, type, selectedMonth) {
  const values = rows.map((row) => row[type]);
  // Both charts show monthly amounts measured from zero. A signed domain keeps losses
  // below their baseline, and the same scale serves the line, area and end marker.
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const y = (value) =>
    max === min ? height / 2 : inset + ((max - value) / (max - min)) * (height - 2 * inset);
  const slot = width / rows.length;
  return {
    baseline: y(0),
    slot,
    points: rows.map((row, index) => ({
      x: (index + 0.5) * slot,
      y: y(row[type]),
      value: row[type],
      selected: row.m === selectedMonth,
      label: monthDate(row.date, dates) + ' · ' + rubles.format(row[type]) + ' ₽',
    })),
  };
}

function marginBars(points, slot, baseline) {
  return points
    .map((point) => {
      const size = slot * 0.57;
      const cls =
        'kpi-bar' + (point.selected ? ' is-selected' : '') + (point.value < 0 ? ' is-loss' : '');
      if (point.value === 0) {
        // A zero is a horizontal tick, never a bar projecting above zero.
        return `<line class="${cls} is-zero" x1="${point.x - size / 2}" x2="${point.x + size / 2}"
        y1="${baseline}" y2="${baseline}"/>`;
      }
      return `<rect class="${cls}" x="${point.x - size / 2}" width="${size}"
      y="${Math.min(baseline, point.y)}" height="${Math.abs(baseline - point.y)}" rx="1.8"/>`;
    })
    .join('');
}

function profitArea(points, baseline) {
  // Individual points are accepted monthly results. Round joins soften the graphic
  // without inventing peaks or troughs between those discrete observations.
  const line = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  const area = line + ` L ${points.at(-1).x} ${baseline} L ${points[0].x} ${baseline} Z`;
  return `<defs><linearGradient id="len-monthly-profit-wash" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" class="kpi-wash-top"/><stop offset="1" class="kpi-wash-bottom"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#len-monthly-profit-wash)"/>
    <path d="${line}" class="kpi-profit-line"/>`;
}

/** Miniature of the selected scenario's monthly financial results; all amounts are rubles. */
export function kpiChart(type, months, selectedMonth) {
  const end = Math.min(months.length, Math.max(windowMonths, selectedMonth));
  const rows = months.slice(Math.max(0, end - windowMonths), end);
  if (!rows.length) return '';

  const { points, slot, baseline } = pointsFor(rows, type, selectedMonth);
  const active = points.find((point) => point.selected);
  const first = rows[0].date,
    last = rows.at(-1).date;
  const name = type === 'margin' ? 'Маржинальный доход' : 'Чистая прибыль';
  const summary = active ? '. Выбран ' + active.label : '';
  const description =
    name + ' по месяцам, ₽. ' + monthDate(first, dates) + ' — ' + monthDate(last, dates) + summary;
  const baselineGuide = `<line class="kpi-baseline" x1="0" x2="${width}" y1="${baseline}" y2="${baseline}"/>`;
  const zeroLabel = points.some((point) => point.value < 0)
    ? `<span class="kpi-zero-mark" aria-hidden="true" style="top:${(baseline / height) * 100}%">0</span>`
    : '';
  const plot = type === 'margin' ? marginBars(points, slot, baseline) : profitArea(points, baseline);
  const hits = points
    .map(
      (point) => `<rect x="${point.x - slot / 2}" width="${slot}" height="${height}"
    fill="transparent"><title>${point.label}</title></rect>`,
    )
    .join('');
  // Draw the focus bead in CSS pixels so its circle remains round at any card width.
  const bead =
    type === 'profit' && active
      ? `<i class="kpi-profit-bead${active.value < 0 ? ' is-loss' : ''}" aria-hidden="true"
        style="left:${(active.x / width) * 100}%;top:${(active.y / height) * 100}%"></i>`
      : '';
  return `<figure class="kpi-trend" role="img" aria-label="${description}">
    <div class="kpi-trend-plot">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        ${baselineGuide}${plot}${hits}
      </svg>${bead}${zeroLabel}
    </div>
    <figcaption aria-hidden="true"><span>${monthDate(first, labels)}</span><span>${monthDate(last, labels)}</span></figcaption>
  </figure>`;
}
