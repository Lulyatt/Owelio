from __future__ import annotations

import json

from owelio.db.models import (
    EmailInviteRow,
    ExpenseRow,
    GroupMemberRow,
    GroupRow,
    NotificationRow,
    RecurringExpenseRow,
    SettlementRow,
    UserRow,
)
from owelio.models.schemas import (
    AppNotification,
    EmailInvite,
    Expense,
    ExpenseInput,
    Group,
    RecurringExpense,
    Settlement,
    User,
)


def user_public(row: UserRow) -> User:
    return User(id=row.id, name=row.name, email=row.email)


def group_schema(row: GroupRow, member_ids: list[str]) -> Group:
    return Group(
        id=row.id,
        name=row.name,
        kind=row.kind,  # type: ignore[arg-type]
        baseCurrency=row.base_currency,
        memberIds=member_ids,
        joinCode=row.join_code,
        archived=row.archived,
        autoArchive=row.auto_archive,
        createdBy=row.created_by,
        createdAt=row.created_at,
    )


def expense_schema(row: ExpenseRow) -> Expense:
    data = {
        "description": row.description,
        "amount": row.amount,
        "currency": row.currency,
        "exchangeRate": row.exchange_rate,
        "date": row.date,
        "category": row.category,
        "notes": row.notes or "",
        "attachments": json.loads(row.attachments_json or "[]"),
        "paidBy": row.paid_by,
        "participantIds": json.loads(row.participant_ids_json),
        "split": json.loads(row.split_json),
    }
    inp = ExpenseInput.model_validate(data)
    return Expense(
        **inp.model_dump(),
        id=row.id,
        groupId=row.group_id,
        createdBy=row.created_by,
        createdAt=row.created_at,
        recurringId=row.recurring_id,
    )


def expense_row_from_input(
    expense_id: str,
    group_id: str,
    inp: ExpenseInput,
    created_by: str,
    created_at: str,
    recurring_id: str | None = None,
) -> ExpenseRow:
    d = inp.model_dump()
    return ExpenseRow(
        id=expense_id,
        group_id=group_id,
        description=d["description"],
        amount=d["amount"],
        currency=d["currency"],
        exchange_rate=d["exchangeRate"],
        date=d["date"],
        category=d["category"],
        notes=d.get("notes") or "",
        attachments_json=json.dumps(d["attachments"]),
        paid_by=d["paidBy"],
        participant_ids_json=json.dumps(d["participantIds"]),
        split_json=json.dumps(d["split"]),
        created_by=created_by,
        created_at=created_at,
        recurring_id=recurring_id,
    )


def settlement_schema(row: SettlementRow) -> Settlement:
    return Settlement(
        id=row.id,
        groupId=row.group_id,
        fromId=row.from_id,
        toId=row.to_id,
        amount=row.amount,
        date=row.date,
        note=row.note,
        createdBy=row.created_by,
    )


def recurring_schema(row: RecurringExpenseRow) -> RecurringExpense:
    template = ExpenseInput.model_validate(json.loads(row.template_json))
    return RecurringExpense(
        id=row.id,
        groupId=row.group_id,
        template=template,
        frequency=row.frequency,  # type: ignore[arg-type]
        nextDate=row.next_date,
        active=row.active,
        createdBy=row.created_by,
    )


def notification_schema(row: NotificationRow) -> AppNotification:
    return AppNotification(
        id=row.id,
        userId=row.user_id,
        groupId=row.group_id,
        message=row.message,
        createdAt=row.created_at,
        read=row.read,
    )


def invite_schema(row: EmailInviteRow) -> EmailInvite:
    return EmailInvite(
        id=row.id,
        groupId=row.group_id,
        email=row.email,
        invitedBy=row.invited_by,
        createdAt=row.created_at,
    )


def member_ids_for_group(rows: list[GroupMemberRow]) -> list[str]:
    return [r.user_id for r in rows]
