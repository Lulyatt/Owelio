import { useMemo, useState } from "react";
import { Paperclip, Plus, Trash2, X } from "lucide-react";
import { computeShares, formatMoney, parseMoney, toBase, validateExpense } from "@/domain/money";
import { CATEGORIES, type Attachment, type ExpenseInput, type Frequency, type Group, type SplitItem, type SplitMethod, type User } from "@/domain/types";
import { CURRENCIES, todayISO } from "@/lib/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/NativeSelect";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const minorToStr = (m: number) => (m ? (m / 100).toFixed(2) : "");

export interface ExpenseFormResult {
  input: ExpenseInput;
  recurring?: { frequency: Frequency } | undefined;
}

export function ExpenseForm({ group, members, meId, initial, allowRecurring, onSubmit, busy }: {
  group: Group;
  members: User[];
  meId: string;
  initial?: ExpenseInput | undefined;
  allowRecurring?: boolean;
  busy?: boolean;
  onSubmit: (r: ExpenseFormResult) => void;
}) {
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amountStr, setAmountStr] = useState(minorToStr(initial?.amount ?? 0));
  const [currency, setCurrency] = useState(initial?.currency ?? group.baseCurrency);
  const [rateStr, setRateStr] = useState(String(initial?.exchangeRate ?? 1));
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [category, setCategory] = useState(initial?.category ?? "Other");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>(initial?.attachments ?? []);
  const [paidBy, setPaidBy] = useState(initial?.paidBy ?? meId);
  const [participants, setParticipants] = useState<string[]>(initial?.participantIds ?? []);
  const [method, setMethod] = useState<SplitMethod>(initial?.split.method ?? "equal");
  const [custom, setCustom] = useState<Record<string, string>>(
    initial?.split.method === "custom" ? Object.fromEntries(Object.entries(initial.split.amounts).map(([k, v]) => [k, minorToStr(v)])) : {},
  );
  const [percents, setPercents] = useState<Record<string, string>>(
    initial?.split.method === "percentage" ? Object.fromEntries(Object.entries(initial.split.percents).map(([k, v]) => [k, String(v)])) : {},
  );
  const [items, setItems] = useState<(Omit<SplitItem, "amount"> & { amountStr: string })[]>(
    initial?.split.method === "itemised" ? initial.split.items.map((i) => ({ ...i, amountStr: minorToStr(i.amount) })) : [],
  );
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("monthly");

  const isBase = currency === group.baseCurrency;
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "?";

  const input: ExpenseInput = useMemo(() => {
    const split =
      method === "equal" ? { method } :
      method === "custom" ? { method, amounts: Object.fromEntries(participants.map((p) => [p, parseMoney(custom[p] ?? "0") || 0])) } :
      method === "percentage" ? { method, percents: Object.fromEntries(participants.map((p) => [p, parseFloat(percents[p] ?? "0") || 0])) } :
      { method, items: items.map(({ amountStr, ...i }) => ({ ...i, amount: parseMoney(amountStr) || 0 })) };
    const itemTotal = method === "itemised" ? items.reduce((s, i) => s + (parseMoney(i.amountStr) || 0), 0) : 0;
    return {
      description, currency, date, category, notes, attachments, paidBy,
      amount: method === "itemised" ? itemTotal : parseMoney(amountStr),
      exchangeRate: isBase ? 1 : parseFloat(rateStr),
      participantIds: participants,
      split,
    } as ExpenseInput;
  }, [description, amountStr, currency, rateStr, date, category, notes, attachments, paidBy, participants, method, custom, percents, items, isBase]);

  const error = validateExpense(input);
  const shares = !error ? computeShares(input) : null;

  const toggle = (id: string) => setParticipants((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      if (f.size > 1_500_000) { alert(`${f.name} is over 1.5 MB`); continue; }
      const dataUrl = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f); });
      setAttachments((a) => [...a, { name: f.name, type: f.type, dataUrl }]);
    }
  };

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (!error) onSubmit({ input, recurring: recurring ? { frequency } : undefined }); }}>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <div className="space-y-1.5"><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Dinner at Rosa's" /></div>
        <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Amount</Label>
          <Input inputMode="decimal" value={method === "itemised" ? minorToStr(input.amount) : amountStr} disabled={method === "itemised"} onChange={(e) => setAmountStr(e.target.value)} placeholder="0.00" />
        </div>
        <div className="space-y-1.5"><Label>Currency</Label>
          <NativeSelect value={currency} onChange={(e) => { setCurrency(e.target.value); if (e.target.value === group.baseCurrency) setRateStr("1"); }}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-1.5"><Label>Category</Label>
          <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</NativeSelect>
        </div>
      </div>

      {!isBase && (
        <div className="rounded-md border border-dashed bg-muted p-3">
          <Label>Exchange rate</Label>
          <div className="mt-1.5 flex items-center gap-2 text-sm">
            1 {currency} = <Input className="w-28" inputMode="decimal" value={rateStr} onChange={(e) => setRateStr(e.target.value)} /> {group.baseCurrency}
            {input.amount > 0 && input.exchangeRate > 0 && <span className="text-muted-foreground">→ {formatMoney(toBase(input.amount, input.exchangeRate), group.baseCurrency)}</span>}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Paid by</Label>
          <NativeSelect value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>{members.map((m) => <option key={m.id} value={m.id}>{m.id === meId ? `${m.name} (you)` : m.name}</option>)}</NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label>Who's included?</Label>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <label key={m.id} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm ${participants.includes(m.id) ? "border-primary bg-secondary" : ""}`}>
                <Checkbox checked={participants.includes(m.id)} onCheckedChange={() => toggle(m.id)} />{m.name}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Label>How to split</Label>
        <ToggleGroup type="single" variant="outline" value={method} onValueChange={(v) => v && setMethod(v as SplitMethod)} className="w-full">
          <ToggleGroupItem value="equal" className="flex-1">Equally</ToggleGroupItem>
          <ToggleGroupItem value="custom" className="flex-1">Amounts</ToggleGroupItem>
          <ToggleGroupItem value="percentage" className="flex-1">Percent</ToggleGroupItem>
          <ToggleGroupItem value="itemised" className="flex-1">Items</ToggleGroupItem>
        </ToggleGroup>

        {(method === "custom" || method === "percentage") && (
          <div className="space-y-2">
            {participants.map((p) => (
              <div key={p} className="flex items-center gap-3">
                <span className="flex-1 text-sm">{nameOf(p)}</span>
                <Input className="w-28" inputMode="decimal" placeholder={method === "custom" ? "0.00" : "0"}
                  value={(method === "custom" ? custom : percents)[p] ?? ""}
                  onChange={(e) => (method === "custom" ? setCustom : setPercents)((s) => ({ ...s, [p]: e.target.value }))} />
                <span className="w-10 text-sm text-muted-foreground">{method === "custom" ? currency : "%"}</span>
              </div>
            ))}
          </div>
        )}

        {method === "itemised" && (
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={it.id} className="space-y-2 rounded-md border p-3">
                <div className="flex gap-2">
                  <Input placeholder="Item" value={it.name} onChange={(e) => setItems((s) => s.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} />
                  <Input className="w-28" inputMode="decimal" placeholder="0.00" value={it.amountStr} onChange={(e) => setItems((s) => s.map((x, i) => (i === idx ? { ...x, amountStr: e.target.value } : x)))} />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove item" onClick={() => setItems((s) => s.filter((_, i) => i !== idx))}><Trash2 /></Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {participants.map((p) => (
                    <label key={p} className="flex items-center gap-1.5 text-sm">
                      <Checkbox checked={it.participantIds.includes(p)} onCheckedChange={() => setItems((s) => s.map((x, i) => i === idx ? { ...x, participantIds: x.participantIds.includes(p) ? x.participantIds.filter((y) => y !== p) : [...x.participantIds, p] } : x))} />
                      {nameOf(p)}
                    </label>
                  ))}
                  {participants.length === 0 && <span className="text-sm text-muted-foreground">Choose who's included first</span>}
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setItems((s) => [...s, { id: crypto.randomUUID(), name: "", amountStr: "", participantIds: [...participants] }])}><Plus /> Add item</Button>
          </div>
        )}
      </div>

      <div className="rounded-md bg-secondary p-3 text-sm">
        <p className="mb-1 font-semibold">Breakdown</p>
        {shares ? (
          <ul className="space-y-0.5">
            {Object.entries(shares).map(([p, v]) => (
              <li key={p} className="flex justify-between tabular"><span>{nameOf(p)}</span><span>{formatMoney(v, group.baseCurrency)}</span></li>
            ))}
          </ul>
        ) : <p className="text-muted-foreground">{error}</p>}
      </div>

      <div className="space-y-1.5"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>

      <div className="space-y-2">
        <Label className="flex w-fit cursor-pointer items-center gap-2"><Paperclip className="size-4" /> Attach receipts or documents
          <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => addFiles(e.target.files)} />
        </Label>
        <div className="flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">
              {a.name}<button type="button" aria-label={`Remove ${a.name}`} onClick={() => setAttachments((s) => s.filter((_, j) => j !== i))}><X className="size-3" /></button>
            </span>
          ))}
        </div>
      </div>

      {allowRecurring && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={recurring} onCheckedChange={(v) => setRecurring(!!v)} /> Repeat automatically</label>
          {recurring && (
            <NativeSelect className="w-36" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
              <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
            </NativeSelect>
          )}
          {recurring && <span className="text-muted-foreground">starting {date}</span>}
        </div>
      )}

      <Button className="w-full" disabled={!!error || busy}>{initial ? "Save changes" : "Add expense"}</Button>
    </form>
  );
}
