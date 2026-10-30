from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Id = str


class User(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: Id
    name: str
    email: EmailStr


class AuthResponse(BaseModel):
    user: User
    access_token: str
    token_type: Literal["bearer"] = "bearer"


class CurrentUserResponse(BaseModel):
    user: User | None


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ErrorResponse(BaseModel):
    code: Literal["unauthenticated", "forbidden", "not_found", "invalid", "conflict"]
    message: str


GroupKind = Literal["temporary", "ongoing"]
Frequency = Literal["daily", "weekly", "monthly"]


class Group(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: Id
    name: str
    kind: GroupKind
    baseCurrency: str
    memberIds: list[Id]
    joinCode: str
    archived: bool
    autoArchive: bool
    createdBy: Id
    createdAt: str


class CreateGroupRequest(BaseModel):
    name: str
    kind: GroupKind
    baseCurrency: str
    autoArchive: bool | None = None


class UpdateGroupRequest(BaseModel):
    name: str | None = None
    autoArchive: bool | None = None


class SetArchivedRequest(BaseModel):
    archived: bool


class JoinGroupRequest(BaseModel):
    code: str


class InviteByEmailRequest(BaseModel):
    email: EmailStr


class EmailInvite(BaseModel):
    id: Id
    groupId: Id
    email: EmailStr
    invitedBy: Id
    createdAt: str


class Attachment(BaseModel):
    name: str
    type: str
    dataUrl: str


class SplitEqual(BaseModel):
    method: Literal["equal"]


class SplitCustom(BaseModel):
    method: Literal["custom"]
    amounts: dict[Id, int]


class SplitPercentage(BaseModel):
    method: Literal["percentage"]
    percents: dict[Id, float]


class SplitItem(BaseModel):
    id: Id
    name: str
    amount: int = Field(ge=1)
    participantIds: list[Id]


class SplitItemised(BaseModel):
    method: Literal["itemised"]
    items: list[SplitItem]


Split = Annotated[
    SplitEqual | SplitCustom | SplitPercentage | SplitItemised,
    Field(discriminator="method"),
]


class ExpenseInput(BaseModel):
    description: str
    amount: int = Field(ge=1)
    currency: str
    exchangeRate: float = Field(gt=0)
    date: str
    category: str
    notes: str | None = None
    attachments: list[Attachment]
    paidBy: Id
    participantIds: list[Id] = Field(min_length=1)
    split: Split


class Expense(ExpenseInput):
    id: Id
    groupId: Id
    createdBy: Id
    createdAt: str
    recurringId: Id | None = None


class RecurringExpense(BaseModel):
    id: Id
    groupId: Id
    template: ExpenseInput
    frequency: Frequency
    nextDate: str
    active: bool
    createdBy: Id


class CreateRecurringExpenseRequest(BaseModel):
    template: ExpenseInput
    frequency: Frequency
    startDate: str


class SetRecurringActiveRequest(BaseModel):
    active: bool


class Settlement(BaseModel):
    id: Id
    groupId: Id
    fromId: Id
    toId: Id
    amount: int = Field(ge=1)
    date: str
    note: str | None = None
    createdBy: Id


class CreateSettlementRequest(BaseModel):
    fromId: Id
    toId: Id
    amount: int = Field(ge=1)
    date: str
    note: str | None = None


class AppNotification(BaseModel):
    id: Id
    userId: Id
    groupId: Id | None = None
    message: str
    createdAt: str
    read: bool


class CurrencyTotals(BaseModel):
    youOwe: int
    owedToYou: int


class DashboardGroupRow(BaseModel):
    group: Group
    balance: int


class DashboardSummary(BaseModel):
    youOwe: int
    owedToYou: int
    groups: list[DashboardGroupRow]
    byCurrency: dict[str, CurrencyTotals]
