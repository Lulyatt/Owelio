from typing import Annotated

from fastapi import APIRouter, Depends

from owelio.auth.deps import get_store, require_user
from owelio.models import CreateSettlementRequest, Settlement, User
from owelio.routers._helpers import run_store
from owelio.store.service import Store

router = APIRouter(tags=["settlements"])


@router.get("/groups/{group_id}/settlements", response_model=list[Settlement])
def settlements_list(
    group_id: str,
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> list[Settlement]:
    return run_store(lambda: store.settlements_list(user.id, group_id))


@router.post("/groups/{group_id}/settlements", response_model=Settlement, status_code=201)
def settlements_create(
    group_id: str,
    body: CreateSettlementRequest,
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> Settlement:
    return run_store(lambda: store.settlements_create(user.id, group_id, body))
