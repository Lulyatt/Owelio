from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from owelio.auth.deps import get_store, require_user
from owelio.models import AppNotification, User
from owelio.routers._helpers import run_store
from owelio.store.service import Store

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=list[AppNotification])
def notifications_list(
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> list[AppNotification]:
    return run_store(lambda: store.notifications_list(user.id))


@router.post("/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def notifications_mark_read(
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> Response:
    run_store(lambda: store.notifications_mark_all_read(user.id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
