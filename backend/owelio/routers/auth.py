from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from owelio.auth.deps import get_store
from owelio.models import AuthResponse, CurrentUserResponse, LoginRequest, RegisterRequest
from owelio.routers._helpers import run_store
from owelio.store.service import Store

router = APIRouter(prefix="/auth", tags=["auth"])
_bearer = HTTPBearer(auto_error=False)


def _user_id_from_token(store: Store, credentials: HTTPAuthorizationCredentials | None) -> str | None:
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    return store.tokens.user_id_for(credentials.credentials)


@router.get("/me", response_model=CurrentUserResponse)
def auth_me(
    store: Annotated[Store, Depends(get_store)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> CurrentUserResponse:
    user_id = _user_id_from_token(store, credentials)
    user = run_store(lambda: store.current_user(user_id))
    return CurrentUserResponse(user=user)


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def auth_register(body: RegisterRequest, store: Annotated[Store, Depends(get_store)]) -> AuthResponse:
    user, token = run_store(
        lambda: store.register(body.name, body.email, body.password),
    )
    return AuthResponse(user=user, access_token=token)


@router.post("/login", response_model=AuthResponse)
def auth_login(body: LoginRequest, store: Annotated[Store, Depends(get_store)]) -> AuthResponse:
    user, token = run_store(lambda: store.login(body.email, body.password))
    return AuthResponse(user=user, access_token=token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def auth_logout(
    store: Annotated[Store, Depends(get_store)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Response:
    token = credentials.credentials if credentials else None
    run_store(lambda: store.logout(token))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
