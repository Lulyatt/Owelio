from owelio.models.schemas import ExpenseInput, SplitCustom, SplitEqual
from owelio.store.money import compute_balances, validate_expense


def test_validate_expense_equal() -> None:
    inp = ExpenseInput(
        description="Dinner",
        amount=1000,
        currency="GBP",
        exchangeRate=1,
        date="2026-10-01",
        category="Food & drink",
        attachments=[],
        paidBy="a",
        participantIds=["a", "b"],
        split=SplitEqual(method="equal"),
    )
    assert validate_expense(inp) is None


def test_validate_custom_split_mismatch() -> None:
    inp = ExpenseInput(
        description="Dinner",
        amount=1000,
        currency="GBP",
        exchangeRate=1,
        date="2026-10-01",
        category="Food & drink",
        attachments=[],
        paidBy="a",
        participantIds=["a"],
        split=SplitCustom(method="custom", amounts={"a": 1}),
    )
    assert validate_expense(inp) is not None


def test_compute_balances_equal_split() -> None:
    from owelio.models.schemas import Expense

    exps = [
        Expense(
            description="x",
            amount=3000,
            currency="GBP",
            exchangeRate=1,
            date="2026-10-01",
            category="Other",
            attachments=[],
            paidBy="a",
            participantIds=["a", "b"],
            split=SplitEqual(method="equal"),
            id="e1",
            groupId="g",
            createdBy="a",
            createdAt="t",
        )
    ]
    bal = compute_balances(["a", "b"], exps, [])
    assert bal["a"] == 1500
    assert bal["b"] == -1500
