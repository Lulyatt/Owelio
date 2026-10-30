import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Copy, Paperclip, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, RequireAuth, todayISO, useAction, useMe } from "@/lib/app";
import { computeBalances, computeShares, formatMoney, parseMoney, simplifyDebts, toBase } from "@/domain/money";
import type { Expense, Group, User } from "@/domain/types";
import { ExpenseForm } from "@/components/ExpenseForm";
import { NativeSelect } from "@/components/NativeSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/groups/$groupId")({
  head: () => ({
    meta: [
      { title: "Group — Tally" },
      { name: "description", content: "Expenses, balances and settlements for your group." },
      { property: "og:title", content: "Group — Tally" },
      { property: "og:description", content: "Expenses, balances and settlements for your group." },
    ],
  }),
  component: () => <RequireAuth><GroupPage /></RequireAuth>,
});

function GroupPage() {
  const { groupId } = Route.useParams();
  const me = useMe().data!;
  const group = useQuery({ queryKey: ["group", groupId], queryFn: () => api().groups.get(groupId), retry: false });
  const members = useQuery({ queryKey: ["members", groupId], queryFn: () => api().groups.members(groupId), enabled: group.isSuccess });
  const expenses = useQuery({ queryKey: ["expenses", groupId], queryFn: () => api().expenses.list(groupId), enabled: group.isSuccess });
  const settlements = useQuery({ queryKey: ["settlements", groupId], queryFn: () => api().settlements.list(groupId), enabled: group.isSuccess });
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const create = useAction(async (r: Parameters<React.ComponentProps<typeof ExpenseForm>["onSubmit"]>[0]) => {
    if (r.recurring) await api().recurring.create(groupId, { template: r.input, frequency: r.recurring.frequency, startDate: r.input.date });
    else await api().expenses.create(groupId, r.input);
  }, "Expense added");
  const update = useAction(({ id, r }: { id: string; r: Parameters<React.ComponentProps<typeof ExpenseForm>["onSubmit"]>[0] }) => api().expenses.update(id, r.input), "Expense updated");
  const archive = useAction((v: boolean) => api().groups.setArchived(groupId, v));

  if (group.isError) return <p className="p-10 text-center text-muted-foreground">{(group.error as Error).message}</p>;
  if (!group.data || !members.data || !expenses.data || !settlements.data) return <p className="p-10 text-center text-muted-foreground">Loading…</p>;
  const g = group.data;
  const balances = computeBalances(g.memberIds, expenses.data, settlements.data);
  const ro = g.archived;

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> All groups</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold">{g.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <Badge variant="secondary" className="mr-2">{g.kind}</Badge>{g.baseCurrency} · {g.memberIds.length} members
            {ro && <Badge className="ml-2">Archived · read-only</Badge>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => archive.mutate(!ro)}>{ro ? "Reopen group" : "Archive"}</Button>
          {!ro && <Button onClick={() => setEditing("new")}><Plus /> Add expense</Button>}
        </div>
      </div>

      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>
        <TabsContent value="expenses"><ExpenseList group={g} members={members.data} expenses={expenses.data} onEdit={ro ? undefined : setEditing} /></TabsContent>
        <TabsContent value="balances"><Balances group={g} members={members.data} balances={balances} settlements={settlements.data} meId={me.id} /></TabsContent>
        <TabsContent value="recurring"><Recurring group={g} members={members.data} /></TabsContent>
        <TabsContent value="members"><Members group={g} members={members.data} /></TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing === "new" ? "Add expense" : "Edit expense"}</DialogTitle></DialogHeader>
          {editing && (
            <ExpenseForm
              key={editing === "new" ? "new" : editing.id}
              group={g}
              members={members.data}
              meId={me.id}
              initial={editing === "new" ? undefined : editing}
              allowRecurring={editing === "new"}
              busy={create.isPending || update.isPending}
              onSubmit={async (r) => {
                if (editing === "new") await create.mutateAsync(r);
                else await update.mutateAsync({ id: editing.id, r });
                setEditing(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const nameIn = (members: User[]) => (id: string) => members.find((m) => m.id === id)?.name ?? "Former member";

function ExpenseList({ group, members, expenses, onEdit }: { group: Group; members: User[]; expenses: Expense[]; onEdit?: ((e: Expense) => void) | undefined }) {
  const [open, setOpen] = useState<string | null>(null);
  const remove = useAction((id: string) => api().expenses.remove(id), "Expense deleted");
  const name = nameIn(members);
  if (!expenses.length) return <p className="py-8 text-center text-muted-foreground">No expenses yet.</p>;
  return (
    <ul className="divide-y rounded-lg border bg-card shadow-ledger">
      {expenses.map((e) => {
        const shares = computeShares(e);
        const base = toBase(e.amount, e.exchangeRate);
        return (
          <li key={e.id}>
            <button className="flex w-full items-center gap-4 p-4 text-left hover:bg-muted" onClick={() => setOpen(open === e.id ? null : e.id)}>
              <div className="w-14 text-center text-xs uppercase text-muted-foreground">{new Date(e.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
              <div className="flex-1">
                <p className="font-semibold">{e.description} {e.recurringId && <Repeat className="inline size-3.5 text-muted-foreground" />} {e.attachments.length > 0 && <Paperclip className="inline size-3.5 text-muted-foreground" />}</p>
                <p className="text-sm text-muted-foreground">{name(e.paidBy)} paid · {e.category}</p>
              </div>
              <div className="text-right tabular">
                <p className="font-semibold">{formatMoney(e.amount, e.currency)}</p>
                {e.currency !== group.baseCurrency && <p className="text-xs text-muted-foreground">{formatMoney(base, group.baseCurrency)} @ {e.exchangeRate}</p>}
              </div>
            </button>
            {open === e.id && (
              <div className="space-y-3 bg-muted/50 px-4 pb-4 pt-2 text-sm">
                <p className="text-muted-foreground">Split {e.split.method === "custom" ? "by amounts" : e.split.method === "percentage" ? "by percentage" : e.split.method === "itemised" ? "by item" : "equally"}</p>
                {e.split.method === "itemised" && (
                  <ul className="space-y-0.5">{e.split.items.map((i) => <li key={i.id}>{i.name}: {formatMoney(i.amount, e.currency)} — {i.participantIds.map(name).join(", ")}</li>)}</ul>
                )}
                <ul className="space-y-0.5">
                  {Object.entries(shares).map(([p, v]) => (
                    <li key={p} className="flex justify-between tabular"><span>{name(p)}{e.split.method === "percentage" ? ` (${e.split.percents[p]}%)` : ""}</span><span>{formatMoney(v, group.baseCurrency)}</span></li>
                  ))}
                </ul>
                {e.notes && <p className="italic">{e.notes}</p>}
                {e.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {e.attachments.map((a, i) => <a key={i} href={a.dataUrl} download={a.name} target="_blank" rel="noreferrer" className="rounded-full bg-card px-3 py-1 text-xs underline">{a.name}</a>)}
                  </div>
                )}
                {onEdit && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => onEdit(e)}><Pencil /> Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => confirm(`Delete "${e.description}"?`) && remove.mutate(e.id)}><Trash2 /> Delete</Button>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Balances({ group, members, balances, settlements, meId }: { group: Group; members: User[]; balances: Record<string, number>; settlements: { id: string; fromId: string; toId: string; amount: number; date: string; note?: string }[]; meId: string }) {
  const name = nameIn(members);
  const payments = simplifyDebts(balances);
  const [from, setFrom] = useState(meId);
  const [to, setTo] = useState(members.find((m) => m.id !== meId)?.id ?? "");
  const [amt, setAmt] = useState("");
  const settle = useAction((p: { fromId: string; toId: string; amount: number }) => api().settlements.create(group.id, { ...p, date: todayISO() }), "Payment recorded");
  const fmt = (v: number) => formatMoney(v, group.baseCurrency);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Where everyone stands</h2>
        <ul className="divide-y rounded-lg border bg-card shadow-ledger">
          {group.memberIds.map((m) => (
            <li key={m} className="flex justify-between p-3">
              <span>{name(m)}{m === meId && " (you)"}</span>
              <span className={`tabular font-semibold ${(balances[m] ?? 0) < 0 ? "text-owe" : (balances[m] ?? 0) > 0 ? "text-owed" : "text-muted-foreground"}`}>
                {(() => { const b = balances[m] ?? 0; return b === 0 ? "settled" : b > 0 ? `gets back ${fmt(b)}` : `owes ${fmt(-b)}`; })()}
              </span>
            </li>
          ))}
        </ul>
        <h2 className="pt-2 text-xl font-semibold">Fewest payments to settle</h2>
        {payments.length === 0 ? <p className="text-muted-foreground">Everyone's square.</p> : (
          <ul className="space-y-2">
            {payments.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3">
                <span className="flex items-center gap-2 text-sm">{name(p.fromId)} <ArrowRight className="size-4" /> {name(p.toId)}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular font-semibold">{fmt(p.amount)}</span>
                  {!group.archived && <Button size="sm" variant="outline" onClick={() => settle.mutate(p)}>Mark paid</Button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        {!group.archived && (
          <>
            <h2 className="text-xl font-semibold">Record a payment</h2>
            <form className="space-y-2 rounded-lg border bg-card p-4" onSubmit={(e) => { e.preventDefault(); const amount = parseMoney(amt); if (!amount) { toast.error("Enter an amount"); return; } settle.mutate({ fromId: from, toId: to, amount }); setAmt(""); }}>
              <div className="grid grid-cols-2 gap-2">
                <NativeSelect value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Who paid">{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</NativeSelect>
                <NativeSelect value={to} onChange={(e) => setTo(e.target.value)} aria-label="Paid to">{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</NativeSelect>
              </div>
              <div className="flex gap-2"><Input inputMode="decimal" placeholder={`Amount (${group.baseCurrency})`} value={amt} onChange={(e) => setAmt(e.target.value)} /><Button>Record</Button></div>
            </form>
          </>
        )}
        <h2 className="text-xl font-semibold">Payment history</h2>
        {settlements.length === 0 ? <p className="text-muted-foreground">No payments recorded.</p> : (
          <ul className="divide-y rounded-lg border bg-card">
            {settlements.map((s) => <li key={s.id} className="flex justify-between p-3 text-sm"><span>{s.date} · {name(s.fromId)} paid {name(s.toId)}</span><span className="tabular font-semibold">{fmt(s.amount)}</span></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}

function Recurring({ group, members }: { group: Group; members: User[] }) {
  const q = useQuery({ queryKey: ["recurring", group.id], queryFn: () => api().recurring.list(group.id) });
  const setActive = useAction(({ id, v }: { id: string; v: boolean }) => api().recurring.setActive(id, v));
  const remove = useAction((id: string) => api().recurring.remove(id), "Stopped repeating");
  const name = nameIn(members);
  if (!q.data?.length) return <p className="py-8 text-center text-muted-foreground">No repeating expenses. Tick "Repeat automatically" when adding an expense.</p>;
  return (
    <ul className="divide-y rounded-lg border bg-card shadow-ledger">
      {q.data.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-semibold">{r.template.description} · {formatMoney(r.template.amount, r.template.currency)}</p>
            <p className="text-sm text-muted-foreground">{r.frequency}, paid by {name(r.template.paidBy)} · next {r.active ? r.nextDate : "paused"}</p>
          </div>
          {!group.archived && (
            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-2">Active <Switch checked={r.active} onCheckedChange={(v) => setActive.mutate({ id: r.id, v })} /></label>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)}><Trash2 /> Stop</Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function Members({ group, members }: { group: Group; members: User[] }) {
  const [email, setEmail] = useState("");
  const invite = useAction((e: string) => api().groups.inviteByEmail(group.id, e), "Invitation sent");
  const invites = useQuery({ queryKey: ["invites", group.id], queryFn: () => api().groups.invites(group.id) });
  const toggleAuto = useAction((v: boolean) => api().groups.update(group.id, { autoArchive: v }));
  const link = typeof window !== "undefined" ? `${window.location.origin}/join/${group.joinCode}` : "";
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Copied"));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Members</h2>
        <ul className="divide-y rounded-lg border bg-card shadow-ledger">
          {members.map((m) => <li key={m.id} className="p-3"><p className="font-medium">{m.name}</p><p className="text-sm text-muted-foreground">{m.email}</p></li>)}
          {invites.data?.map((i) => <li key={i.id} className="p-3 text-sm text-muted-foreground">{i.email} · invited, joins when they sign up</li>)}
        </ul>
        <p className="text-sm text-muted-foreground">Everyone in the group can add, edit and delete expenses.</p>
      </section>
      {!group.archived && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Invite people</h2>
          <div className="space-y-2 rounded-lg border bg-card p-4">
            <p className="text-sm font-medium">Join code</p>
            <div className="flex items-center gap-2"><span className="font-display text-3xl font-bold tracking-widest text-primary">{group.joinCode}</span><Button size="icon" variant="ghost" aria-label="Copy code" onClick={() => copy(group.joinCode)}><Copy /></Button></div>
            <p className="pt-2 text-sm font-medium">Invitation link</p>
            <div className="flex gap-2"><Input readOnly value={link} /><Button variant="outline" onClick={() => copy(link)}><Copy /> Copy</Button></div>
            <p className="pt-2 text-sm font-medium">Invite by email</p>
            <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); await invite.mutateAsync(email); setEmail(""); }}>
              <Input type="email" placeholder="friend@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required /><Button>Invite</Button>
            </form>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 text-sm">
            Archive automatically once everyone is settled up
            <Switch checked={group.autoArchive} onCheckedChange={(v) => toggleAuto.mutate(v)} />
          </label>
        </section>
      )}
    </div>
  );
}
