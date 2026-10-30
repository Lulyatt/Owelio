import type { Expense, ExpenseInput, ID, Payment, Settlement, Split } from "./types";

/**
 * Split `total` minor units in proportion to `weights` using the largest
 * remainder method, so shares are whole pennies and always sum to `total`.
 * Ties go to the earlier key (stable, predictable).
 */
export function allocate(total: number, weights: Record<ID, number>): Record<ID, number> {
  const keys = Object.keys(weights).filter((k) => (weights[k] ?? 0) > 0);
  const result: Record<ID, number> = {};
  const sum = keys.reduce((s, k) => s + weights[k]!, 0);
  if (keys.length === 0 || sum <= 0) return result;
  const raw = keys.map((k) => ({ k, exact: (total * weights[k]!) / sum }));
  let assigned = 0;
  for (const r of raw) {
    result[r.k] = Math.floor(r.exact);
    assigned += result[r.k]!;
  }
  let remainder = total - assigned;
  const order = raw
    .map((r, i) => ({ ...r, i, frac: r.exact - Math.floor(r.exact) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let j = 0; remainder > 0; j = (j + 1) % order.length, remainder--) {
    const o = order[j]!;
    result[o.k] = (result[o.k] ?? 0) + 1;
  }
  return result;
}

/** Amount of the expense converted to the group base currency (minor units). */
export function toBase(amount: number, rate: number): number {
  return Math.round(amount * rate);
}

/** Validate a split. Returns an error message, or null if valid. */
export function validateExpense(e: ExpenseInput): string | null {
  if (!e.description.trim()) return "Add a description";
  if (!Number.isInteger(e.amount) || e.amount <= 0) return "Amount must be more than zero";
  if (!(e.exchangeRate > 0)) return "Exchange rate must be more than zero";
  if (e.participantIds.length === 0) return "Choose at least one person to include";
  return validateSplit(e.amount, e.participantIds, e.split);
}

export function validateSplit(amount: number, participants: ID[], split: Split): string | null {
  switch (split.method) {
    case "equal":
      return null;
    case "custom": {
      const sum = participants.reduce((s, p) => s + (split.amounts[p] ?? 0), 0);
      if (participants.some((p) => (split.amounts[p] ?? 0) < 0)) return "Amounts can't be negative";
      if (sum !== amount) return `Custom amounts add up to ${(sum / 100).toFixed(2)}, not ${(amount / 100).toFixed(2)}`;
      return null;
    }
    case "percentage": {
      const sum = participants.reduce((s, p) => s + (split.percents[p] ?? 0), 0);
      if (participants.some((p) => (split.percents[p] ?? 0) < 0)) return "Percentages can't be negative";
      if (Math.abs(sum - 100) > 0.001) return `Percentages add up to ${+sum.toFixed(3)}%, not 100%`;
      return null;
    }
    case "itemised": {
      if (split.items.length === 0) return "Add at least one item";
      for (const it of split.items) {
        if (it.amount <= 0) return `Item "${it.name || "unnamed"}" needs an amount`;
        if (it.participantIds.length === 0) return `Assign item "${it.name || "unnamed"}" to someone`;
        if (it.participantIds.some((p) => !participants.includes(p)))
          return `Item "${it.name || "unnamed"}" is assigned to someone not included`;
      }
      const sum = split.items.reduce((s, i) => s + i.amount, 0);
      if (sum !== amount) return `Items add up to ${(sum / 100).toFixed(2)}, not ${(amount / 100).toFixed(2)}`;
      return null;
    }
  }
}

/** Weights describing how the expense is shared, in expense currency. */
function splitWeights(e: Pick<ExpenseInput, "amount" | "participantIds" | "split">): Record<ID, number> {
  const w: Record<ID, number> = {};
  const s = e.split;
  switch (s.method) {
    case "equal":
      e.participantIds.forEach((p) => (w[p] = 1));
      break;
    case "custom":
      e.participantIds.forEach((p) => (w[p] = s.amounts[p] ?? 0));
      break;
    case "percentage":
      e.participantIds.forEach((p) => (w[p] = s.percents[p] ?? 0));
      break;
    case "itemised":
      for (const item of s.items) {
        const per = allocate(item.amount, Object.fromEntries(item.participantIds.map((p) => [p, 1])));
        for (const [p, v] of Object.entries(per)) w[p] = (w[p] ?? 0) + v;
      }
      break;
  }
  return w;
}

/** Each participant's share of the expense, in base-currency minor units. Always sums to toBase(amount). */
export function computeShares(e: Pick<ExpenseInput, "amount" | "exchangeRate" | "participantIds" | "split">): Record<ID, number> {
  return allocate(toBase(e.amount, e.exchangeRate), splitWeights(e));
}

/** Net position per member in base currency: positive = is owed money, negative = owes. */
export function computeBalances(memberIds: ID[], expenses: Expense[], settlements: Settlement[]): Record<ID, number> {
  const net: Record<ID, number> = Object.fromEntries(memberIds.map((m) => [m, 0]));
  for (const e of expenses) {
    net[e.paidBy] = (net[e.paidBy] ?? 0) + toBase(e.amount, e.exchangeRate);
    for (const [p, share] of Object.entries(computeShares(e))) net[p] = (net[p] ?? 0) - share;
  }
  for (const s of settlements) {
    net[s.fromId] = (net[s.fromId] ?? 0) + s.amount;
    net[s.toId] = (net[s.toId] ?? 0) - s.amount;
  }
  return net;
}

/**
 * Turn net balances into a small set of payments: repeatedly match the largest
 * debtor with the largest creditor. Produces at most n-1 payments.
 */
export function simplifyDebts(balances: Record<ID, number>): Payment[] {
  const debtors = Object.entries(balances).filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const creditors = Object.entries(balances).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const payments: Payment[] = [];
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.v - a.v);
    creditors.sort((a, b) => b.v - a.v);
    const d = debtors[0]!;
    const c = creditors[0]!;
    const amt = Math.min(d.v, c.v);
    payments.push({ fromId: d.id, toId: c.id, amount: amt });
    d.v -= amt;
    c.v -= amt;
    if (d.v === 0) debtors.shift();
    if (c.v === 0) creditors.shift();
  }
  return payments;
}

export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

/** Parse a user-typed major amount ("12.5") into minor units, or NaN. */
export function parseMoney(input: string): number {
  const t = input.trim();
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return NaN;
  return Math.round(parseFloat(t) * 100);
}

/** Add a schedule step to a YYYY-MM-DD date. Monthly clamps to month end (31 Jan -> 28/29 Feb). */
export function addInterval(date: string, freq: "daily" | "weekly" | "monthly", anchorDay?: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  if (freq === "daily" || freq === "weekly") {
    const dt = new Date(Date.UTC(y, m - 1, d + (freq === "daily" ? 1 : 7)));
    return dt.toISOString().slice(0, 10);
  }
  const day = anchorDay ?? d;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const dt = new Date(Date.UTC(y, m, Math.min(day, lastDay)));
  return dt.toISOString().slice(0, 10);
}
