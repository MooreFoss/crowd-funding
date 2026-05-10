export type ProportionalRefundPledge = {
  pledgeId: string;
  merchantOrderNo: string;
  netAmountFen: number;
};

export type ProportionalRefundAllocation = {
  pledgeId: string;
  merchantOrderNo: string;
  allocationOrder: number;
  amountFen: number;
};

export function allocateProportionalRefunds(input: {
  totalRefundFen: number;
  pledges: ProportionalRefundPledge[];
}): ProportionalRefundAllocation[] {
  const eligiblePledges = input.pledges
    .filter((pledge) => pledge.netAmountFen > 0)
    .map((pledge, index) => ({
      ...pledge,
      originalIndex: index,
    }));
  const totalNetFen = eligiblePledges.reduce(
    (total, pledge) => total + pledge.netAmountFen,
    0,
  );
  const totalRefundFen = Math.max(0, Math.trunc(input.totalRefundFen));

  if (totalRefundFen <= 0 || totalNetFen <= 0) {
    return [];
  }

  const baseAllocations = eligiblePledges.map((pledge) => {
    const numerator = pledge.netAmountFen * totalRefundFen;
    const baseAmountFen = Math.floor(numerator / totalNetFen);

    return {
      pledge,
      baseAmountFen,
      remainder: numerator % totalNetFen,
    };
  });
  const allocatedBaseFen = baseAllocations.reduce(
    (total, allocation) => total + allocation.baseAmountFen,
    0,
  );
  let remainingFen = totalRefundFen - allocatedBaseFen;
  const remainderWinners = new Set<number>();

  for (const allocation of baseAllocations
    .slice()
    .sort((left, right) => {
      if (right.remainder !== left.remainder) {
        return right.remainder - left.remainder;
      }

      return left.pledge.originalIndex - right.pledge.originalIndex;
    })) {
    if (remainingFen <= 0) {
      break;
    }

    remainderWinners.add(allocation.pledge.originalIndex);
    remainingFen -= 1;
  }

  return baseAllocations
    .map((allocation, index) => ({
      pledgeId: allocation.pledge.pledgeId,
      merchantOrderNo: allocation.pledge.merchantOrderNo,
      allocationOrder: index + 1,
      amountFen:
        allocation.baseAmountFen +
        (remainderWinners.has(allocation.pledge.originalIndex) ? 1 : 0),
    }))
    .filter((allocation) => allocation.amountFen > 0);
}
