import type {
  AppNotification,
  DashboardSummary,
  EmailInvite,
  Expense,
  ExpenseInput,
  Group,
  ID,
  RecurringExpense,
  Settlement,
  User,
} from "@/domain/types";
import { getAccessToken, setAccessToken } from "@/services/token";
import { ServiceError, type Services } from "@/services/types";

type ErrorCode = ServiceError["code"];

interface ApiErrorBody {
  detail?: { code?: ErrorCode; message?: string } | string;
}

interface AuthResponse {
  user: User;
  access_token: string;
  token_type: "bearer";
}

interface CurrentUserResponse {
  user: User | null;
}

async function parseError(res: Response): Promise<ServiceError> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    const d = body.detail;
    if (d && typeof d === "object" && typeof d.message === "string" && d.code) {
      return new ServiceError(d.message, d.code);
    }
    if (typeof d === "string") return new ServiceError(d, "invalid");
  } catch {
    /* ignore */
  }
  return new ServiceError(res.statusText || "Request failed", "invalid");
}

export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.replace(/\/$/, "");
  return "http://127.0.0.1:8000/api/v1";
}

export function createApiServices(baseUrl: string): Services {
  const root = baseUrl.replace(/\/$/, "");

  async function request<T>(
    path: string,
    init: RequestInit & { auth?: boolean } = {},
  ): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body != null && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const auth = init.auth !== false;
    if (auth) {
      const token = getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }
    const { auth: _auth, ...fetchInit } = init;
    const res = await fetch(`${root}${path}`, { ...fetchInit, headers });
    if (res.status === 204) return undefined as T;
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as T;
  }

  async function saveSession(data: AuthResponse): Promise<User> {
    setAccessToken(data.access_token);
    return data.user;
  }

  return {
    auth: {
      currentUser: async () => {
        const data = await request<CurrentUserResponse>("/auth/me");
        return data.user;
      },
      register: async (input) => {
        const data = await request<AuthResponse>("/auth/register", {
          method: "POST",
          auth: false,
          body: JSON.stringify(input),
        });
        return saveSession(data);
      },
      login: async (input) => {
        const data = await request<AuthResponse>("/auth/login", {
          method: "POST",
          auth: false,
          body: JSON.stringify(input),
        });
        return saveSession(data);
      },
      logout: async () => {
        try {
          await request<void>("/auth/logout", { method: "POST" });
        } finally {
          setAccessToken(null);
        }
      },
    },

    groups: {
      list: () => request<Group[]>("/groups"),
      get: (groupId) => request<Group>(`/groups/${encodeURIComponent(groupId)}`),
      create: (input) =>
        request<Group>("/groups", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      update: (groupId, patch) =>
        request<Group>(`/groups/${encodeURIComponent(groupId)}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        }),
      setArchived: (groupId, archived) =>
        request<Group>(`/groups/${encodeURIComponent(groupId)}/archived`, {
          method: "PUT",
          body: JSON.stringify({ archived }),
        }),
      members: (groupId) => request<User[]>(`/groups/${encodeURIComponent(groupId)}/members`),
      joinByCode: (code) =>
        request<Group>("/groups/join", {
          method: "POST",
          body: JSON.stringify({ code }),
        }),
      inviteByEmail: (groupId, email) =>
        request<EmailInvite>(`/groups/${encodeURIComponent(groupId)}/invites`, {
          method: "POST",
          body: JSON.stringify({ email }),
        }),
      invites: (groupId) =>
        request<EmailInvite[]>(`/groups/${encodeURIComponent(groupId)}/invites`),
    },

    expenses: {
      list: (groupId) =>
        request<Expense[]>(`/groups/${encodeURIComponent(groupId)}/expenses`),
      create: (groupId, input) =>
        request<Expense>(`/groups/${encodeURIComponent(groupId)}/expenses`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
      update: (expenseId, input) =>
        request<Expense>(`/expenses/${encodeURIComponent(expenseId)}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        }),
      remove: (expenseId) =>
        request<void>(`/expenses/${encodeURIComponent(expenseId)}`, { method: "DELETE" }),
    },

    settlements: {
      list: (groupId) =>
        request<Settlement[]>(`/groups/${encodeURIComponent(groupId)}/settlements`),
      create: (groupId, input) =>
        request<Settlement>(`/groups/${encodeURIComponent(groupId)}/settlements`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
    },

    recurring: {
      list: (groupId) =>
        request<RecurringExpense[]>(
          `/groups/${encodeURIComponent(groupId)}/recurring-expenses`,
        ),
      create: (groupId, input) =>
        request<RecurringExpense>(
          `/groups/${encodeURIComponent(groupId)}/recurring-expenses`,
          {
            method: "POST",
            body: JSON.stringify(input),
          },
        ),
      setActive: (id, active) =>
        request<RecurringExpense>(`/recurring-expenses/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ active }),
        }),
      remove: (id) =>
        request<void>(`/recurring-expenses/${encodeURIComponent(id)}`, { method: "DELETE" }),
    },

    notifications: {
      list: () => request<AppNotification[]>("/notifications"),
      markAllRead: () => request<void>("/notifications/read-all", { method: "POST" }),
    },

    dashboard: {
      summary: () => request<DashboardSummary>("/dashboard/summary"),
    },
  };
}
