import os

from owelio.auth.tokens import TokenStore
from owelio.db.engine import init_database, reconfigure_database
from owelio.store.service import Store

_store: Store | None = None


def init_app() -> Store:
    global _store
    if _store is None:
        init_database()
        _store = Store()
    return _store


def get_app_store() -> Store:
    if _store is None:
        return init_app()
    return _store


def set_app_store(store: Store) -> None:
    global _store
    _store = store


def reset_app_store(database_url: str | None = None) -> Store:
    """Fresh database + store (tests)."""
    global _store
    url = database_url or os.environ.get("DATABASE_URL", "sqlite:///:memory:")
    reconfigure_database(url)
    _store = Store(tokens=TokenStore())
    return _store
