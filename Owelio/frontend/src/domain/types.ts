// Core domain types. All money is stored as integer minor units (e.g. pence).

export type ID = string;

export interface User {
  id: ID;
  name: string;
  email: string;
}

export type GroupKind = "temporary" | "ongoing";

export interface Group {
  id: ID;
  name: string;
  kind: GroupKind;
  baseCurrency: string;
  memberIds: ID[];
  joinCode: string;
  archived: boolean;
  autoArchive: boolean;
  createdBy: ID;
  createdAt: string;
}

export interface SplitItem {
  id: ID;
  name: string;
  amount: number; // minor units, expense currency
  participantIds: ID[];
}

export type Split =
  | { method: "equal" }
  | { method: "custom"; amounts: Record<ID, number> } // minor units, expense currency
  | { method: "percentage"; percents: Record<ID, number> }
  | { method: "itemised"; items: SplitItem[] };

export type SplitMethod = Split["method"];

export interface Attachment {
  name: string;
  type: string;
  dataUrl: string;
}

export const CATEGORIES = [
  "Food & drink",
  "Groceries",
  "Transport",
  "Accommodation",
  "Utilities",
  "Rent",
  "Entertainment",
  "Shopping",
  "Other",
] as const;

export interface ExpenseInput {
  description: string;
  amount: number; // minor units, expense currency
  currency: string;
  exchangeRate: number; // 1 unit of expense currency = rate units of base currency
  date: string; // YYYY-MM-DD
  category: string;
  notes?: string;
  attachments: Attachment[];
  paidBy: ID;
  participantIds: ID[];
  split: Split;
}

export interface Expense extends ExpenseInput {
  id: ID;
  groupId: ID;
  createdBy: ID;
  createdAt: string;
  recurringId?: ID;
}

export type Frequency = "daily" | "weekly" | "monthly";

export interface RecurringExpense {
  id: ID;
  groupId: ID;
  template: ExpenseInput;
  frequency: Frequency;
  nextDate: string; // YYYY-MM-DD
  active: boolean;
  createdBy: ID;
}

export interface Settlement {
  id: ID;
  groupId: ID;
  fromId: ID;
  toId: ID;
  amount: number; // minor units, base currency
  date: string;
  note?: string;
  createdBy: ID;
}

export interface AppNotification {
  id: ID;
  userId: ID;
  groupId?: ID;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface EmailInvite {
  id: ID;
  groupId: ID;
  email: string;
  invitedBy: ID;
  createdAt: string;
}

export interface Payment {
  fromId: ID;
  toId: ID;
  amount: number;
}

export interface DashboardSummary {
  youOwe: number;
  owedToYou: number;
  groups: { group: Group; balance: number }[];
  // Totals are per base currency because groups may use different currencies.
  byCurrency: Record<string, { youOwe: number; owedToYou: number }>;
}
