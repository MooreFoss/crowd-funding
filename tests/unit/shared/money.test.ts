import { describe, expect, it } from "vitest";

import { formatBalanceFen, formatFenToYuan, parseMoneyToFen } from "../../../src/shared/money";
import { getStatusLabel } from "../../../src/shared/status";

describe("money helpers", () => {
  it("parses yuan text into fen", () => {
    expect(parseMoneyToFen("1,234.56")).toBe(123456);
    expect(parseMoneyToFen("0.01")).toBe(1);
  });

  it("supports whole yuan, zero, and leading plus signs", () => {
    expect(parseMoneyToFen("12")).toBe(1200);
    expect(parseMoneyToFen("0")).toBe(0);
    expect(parseMoneyToFen("+8.88")).toBe(888);
  });

  it("rejects invalid or non-string money input", () => {
    expect(() => parseMoneyToFen("12.345")).toThrow("Invalid money amount: 12.345");
    expect(() => parseMoneyToFen(12.34 as never)).toThrow(
      "Money input must be provided as a string amount.",
    );
  });

  it("formats fen into yuan text", () => {
    expect(formatFenToYuan(123456)).toBe("¥ 1,234.56");
  });

  it("shows negative balances without clamping", () => {
    expect(formatBalanceFen(-123)).toBe("¥ -1.23");
  });

  it("maps shared status labels", () => {
    expect(getStatusLabel("PARTIAL_REFUNDED")).toBe("已部分退款");
    expect(getStatusLabel("UNKNOWN_STATUS")).toBe("UNKNOWN_STATUS");
  });
});
