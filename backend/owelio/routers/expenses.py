from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from owelio.auth.deps import get_store, require_user
from owelio.models import Expense, ExpenseInput, User
from owelio.routers._helpers import run_store
from owelio.store.service import Store

router = APIRouter(tags=["expenses"])


@router.get("/groups/{group_id}/expenses", response_model=list[Expense])
def expenses_list(
    group_id: str,
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> list[Expense]:
    return run_store(lambda: store.expenses_list(user.id, group_id))


@router.post("/groups/{group_id}/expenses", response_model=Expense, status_code=201)
def expenses_create(
    group_id: str,
    body: ExpenseInput,
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> Expense:
    return run_store(lambda: store.expenses_create(user.id, group_id, body))


@router.patch("/expenses/{expense_id}", response_model=Expense)
def expenses_update(
    expense_id: str,
    body: ExpenseInput,
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> Expense:
    return run_store(lambda: store.expenses_update(user.id, expense_id, body))


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def expenses_delete(
    expense_id: str,
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> Response:
    run_store(lambda: store.expenses_delete(user.id, expense_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
