from typing import Annotated

from fastapi import APIRouter, Depends

from owelio.auth.deps import get_store, require_user
from owelio.models import (
    CreateGroupRequest,
    EmailInvite,
    Group,
    InviteByEmailRequest,
    JoinGroupRequest,
    SetArchivedRequest,
    UpdateGroupRequest,
    User,
)
from owelio.routers._helpers import run_store
from owelio.store.service import Store

router = APIRouter(tags=["groups"])


@router.get("/groups", response_model=list[Group])
def groups_list(
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> list[Group]:
    return run_store(lambda: store.groups_list(user.id))


@router.post("/groups", response_model=Group, status_code=201)
def groups_create(
    body: CreateGroupRequest,
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> Group:
    return run_store(lambda: store.groups_create(user.id, body))


@router.post("/groups/join", response_model=Group)
def groups_join(
    body: JoinGroupRequest,
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> Group:
    return run_store(lambda: store.groups_join_by_code(user.id, body.code))


@router.get("/groups/{group_id}", response_model=Group)
def groups_get(
    group_id: str,
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> Group:
    return run_store(lambda: store.groups_get(user.id, group_id))


@router.patch("/groups/{group_id}", response_model=Group)
def groups_update(
    group_id: str,
    body: UpdateGroupRequest,
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> Group:
    return run_store(lambda: store.groups_update(user.id, group_id, body))


@router.put("/groups/{group_id}/archived", response_model=Group)
def groups_set_archived(
    group_id: str,
    body: SetArchivedRequest,
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> Group:
    return run_store(lambda: store.groups_set_archived(user.id, group_id, body.archived))


@router.get("/groups/{group_id}/members", response_model=list[User])
def groups_members(
    group_id: str,
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> list[User]:
    return run_store(lambda: store.groups_members(user.id, group_id))


@router.get("/groups/{group_id}/invites", response_model=list[EmailInvite])
def groups_invites_list(
    group_id: str,
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> list[EmailInvite]:
    return run_store(lambda: store.groups_invites(user.id, group_id))


@router.post("/groups/{group_id}/invites", response_model=EmailInvite, status_code=201)
def groups_invite(
    group_id: str,
    body: InviteByEmailRequest,
    user: Annotated[User, Depends(require_user)],
    store: Annotated[Store, Depends(get_store)],
) -> EmailInvite:
    return run_store(lambda: store.groups_invite_by_email(user.id, group_id, body.email))
