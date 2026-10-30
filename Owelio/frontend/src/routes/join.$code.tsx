import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { api, RequireAuth, useAction } from "@/lib/app";

export const Route = createFileRoute("/join/$code")({
  head: () => ({
    meta: [
      { title: "Join a group — Owelio" },
      { name: "description", content: "You've been invited to split expenses on Owelio." },
      { property: "og:title", content: "Join a group — Owelio" },
      { property: "og:description", content: "You've been invited to split expenses on Owelio." },
    ],
  }),
  component: () => <RequireAuth><Join /></RequireAuth>,
});

function Join() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const join = useAction((c: string) => api().groups.joinByCode(c), "You joined the group");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    join.mutateAsync(code).then(
      (g) => navigate({ to: "/groups/$groupId", params: { groupId: g.id }, replace: true }),
      () => navigate({ to: "/", replace: true }),
    );
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps
  return <p className="p-10 text-center text-muted-foreground">Joining group…</p>;
}
