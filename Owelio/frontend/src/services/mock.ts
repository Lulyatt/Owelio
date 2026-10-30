import {
  addInterval,
  computeBalances,
  validateExpense,
} from "@/domain/money";
import type {
  AppNotification,
  EmailInvite,
  Expense,
  ExpenseInput,
  Group,
  ID,
  RecurringExpense,
  Settlement,
  User,
} from "@/domain/types";
import { ServiceError, type Services } from "./types";

interface State {
  users: (User & { password: string })[];
  groups: Group[];
  expenses: Expense[];
  settlements: Settlement[];
  recurring: RecurringExpense[];
  notifications: AppNotification[];
  invites: EmailInvite[];
  sessionUserId: ID | null;
}

export interface Storage {
  load(): State | null;
  save(state: State): void;
}

export const memoryStorage = (): Storage => {
  let s: State | null = null;
  return { load: () => (s ? structuredClone(s) : null), save: (v) => (s = structuredClone(v)) };
};

export const browserStorage = (key = "splitwell-mock-v1"): Storage => ({
  load() {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as State) : null;
    } catch {
      return null;
    }
  },
  save(state) {
    localStorage.setItem(key, JSON.stringify(state));
  },
});

export interface MockOptions {
  storage?: Storage;
  seed?: boolean;
  now?: () => Date;
  latencyMs?: number;
}

const emptyState = (): State => ({
  users: [],
  groups: [],
  expenses: [],
  settlements: [],
  recurring: [],
  notifications: [],
  invites: [],
  sessionUserId: null,
});

let counter = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const code = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

