import os


def get_database_url() -> str:
    """
    SQLAlchemy database URL. Examples:
      sqlite:///./owelio.db
      sqlite:///:memory:
      postgresql+psycopg://user:pass@localhost/owelio
    """
    return os.environ.get("DATABASE_URL", "sqlite:///./owelio.db")


def sqlalchemy_engine_options(url: str) -> dict:
    """Driver-specific engine kwargs (SQLite thread sharing, etc.)."""
    from sqlalchemy.pool import StaticPool

    opts: dict = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        opts["connect_args"] = {"check_same_thread": False}
        if url.endswith(":memory:") or url.endswith(":memory"):
            # One shared in-memory database across connections (tests).
            opts["poolclass"] = StaticPool
    return opts
