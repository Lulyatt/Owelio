import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { api, CURRENCIES, RequireAuth, useAction } from "@/lib/app";
import { formatMoney } from "@/domain/money";
import type { GroupKind } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/NativeSelect";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Your groups — Tally" },
      { name: "description", content: "See what you owe, what you're owed, and all your shared-expense groups." },
      { property: "og:title", content: "Your groups — Tally" },
      { property: "og:description", content: "See what you owe, what you're owed, and all your shared-expense groups." },
    ],
  }),
  component: () => <RequireAuth><Dashboard /></RequireAuth>,
});

function Dashboard() {
  const summary = useQuery({ queryKey: ["dashboard"], queryFn: () => api().dashboard.summary() });
  const [code, setCode] = useState("");
  const navigate = useNavigate();
  const join = useAction((c: string) => api().groups.joinByCode(c), "Joined group");
  const s = summary.data;
  const currencies = s ? Object.entries(s.byCurrency) : [];
  const active = s?.groups.filter((g) => !g.group.archived) ?? [];
  const archived = s?.groups.filter((g) => g.group.archived) ?? [];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Total label="You owe" tone="owe" values={currencies.map(([c, v]) => formatMoney(v.youOwe, c))} />
        <Total label="Owed to you" tone="owed" values={currencies.map(([c, v]) => formatMoney(v.owedToYou, c))} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-bold">Your groups</h1>
        <div className="flex flex-wrap gap-2">
          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); const g = await join.mutateAsync(code); navigate({ to: "/groups/$groupId", params: { groupId: g.id } }); }}>
            <Input placeholder="Join code" value={code} onChange={(e) => setCode(e.target.value)} className="w-32 uppercase" />
            <Button variant="outline" disabled={!code}>Join</Button>
          </form>
          <NewGroupDialog />
        </div>
      </div>

      <GroupList rows={active} empty="No groups yet. Create one or join with a code." />
      {archived.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Archived</h2>
          <GroupList rows={archived} empty="" />
        </div>
      )}
    </div>
  );
}

function Total({ label, values, tone }: { label: string; values: string[]; tone: "owe" | "owed" }) {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-ledger">
      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className={`mt-1 font-display text-4xl font-bold tabular ${tone === "owe" ? "text-owe" : "text-owed"}`}>
        {values.length ? values.map((v) => <div key={v}>{v}</div>) : "£0.00"}
      </div>
    </div>
  );
}

function GroupList({ rows, empty }: { rows: { group: { id: string; name: string; kind: string; baseCurrency: string; memberIds: string[] }; balance: number }[]; empty: string }) {
  if (!rows.length) return empty ? <p className="text-muted-foreground">{empty}</p> : null;
  return (
    <ul className="divide-y rounded-lg border bg-card shadow-ledger">
      {rows.map(({ group: g, balance }) => (
        <li key={g.id}>
          <Link to="/groups/$groupId" params={{ groupId: g.id }} className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted">
            <div>
              <p className="font-semibold">{g.name}</p>
              <p className="text-sm text-muted-foreground">
                <Badge variant="secondary" className="mr-2">{g.kind}</Badge>
                {g.memberIds.length} members · {g.baseCurrency}
              </p>
            </div>
            <span className={`tabular font-semibold ${balance < 0 ? "text-owe" : balance > 0 ? "text-owed" : "text-muted-foreground"}`}>
              {balance === 0 ? "settled" : `${balance < 0 ? "you owe " : "you're owed "}${formatMoney(Math.abs(balance), g.baseCurrency)}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NewGroupDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<GroupKind>("temporary");
  const [currency, setCurrency] = useState("GBP");
  const [autoArchive, setAutoArchive] = useState(true);
  const navigate = useNavigate();
  const create = useAction(() => api().groups.create({ name, kind, baseCurrency: currency, autoArchive }), "Group created");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus /> New group</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New group</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); const g = await create.mutateAsync(undefined); setOpen(false); navigate({ to: "/groups/$groupId", params: { groupId: g.id } }); }}>
          <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Barcelona trip" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Type</Label>
              <NativeSelect value={kind} onChange={(e) => { const k = e.target.value as GroupKind; setKind(k); setAutoArchive(k === "temporary"); }}>
                <option value="temporary">Temporary (trip, event)</option>
                <option value="ongoing">Ongoing (household)</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5"><Label>Main currency</Label>
              <NativeSelect value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</NativeSelect>
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            Archive automatically once everyone is settled up
            <Switch checked={autoArchive} onCheckedChange={setAutoArchive} />
          </label>
          <Button className="w-full" disabled={create.isPending}>Create group</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
