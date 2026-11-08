FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.10.9 /uv /uvx /bin/

WORKDIR /app

# The virtualenv lives outside /app so the dev compose bind mount of the
# source over /app doesn't hide it.
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/opt/venv/bin:$PATH"

# Dependencies first, so source changes don't reinstall them.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
