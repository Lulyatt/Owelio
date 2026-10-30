import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { api, RequireAuth, useAction } from "@/lib/app";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Tally" },
      { name: "description", content: "Recent activity across your Tally groups." },
      { property: "og:title", content: "Notifications — Tally" },
      { property: "og:description", content: "Recent activity across your Tally groups." },
    ],
  }),
  component: () => <RequireAuth><Notifications /></RequireAuth>,
});

function Notifications() {
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => api().notifications.list() });
  const markRead = useAction(() => api().notifications.markAllRead());
  const hasUnread = q.data?.some((n) => !n.read);
  useEffect(() => {
    if (hasUnread) {
      const t = setTimeout(() => markRead.mutate(undefined), 1500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [hasUnread]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Notifications</h1>
      {q.data?.length === 0 && <p className="text-muted-foreground">Nothing yet.</p>}
      <ul className="divide-y rounded-lg border bg-card shadow-ledger">
        {q.data?.map((n) => (
          <li key={n.id} className={`flex items-start gap-3 p-4 ${n.read ? "" : "bg-accent/40"}`}>
            <div className="flex-1">
              {n.groupId ? <Link to="/groups/$groupId" params={{ groupId: n.groupId }} className="hover:underline">{n.message}</Link> : n.message}
              <p className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString("en-GB")}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
