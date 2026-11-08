from sqlalchemy import MetaData, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

naming_convention = {
    "ix": "ix_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def _connect_args(url: str) -> dict:
    # DateTime columns hold naive UTC. Python writes timezone-aware UTC values,
    # which PostgreSQL converts to the session time zone before dropping the
    # offset, so pin sessions to UTC instead of relying on the server default.
    if url.startswith("postgresql"):
        return {"options": "-c timezone=UTC"}
    return {}


engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args=_connect_args(settings.DATABASE_URL),
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=naming_convention)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
