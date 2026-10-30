import { describe, expect, it } from "vitest";
import { addInterval, allocate, computeBalances, computeShares, parseMoney, simplifyDebts, validateSplit } from "@/domain/money";
import type { Expense } from "@/domain/types";

const exp = (p: Partial<Expense>): Expense => ({
  id: "e", groupId: "g", description: "x", amount: 1000, currency: "GBP", exchangeRate: 1, date: "2026-01-01",
  category: "Other", attachments: [], paidBy: "a", participantIds: ["a", "b"], split: { method: "equal" },
  createdBy: "a", createdAt: "", ...p,
});

describe("allocate (rounding)", () => {
  it("splits £10 three ways into whole pennies that sum to £10", () => {
    expect(allocate(1000, { a: 1, b: 1, c: 1 })).toEqual({ a: 334, b: 333, c: 333 });
  });
  it("gives leftover pennies to the largest fractional share", () => {
    expect(allocate(100, { a: 1, b: 2 })).toEqual({ a: 33, b: 67 });
  });
});

describe("split methods", () => {
  it("equal split divides between selected participants only", () => {
    expect(computeShares(exp({ amount: 900, participantIds: ["a", "c", "d"] }))).toEqual({ a: 300, c: 300, d: 300 });
  });
  it("custom amounts are used exactly", () => {
    expect(computeShares(exp({ amount: 1000, split: { method: "custom", amounts: { a: 250, b: 750 } } }))).toEqual({ a: 250, b: 750 });
  });
  it("percentage split allocates by percent", () => {
    expect(computeShares(exp({ amount: 8400, split: { method: "percentage", percents: { a: 60, b: 40 } } }))).toEqual({ a: 5040, b: 3360 });
  });
  it("itemised split charges each item only to its assignees", () => {
    const shares = computeShares(exp({
      amount: 1500, participantIds: ["a", "b", "c"],
      split: { method: "itemised", items: [
        { id: "1", name: "Pizza", amount: 900, participantIds: ["a", "b", "c"] },
        { id: "2", name: "Wine", amount: 600, participantIds: ["a", "b"] },
      ] },
    }));
    expect(shares).toEqual({ a: 600, b: 600, c: 300 });
  });
  it("converts to base currency with the manually entered rate", () => {
    expect(computeShares(exp({ amount: 10000, currency: "EUR", exchangeRate: 0.85 }))).toEqual({ a: 4250, b: 4250 });
  });
  it("rejects custom amounts that don't add up", () => {
    expect(validateSplit(1000, ["a", "b"], { method: "custom", amounts: { a: 100, b: 100 } })).toMatch(/add up/);
  });
  it("rejects percentages that don't total 100", () => {
    expect(validateSplit(1000, ["a", "b"], { method: "percentage", percents: { a: 50, b: 40 } })).toMatch(/100%/);
  });
});

describe("balances and settling", () => {
  it("payer is owed what others consumed", () => {
    expect(computeBalances(["a", "b"], [exp({ amount: 1000 })], [])).toEqual({ a: 500, b: -500 });
  });
  it("recording a settlement clears the balance", () => {
    const s = { id: "s", groupId: "g", fromId: "b", toId: "a", amount: 500, date: "", createdBy: "b" };
    expect(computeBalances(["a", "b"], [exp({ amount: 1000 })], [s])).toEqual({ a: 0, b: 0 });
  });
  it("simplifies a chain of debts into one payment", () => {
    // b owes a 10, c owes b 10 -> c pays a 10
    expect(simplifyDebts({ a: 1000, b: 0, c: -1000 })).toEqual([{ fromId: "c", toId: "a", amount: 1000 }]);
  });
  it("needs at most n-1 payments", () => {
    const p = simplifyDebts({ a: 3000, b: -1000, c: -1000, d: -1000 });
    expect(p).toHaveLength(3);
    expect(p.reduce((s, x) => s + x.amount, 0)).toBe(3000);
  });
});

describe("helpers", () => {
  it("parses money input", () => {
    expect(parseMoney("12.5")).toBe(1250);
    expect(Number.isNaN(parseMoney("1.234"))).toBe(true);
  });
  it("monthly schedule clamps to month end and keeps its anchor day", () => {
    expect(addInterval("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(addInterval("2026-02-28", "monthly", 31)).toBe("2026-03-31");
    expect(addInterval("2026-01-01", "weekly")).toBe("2026-01-08");
  });
});