/** In-browser fake backend implementing the full Services contract. */
export function createMockServices(opts: MockOptions = {}): Services {
  const storage = opts.storage ?? memoryStorage();
  const now = opts.now ?? (() => new Date());
  let state: State = storage.load() ?? (opts.seed ? seedState() : emptyState());
  storage.save(state);

  const today = () => now().toISOString().slice(0, 10);
  const wait = () => (opts.latencyMs ? new Promise((r) => setTimeout(r, opts.latencyMs)) : Promise.resolve());

  async function run<T>(fn: () => T): Promise<T> {
    await wait();
    state = storage.load() ?? state;
    const out = fn();
    storage.save(state);
    return structuredClone(out);
  }

  const me = (): User & { password: string } => {
    const u = state.users.find((x) => x.id === state.sessionUserId);
    if (!u) throw new ServiceError("Please log in", "unauthenticated");
    return u;
  };
  const publicUser = (u: User): User => ({ id: u.id, name: u.name, email: u.email });
  const groupFor = (groupId: ID): Group => {
    const g = state.groups.find((x) => x.id === groupId);
    if (!g) throw new ServiceError("Group not found", "not_found");
    if (!g.memberIds.includes(me().id)) throw new ServiceError("You're not a member of this group", "forbidden");
    return g;
  };
  const writableGroup = (groupId: ID) => {
    const g = groupFor(groupId);
    if (g.archived) throw new ServiceError("This group is archived and read-only", "forbidden");
    return g;
  };
  const notify = (g: Group, message: string, exceptId?: ID) => {
    for (const m of g.memberIds) {
      if (m === exceptId) continue;
      state.notifications.push({ id: uid("n"), userId: m, groupId: g.id, message, createdAt: now().toISOString(), read: false });
    }
  };
  const checkExpense = (g: Group, input: ExpenseInput) => {
    const err = validateExpense(input);
    if (err) throw new ServiceError(err, "invalid");
    if (!g.memberIds.includes(input.paidBy)) throw new ServiceError("Payer must be a group member", "invalid");
    if (input.participantIds.some((p) => !g.memberIds.includes(p)))
      throw new ServiceError("Everyone included must be a group member", "invalid");
    if (input.currency === g.baseCurrency && input.exchangeRate !== 1)
      throw new ServiceError("Exchange rate must be 1 for the group's own currency", "invalid");
  };
  const maybeAutoArchive = (g: Group) => {
    if (!g.autoArchive || g.archived) return;
    const exps = state.expenses.filter((e) => e.groupId === g.id);
    if (exps.length === 0) return;
    const bal = computeBalances(g.memberIds, exps, state.settlements.filter((s) => s.groupId === g.id));
    if (Object.values(bal).every((v) => v === 0)) {
      g.archived = true;
      notify(g, `${g.name} is all settled up and has been archived`);
    }
  };
  const acceptInvites = (u: User) => {
    const mine = state.invites.filter((i) => i.email.toLowerCase() === u.email.toLowerCase());
    for (const inv of mine) {
      const g = state.groups.find((x) => x.id === inv.groupId);
      if (g && !g.memberIds.includes(u.id)) {
        g.memberIds.push(u.id);
        notify(g, `${u.name} joined ${g.name}`, u.id);
        state.notifications.push({ id: uid("n"), userId: u.id, groupId: g.id, message: `You were added to ${g.name} by invitation`, createdAt: now().toISOString(), read: false });
      }
    }
    state.invites = state.invites.filter((i) => !mine.includes(i));
  };
  /** Materialise every recurring expense that has fallen due, catching up missed dates. */
  const runRecurring = () => {
    const t = today();
    for (const r of state.recurring) {
      if (!r.active) continue;
      const g = state.groups.find((x) => x.id === r.groupId);
      if (!g || g.archived) continue;
      const anchor = Number(r.nextDate.slice(8, 10));
      let guard = 0;
      while (r.nextDate <= t && guard++ < 400) {
        state.expenses.push({ ...structuredClone(r.template), date: r.nextDate, id: uid("e"), groupId: g.id, createdBy: r.createdBy, createdAt: now().toISOString(), recurringId: r.id });
        notify(g, `Recurring expense "${r.template.description}" was added for ${r.nextDate}`);
        r.nextDate = addInterval(r.nextDate, r.frequency, r.frequency === "monthly" ? anchor : undefined);
      }
    }
  };

  return {
    auth: {
      currentUser: () => run(() => {
        const u = state.users.find((x) => x.id === state.sessionUserId);
        if (u) runRecurring();
        return u ? publicUser(u) : null;
      }),
      register: ({ name, email, password }) => run(() => {
        if (!name.trim()) throw new ServiceError("Enter your name", "invalid");
        if (!/^\S+@\S+\.\S+$/.test(email)) throw new ServiceError("Enter a valid email", "invalid");
        if (password.length < 8) throw new ServiceError("Password must be at least 8 characters", "invalid");
        if (state.users.some((u) => u.email.toLowerCase() === email.toLowerCase()))
          throw new ServiceError("An account with that email already exists", "conflict");
        const u = { id: uid("u"), name: name.trim(), email: email.trim(), password };
        state.users.push(u);
        state.sessionUserId = u.id;
        acceptInvites(u);
        return publicUser(u);
      }),
      login: ({ email, password }) => run(() => {
        const u = state.users.find((x) => x.email.toLowerCase() === email.toLowerCase().trim());
        if (!u || u.password !== password) throw new ServiceError("Email or password is incorrect", "unauthenticated");
        state.sessionUserId = u.id;
        acceptInvites(u);
        runRecurring();
        return publicUser(u);
      }),
      logout: () => run(() => {
        state.sessionUserId = null;
      }),
    },

    groups: {
      list: () => run(() => {
        const id = me().id;
        return state.groups.filter((g) => g.memberIds.includes(id));
      }),
      get: (id) => run(() => groupFor(id)),
      create: ({ name, kind, baseCurrency, autoArchive }) => run(() => {
        const u = me();
        if (!name.trim()) throw new ServiceError("Give the group a name", "invalid");
        const g: Group = { id: uid("g"), name: name.trim(), kind, baseCurrency, memberIds: [u.id], joinCode: code(), archived: false, autoArchive: autoArchive ?? kind === "temporary", createdBy: u.id, createdAt: now().toISOString() };
        state.groups.push(g);
        return g;
      }),
      update: (id, patch) => run(() => {
        const g = writableGroup(id);
        Object.assign(g, patch);
        return g;
      }),
      setArchived: (id, archived) => run(() => {
        const g = groupFor(id);
        g.archived = archived;
        notify(g, `${me().name} ${archived ? "archived" : "reopened"} ${g.name}`, me().id);
        return g;
      }),
      members: (id) => run(() => groupFor(id).memberIds.map((m) => publicUser(state.users.find((u) => u.id === m)!))),
      joinByCode: (c) => run(() => {
        const u = me();
        const g = state.groups.find((x) => x.joinCode === c.trim().toUpperCase());
        if (!g) throw new ServiceError("No group found for that code", "not_found");
        if (g.archived) throw new ServiceError("That group is archived", "forbidden");
        if (!g.memberIds.includes(u.id)) {
          g.memberIds.push(u.id);
          notify(g, `${u.name} joined ${g.name}`, u.id);
        }
        return g;
      }),
      inviteByEmail: (id, email) => run(() => {
        const g = writableGroup(id);
        if (!/^\S+@\S+\.\S+$/.test(email)) throw new ServiceError("Enter a valid email", "invalid");
        const existing = state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        const inv: EmailInvite = { id: uid("i"), groupId: g.id, email: email.trim(), invitedBy: me().id, createdAt: now().toISOString() };
        if (existing) {
          if (!g.memberIds.includes(existing.id)) {
            g.memberIds.push(existing.id);
            notify(g, `${existing.name} was added to ${g.name}`);
          }
        } else {
          state.invites.push(inv);
        }
        return inv;
      }),
      invites: (id) => run(() => {
        groupFor(id);
        return state.invites.filter((i) => i.groupId === id);
      }),
    },

    expenses: {
      list: (groupId) => run(() => {
        groupFor(groupId);
        return state.expenses.filter((e) => e.groupId === groupId).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
      }),
      create: (groupId, input) => run(() => {
        const g = writableGroup(groupId);
        checkExpense(g, input);
        const e: Expense = { ...structuredClone(input), id: uid("e"), groupId, createdBy: me().id, createdAt: now().toISOString() };
        state.expenses.push(e);
        notify(g, `${me().name} added "${e.description}"`, me().id);
        return e;
      }),
      update: (id, input) => run(() => {
        const e = state.expenses.find((x) => x.id === id);
        if (!e) throw new ServiceError("Expense not found", "not_found");
        const g = writableGroup(e.groupId);
        checkExpense(g, input);
        Object.assign(e, structuredClone(input));
        notify(g, `${me().name} edited "${e.description}"`, me().id);
        return e;
      }),
      remove: (id) => run(() => {
        const e = state.expenses.find((x) => x.id === id);
        if (!e) throw new ServiceError("Expense not found", "not_found");
        const g = writableGroup(e.groupId);
        state.expenses = state.expenses.filter((x) => x.id !== id);
        notify(g, `${me().name} deleted "${e.description}"`, me().id);
      }),
    },

    settlements: {
      list: (groupId) => run(() => {
        groupFor(groupId);
        return state.settlements.filter((s) => s.groupId === groupId).sort((a, b) => b.date.localeCompare(a.date));
      }),
      create: (groupId, input) => run(() => {
        const g = writableGroup(groupId);
        if (input.fromId === input.toId) throw new ServiceError("Choose two different people", "invalid");
        if (![input.fromId, input.toId].every((m) => g.memberIds.includes(m))) throw new ServiceError("Both people must be group members", "invalid");
        if (!Number.isInteger(input.amount) || input.amount <= 0) throw new ServiceError("Amount must be more than zero", "invalid");
        const s: Settlement = { ...input, id: uid("s"), groupId, createdBy: me().id };
        state.settlements.push(s);
        const name = (id: ID) => state.users.find((u) => u.id === id)?.name ?? "Someone";
        notify(g, `${name(input.fromId)} paid ${name(input.toId)} in ${g.name}`, me().id);
        maybeAutoArchive(g);
        return s;
      }),
    },

    recurring: {
      list: (groupId) => run(() => {
        groupFor(groupId);
        return state.recurring.filter((r) => r.groupId === groupId);
      }),
      create: (groupId, { template, frequency, startDate }) => run(() => {
        const g = writableGroup(groupId);
        checkExpense(g, template);
        const r: RecurringExpense = { id: uid("r"), groupId, template: structuredClone(template), frequency, nextDate: startDate, active: true, createdBy: me().id };
        state.recurring.push(r);
        runRecurring();
        return r;
      }),
      setActive: (id, active) => run(() => {
        const r = state.recurring.find((x) => x.id === id);
        if (!r) throw new ServiceError("Not found", "not_found");
        writableGroup(r.groupId);
        r.active = active;
        if (active) runRecurring();
        return r;
      }),
      remove: (id) => run(() => {
        const r = state.recurring.find((x) => x.id === id);
        if (!r) throw new ServiceError("Not found", "not_found");
        writableGroup(r.groupId);
        state.recurring = state.recurring.filter((x) => x.id !== id);
      }),
    },

    notifications: {
      list: () => run(() => state.notifications.filter((n) => n.userId === me().id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
      markAllRead: () => run(() => {
        const id = me().id;
        state.notifications.forEach((n) => n.userId === id && (n.read = true));
      }),
    },

    dashboard: {
      summary: () => run(() => {
        const u = me();
        const groups = state.groups.filter((g) => g.memberIds.includes(u.id));
        const byCurrency: Record<string, { youOwe: number; owedToYou: number }> = {};
        const rows = groups.map((g) => {
          const bal = computeBalances(g.memberIds, state.expenses.filter((e) => e.groupId === g.id), state.settlements.filter((s) => s.groupId === g.id))[u.id] ?? 0;
          const c = (byCurrency[g.baseCurrency] ??= { youOwe: 0, owedToYou: 0 });
          if (bal < 0) c.youOwe += -bal;
          else c.owedToYou += bal;
          return { group: g, balance: bal };
        });
        const totals = Object.values(byCurrency);
        return {
          youOwe: totals.reduce((s, c) => s + c.youOwe, 0),
          owedToYou: totals.reduce((s, c) => s + c.owedToYou, 0),
          groups: rows,
          byCurrency,
        };
      }),
    },
  };
}

/** Demo data so the app is explorable immediately. Log in: alex@example.com / password123 */
export function seedState(): State {
  const users = [
    { id: "u_alex", name: "Alex Morgan", email: "alex@example.com", password: "password123" },
    { id: "u_sam", name: "Sam Patel", email: "sam@example.com", password: "password123" },
    { id: "u_jo", name: "Jo Kim", email: "jo@example.com", password: "password123" },
  ];
  const t = new Date().toISOString();
  const base = { attachments: [], notes: "", createdAt: t };
  return {
    ...emptyState(),
    users,
    groups: [
      { id: "g_lisbon", name: "Lisbon weekend", kind: "temporary", baseCurrency: "GBP", memberIds: ["u_alex", "u_sam", "u_jo"], joinCode: "LISBON", archived: false, autoArchive: true, createdBy: "u_alex", createdAt: t },
      { id: "g_flat", name: "Flat 4B", kind: "ongoing", baseCurrency: "GBP", memberIds: ["u_alex", "u_sam"], joinCode: "FLAT4B", archived: false, autoArchive: false, createdBy: "u_sam", createdAt: t },
    ],
    expenses: [
      { ...base, id: "e1", groupId: "g_lisbon", description: "Flat", amount: 36000, currency: "GBP", exchangeRate: 1, date: "2026-10-10", category: "Accommodation", paidBy: "u_alex", participantIds: ["u_alex", "u_sam", "u_jo"], split: { method: "equal" }, createdBy: "u_alex" },
      { ...base, id: "e2", groupId: "g_lisbon", description: "Seafood dinner", amount: 9600, currency: "EUR", exchangeRate: 0.85, date: "2026-10-11", category: "Food & drink", paidBy: "u_sam", participantIds: ["u_alex", "u_sam", "u_jo"], split: { method: "itemised", items: [ { id: "i1", name: "Shared platter", amount: 6000, participantIds: ["u_alex", "u_sam", "u_jo"] }, { id: "i2", name: "Wine", amount: 3600, participantIds: ["u_alex", "u_sam"] } ] }, createdBy: "u_sam" },
      { ...base, id: "e3", groupId: "g_flat", description: "Electricity — October", amount: 8400, currency: "GBP", exchangeRate: 1, date: "2026-10-01", category: "Utilities", paidBy: "u_sam", participantIds: ["u_alex", "u_sam"], split: { method: "percentage", percents: { u_alex: 60, u_sam: 40 } }, createdBy: "u_sam" },
    ],
  };
}
