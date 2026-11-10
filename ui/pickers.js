// Static counterpart of the Mieru SelectMenu: a trigger, a viewport-anchored
// surface and an explicit focus return. No native select popup is involved.
export const plans = [
  {
    value: 'growth',
    title: 'План роста',
    hint: 'От 30 партий в мае до загрузки выше 80% в декабре 2027 года',
  },
  { value: 'base', title: 'Постоянный объём', hint: 'Выбранный объём с мая 2027 года, базовые цены' },
  {
    value: 'fast',
    title: 'Ускоренный старт',
    hint: 'Постоянный объём с февраля 2027 года, повышенные цены',
  },
];
const monthLabels = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
let dismissOpen;

function trigger(id, text, label, glyph, popupType, icon) {
  return `<button type="button" id="${id}" class="len-picker-trigger"
      aria-label="${label}: ${text}" aria-haspopup="${popupType}" aria-expanded="false">
      ${glyph ? icon(glyph, 17) : ''}<span>${text}</span><span class="len-picker-chevron">${icon('chevron', 14)}</span>
    </button>`;
}

export function choiceTrigger(id, label, value, choices, icon, glyph) {
  const selected = choices.find((choice) => choice.value === value);
  return trigger(id, selected?.title ?? '', label, glyph, 'listbox', icon);
}

const scenarioField = { key: 'scenario', label: 'Сценарий продаж', choices: plans };

export function renderPickers({ state, months, fullMonth, icon }) {
  const selected = months.find((row) => row.m === state.month);
  return (
    choiceTrigger('scenario', scenarioField.label, state.scenario, plans, icon, 'settings') +
    trigger('month', fullMonth(selected.date), 'Расчётный месяц', 'calendar', 'dialog', icon)
  );
}

function positionPanel(panel, button, minWidth) {
  const edge = 12,
    gap = 8;
  const vp = window.visualViewport;
  const left = vp?.offsetLeft ?? 0,
    top = vp?.offsetTop ?? 0;
  const width = vp?.width ?? document.documentElement.clientWidth;
  const height = vp?.height ?? window.innerHeight;
  const anchor = button.getBoundingClientRect();
  const below = Math.max(0, top + height - edge - anchor.bottom - gap);
  const above = Math.max(0, anchor.top - top - edge - gap);
  const panelWidth = Math.max(1, Math.min(Math.max(minWidth, anchor.width), width - 2 * edge));
  panel.style.width = panelWidth + 'px';
  const desired = Math.min(332, panel.scrollHeight);
  const openBelow = below >= desired || below >= above;
  const available = openBelow ? below : above;
  const x = Math.min(Math.max(anchor.left, left + edge), left + width - edge - panelWidth);
  panel.style.maxHeight = Math.max(1, Math.min(332, available)) + 'px';
  panel.style.left = x + 'px';
  panel.style.top =
    (openBelow ? anchor.bottom + gap : anchor.top - gap - Math.min(desired, available)) + 'px';
}

function openPicker(button, ctx, field) {
  if (button.getAttribute('aria-expanded') === 'true') {
    dismissOpen?.(true);
    return;
  }
  dismissOpen?.();
  const monthPicker = !field;
  const { state, icon } = ctx;
  const panel = document.createElement('div');
  const abort = new AbortController();
  const options = { signal: abort.signal };
  panel.id = 'len-popup-' + button.id;
  panel.className = 'len-picker-panel ' + (monthPicker ? 'len-month-panel' : 'len-plan-panel');
  panel.setAttribute('role', monthPicker ? 'dialog' : 'listbox');
  panel.setAttribute('aria-label', monthPicker ? 'Выбор расчётного месяца' : field.label);
  button.setAttribute('aria-controls', panel.id);
  button.setAttribute('aria-expanded', 'true');

  function close(restore = false) {
    abort.abort();
    panel.remove();
    button.setAttribute('aria-expanded', 'false');
    button.removeAttribute('aria-controls');
    dismissOpen = undefined;
    if (restore && button.isConnected) button.focus({ preventScroll: true });
  }
  function commit(value) {
    close(true);
    ctx.update({ [field?.key ?? 'month']: value }, { focus: '#' + button.id });
  }
  dismissOpen = close;
  const reposition = () => positionPanel(panel, button, monthPicker ? 276 : 258);

  // Mount the surface outside scrolling cards and header stacking contexts.
  document.body.append(panel);
  if (monthPicker) {
    fillMonthPanel(panel, ctx, commit, reposition, options);
  } else {
    const selected = state[field.key];
    panel.innerHTML = field.choices
      .map(({ value, title, hint }) => {
        const current = value === selected;
        return `<button type="button" class="len-plan-option" role="option" aria-selected="${current}" tabindex="-1" data-choice="${value}" ${field.key === 'scenario' ? `data-plan="${value}"` : ''}>
          <span><strong>${title}</strong>${hint ? `<small>${hint}</small>` : ''}</span>
          ${current ? icon('check', 17) : ''}
        </button>`;
      })
      .join('');
    panel.addEventListener(
      'click',
      (event) => {
        const option = event.target.closest('[data-choice]');
        if (option) commit(option.dataset.choice);
      },
      options,
    );
  }
  reposition();
  const selected = monthPicker ? '[aria-pressed="true"]' : '[aria-selected="true"]';
  panel.querySelector(selected)?.focus({ preventScroll: true });

  panel.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(true);
        return;
      }
      if (e.key === 'Tab') {
        // The popup is portaled to body. Return to the trigger before letting Tab
        // advance in page order at either edge of the month-picker controls.
        const stops = [...panel.querySelectorAll('button:not(:disabled):not([tabindex="-1"])')];
        if (!monthPicker || (e.shiftKey ? stops[0] : stops.at(-1)) === e.target) close(true);
        return;
      }
      if (monthPicker) return;
      const choices = [...panel.querySelectorAll('[role="option"]')];
      const index = choices.indexOf(e.target);
      const next = {
        ArrowDown: (index + 1) % choices.length,
        ArrowUp: (index - 1 + choices.length) % choices.length,
        Home: 0,
        End: choices.length - 1,
      }[e.key];
      if (next !== undefined) {
        e.preventDefault();
        choices[next].focus();
      }
    },
    options,
  );
  const isOutside = (e) => !panel.contains(e.target) && !button.contains(e.target);
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (isOutside(e)) close();
    },
    { capture: true, ...options },
  );
  document.addEventListener(
    'focusin',
    (e) => {
      if (isOutside(e)) close();
    },
    options,
  );
  window.addEventListener('resize', reposition, options);
  window.addEventListener(
    'scroll',
    (e) => {
      if (panel.contains(e.target instanceof Node ? e.target : null)) return;
      if (!button.isConnected) return close();
      const r = button.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= innerHeight) return close();
      reposition();
    },
    { capture: true, ...options },
  );
  window.visualViewport?.addEventListener('resize', reposition, options);
}

