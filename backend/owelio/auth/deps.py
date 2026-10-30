from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from owelio.errors import ApiError, raise_api_error
from owelio.models import User
from owelio.store.service import Store

_bearer = HTTPBearer(auto_error=False)


def _token_from(credentials: HTTPAuthorizationCredentials | None) -> str | None:
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    return credentials.credentials


def get_store() -> Store:
    from owelio.store.instance import get_app_store

    return get_app_store()


def get_current_user_optional(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    store: Annotated[Store, Depends(get_store)],
) -> User | None:
    token = _token_from(credentials)
    user_id = store.tokens.user_id_for(token)
    if not user_id:
        return None
    try:
        return store.public_user(user_id)
    except ApiError:
        return None


def get_current_user(
    user: Annotated[User | None, Depends(get_current_user_optional)],
) -> User:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "unauthenticated", "message": "Please log in"},
        )
    return user


def require_user(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    return user
