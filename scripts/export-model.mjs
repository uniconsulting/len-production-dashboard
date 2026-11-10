// Run offline with the model workbook and the spreadsheet calculation runtime:
// node scripts/export-model.mjs <model.xlsx> [data/model.json]
// Only the aggregates explicitly mapped below reach the published dataset.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const [input, output = 'data/model.json'] = process.argv.slice(2);
if (!input) throw new Error('Specify the financial model workbook.');
const book = await SpreadsheetFile.importXlsx(await FileBlob.load(input));
const sheet = (name) => book.worksheets.getItem(name);
const get = (name, address) => sheet(name).getRange(address).values[0][0];
const write = (name, address, value) => {
  sheet(name).getRange(address).values = [[value]];
};
const source = (row) => get('Вводные', 'D' + row);
const across = (name, row) => sheet(name).getRange('D' + row + ':BL' + row).values[0];
const sum = (values) => values.reduce((total, value) => total + value, 0);
const weighted = (volumes, rates) => sum(volumes.map((volume, i) => volume * rates[i]));
function check(actual, expected, label, tolerance = 1e-5) {
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) < tolerance,
    label + ': ' + actual + ' vs ' + expected,
  );
}
function annualIrr(principal, income) {
  if (principal <= 0 || income.every((x) => x === 0)) return null;
  const npv = (rate) => sum(income.map((x, i) => x / (1 + rate) ** (i + 1))) - principal;
  let low = -0.95,
    high = 1;
  while (npv(high) > 0) high *= 2;
  for (let j = 0; j < 100; j++) {
    const rate = (low + high) / 2;
    if (npv(rate) > 0) low = rate;
    else high = rate;
  }
  return (1 + (low + high) / 2) ** 12 - 1;
}
function isoMonth(serial) {
  const date =
    typeof serial === 'number' ? new Date(Date.UTC(1899, 11, 30) + serial * 86400000) : new Date(serial);
  return date.toISOString().slice(0, 7);
}
const columns = ['C', 'D', 'E', 'F'];
const profiles = columns.map((col, i) => {
  const item = (row) => get('План производства', col + row);
  return {
    id: 'ABCD'[i],
    name: item(114),
    units: item(116),
    materialKg: item(117),
    printHours: item(118),
    operatorHours: item(119),
    externalHours: item(120),
    labor: [23, 24, 25, 26].map((row) => get('Труд оператора', col + row)),
  };
});
const groupNames = ['xl', 'engineering', 'series'];
const printers = Array.from({ length: 12 }, (_, i) => {
  const group = i === 0 ? 0 : i < 10 ? 1 : 2;
  const ordinal = i === 0 ? 1 : i < 10 ? i : i - 9;
  return {
    id: ['xl', 'eng', 'series'][group] + '-' + String(ordinal).padStart(2, '0'),
    name: get('По принтерам', 'C' + (11 + i)),
    group: groupNames[group],
  };
});
const counts = groupNames.map((group) => printers.filter((p) => p.group === group).length);
const principal = [0, source(10), source(11)];
const shares = [
  get('Участники', 'D9'),
  get('Участники', 'D10'),
  get('Участники', 'D11') + get('Участники', 'D12'),
];
const netShare = [
  shares[0] * (1 - source(65)),
  shares[1] * (1 - source(66)),
  get('Участники', 'D11') * (1 - source(67)) + get('Участники', 'D12') * (1 - source(68)),
];
const meta = {
  source: 'Финансовая модель ЛËН Производство',
  asOf: '2026-11-10',
  start: isoMonth(source(7)),
  horizon: 60,
  currency: 'RUB',
  vat: source(36),
  shares,
  principal,
  loanAmount: get('Деньги', 'D79'),
  loanApr: source(85),
  loanDue: source(86),
  startupBudget: get('Запуск', 'F26'),
  startupReserve: get('Деньги', 'D64'),
  openingProfit: get('P&L', 'D29'),
  monthlyMarketing: source(25),
  postprocessShare: get('Труд оператора', 'C6'),
  roundMinutes: get('Труд оператора', 'C7'),
  ownersMonths: source(69),
  ownerDailyHours: source(71),
  operatorWeekHours: source(70),
  repeatShare: source(56),
  conversion: source(57),
  offersShare: source(58),
  payoutShare: source(47),
  firstPayoutAllowed: source(48),
  protectedDevelopmentTarget: source(52),
  ownerCreditLimit: source(30),
  ownerHourRate: source(72),
};

