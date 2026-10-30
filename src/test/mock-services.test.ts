import { beforeEach, describe, expect, it } from "vitest";
import { createMockServices, memoryStorage } from "@/services/mock";
import type { Services } from "@/services/types";
import type { ExpenseInput } from "@/domain/types";

const input = (paidBy: string, participantIds: string[], amount = 1000): ExpenseInput => ({
  description: "Dinner", amount, currency: "GBP", exchangeRate: 1, date: "2026-10-01", category: "Food & drink",
  attachments: [], paidBy, participantIds, split: { method: "equal" },
});

describe("mock services", () => {
  let storage: ReturnType<typeof memoryStorage>;
  let svc: Services;
  beforeEach(() => {
    storage = memoryStorage();
    svc = createMockServices({ storage, now: () => new Date("2026-10-30T09:00:00Z") });
  });

  it("requires an account: no guest access", async () => {
    await expect(svc.groups.list()).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("lets a second user join by code and both see expenses", async () => {
    const alex = await svc.auth.register({ name: "Alex", email: "a@x.com", password: "password1" });
    const g = await svc.groups.create({ name: "Trip", kind: "temporary", baseCurrency: "GBP" });
    await svc.auth.logout();
    const sam = await svc.auth.register({ name: "Sam", email: "s@x.com", password: "password1" });
    await svc.groups.joinByCode(g.joinCode);
    await svc.expenses.create(g.id, input(sam.id, [alex.id, sam.id]));
    await svc.auth.logout();
    await svc.auth.login({ email: "a@x.com", password: "password1" });
    expect(await svc.expenses.list(g.id)).toHaveLength(1);
    const notes = await svc.notifications.list();
    expect(notes.some((n) => n.message.includes("Dinner"))).toBe(true);
  });

  it("adds an email-invited person when they register", async () => {
    await svc.auth.register({ name: "Alex", email: "a@x.com", password: "password1" });
    const g = await svc.groups.create({ name: "Flat", kind: "ongoing", baseCurrency: "GBP" });
    await svc.groups.inviteByEmail(g.id, "new@x.com");
    await svc.auth.logout();
    await svc.auth.register({ name: "New", email: "new@x.com", password: "password1" });
    expect((await svc.groups.list()).map((x) => x.id)).toContain(g.id);
  });

  it("blocks non-members from seeing a group", async () => {
    await svc.auth.register({ name: "Alex", email: "a@x.com", password: "password1" });
    const g = await svc.groups.create({ name: "Private", kind: "ongoing", baseCurrency: "GBP" });
    await svc.auth.logout();
    await svc.auth.register({ name: "Eve", email: "e@x.com", password: "password1" });
    await expect(svc.expenses.list(g.id)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("auto-archives a temporary group once everyone is settled, then it is read-only", async () => {
    const alex = await svc.auth.register({ name: "Alex", email: "a@x.com", password: "password1" });
    const g = await svc.groups.create({ name: "Trip", kind: "temporary", baseCurrency: "GBP" });
    await svc.auth.logout();
    const sam = await svc.auth.register({ name: "Sam", email: "s@x.com", password: "password1" });
    await svc.groups.joinByCode(g.joinCode);
    await svc.expenses.create(g.id, input(alex.id, [alex.id, sam.id]));
    await svc.settlements.create(g.id, { fromId: sam.id, toId: alex.id, amount: 500, date: "2026-10-30" });
    expect((await svc.groups.get(g.id)).archived).toBe(true);
    await expect(svc.expenses.create(g.id, input(alex.id, [alex.id]))).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects an expense whose split does not add up", async () => {
    const alex = await svc.auth.register({ name: "Alex", email: "a@x.com", password: "password1" });
    const g = await svc.groups.create({ name: "Trip", kind: "ongoing", baseCurrency: "GBP" });
    await expect(
      svc.expenses.create(g.id, { ...input(alex.id, [alex.id]), split: { method: "custom", amounts: { [alex.id]: 1 } } }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("catches up missed recurring expenses up to today", async () => {
    const alex = await svc.auth.register({ name: "Alex", email: "a@x.com", password: "password1" });
    const g = await svc.groups.create({ name: "Flat", kind: "ongoing", baseCurrency: "GBP" });
    await svc.recurring.create(g.id, { template: input(alex.id, [alex.id]), frequency: "weekly", startDate: "2026-10-09" });
    const dates = (await svc.expenses.list(g.id)).map((e) => e.date).sort();
    expect(dates).toEqual(["2026-10-09", "2026-10-16", "2026-10-23", "2026-10-30"]);
    const [r] = await svc.recurring.list(g.id);
    expect(r.nextDate).toBe("2026-11-06");
  });

  it("dashboard totals what you owe and are owed", async () => {
    const alex = await svc.auth.register({ name: "Alex", email: "a@x.com", password: "password1" });
    const g = await svc.groups.create({ name: "Trip", kind: "ongoing", baseCurrency: "GBP" });
    await svc.auth.logout();
    const sam = await svc.auth.register({ name: "Sam", email: "s@x.com", password: "password1" });
    await svc.groups.joinByCode(g.joinCode);
    await svc.expenses.create(g.id, input(alex.id, [alex.id, sam.id], 3000));
    const d = await svc.dashboard.summary();
    expect(d.youOwe).toBe(1500);
    expect(d.owedToYou).toBe(0);
  });
});
