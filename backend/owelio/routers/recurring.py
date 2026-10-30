from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from owelio.auth.deps import get_store, require_user
from owelio.models import CreateRecurringExpenseRequest, RecurringExpense, SetRecurringActiveRequest, User
from owelio.routers._helpers import run_store
from owelio.store.service import Store

router = APIRouter(tags=["recurring"])


@router.get("/groups/{group_id}/recurring-expenses", response_model=list[RecurringExpense])
def recurring_list(
    group_id: str,
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> list[RecurringExpense]:
    return run_store(lambda: store.recurring_list(user.id, group_id))


@router.post("/groups/{group_id}/recurring-expenses", response_model=RecurringExpense, status_code=201)
def recurring_create(
    group_id: str,
    body: CreateRecurringExpenseRequest,
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> RecurringExpense:
    return run_store(lambda: store.recurring_create(user.id, group_id, body))


@router.patch("/recurring-expenses/{recurring_id}", response_model=RecurringExpense)
def recurring_set_active(
    recurring_id: str,
    body: SetRecurringActiveRequest,
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> RecurringExpense:
    return run_store(lambda: store.recurring_set_active(user.id, recurring_id, body.active))


@router.delete("/recurring-expenses/{recurring_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def recurring_delete(
    recurring_id: str,
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> Response:
    run_store(lambda: store.recurring_delete(user.id, recurring_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
