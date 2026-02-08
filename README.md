# SkiltaPiikki

A Telegram Mini App for managing beverage tabs in a student organization. Members log drinks from a shared fridge, track their balance, and request payments. Admins approve transactions and manage users.

## Features

- **Drink logging** — tap a product to deduct from your balance (auto-approved)
- **Payment requests** — users submit cash payments for admin approval
- **Leaderboard** — ranked list of balances across all active users
- **User management** — whitelist model: admins add/remove/promote users
- **Admin panel** — approve/reject pending transactions, log payments on behalf of users
- **Transaction history** — full per-user history with status tracking

## Tech Stack

- **Backend**: Python, FastAPI, SQLAlchemy, SQLite, Alembic
- **Frontend**: React, TypeScript, Vite
- **Auth**: Telegram Mini App init data (HMAC-SHA256)
- **Infra**: Docker, Caddy (auto-HTTPS), GitHub Actions, GHCR

## Quick Start (Development)

```bash
cp .env.example .env
# Edit .env — set BOT_TOKEN, ADMIN_TELEGRAM_IDS, DEV_MODE=true

docker compose -f docker-compose.dev.yml up --build
```

The app is available at `http://localhost:80`. With `DEV_MODE=true`, auth is bypassed with a fake dev user.

## Production Deployment

Requires a server with Docker and a domain pointing to it.

```bash
cp .env.example .env
# Edit .env — set BOT_TOKEN, ADMIN_TELEGRAM_IDS, DOMAIN

docker compose up -d
```

Caddy handles TLS automatically. Images are pulled from GHCR.

## Releasing

Releases are triggered manually via GitHub Actions:

1. Go to **Actions > Release > Run workflow**
2. Pick **patch**, **minor**, or **major**
3. The workflow auto-increments the version tag, builds and pushes Docker images to GHCR, and creates a GitHub Release with generated notes

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `BOT_TOKEN` | Telegram Bot API token | (required) |
| `DATABASE_URL` | SQLAlchemy database URL | `sqlite:///./skilta_piikki.db` |
| `ADMIN_TELEGRAM_IDS` | Comma-separated Telegram IDs to bootstrap as admins | `""` |
| `AUTO_APPROVE_PURCHASES` | Auto-approve drink purchases | `true` |
| `CORS_ORIGINS` | Allowed CORS origins | `*` |
| `DEV_MODE` | Bypass Telegram auth for local dev | `false` |
| `DOMAIN` | Domain for Caddy TLS (production only) | (required in prod) |

## API Endpoints

### Public (authenticated user)
| Method | Path | Description |
|---|---|---|
| GET | `/api/me` | Current user info |
| GET | `/api/products` | List active products |
| POST | `/api/transactions/purchase` | Log a drink purchase |
| POST | `/api/transactions/payment-request` | Request a payment (pending) |
| GET | `/api/transactions/mine` | User's transaction history |
| GET | `/api/leaderboard` | Active users ranked by balance |

### Admin
| Method | Path | Description |
|---|---|---|
| GET | `/api/users` | List all users |
| POST | `/api/users` | Add a user |
| POST | `/api/users/bulk` | Bulk add users |
| PUT | `/api/users/{id}/activate` | Reactivate user |
| PUT | `/api/users/{id}/deactivate` | Soft-delete user |
| PUT | `/api/users/{id}/promote` | Make admin |
| PUT | `/api/users/{id}/demote` | Remove admin |
| POST | `/api/transactions/payment` | Log payment for a user |
| GET | `/api/transactions/pending` | List pending transactions |
| PUT | `/api/transactions/{id}/approve` | Approve transaction |
| PUT | `/api/transactions/{id}/reject` | Reject transaction |

## Project Structure

```
backend/
  app/
    auth/          # Telegram init data validation
    models/        # SQLAlchemy models (User, Product, Transaction)
    routers/       # FastAPI route handlers
    schemas/       # Pydantic request/response schemas
    config.py      # Settings via pydantic-settings
    database.py    # Engine, session, Base
    main.py        # App entrypoint, lifespan, migrations
    seed.py        # Product + admin seeding
  alembic/         # Database migrations
frontend/
  src/
    api/           # Typed API client functions
    components/    # Reusable UI components
    pages/         # Route pages
    types/         # TypeScript interfaces
```
