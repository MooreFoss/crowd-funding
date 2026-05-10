import { describe, expect, it } from "vitest";

import { allocateProportionalRefunds } from "@/src/domain/funding/proportionalAllocator";

describe("proportional refund allocator", () => {
  it("returns zero allocations for zero balance or zero total", () => {
    expect(
      allocateProportionalRefunds({
        totalRefundFen: 0,
        pledges: [
          { pledgeId: "a", merchantOrderNo: "A", netAmountFen: 100 },
          { pledgeId: "b", merchantOrderNo: "B", netAmountFen: 200 },
        ],
      }),
    ).toEqual([]);

    expect(
      allocateProportionalRefunds({
        totalRefundFen: 100,
        pledges: [
          { pledgeId: "a", merchantOrderNo: "A", netAmountFen: 0 },
        ],
      }),
    ).toEqual([]);
  });

  it("allocates exact divisions by pledge net amount", () => {
    expect(
      allocateProportionalRefunds({
        totalRefundFen: 600,
        pledges: [
          { pledgeId: "a", merchantOrderNo: "A", netAmountFen: 100 },
          { pledgeId: "b", merchantOrderNo: "B", netAmountFen: 200 },
          { pledgeId: "c", merchantOrderNo: "C", netAmountFen: 300 },
        ],
      }),
    ).toEqual([
      { pledgeId: "a", merchantOrderNo: "A", allocationOrder: 1, amountFen: 100 },
      { pledgeId: "b", merchantOrderNo: "B", allocationOrder: 2, amountFen: 200 },
      { pledgeId: "c", merchantOrderNo: "C", allocationOrder: 3, amountFen: 300 },
    ]);
  });

  it("uses stable largest-remainder allocation for rounding edges", () => {
    const allocations = allocateProportionalRefunds({
      totalRefundFen: 100,
      pledges: [
        { pledgeId: "a", merchantOrderNo: "ORDER-A", netAmountFen: 1 },
        { pledgeId: "b", merchantOrderNo: "ORDER-B", netAmountFen: 1 },
        { pledgeId: "c", merchantOrderNo: "ORDER-C", netAmountFen: 1 },
      ],
    });

    expect(allocations).toEqual([
      { pledgeId: "a", merchantOrderNo: "ORDER-A", allocationOrder: 1, amountFen: 34 },
      { pledgeId: "b", merchantOrderNo: "ORDER-B", allocationOrder: 2, amountFen: 33 },
      { pledgeId: "c", merchantOrderNo: "ORDER-C", allocationOrder: 3, amountFen: 33 },
    ]);
    expect(allocations.reduce((total, item) => total + item.amountFen, 0)).toBe(100);
  });
});
