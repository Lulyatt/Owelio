from __future__ import annotations

from collections.abc import Generator
from typing import Callable

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from owelio.db.config import get_database_url, sqlalchemy_engine_options
from owelio.db.models import Base
from owelio.db.seed import seed_database

_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


def _build_engine(url: str) -> Engine:
    return create_engine(url, **sqlalchemy_engine_options(url))


def init_database(url: str | None = None) -> None:
    """Create engine, tables, and seed demo data if the database is empty."""
    global _engine, _SessionLocal
    db_url = url or get_database_url()
    if _engine is not None:
        _engine.dispose()
    _engine = _build_engine(db_url)
    _SessionLocal = sessionmaker(bind=_engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(_engine)
    with _SessionLocal() as session:
        seed_database(session)
        session.commit()


def reconfigure_database(url: str) -> None:
    """Drop and recreate all tables (used in tests)."""
    global _engine, _SessionLocal
    if _engine is not None:
        Base.metadata.drop_all(_engine)
        _engine.dispose()
    init_database(url)


def get_engine() -> Engine:
    if _engine is None:
        init_database()
    assert _engine is not None
    return _engine


def get_session_factory() -> Callable[[], Session]:
    if _SessionLocal is None:
        init_database()
    assert _SessionLocal is not None
    return _SessionLocal


def session_scope() -> Generator[Session, None, None]:
    factory = get_session_factory()
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
