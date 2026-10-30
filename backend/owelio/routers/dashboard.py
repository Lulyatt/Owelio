from typing import Annotated

from fastapi import APIRouter, Depends

from owelio.auth.deps import get_store, require_user
from owelio.models import DashboardSummary, User
from owelio.routers._helpers import run_store
from owelio.store.service import Store

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary(
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> DashboardSummary:
    return run_store(lambda: store.dashboard_summary(user.id))
