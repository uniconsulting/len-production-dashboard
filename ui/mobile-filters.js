import { plans, fillMonthPanel } from './pickers.js?v=13';

export function filterSummary({ state, icon, fullMonth }, month, batchLabel) {
  const plan = plans.find((entry) => entry.value === state.scenario).title;
  return `<button class="mobile-filter-trigger" type="button" data-action="filters" aria-haspopup="dialog">
    <span><strong>${fullMonth(month.date)}</strong><small>${plan} · ${batchLabel}</small></span>
    <span class="filter-icon" aria-label="Изменить параметры расчёта">${icon('settings', 21)}</span>
  </button>`;
}

export function openFilters(dialog, openDialog, ctx, portfolios, trigger) {
  const { state, icon, fullMonth, months } = ctx;
  const draft = { month: state.month, portfolio: state.portfolio, scenario: state.scenario };
  const radio = (name, value, label, hint = '') =>
    `<label class="filter-option"><input type="radio" name="${name}" value="${value}"
      ${draft[name] === value ? 'checked' : ''}><span>${label}${hint ? '<small>' + hint + '</small>' : ''}</span></label>`;
  openDialog(
    'Параметры расчёта',
    `<form class="filter-form">
    <fieldset><legend>Сценарий</legend><div class="filter-plans">
      ${plans.map((plan) => radio('scenario', plan.value, plan.title, plan.hint)).join('')}</div></fieldset>
    <fieldset data-fixed-volumes ${state.scenario === 'growth' ? 'hidden' : ''}><legend>Партий в месяц после разгона</legend><div class="filter-counts">
      ${portfolios.map((value) => radio('portfolio', value, value)).join('')}</div></fieldset>
    <details class="filter-month"><summary><span>Расчётный месяц<strong data-month-label>${fullMonth(months[draft.month - 1].date)}</strong></span>${icon('chevron', 18)}</summary>
      <div class="filter-calendar"></div></details>
    <div class="apply-filters"><button type="submit" class="primary-action">Применить</button></div>
  </form>`,
    trigger,
  );
  const form = dialog.querySelector('form');
  const volumeField = form.querySelector('[data-fixed-volumes]');
  form.addEventListener('change', (event) => {
    if (event.target.name === 'scenario') volumeField.hidden = event.target.value === 'growth';
  });
  const monthChoice = form.querySelector('.filter-month');
  const calendar = form.querySelector('.filter-calendar');
  const session = new AbortController();
  dialog.addEventListener('close', () => session.abort(), { once: true });
  const phone = matchMedia('(max-width: 700px)');
  phone.addEventListener(
    'change',
    () => {
      if (!phone.matches) {
        dialog.close();
        document.querySelector('#month')?.focus({ preventScroll: true });
      }
    },
    { signal: session.signal },
  );
  fillMonthPanel(
    calendar,
    { ...ctx, state: draft },
    (month) => {
      draft.month = month;
      for (const cell of calendar.querySelectorAll('[data-month-choice]')) {
        const selected = Number(cell.dataset.monthChoice) === month;
        cell.setAttribute('aria-pressed', String(selected));
        cell.tabIndex = selected ? 0 : -1;
      }
      monthChoice.querySelector('[data-month-label]').textContent = fullMonth(months[month - 1].date);
      monthChoice.open = false;
      monthChoice.querySelector('summary').focus();
    },
    () => {},
    { signal: session.signal },
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    draft.portfolio = Number(data.get('portfolio'));
    draft.scenario = data.get('scenario');
    dialog.close();
    ctx.update(draft, { focus: '.mobile-filter-trigger' });
  });
}
