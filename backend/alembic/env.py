from logging.config import fileConfig

from sqlalchemy import pool
from alembic import context

from app.config import settings
from app.database import engine, Base

# Import all models so Base.metadata is populated
from app.models.user import User  # noqa: F401
from app.models.product import Product  # noqa: F401
from app.models.transaction import Transaction  # noqa: F401
from app.models.fiscal_period import FiscalPeriod  # noqa: F401
from app.models.fiscal_debt import FiscalDebt  # noqa: F401
from app.models.message_template import MessageTemplate  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