function summarize(months, policy) {
  const income = principal.map((_, i) => months.map((x) => x.policies[policy].payouts[i]));
  return {
    payback: principal.map((p, i) =>
      p ? (months.find((x) => x.policies[policy].cumPayouts[i] >= p)?.m ?? null) : null,
    ),
    irr: principal.map((p, i) => annualIrr(p, income[i])),
    firstMonth: months.find((x) => x.policies[policy].gross > 0)?.m ?? null,
    totalPayouts: income.map(sum),
    totalGross: sum(months.map((x) => x.policies[policy].gross)),
  };
}
function policyMonth(state, gross, cash, totalProfit) {
  state.sent += gross;
  const payouts = netShare.map((share) => gross * share);
  state.cum = state.cum.map((previous, i) => previous + payouts[i]);
  return { gross, cash, payouts, cumPayouts: [...state.cum], retainedProfit: totalProfit - state.sent };
}
function readCase(target, pace) {
  const growth = pace === 'growth';
  write('Инвестору', 'C5', pace === 'fast' ? 'Ускоренный план' : 'Рабочий план');
  write('План производства', 'C7', growth ? 'Рост до 80%+' : target + (target === 22 ? ' партии' : ' партий'));
  book.recalculate();
  const inputs = {
    Мощность: [
      6, 7, 8, 9, 10, 11, 12, 14, 27, 28, 29, 30, 32, 33, 34, 35, 37, 38, 39, 40, 42, 43, 44, 45, 47, 48,
      49, 50, 55, 56, 57, 60, 61, 71, 78, 88, ...(growth ? [93, 94, 95, 98, 99, 100, 101, 102] : []),
    ],
    'P&L': [7, 8, 9, 10, 21, 24, 25, 26, 27, 28, 29, 30, 44, ...(growth ? [39, 40] : [])],
    Деньги: [7, 11, 17, 19, 27, 29, 30, 34, 36, 37, 39, 40, 51, 52, 64, 71, 82],
    Участники: [25, 35, 45, 55],
  };
  const ranges = Object.fromEntries(
    Object.entries(inputs).map(([name, rows]) => [
      name,
      Object.fromEntries(rows.map((row) => [row, across(name, row)])),
    ]),
  );
  const mix = [267, 268, 269, 270].map((r) => get('Параметры', 'G' + r));
  const months = [],
    state = { balance: { sent: 0, cum: [0, 0, 0] }, retained: { sent: 0, cum: [0, 0, 0] } };
  let totalProfit = meta.openingProfit;
  for (let m = 1; m <= meta.horizon; m++) {
    const cap = (r) => ranges['Мощность'][r][m],
      cash = (r) => ranges['Деньги'][r][m],
      pl = (r) => ranges['P&L'][r][m];
    const date = isoMonth(cap(6));
    const [yearNumber, monthNumber] = date.split('-').map(Number);
    const days = new Date(Date.UTC(yearNumber, monthNumber, 0)).getUTCDate();
    assert.ok(Number.isInteger(days) && days >= 28 && days <= 31, 'Invalid calendar month');
    const orders = [27, 28, 29, 30].map(cap);
    const sales = [32, 33, 34, 35].map(cap);
    const profileMargin = sales.map((v, i) => v - cap(37 + i) - cap(42 + i));
    const labor = [0, 1, 2, 3].map((i) =>
      weighted(
        orders,
        profiles.map((p) => p.labor[i]),
      ),
    );
    const groupHours = [47, 48, 49].map(cap),
      groupCapacity = [8, 9, 10].map(cap);
    const sharedSeries = sales[1] + sales[3],
      engineeringFraction = cap(78);
    const groupRevenue = [
      sales[2],
      sales[0] + sharedSeries * engineeringFraction,
      sharedSeries * (1 - engineeringFraction),
    ];
    const perMachine = (values) =>
      printers.map((p) => {
        const i = groupNames.indexOf(p.group);
        return values[i] / counts[i];
      });
    const avgCheck = cap(61),
      clients = orders.reduce((n, v) => n + v, 0);
    const newOrders = Math.ceil(clients * (1 - meta.repeatShare) - 1e-10);
    const theoryLeads = Math.ceil(newOrders / meta.conversion - 1e-10);
    totalProfit += pl(29);
    const cashPriorToProtectedDividends = cash(30) + state.balance.sent - state.retained.sent;
    const fundsRequired = cash(36) + cash(51) + cash(52) + cash(64);
    const surplus = Math.max(0, cashPriorToProtectedDividends - fundsRequired);
    const eligible = cash(37) === 1;
    const protectedDividend = eligible
      ? Math.min(surplus, Math.max(0, meta.payoutShare * totalProfit - state.retained.sent))
      : 0;
    const policies = {
      retained: policyMonth(
        state.retained,
        protectedDividend,
        cashPriorToProtectedDividends - protectedDividend,
        totalProfit,
      ),
      balance: policyMonth(state.balance, cash(39), cash(40), totalProfit),
    };
    const mr = perMachine(groupRevenue);
    check(sum(labor), cap(50), 'labor');
    check(sum(groupRevenue), pl(7), 'group revenue');
    check(sum(profileMargin), cap(60), 'profile margin');
    check(sum(mr), pl(7), 'machines');
    check(
      sum(policies.balance.payouts.slice(1)),
      ranges['Участники'][35][m] + ranges['Участники'][45][m] + ranges['Участники'][55][m],
      'investors',
    );
    check(policies.balance.payouts[0], ranges['Участники'][25][m], 'management');
    assert.ok(
      policies.retained.cash >= -1e-5 &&
        state.retained.sent <= Math.max(totalProfit * meta.payoutShare, 0) + 1e-5,
    );
    months.push({
      m,
      date,
      days,
      revenue: pl(7),
      margin: cap(60),
      profit: pl(29),
      orders: cap(56),
      units: weighted(
        orders,
        profiles.map((p) => p.units),
      ),
      materialKg: weighted(
        orders,
        profiles.map((p) => p.materialKg),
      ),
      avgCheck,
      operatorHours: cap(50),
      roundsHours: cap(88),
      externalHours: weighted(
        orders,
        profiles.map((p) => p.externalHours),
      ),
      laborCapacity: cap(growth ? 93 : 71),
      ...(growth ? {
        ownerSupportHours: cap(98),
        ownerSupportCapacity: cap(94),
        ownerSupportCost: cap(99),
        ownerSupportCashCost: cap(102),
        contractorCapacity: cap(95),
        engineerSeriesShare: cap(78),
        economicProfit: pl(30),
        ownerWorkCredit: pl(39),
        ownerWorkCreditRemaining: Math.max(0, meta.ownerCreditLimit - pl(39)),
        ownerWorkAboveCredit: pl(40),
      } : {}),
      groupHours,
      groupCapacity,
      profileOrders: orders,
      profileRevenue: sales,
      profileMargin,
      printHours: sum(groupHours),
      stock: cash(11),
      receivables: cash(19),
      receipts: cash(7),
      activeClients: Math.ceil(cap(56) / source(55) - 1e-10),
      newOrders,
      theoryLeads,
      offers: Math.ceil(theoryLeads * meta.offersShare - 1e-10),
      machineHours: perMachine(groupHours),
      machineRevenue: mr,
      labor,
      operatingReserve: cash(36),
      replacementReserve: cash(51),
      taxReserve: cash(52),
      startupReserve: cash(64),
      loanBalance: cash(82),
      materialCost: pl(8),
      otherVariableCosts: pl(9),
      fixedCosts: pl(21),
      depreciation: pl(25),
      profitTax: pl(28),
      interest: pl(44),
      ebitda: pl(24),
      opCashFlow: cash(27),
      policies,
    });
  }
  const policies = { balance: summarize(months, 'balance'), retained: summarize(months, 'retained') };
  const thresholds = {};
  write('План производства', 'C6', 13);
  for (const horizon of [24, 36]) {
    write('План производства', 'C5', horizon);
    book.recalculate();
    const multiple = get('Расчёт цены', 'D7');
    if (!Number.isFinite(multiple)) {
      thresholds[horizon] = null;
      continue;
    }
    const thresholdRevenue = get('План производства', 'C51');
    const avgCheck = get('План производства', 'C50');
    check(avgCheck, Math.ceil(thresholdRevenue / months[12].orders), 'minimum order price');
    assert.ok(get('Расчёт цены', 'D8') >= principal[1] - 0.02, 'Payout must cover the principal');
    assert.ok(
      get('Расчёт цены', 'D9') >= meta.startupReserve - 0.02,
      'Start-up reserve must be preserved',
    );
    thresholds[horizon] = {
      avgCheck,
      revenue: thresholdRevenue,
      margin: get('План производства', 'C52'),
    };
  }
  const result = { target: growth ? sum(mix) : target, pace, mix, months, policies, thresholds };
  if (!growth) {
    const valuationYear = months.filter((month) => month.date.startsWith('2028-'));
    assert.equal(valuationYear.length, 12, 'December 2028 valuation needs twelve calendar months');
    result.normalizedProfit2028 = sum(valuationYear.map((month) => ranges['P&L'][30][month.m]));
    assert.ok(Number.isFinite(result.normalizedProfit2028), 'Missing 2028 economic profit');
  }
  for (const [group, col] of [
    [1, 'C'],
    [2, 'E'],
  ]) {
    check(policies.balance.payback[group], get('Инвестору', col + '12'), 'payback');
    check(policies.balance.irr[group], get('Инвестору', col + '13'), 'IRR');
  }
  for (let i = 0; i < 5; i++) {
    const year = months.slice(i * 12, (i + 1) * 12),
      col = 'CDEFG'[i];
    check(sum(year.map((x) => x.revenue)), get('Инвестору', col + '17'), 'annual revenue');
    check(
      sum(year.map((x) => x.profit)) + (i === 0 ? meta.openingProfit : 0),
      get('Инвестору', col + '18'),
      'annual profit',
    );
  }
  return result;
}
const cases = {};
for (const pace of ['base', 'fast']) {
  for (const target of [22, 30, 40]) cases[pace + '-' + target] = readCase(target, pace);
}
cases.growth = readCase(null, 'growth');
for (const month of cases.growth.months) {
  assert.ok(month.operatorHours <= month.laborCapacity + month.ownerSupportCapacity + 1e-6);
  assert.ok(month.externalHours <= month.contractorCapacity + 1e-6);
  assert.ok(month.groupHours.every((hours, i) => hours <= month.groupCapacity[i] + 1e-6));
}
check(cases['base-30'].months[12].revenue, 1040760, 'audited plan');
check(cases['base-40'].months[12].revenue, 1384740, 'audited expansion');
check(cases['base-30'].policies.retained.totalPayouts[1], 2487782, 'audited protected policy', 1);
check(cases['fast-30'].policies.retained.totalPayouts[1], 3775903, 'audited protected growth', 1);
const data = { meta, printers, profiles, cases };
// Invoice, production and cash series are numbers even in workbooks whose Excel
// number formats cause the calculation runtime to decode a cell as a date.
function validateNumericTree(value, key) {
  if (typeof value === 'object' && value !== null) {
    for (const [field, child] of Object.entries(value)) validateNumericTree(child, key + '.' + field);
  } else if (key === 'month.date') {
    assert.match(value, /^\d{4}-(0[1-9]|1[0-2])$/);
  } else assert.ok(typeof value === 'number' && Number.isFinite(value), key + ' is not numeric');
}
for (const scenario of Object.values(cases)) {
  for (const month of scenario.months) validateNumericTree(month, 'month');
}
await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  JSON.stringify(data, (_, v) => (typeof v === 'number' ? Number(v.toFixed(6)) : v)) + '\n',
);
console.log('Validated fixed portfolios and the growth plan, 60 months, 12 printers, 2 distribution policies.');
