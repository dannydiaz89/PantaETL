FROM ghcr.io/astral-sh/uv:python3.13-trixie-slim

WORKDIR /workspace

COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen

COPY workers ./workers
COPY tests ./tests

CMD ["uv", "run", "python", "-m", "workers.python"]
