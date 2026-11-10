const batchPlural = new Intl.PluralRules('ru-RU');
const batchWords = { one: 'партия', few: 'партии', many: 'партий', other: 'партии' };

export function mobileBatchList({ model, money, n, icon }, month) {
  const rows = model.profiles.map((profile, index) => {
    const orders = month.profileOrders[index];
    const check = orders ? month.profileRevenue[index] / orders : 0;
    const margin = orders ? month.profileMargin[index] / orders : 0;
    const count = n(orders, 1) + ' ' + batchWords[batchPlural.select(Math.round(orders * 10) / 10)];
    return `<li>
      <button class="batch-row" type="button" data-profile="${index}" aria-haspopup="dialog">
        <span class="batch-row-name">${profile.name}</span>
        <span class="batch-row-check">${money(check)}</span>
        <span class="batch-row-count">${count}</span>
        <span class="batch-row-margin">Маржа ${money(margin)}</span>
        ${icon('right', 15)}
      </button>
    </li>`;
  });
  return `<div class="mobile-batches"><div class="batch-guide"><span>Заказы за месяц</span><span>Чек без НДС</span></div><ul>${rows.join('')}</ul></div>`;
}
