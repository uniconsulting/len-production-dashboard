export const roles = [
  {
    key: 'lead',
    title: 'Инвестор',
    full: 'Инвестор с вкладом 1 млн ₽',
    idx: 1,
    fraction: 1,
    cash: 1000000,
    share: 0.33,
  },
  {
    key: 'pair',
    title: 'Пара вместе',
    full: 'Два инвестора вместе',
    idx: 2,
    fraction: 1,
    cash: 500000,
    share: 0.33,
  },
  {
    key: 'one',
    title: 'Один из пары',
    full: 'Один участник пары',
    idx: 2,
    fraction: 0.5,
    cash: 250000,
    share: 0.165,
  },
  { key: 'uk', title: 'УК ДИОНК', full: 'ООО «УК ДИОНК»', idx: 0, fraction: 1, cash: 0, share: 0.34 },
];
export const policies = {
  balance: {
    label: '50% остатка',
    detail:
      'Каждый квартал можно распределить до половины всей накопленной нераспределённой прибыли. Остаток прошлого квартала снова участвует в расчёте.',
  },
  retained: {
    label: '50% прибыли остаётся',
    detail:
      'Половина заработанной с запуска прибыли постоянно остаётся в производстве. Уже выплаченные дивиденды уменьшают лимит следующего распределения.',
  },
};

export const investorFields = {
  role: {
    key: 'role',
    label: 'Участник',
    choices: roles.map(({ key, title, cash, share }) => ({
      value: key,
      title,
      hint: `Доля ${(share * 100).toLocaleString('ru-RU')}% · ${cash ? 'вклад ' + cash.toLocaleString('ru-RU') + ' ₽' : 'вклад работой'}`,
    })),
  },
  policy: {
    key: 'policy',
    label: 'Распределение прибыли',
    choices: Object.entries(policies).map(([key, policy]) => ({
      value: key,
      title: policy.label,
      hint: policy.detail,
    })),
  },
};
