from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta

from owelio.models.schemas import Expense, ExpenseInput, Id, Settlement, Split


def allocate(total: int, weights: dict[Id, int]) -> dict[Id, int]:
    keys = [k for k, w in weights.items() if w > 0]
    result: dict[Id, int] = {}
    s = sum(weights[k] for k in keys)
    if not keys or s <= 0:
        return result
    raw = [(k, (total * weights[k]) / s) for k in keys]
    assigned = 0
    for k, exact in raw:
        result[k] = int(exact // 1)
        assigned += result[k]
    remainder = total - assigned
    order = sorted(
        enumerate(raw),
        key=lambda t: (-(t[1][1] - int(t[1][1] // 1)), t[0]),
    )
    j = 0
    while remainder > 0 and order:
        k = order[j % len(order)][1][0]
        result[k] = result.get(k, 0) + 1
        remainder -= 1
        j += 1
    return result


def to_base(amount: int, rate: float) -> int:
    return round(amount * rate)


def validate_split(amount: int, participants: list[Id], split: Split) -> str | None:
    if split.method == "equal":
        return None
    if split.method == "custom":
        sm = sum(split.amounts.get(p, 0) for p in participants)
        if any(split.amounts.get(p, 0) < 0 for p in participants):
            return "Amounts can't be negative"
        if sm != amount:
            return f"Custom amounts add up to {sm / 100:.2f}, not {amount / 100:.2f}"
        return None
    if split.method == "percentage":
        sm = sum(split.percents.get(p, 0) for p in participants)
        if any(split.percents.get(p, 0) < 0 for p in participants):
            return "Percentages can't be negative"
        if abs(sm - 100) > 0.001:
            return f"Percentages add up to {sm:.3f}%, not 100%"
        return None
    if split.method == "itemised":
        if not split.items:
            return "Add at least one item"
        for it in split.items:
            if it.amount <= 0:
                return f'Item "{it.name or "unnamed"}" needs an amount'
            if not it.participantIds:
                return f'Assign item "{it.name or "unnamed"}" to someone'
            if any(p not in participants for p in it.participantIds):
                return f'Item "{it.name or "unnamed"}" is assigned to someone not included'
        sm = sum(i.amount for i in split.items)
        if sm != amount:
            return f"Items add up to {sm / 100:.2f}, not {amount / 100:.2f}"
        return None
    return "Unknown split method"


def validate_expense(e: ExpenseInput) -> str | None:
    if not e.description.strip():
        return "Add a description"
    if not isinstance(e.amount, int) or e.amount <= 0:
        return "Amount must be more than zero"
    if not (e.exchangeRate > 0):
        return "Exchange rate must be more than zero"
    if not e.participantIds:
        return "Choose at least one person to include"
    return validate_split(e.amount, e.participantIds, e.split)


def split_weights(e: ExpenseInput) -> dict[Id, int]:
    w: dict[Id, int] = {}
    s = e.split
    if s.method == "equal":
        for p in e.participantIds:
            w[p] = 1
    elif s.method == "custom":
        for p in e.participantIds:
            w[p] = s.amounts.get(p, 0)
    elif s.method == "percentage":
        for p in e.participantIds:
            w[p] = int(s.percents.get(p, 0))
    elif s.method == "itemised":
        for item in s.items:
            per = allocate(item.amount, {p: 1 for p in item.participantIds})
            for p, v in per.items():
                w[p] = w.get(p, 0) + v
    return w


def compute_shares(e: ExpenseInput) -> dict[Id, int]:
    return allocate(to_base(e.amount, e.exchangeRate), split_weights(e))


def compute_balances(
    member_ids: list[Id],
    expenses: list[Expense],
    settlements: list[Settlement],
) -> dict[Id, int]:
    net = {m: 0 for m in member_ids}
    for e in expenses:
        net[e.paidBy] = net.get(e.paidBy, 0) + to_base(e.amount, e.exchangeRate)
        for p, share in compute_shares(e).items():
            net[p] = net.get(p, 0) - share
    for s in settlements:
        net[s.fromId] = net.get(s.fromId, 0) + s.amount
        net[s.toId] = net.get(s.toId, 0) - s.amount
    return net


def add_interval(d: str, freq: str, anchor_day: int | None = None) -> str:
    y, m, day = (int(x) for x in d.split("-"))
    if freq in ("daily", "weekly"):
        dt = date(y, m, day) + timedelta(days=1 if freq == "daily" else 7)
        return dt.isoformat()
    anchor = anchor_day if anchor_day is not None else day
    if m == 12:
        ny, nm = y + 1, 1
    else:
        ny, nm = y, m + 1
    last = monthrange(ny, nm)[1]
    return date(ny, nm, min(anchor, last)).isoformat()
