// The export already deducts the modelled dividend tax per participant.
// Each member of the pair receives one half of their block's net payouts.
export function investorReturns(plan, policy, role) {
  const { idx, fraction, cash } = role;
  const first = plan.months.find((month) => month.policies[policy].payouts[idx] * fraction > 0);
  const recovered =
    cash > 0
      ? plan.months.find((month) => month.policies[policy].cumPayouts[idx] * fraction >= cash)
      : null;

  const end = plan.months.find((month) => month.m === 36);
  let threeYears = null;
  if (end) {
    const paid = end.policies[policy].cumPayouts[idx] * fraction;
    const gain = paid - cash;
    // The growth plan values all unpaid work, including hours above the agreed credit limit.
    const workCost =
      role.key === 'uk' &&
      Number.isFinite(end.ownerWorkCredit) &&
      Number.isFinite(end.ownerWorkAboveCredit)
        ? end.ownerWorkCredit + end.ownerWorkAboveCredit
        : null;
    threeYears = {
      from: plan.months[0].date,
      to: end.date,
      paid,
      gain,
      workCost,
      afterWork: workCost === null ? null : gain - workCost,
    };
  }

  return {
    firstPayout: first
      ? { m: first.m, date: first.date, net: first.policies[policy].payouts[idx] * fraction }
      : null,
    payback: recovered
      ? {
          m: recovered.m,
          date: recovered.date,
          net: recovered.policies[policy].cumPayouts[idx] * fraction,
        }
      : null,
    threeYears,
  };
}