export function fillMonthPanel(panel, { state, months, fullMonth, icon }, commit, reposition, opts) {
  const record = (m) => months[m - 1];
  const yearOf = (m) => Number(record(m).date.slice(0, 4));
  const monthOf = (m) => Number(record(m).date.slice(5)) - 1;
  const first = months[0].m,
    last = months.at(-1).m;
  let cursor = state.month;
  const forYear = (y) => months.filter((row) => yearOf(row.m) === y);
  function draw(focus = null) {
    const year = yearOf(cursor),
      entries = forYear(year);
    const cells = monthLabels
      .map((label, index) => {
        const row = entries.find((item) => monthOf(item.m) === index);
        return row
          ? `<button type="button" class="len-month-cell" data-month-choice="${row.m}" tabindex="${cursor === row.m ? 0 : -1}" aria-pressed="${state.month === row.m}" aria-label="${fullMonth(row.date)}">${label}</button>`
          : `<button type="button" class="len-month-cell" disabled>${label}</button>`;
      })
      .join('');
    panel.innerHTML = `<div class="len-year-nav">
      <button type="button" class="len-year-step previous" data-year="-1" aria-label="Предыдущий год" ${year === yearOf(first) ? 'disabled' : ''}>${icon('right', 16)}</button>
      <strong aria-live="polite">${year}</strong>
      <button type="button" class="len-year-step" data-year="1" aria-label="Следующий год" ${year === yearOf(last) ? 'disabled' : ''}>${icon('right', 16)}</button>
      </div><div class="len-month-grid" role="group" aria-label="Месяцы ${year} года">${cells}</div>`;
    reposition();
    if (focus) {
      const el = panel.querySelector(focus);
      (el && !el.disabled ? el : panel.querySelector('[data-month-choice][tabindex="0"]'))?.focus({
        preventScroll: true,
      });
    }
  }
  function switchYear(delta, focus) {
    const next = forYear(yearOf(cursor) + delta);
    if (!next.length) return;
    const match = next.find((r) => monthOf(r.m) === monthOf(cursor));
    cursor = (match ?? (delta > 0 ? next.at(-1) : next[0])).m;
    draw(focus);
  }
  draw();
  panel.addEventListener(
    'click',
    (e) => {
      const btn = e.target.closest('button');
      if (btn?.dataset.year)
        switchYear(Number(btn.dataset.year), '[data-year="' + btn.dataset.year + '"]');
      if (btn?.dataset.monthChoice) {
        cursor = Number(btn.dataset.monthChoice);
        commit(cursor);
      }
    },
    opts,
  );
  panel.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'PageUp' || e.key === 'PageDown') {
        e.preventDefault();
        switchYear(e.key === 'PageUp' ? -1 : 1, '[data-month-choice][tabindex="0"]');
        return;
      }
      if (!e.target.hasAttribute('data-month-choice')) return;
      const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 }[e.key];
      const rows = forYear(yearOf(cursor));
      const next =
        delta !== undefined
          ? Math.min(last, Math.max(first, cursor + delta))
          : e.key === 'Home'
            ? rows[0].m
            : e.key === 'End'
              ? rows.at(-1).m
              : null;
      if (next === null) return;
      e.preventDefault();
      cursor = next;
      draw('[data-month-choice][tabindex="0"]');
    },
    opts,
  );
}

export function bindChoicePicker(button, ctx, field) {
  button.addEventListener('click', () => openPicker(button, ctx, field));
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (button.getAttribute('aria-expanded') !== 'true') openPicker(button, ctx, field);
  });
}

export function bindPickers(root, ctx) {
  dismissOpen?.();
  bindChoicePicker(root.querySelector('#scenario'), ctx, scenarioField);
  bindChoicePicker(root.querySelector('#month'), ctx);
}
