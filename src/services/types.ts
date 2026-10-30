import type {
  AppNotification,
  DashboardSummary,
  EmailInvite,
  Expense,
  ExpenseInput,
  Frequency,
  Group,
  GroupKind,
  ID,
  RecurringExpense,
  Settlement,
  User,
} from "@/domain/types";

/**
 * The single contract for every backend call the app makes.
 * UI code talks only to this interface; swap the implementation in
 * src/services/index.ts to move from the mock to a real backend.
 */
export interface Services {
  auth: {
    currentUser(): Promise<User | null>;
    register(input: { name: string; email: string; password: string }): Promise<User>;
    login(input: { email: string; password: string }): Promise<User>;
    logout(): Promise<void>;
  };
  groups: {
    list(): Promise<Group[]>;
    get(groupId: ID): Promise<Group>;
    create(input: { name: string; kind: GroupKind; baseCurrency: string; autoArchive?: boolean }): Promise<Group>;
    update(groupId: ID, patch: Partial<Pick<Group, "name" | "autoArchive">>): Promise<Group>;
    setArchived(groupId: ID, archived: boolean): Promise<Group>;
    members(groupId: ID): Promise<User[]>;
    joinByCode(code: string): Promise<Group>;
    inviteByEmail(groupId: ID, email: string): Promise<EmailInvite>;
    invites(groupId: ID): Promise<EmailInvite[]>;
  };
  expenses: {
    list(groupId: ID): Promise<Expense[]>;
    create(groupId: ID, input: ExpenseInput): Promise<Expense>;
    update(expenseId: ID, input: ExpenseInput): Promise<Expense>;
    remove(expenseId: ID): Promise<void>;
  };
  settlements: {
    list(groupId: ID): Promise<Settlement[]>;
    create(groupId: ID, input: { fromId: ID; toId: ID; amount: number; date: string; note?: string }): Promise<Settlement>;
  };
  recurring: {
    list(groupId: ID): Promise<RecurringExpense[]>;
    create(groupId: ID, input: { template: ExpenseInput; frequency: Frequency; startDate: string }): Promise<RecurringExpense>;
    setActive(id: ID, active: boolean): Promise<RecurringExpense>;
    remove(id: ID): Promise<void>;
  };
  notifications: {
    list(): Promise<AppNotification[]>;
    markAllRead(): Promise<void>;
  };
  dashboard: {
    summary(): Promise<DashboardSummary>;
  };
}

export class ServiceError extends Error {
  constructor(
    message: string,
    public code: "unauthenticated" | "forbidden" | "not_found" | "invalid" | "conflict",
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
