import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getServices } from "@/services";

export const api = () => getServices();

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => api().auth.currentUser() });
}

/** Wrap a services call as a mutation that refreshes all data and toasts errors. */
export function useAction<A, R>(fn: (a: A) => Promise<R>, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries();
      if (success) toast.success(success);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}

/** Mandatory accounts: render children only for a logged-in user. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe();
  const navigate = useNavigate();
  useEffect(() => {
    if (me.isSuccess && !me.data) {
      const redirect = window.location.pathname + window.location.search;
      navigate({ to: "/login", search: { redirect } });
    }
  }, [me.isSuccess, me.data, navigate]);
  if (!me.data) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  return <>{children}</>;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const CURRENCIES = ["GBP", "EUR", "USD", "CHF", "JPY", "AUD", "CAD", "SEK", "NOK", "DKK", "PLN"];
