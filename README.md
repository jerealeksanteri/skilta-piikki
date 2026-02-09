# SkiltaPiikki

A Telegram Mini App for managing beverage tabs in a student organization. Members log drinks from a shared fridge, track their balance, and request payments. Admins approve transactions, manage users, and handle fiscal periods.

## Features

- **Self-registration** — open the Mini App to register; admins approve new users
- **Drink logging** — tap the + button to open the product overlay, pick a product, set quantity, and confirm
- **Quantity support** — log multiple items at once (e.g., 3x Beer); history shows quantity prefix
- **Payment requests** — users submit cash payments for admin approval
- **Fiscal periods** — time-based accounting: admins close periods, negative balances become debts, all balances reset to zero
- **Debt management** — users see outstanding debts on the home page and request payment; admins approve or reject
- **Telegram notifications** — bot messages on key events (approvals, rejections, period closures, promotions)
- **Message templates** — admins customize notification text and toggle individual event messages on/off
- **Leaderboard** — ranked list of balances with a blacklist section for heavy debtors
- **Rank on home page** — see your position among all users at a glance
- **Product management** — admins add, edit, reorder, and deactivate products
- **User management** — admins approve, deactivate, promote/demote users, or reset all
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
| GET | `/api/me` | Current user info (includes fiscal debt totals) |
| GET | `/api/products` | List active products |
| POST | `/api/transactions/purchase` | Log a drink purchase (with quantity) |
| POST | `/api/transactions/payment-request` | Request a payment (pending) |
| GET | `/api/transactions/mine` | User's transaction history |
| GET | `/api/leaderboard` | Active users ranked by balance |
| GET | `/api/fiscal-periods/current` | Current open fiscal period |
| GET | `/api/my/debts` | User's unpaid/pending fiscal debts |
| POST | `/api/fiscal-debts/{id}/request-payment` | Request to pay a fiscal debt |

### Admin
| Method | Path | Description |
|---|---|---|
| GET | `/api/users` | List all users |
| POST | `/api/users` | Add a user |
| POST | `/api/users/bulk` | Bulk add users |
| PUT | `/api/users/{id}/activate` | Approve / reactivate user |
| PUT | `/api/users/{id}/deactivate` | Soft-delete user |
| PUT | `/api/users/{id}/promote` | Make admin |
| PUT | `/api/users/{id}/demote` | Remove admin |
| DELETE | `/api/users/all` | Deactivate all non-admin users and reset balances |
| GET | `/api/products/all` | List all products (including inactive) |
| POST | `/api/products` | Create a product |
| PUT | `/api/products/{id}` | Update a product |
| DELETE | `/api/products/{id}` | Soft-delete a product |
| POST | `/api/transactions/payment` | Log payment for a user |
| GET | `/api/transactions/pending` | List pending transactions |
| PUT | `/api/transactions/{id}/approve` | Approve transaction |
| PUT | `/api/transactions/{id}/reject` | Reject transaction |
| GET | `/api/fiscal-periods` | List all fiscal periods |
| POST | `/api/fiscal-periods/close` | Close current period (creates debts, resets balances) |
| GET | `/api/fiscal-periods/{id}/stats` | Period statistics |
| GET | `/api/fiscal-periods/{id}/debts` | All debts for a period |
| PUT | `/api/fiscal-debts/{id}/approve` | Approve debt payment |
| PUT | `/api/fiscal-debts/{id}/reject` | Reject debt payment |
| PUT | `/api/fiscal-debts/{id}/mark-paid` | Mark debt as paid directly |
| GET | `/api/message-templates` | List all message templates |
| PUT | `/api/message-templates/{id}` | Update template text or active state |

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). You may use, modify, and distribute the software for any **non-commercial** purpose. Commercial use requires explicit permission from the author.

## Project Structure

```
backend/
  app/
    auth/          # Telegram init data validation
    models/        # SQLAlchemy models (User, Product, Transaction, FiscalPeriod, FiscalDebt, MessageTemplate)
    routers/       # FastAPI route handlers
    schemas/       # Pydantic request/response schemas
    services/      # Telegram bot client, event messaging
    config.py      # Settings via pydantic-settings
    database.py    # Engine, session, Base
    main.py        # App entrypoint, lifespan, migrations
    seed.py        # Product, admin, fiscal period, and message template seeding
  alembic/         # Database migrations
frontend/
  src/
    api/           # Typed API client functions
    components/    # Reusable UI components
    pages/         # Route pages
    types/         # TypeScript interfaces
```
