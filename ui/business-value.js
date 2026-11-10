// Asking prices and monthly figures published by the sellers, checked 10 Nov 2026.
// Keep the observations together so the two medians can be reproduced.
export const comparables = [
  {
    label: 'Студия печати и моделирования, Москва',
    url: 'https://alterainvest.ru/msk/products/detail/17725008/',
    price: 2450000,
    revenue: 590000,
    profit: 110000,
  },
  {
    label: 'Мастерская с продажами на Ozon, Москва',
    url: 'https://alterainvest.ru/msk/products/detail/17516083/',
    price: 700000,
    revenue: 115000,
    profit: 50000,
  },
  {
    label: 'Ферма на 80 принтеров, Санкт-Петербург',
    url: 'https://alterainvest.ru/products/detail/16995804/',
    price: 15000000,
    revenue: 1000000,
    profit: 500000,
  },
];

function medianMultiple(metric) {
  const sorted = comparables.map((offer) => offer.price / (12 * offer[metric])).sort((a, b) => a - b);
  return sorted[1]; // Middle observation of the three named businesses.
}

export const saleMultiples = { revenue: medianMultiple('revenue'), profit: medianMultiple('profit') };

export function businessYear2028(plan, meta, policy) {
  const year = plan.months.filter((row) => row.date.startsWith('2028-'));
  const opening = plan.months.find((row) => row.date === '2027-12');
  if (!opening || year.length !== 12) return null;
  const closing = year.at(-1);
  const sum = (field) => year.reduce((total, row) => total + row[field], 0);
  const revenue = sum('revenue');
  const contributed = meta.principal.reduce((total, rubles) => total + rubles, 0);
  // Workbook «Баланс» rows 15 and 26 are equal: contributions, retained earnings,
  // taxes payable and outstanding loan. Policy changes retained earnings and cash.
  const assets = (row) =>
    contributed + row.policies[policy].retainedProfit + row.taxReserve + row.loanBalance;
  let previous = assets(opening);
  let assetSum = 0;
  for (const row of year) {
    const end = assets(row);
    assetSum += (previous + end) / 2;
    previous = end;
  }
  const averageAssets = assetSum / year.length;
  const profit = sum('profit');
  const normalizedProfit = year.every((row) => Number.isFinite(row.economicProfit))
    ? sum('economicProfit')
    : plan.normalizedProfit2028;
  const reserves =
    closing.operatingReserve + closing.replacementReserve + closing.taxReserve + closing.startupReserve;
  const cashAfterReserves = closing.policies[policy].cash - reserves;
  // The indicative sale assumes normal working capital and the required reserves stay in the business.
  const cashAdjustment = cashAfterReserves - closing.loanBalance;
  return {
    revenue,
    monthlySales: revenue / year.length,
    averageAssets,
    assetTurns: averageAssets > 0 ? revenue / averageAssets : null,
    profit,
    normalizedProfit,
    cashAfterReserves,
    reserves,
    debt: closing.loanBalance,
    byRevenue: revenue > 0 ? revenue * saleMultiples.revenue + cashAdjustment : null,
    byProfit: normalizedProfit > 0 ? normalizedProfit * saleMultiples.profit + cashAdjustment : null,
  };
}
