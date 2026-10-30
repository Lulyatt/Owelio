from __future__ import annotations

import json
import random
import re
from collections.abc import Callable, Generator
from contextlib import contextmanager
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from owelio.auth.passwords import hash_password, verify_password
from owelio.auth.tokens import TokenStore
from owelio.db.engine import get_session_factory
from owelio.db.mappers import (
    expense_row_from_input,
    expense_schema,
    group_schema,
    invite_schema,
    notification_schema,
    recurring_schema,
    settlement_schema,
    user_public,
)
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
from owelio.errors import ApiError
from owelio.models.schemas import (
    AppNotification,
    CreateGroupRequest,
    CreateRecurringExpenseRequest,
    CreateSettlementRequest,
    CurrencyTotals,
    DashboardGroupRow,
    DashboardSummary,
    EmailInvite,
    Expense,
    ExpenseInput,
    Group,
    RecurringExpense,
    Settlement,
    UpdateGroupRequest,
    User,
)
from owelio.store.money import add_interval, compute_balances, validate_expense

_EMAIL_RE = re.compile(r"^\S+@\S+\.\S+$")
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


class Store:
    def __init__(
        self,
        session_factory: Callable[[], Session] | None = None,
        tokens: TokenStore | None = None,
    ) -> None:
        self._session_factory = session_factory or get_session_factory()
        self.tokens = tokens if tokens is not None else TokenStore()
        self._counter = 0

    @contextmanager
    def _db(self) -> Generator[Session, None, None]:
        session = self._session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    def _today(self) -> str:
        return datetime.now(timezone.utc).date().isoformat()

    def _uid(self, prefix: str) -> str:
        self._counter += 1
        return f"{prefix}_{int(datetime.now().timestamp() * 1000):x}{self._counter:x}{random.randint(0, 0xFFFF):04x}"

    def _join_code(self) -> str:
        return "".join(random.choice(_CODE_ALPHABET) for _ in range(6))

    def _member_ids(self, db: Session, group_id: str) -> list[str]:
        q = select(GroupMemberRow.user_id).where(GroupMemberRow.group_id == group_id)
        return list(db.scalars(q))

    def _group_schema(self, db: Session, row: GroupRow) -> Group:
        return group_schema(row, self._member_ids(db, row.id))

    def public_user(self, user_id: str) -> User:
        with self._db() as db:
            row = db.get(UserRow, user_id)
            if not row:
                raise ApiError("User not found", "not_found")
            return user_public(row)

    def _user_row(self, db: Session, user_id: str) -> UserRow:
        row = db.get(UserRow, user_id)
        if not row:
            raise ApiError("User not found", "not_found")
        return row

    def _require_user_row(self, db: Session, user_id: str | None) -> UserRow:
        if not user_id:
            raise ApiError("Please log in", "unauthenticated")
        return self._user_row(db, user_id)

    def _group_for(self, db: Session, user_id: str, group_id: str) -> Group:
        row = db.get(GroupRow, group_id)
        if not row:
            raise ApiError("Group not found", "not_found")
        g = self._group_schema(db, row)
        if user_id not in g.memberIds:
            raise ApiError("You're not a member of this group", "forbidden")
        return g

    def _writable_group(self, db: Session, user_id: str, group_id: str) -> Group:
        g = self._group_for(db, user_id, group_id)
        if g.archived:
            raise ApiError("This group is archived and read-only", "forbidden")
        return g

    def _add_member(self, db: Session, group_id: str, user_id: str) -> None:
        if user_id in self._member_ids(db, group_id):
            return
        db.add(GroupMemberRow(group_id=group_id, user_id=user_id))

    def _notify(self, db: Session, g: Group, message: str, except_id: str | None = None) -> None:
        for m in g.memberIds:
            if m == except_id:
                continue
            db.add(
                NotificationRow(
                    id=self._uid("n"),
                    user_id=m,
                    group_id=g.id,
                    message=message,
                    created_at=self._now_iso(),
                    read=False,
                )
            )

    def _check_expense(self, g: Group, inp: ExpenseInput) -> None:
        err = validate_expense(inp)
        if err:
            raise ApiError(err, "invalid")
        if inp.paidBy not in g.memberIds:
            raise ApiError("Payer must be a group member", "invalid")
        if any(p not in g.memberIds for p in inp.participantIds):
            raise ApiError("Everyone included must be a group member", "invalid")
        if inp.currency == g.baseCurrency and inp.exchangeRate != 1:
            raise ApiError("Exchange rate must be 1 for the group's own currency", "invalid")

    def _expenses_for_group(self, db: Session, group_id: str) -> list[Expense]:
        rows = db.scalars(select(ExpenseRow).where(ExpenseRow.group_id == group_id))
        return [expense_schema(r) for r in rows]

    def _settlements_for_group(self, db: Session, group_id: str) -> list[Settlement]:
        rows = db.scalars(select(SettlementRow).where(SettlementRow.group_id == group_id))
        return [settlement_schema(r) for r in rows]

    def _maybe_auto_archive(self, db: Session, g: Group) -> None:
        if not g.autoArchive or g.archived:
            return
        exps = self._expenses_for_group(db, g.id)
        if not exps:
            return
        bal = compute_balances(g.memberIds, exps, self._settlements_for_group(db, g.id))
        if all(v == 0 for v in bal.values()):
            row = db.get(GroupRow, g.id)
            if row:
                row.archived = True
            self._notify(db, g, f"{g.name} is all settled up and has been archived")

    def _accept_invites(self, db: Session, u: UserRow) -> None:
        invites = db.scalars(
            select(EmailInviteRow).where(EmailInviteRow.email.ilike(u.email)),
        ).all()
        for inv in invites:
            grow = db.get(GroupRow, inv.group_id)
            if not grow:
                continue
            g = self._group_schema(db, grow)
            if u.id not in g.memberIds:
                self._add_member(db, g.id, u.id)
                g = self._group_schema(db, grow)
                self._notify(db, g, f"{u.name} joined {g.name}", u.id)
                db.add(
                    NotificationRow(
                        id=self._uid("n"),
                        user_id=u.id,
                        group_id=g.id,
                        message=f"You were added to {g.name} by invitation",
                        created_at=self._now_iso(),
                        read=False,
                    )
                )
            db.delete(inv)

    def _run_recurring(self, db: Session) -> None:
        t = self._today()
        rows = db.scalars(select(RecurringExpenseRow)).all()
        for r in rows:
            if not r.active:
                continue
            grow = db.get(GroupRow, r.group_id)
            if not grow or grow.archived:
                continue
            g = self._group_schema(db, grow)
            anchor = int(r.next_date[8:10])
            guard = 0
            while r.next_date <= t and guard < 400:
                guard += 1
                template = ExpenseInput.model_validate(json.loads(r.template_json))
                template.date = r.next_date
                db.add(
                    expense_row_from_input(
                        self._uid("e"),
                        g.id,
                        template,
                        r.created_by,
                        self._now_iso(),
                        r.id,
                    )
                )
                self._notify(db, g, f'Recurring expense "{template.description}" was added for {r.next_date}')
                r.next_date = add_interval(
                    r.next_date,
                    r.frequency,
                    anchor if r.frequency == "monthly" else None,
                )

    # --- auth ---

    def current_user(self, user_id: str | None) -> User | None:
        if not user_id:
            return None
        with self._db() as db:
            row = db.get(UserRow, user_id)
            if not row:
                return None
            self._run_recurring(db)
            return user_public(row)

    def register(self, name: str, email: str, password: str) -> tuple[User, str]:
        with self._db() as db:
            if not name.strip():
                raise ApiError("Enter your name", "invalid")
            if not _EMAIL_RE.match(email):
                raise ApiError("Enter a valid email", "invalid")
            if len(password) < 8:
                raise ApiError("Password must be at least 8 characters", "invalid")
            exists = db.scalar(select(UserRow.id).where(UserRow.email.ilike(email.strip())))
            if exists:
                raise ApiError("An account with that email already exists", "conflict")
            u = UserRow(
                id=self._uid("u"),
                name=name.strip(),
                email=email.strip(),
                password_hash=hash_password(password),
            )
            db.add(u)
            db.flush()
            self._accept_invites(db, u)
            token = self.tokens.issue(u.id)
            return user_public(u), token

    def login(self, email: str, password: str) -> tuple[User, str]:
        with self._db() as db:
            row = db.scalar(select(UserRow).where(UserRow.email.ilike(email.lower().strip())))
            if not row or not verify_password(password, row.password_hash):
                raise ApiError("Email or password is incorrect", "unauthenticated")
            self._accept_invites(db, row)
            self._run_recurring(db)
            token = self.tokens.issue(row.id)
            return user_public(row), token

    def logout(self, token: str | None) -> None:
        self.tokens.revoke(token)

    # --- groups ---

    def groups_list(self, user_id: str) -> list[Group]:
        with self._db() as db:
            u = self._require_user_row(db, user_id)
            q = (
                select(GroupRow)
                .join(GroupMemberRow, GroupMemberRow.group_id == GroupRow.id)
                .where(GroupMemberRow.user_id == u.id)
            )
            return [self._group_schema(db, r) for r in db.scalars(q)]

    def groups_get(self, user_id: str, group_id: str) -> Group:
        with self._db() as db:
            self._require_user_row(db, user_id)
            return self._group_for(db, user_id, group_id)

    def groups_create(self, user_id: str, body: CreateGroupRequest) -> Group:
        with self._db() as db:
            u = self._require_user_row(db, user_id)
            if not body.name.strip():
                raise ApiError("Give the group a name", "invalid")
            auto = body.autoArchive if body.autoArchive is not None else body.kind == "temporary"
            row = GroupRow(
                id=self._uid("g"),
                name=body.name.strip(),
                kind=body.kind,
                base_currency=body.baseCurrency,
                join_code=self._join_code(),
                archived=False,
                auto_archive=auto,
                created_by=u.id,
                created_at=self._now_iso(),
            )
            db.add(row)
            db.flush()
            db.add(GroupMemberRow(group_id=row.id, user_id=u.id))
            return self._group_schema(db, row)

    def groups_update(self, user_id: str, group_id: str, patch: UpdateGroupRequest) -> Group:
        with self._db() as db:
            self._require_user_row(db, user_id)
            self._writable_group(db, user_id, group_id)
            row = db.get(GroupRow, group_id)
            assert row is not None
            data = patch.model_dump(exclude_unset=True)
            if not data:
                raise ApiError("Nothing to update", "invalid")
            if data.get("name") is not None:
                row.name = data["name"]
            if data.get("autoArchive") is not None:
                row.auto_archive = data["autoArchive"]
            return self._group_schema(db, row)

    def groups_set_archived(self, user_id: str, group_id: str, archived: bool) -> Group:
        with self._db() as db:
            u = self._require_user_row(db, user_id)
            g = self._group_for(db, user_id, group_id)
            row = db.get(GroupRow, group_id)
            assert row is not None
            row.archived = archived
            self._notify(db, g, f"{u.name} {'archived' if archived else 'reopened'} {g.name}", u.id)
            return self._group_schema(db, row)

    def groups_members(self, user_id: str, group_id: str) -> list[User]:
        with self._db() as db:
            self._require_user_row(db, user_id)
            g = self._group_for(db, user_id, group_id)
            users = db.scalars(select(UserRow).where(UserRow.id.in_(g.memberIds)))
            return [user_public(u) for u in users]

    def groups_join_by_code(self, user_id: str, code: str) -> Group:
        with self._db() as db:
            u = self._require_user_row(db, user_id)
            row = db.scalar(select(GroupRow).where(GroupRow.join_code == code.strip().upper()))
            if not row:
                raise ApiError("No group found for that code", "not_found")
            if row.archived:
                raise ApiError("That group is archived", "forbidden")
            g = self._group_schema(db, row)
            if u.id not in g.memberIds:
                self._add_member(db, row.id, u.id)
                g = self._group_schema(db, row)
                self._notify(db, g, f"{u.name} joined {g.name}", u.id)
            return g

    def groups_invite_by_email(self, user_id: str, group_id: str, email: str) -> EmailInvite:
        with self._db() as db:
            u = self._require_user_row(db, user_id)
            g = self._writable_group(db, user_id, group_id)
            if not _EMAIL_RE.match(email):
                raise ApiError("Enter a valid email", "invalid")
            inv = EmailInviteRow(
                id=self._uid("i"),
                group_id=g.id,
                email=email.strip(),
                invited_by=u.id,
                created_at=self._now_iso(),
            )
            existing = db.scalar(select(UserRow).where(UserRow.email.ilike(email.strip())))
            if existing:
                if existing.id not in g.memberIds:
                    self._add_member(db, g.id, existing.id)
                    g = self._group_for(db, user_id, group_id)
                    self._notify(db, g, f"{existing.name} was added to {g.name}")
            else:
                db.add(inv)
            return invite_schema(inv)

    def groups_invites(self, user_id: str, group_id: str) -> list[EmailInvite]:
        with self._db() as db:
            self._require_user_row(db, user_id)
            self._group_for(db, user_id, group_id)
            rows = db.scalars(select(EmailInviteRow).where(EmailInviteRow.group_id == group_id))
            return [invite_schema(r) for r in rows]

    # --- expenses ---

    def expenses_list(self, user_id: str, group_id: str) -> list[Expense]:
        with self._db() as db:
            self._require_user_row(db, user_id)
            self._group_for(db, user_id, group_id)
            rows = list(db.scalars(select(ExpenseRow).where(ExpenseRow.group_id == group_id)))
            rows.sort(key=lambda e: (e.date, e.created_at), reverse=True)
            return [expense_schema(r) for r in rows]

    def expenses_create(self, user_id: str, group_id: str, inp: ExpenseInput) -> Expense:
        with self._db() as db:
            u = self._require_user_row(db, user_id)
            g = self._writable_group(db, user_id, group_id)
            self._check_expense(g, inp)
            row = expense_row_from_input(
                self._uid("e"), group_id, inp, u.id, self._now_iso(),
            )
            db.add(row)
            self._notify(db, g, f'{u.name} added "{inp.description}"', u.id)
            return expense_schema(row)

    def expenses_update(self, user_id: str, expense_id: str, inp: ExpenseInput) -> Expense:
        with self._db() as db:
            u = self._require_user_row(db, user_id)
            row = db.get(ExpenseRow, expense_id)
            if not row:
                raise ApiError("Expense not found", "not_found")
            g = self._writable_group(db, user_id, row.group_id)
            self._check_expense(g, inp)
            updated = expense_row_from_input(
                row.id,
                row.group_id,
                inp,
                row.created_by,
                row.created_at,
                row.recurring_id,
            )
            db.merge(updated)
            self._notify(db, g, f'{u.name} edited "{inp.description}"', u.id)
            return expense_schema(updated)

    def expenses_delete(self, user_id: str, expense_id: str) -> None:
        with self._db() as db:
            u = self._require_user_row(db, user_id)
            row = db.get(ExpenseRow, expense_id)
            if not row:
                raise ApiError("Expense not found", "not_found")
            g = self._writable_group(db, user_id, row.group_id)
            desc = row.description
            db.delete(row)
            self._notify(db, g, f'{u.name} deleted "{desc}"', u.id)

    # --- settlements ---

    def settlements_list(self, user_id: str, group_id: str) -> list[Settlement]:
        with self._db() as db:
            self._require_user_row(db, user_id)
            self._group_for(db, user_id, group_id)
            rows = list(db.scalars(select(SettlementRow).where(SettlementRow.group_id == group_id)))
            rows.sort(key=lambda s: s.date, reverse=True)
            return [settlement_schema(r) for r in rows]

    def settlements_create(self, user_id: str, group_id: str, body: CreateSettlementRequest) -> Settlement:
        with self._db() as db:
            u = self._require_user_row(db, user_id)
            g = self._writable_group(db, user_id, group_id)
            if body.fromId == body.toId:
                raise ApiError("Choose two different people", "invalid")
            if body.fromId not in g.memberIds or body.toId not in g.memberIds:
                raise ApiError("Both people must be group members", "invalid")
            if not isinstance(body.amount, int) or body.amount <= 0:
                raise ApiError("Amount must be more than zero", "invalid")
            row = SettlementRow(
                id=self._uid("s"),
                group_id=group_id,
                from_id=body.fromId,
                to_id=body.toId,
                amount=body.amount,
                date=body.date,
                note=body.note,
                created_by=u.id,
            )
            db.add(row)

            def name(uid: str) -> str:
                ur = db.get(UserRow, uid)
                return ur.name if ur else "Someone"

            self._notify(db, g, f"{name(body.fromId)} paid {name(body.toId)} in {g.name}", u.id)
            g_after = self._group_for(db, user_id, group_id)
            self._maybe_auto_archive(db, g_after)
            return settlement_schema(row)

    # --- recurring ---

    def recurring_list(self, user_id: str, group_id: str) -> list[RecurringExpense]:
        with self._db() as db:
            self._require_user_row(db, user_id)
            self._group_for(db, user_id, group_id)
            rows = db.scalars(select(RecurringExpenseRow).where(RecurringExpenseRow.group_id == group_id))
            return [recurring_schema(r) for r in rows]

    def recurring_create(self, user_id: str, group_id: str, body: CreateRecurringExpenseRequest) -> RecurringExpense:
        with self._db() as db:
            u = self._require_user_row(db, user_id)
            g = self._writable_group(db, user_id, group_id)
            self._check_expense(g, body.template)
            row = RecurringExpenseRow(
                id=self._uid("r"),
                group_id=group_id,
                template_json=json.dumps(body.template.model_dump()),
                frequency=body.frequency,
                next_date=body.startDate,
                active=True,
                created_by=u.id,
            )
            db.add(row)
            self._run_recurring(db)
            return recurring_schema(row)

    def recurring_set_active(self, user_id: str, recurring_id: str, active: bool) -> RecurringExpense:
        with self._db() as db:
            self._require_user_row(db, user_id)
            row = db.get(RecurringExpenseRow, recurring_id)
            if not row:
                raise ApiError("Not found", "not_found")
            self._writable_group(db, user_id, row.group_id)
            row.active = active
            if active:
                self._run_recurring(db)
            return recurring_schema(row)

    def recurring_delete(self, user_id: str, recurring_id: str) -> None:
        with self._db() as db:
            self._require_user_row(db, user_id)
            row = db.get(RecurringExpenseRow, recurring_id)
            if not row:
                raise ApiError("Not found", "not_found")
            self._writable_group(db, user_id, row.group_id)
            db.delete(row)

    # --- notifications ---

    def notifications_list(self, user_id: str) -> list[AppNotification]:
        with self._db() as db:
            u = self._require_user_row(db, user_id)
            rows = list(db.scalars(select(NotificationRow).where(NotificationRow.user_id == u.id)))
            rows.sort(key=lambda n: n.created_at, reverse=True)
            return [notification_schema(r) for r in rows]

    def notifications_mark_all_read(self, user_id: str) -> None:
        with self._db() as db:
            u = self._require_user_row(db, user_id)
            rows = db.scalars(select(NotificationRow).where(NotificationRow.user_id == u.id))
            for n in rows:
                n.read = True

    # --- dashboard ---

    def dashboard_summary(self, user_id: str) -> DashboardSummary:
        with self._db() as db:
            u = self._require_user_row(db, user_id)
            group_rows = db.scalars(
                select(GroupRow)
                .join(GroupMemberRow, GroupMemberRow.group_id == GroupRow.id)
                .where(GroupMemberRow.user_id == u.id),
            ).all()
            by_currency: dict[str, CurrencyTotals] = {}
            rows: list[DashboardGroupRow] = []
            for grow in group_rows:
                g = self._group_schema(db, grow)
                bal = compute_balances(
                    g.memberIds,
                    self._expenses_for_group(db, g.id),
                    self._settlements_for_group(db, g.id),
                ).get(u.id, 0)
                c = by_currency.setdefault(g.baseCurrency, CurrencyTotals(youOwe=0, owedToYou=0))
                if bal < 0:
                    c.youOwe += -bal
                else:
                    c.owedToYou += bal
                rows.append(DashboardGroupRow(group=g, balance=bal))
            totals = list(by_currency.values())
            return DashboardSummary(
                youOwe=sum(t.youOwe for t in totals),
                owedToYou=sum(t.owedToYou for t in totals),
                groups=rows,
                byCurrency=by_currency,
            )
