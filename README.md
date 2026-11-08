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

- **Backend**: Python, FastAPI, SQLAlchemy, PostgreSQL 17, Alembic
- **Frontend**: React, TypeScript, Vite
- **Auth**: Telegram Mini App init data (HMAC-SHA256)
- **Infra**: Docker, GitHub Actions, GHCR; production on k3s with Argo CD

## Running locally

Needs Docker. Everything runs in containers with hot reload:

```bash
cp .env.example .env          # optional: BOT_TOKEN, ADMIN_TELEGRAM_IDS
docker compose up --build
docker compose exec backend python -m app.dev_seed   # optional sample data
```

- **App:** http://localhost:5173. Login is skipped: you're "Dev User", an admin. Bot messages are logged, not sent.
- **API docs:** http://localhost:8000/docs
- **Database:** `localhost:5432`, user `piikki`, password `piikki`, database `piikki`

Edits under `backend/` and `frontend/` reload automatically. Database migrations run when the backend starts. To start from an empty database, run `docker compose down -v`.

**Tests:** `cd backend && uv run pytest` (needs [uv](https://docs.astral.sh/uv/); it installs Python 3.12 and the dependencies on first run). Add a dependency with `uv add <package>`, a dev tool with `uv add --dev <package>`.

## Deployment

Production runs on a single-node k3s cluster managed by Argo CD from the `server-config` repo (`manifests/skilta-piikki`). After a release (see below), set the new image tags in `manifests/skilta-piikki/backend/deployment.yaml` and `frontend/deployment.yaml` and push; Argo CD rolls them out.

## Development flow

`main` is the only long-lived branch and is always releasable.

1. Branch off `main` (`feat/…`, `fix/…`, `chore/…`).
2. Open a PR to `main`. Give it a [conventional](https://www.conventionalcommits.org/) title such as `feat: add favourites` or `fix: round report totals`: the release notes are built from PR titles. Mark breaking changes with `!` (`feat!: …`).
3. Merge with a merge commit and delete the branch.

Every PR to `main` runs the **CI** workflow: ruff (lint and formatting) and pytest for the backend; `tsc`, eslint and a production build for the frontend; and Trivy. Trivy scans the dependencies and both Docker images, fails on leaked secrets or a CRITICAL vulnerability that has a fix, and reports all HIGH and CRITICAL findings in the repo's Security tab. Before pushing, `cd backend && uv run ruff check --fix && uv run ruff format` fixes most lint findings.

## Releasing

Releases are cut from `main` by pushing a version tag:

```bash
git checkout main && git pull
scripts/release.sh patch   # or minor / major
```

The script works out the next version from the latest tag, lists the PRs going out, asks for confirmation and pushes the tag. Pushing a tag by hand (`git tag v2.4.0 && git push origin v2.4.0`) works the same way.

The **Release** workflow then:

1. Checks the tag is the next patch, minor or major version and is on `main`, and stops before building anything if not
2. Builds and pushes the backend and frontend images to GHCR, tagged with the version and `latest`
3. Creates a GitHub Release whose notes start with what the bump type means, group the PRs by type (new features, fixes, under the hood), and list any new database migrations. It warns if, for example, a patch release contains a new feature.

To deploy, set the new image tags in the server-config repo.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `BOT_TOKEN` | Telegram Bot API token | (required) |
| `DATABASE_URL` | SQLAlchemy database URL | `postgresql://piikki:piikki@db:5432/piikki` |
| `ADMIN_TELEGRAM_IDS` | Comma-separated Telegram IDs to bootstrap as admins | `""` |
| `AUTO_APPROVE_PURCHASES` | Auto-approve drink purchases | `true` |
| `UNDO_WINDOW_SECONDS` | How long a purchase can be changed or undone by its member, and an approve/reject by an admin | `60` |
| `CORS_ORIGINS` | Allowed CORS origins | `*` |
| `DEV_MODE` | Skip Telegram login and only log bot messages (local dev) | `false` |

## API Endpoints

### Public (authenticated user)
| Method | Path | Description |
|---|---|---|
| GET | `/api/me` | Current user info (includes fiscal debt totals) |
| GET | `/api/products` | List active products |
| POST | `/api/transactions/purchase` | Log a drink purchase (with quantity); the same drink again within the undo window adds to it |
| GET | `/api/transactions/undoable` | User's purchases still inside the undo window |
| PUT | `/api/transactions/{id}/quantity` | Change a purchase's quantity inside the undo window |
| POST | `/api/transactions/{id}/cancel` | Undo a purchase inside the undo window |
| POST | `/api/transactions/{id}/settle` | Close a purchase's undo window early |
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
| PUT | `/api/transactions/{id}/approve` | Approve transaction (undoable for the undo window; the user is told after it) |
| PUT | `/api/transactions/{id}/reject` | Reject transaction (likewise) |
| GET | `/api/transactions/recently-decided` | Approvals and rejections that can still be undone |
| PUT | `/api/transactions/{id}/undo-decision` | Put an approved or rejected transaction back in Pending |
| PUT | `/api/transactions/{id}/finish-decision` | Make an approval or rejection final now and notify the user |
| GET | `/api/fiscal-periods` | List all fiscal periods |
| POST | `/api/fiscal-periods/close` | Close current period (creates debts, resets balances) |
| GET | `/api/fiscal-periods/{id}/stats` | Period statistics |
| GET | `/api/fiscal-periods/{id}/debts` | All debts for a period |
| GET | `/api/fiscal-debts/pending` | All pending debt payments across all periods |
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
    components/    # Feature components (product grid, transaction list, ...)
    pages/         # Route pages
    types/         # TypeScript interfaces
    ui/            # Shared building blocks: Button, TextField, Card, Section, Tabs, Toast, ...
    utils/         # Date formatting and other helpers
```

New screens should be built from `frontend/src/ui` (sizes in `ui/tokens.ts`, colours as CSS variables in `styles/global.css`) and show messages with `useToast()`, so the app keeps one look.
