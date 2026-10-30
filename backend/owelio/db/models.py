from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class UserRow(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))


class GroupRow(Base):
    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(32))
    base_currency: Mapped[str] = mapped_column(String(8))
    join_code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_archive: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"))
    created_at: Mapped[str] = mapped_column(String(32))

    memberships: Mapped[list[GroupMemberRow]] = relationship(back_populates="group")


class GroupMemberRow(Base):
    __tablename__ = "group_members"

    group_id: Mapped[str] = mapped_column(String(64), ForeignKey("groups.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), primary_key=True)

    group: Mapped[GroupRow] = relationship(back_populates="memberships")


class ExpenseRow(Base):
    __tablename__ = "expenses"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    group_id: Mapped[str] = mapped_column(String(64), ForeignKey("groups.id"), index=True)
    description: Mapped[str] = mapped_column(String(512))
    amount: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(8))
    exchange_rate: Mapped[float]
    date: Mapped[str] = mapped_column(String(16))
    category: Mapped[str] = mapped_column(String(128))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachments_json: Mapped[str] = mapped_column(Text, default="[]")
    paid_by: Mapped[str] = mapped_column(String(64))
    participant_ids_json: Mapped[str] = mapped_column(Text)
    split_json: Mapped[str] = mapped_column(Text)
    created_by: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[str] = mapped_column(String(32))
    recurring_id: Mapped[str | None] = mapped_column(String(64), nullable=True)


class SettlementRow(Base):
    __tablename__ = "settlements"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    group_id: Mapped[str] = mapped_column(String(64), ForeignKey("groups.id"), index=True)
    from_id: Mapped[str] = mapped_column(String(64))
    to_id: Mapped[str] = mapped_column(String(64))
    amount: Mapped[int] = mapped_column(Integer)
    date: Mapped[str] = mapped_column(String(16))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(64))


class RecurringExpenseRow(Base):
    __tablename__ = "recurring_expenses"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    group_id: Mapped[str] = mapped_column(String(64), ForeignKey("groups.id"), index=True)
    template_json: Mapped[str] = mapped_column(Text)
    frequency: Mapped[str] = mapped_column(String(16))
    next_date: Mapped[str] = mapped_column(String(16))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[str] = mapped_column(String(64))


class NotificationRow(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), index=True)
    group_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(32))
    read: Mapped[bool] = mapped_column(Boolean, default=False)


class EmailInviteRow(Base):
    __tablename__ = "email_invites"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    group_id: Mapped[str] = mapped_column(String(64), ForeignKey("groups.id"), index=True)
    email: Mapped[str] = mapped_column(String(320))
    invited_by: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[str] = mapped_column(String(32))

    __table_args__ = (UniqueConstraint("group_id", "email", name="uq_invite_group_email"),)
