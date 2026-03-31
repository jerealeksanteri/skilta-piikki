from contextlib import asynccontextmanager

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import fiscal, messages, products, rewards, roulette, slot_machine, transactions, users


def run_migrations():
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    from app.seed import seed
    seed()

    # Start scheduler
    from app.services.scheduler import start_scheduler, stop_scheduler
    start_scheduler()

    yield

    # Stop scheduler on shutdown
    stop_scheduler()


app = FastAPI(title="SkiltaPiikki", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(fiscal.router, prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(rewards.router, prefix="/api")
app.include_router(slot_machine.router, prefix="/api")
app.include_router(roulette.router, prefix="/api")
