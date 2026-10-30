from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from owelio.auth.passwords import hash_password
from owelio.db.mappers import expense_row_from_input
from owelio.db.models import GroupMemberRow, GroupRow, UserRow
from owelio.models.schemas import ExpenseInput, SplitEqual, SplitItem, SplitItemised, SplitPercentage


def seed_database(session: Session) -> None:
    if session.scalar(select(UserRow).limit(1)) is not None:
        return

    t = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    pw = hash_password("password123")
    users = [
        UserRow(id="u_alex", name="Alex Morgan", email="alex@example.com", password_hash=pw),
        UserRow(id="u_sam", name="Sam Patel", email="sam@example.com", password_hash=pw),
        UserRow(id="u_jo", name="Jo Kim", email="jo@example.com", password_hash=pw),
    ]
    session.add_all(users)

    groups = [
        GroupRow(
            id="g_lisbon",
            name="Lisbon weekend",
            kind="temporary",
            base_currency="GBP",
            join_code="LISBON",
            archived=False,
            auto_archive=True,
            created_by="u_alex",
            created_at=t,
        ),
        GroupRow(
            id="g_flat",
            name="Flat 4B",
            kind="ongoing",
            base_currency="GBP",
            join_code="FLAT4B",
            archived=False,
            auto_archive=False,
            created_by="u_sam",
            created_at=t,
        ),
    ]
    session.add_all(groups)
    session.add_all(
        [
            GroupMemberRow(group_id="g_lisbon", user_id="u_alex"),
            GroupMemberRow(group_id="g_lisbon", user_id="u_sam"),
            GroupMemberRow(group_id="g_lisbon", user_id="u_jo"),
            GroupMemberRow(group_id="g_flat", user_id="u_alex"),
            GroupMemberRow(group_id="g_flat", user_id="u_sam"),
        ]
    )

    expenses = [
        expense_row_from_input(
            "e1",
            "g_lisbon",
            ExpenseInput(
                description="Flat",
                amount=36000,
                currency="GBP",
                exchangeRate=1,
                date="2026-10-10",
                category="Accommodation",
                notes="",
                attachments=[],
                paidBy="u_alex",
                participantIds=["u_alex", "u_sam", "u_jo"],
                split=SplitEqual(method="equal"),
            ),
            "u_alex",
            t,
        ),
        expense_row_from_input(
            "e2",
            "g_lisbon",
            ExpenseInput(
                description="Seafood dinner",
                amount=9600,
                currency="EUR",
                exchangeRate=0.85,
                date="2026-10-11",
                category="Food & drink",
                notes="",
                attachments=[],
                paidBy="u_sam",
                participantIds=["u_alex", "u_sam", "u_jo"],
                split=SplitItemised(
                    method="itemised",
                    items=[
                        SplitItem(
                            id="i1",
                            name="Shared platter",
                            amount=6000,
                            participantIds=["u_alex", "u_sam", "u_jo"],
                        ),
                        SplitItem(
                            id="i2",
                            name="Wine",
                            amount=3600,
                            participantIds=["u_alex", "u_sam"],
                        ),
                    ],
                ),
            ),
            "u_sam",
            t,
        ),
        expense_row_from_input(
            "e3",
            "g_flat",
            ExpenseInput(
                description="Electricity — October",
                amount=8400,
                currency="GBP",
                exchangeRate=1,
                date="2026-10-01",
                category="Utilities",
                notes="",
                attachments=[],
                paidBy="u_sam",
                participantIds=["u_alex", "u_sam"],
                split=SplitPercentage(method="percentage", percents={"u_alex": 60, "u_sam": 40}),
            ),
            "u_sam",
            t,
        ),
    ]
    session.add_all(expenses)
