# Stage 1: install the locked dependencies into /opt/venv with uv.
FROM python:3.12-slim AS deps

COPY --from=ghcr.io/astral-sh/uv:0.10.9 /uv /bin/uv

ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev --no-install-project

# Stage 2: the runtime image gets the virtualenv but not uv itself.
# /opt/venv sits outside /app, so the dev compose source mount doesn't hide it.
FROM python:3.12-slim

ENV PATH="/opt/venv/bin:$PATH"
COPY --from=deps /opt/venv /opt/venv

WORKDIR /app
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
