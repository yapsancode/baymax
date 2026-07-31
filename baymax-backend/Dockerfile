# Baymax backend — FastAPI service for Google Cloud Run.
# Pinned to Python 3.12 so every machine (and Cloud Run) runs the same runtime.
FROM python:3.12-slim

# Don't write .pyc files; stream logs straight to stdout (Cloud Run logging).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies first so this layer is cached when only app code changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code (see .dockerignore for what's excluded, e.g. .env, venv).
COPY . .

# Cloud Run routes traffic to $PORT (default 8080). Bind uvicorn to it.
ENV PORT=8080
EXPOSE 8080

# JSON array form (satisfies linter). sh -c + exec: $PORT expands and uvicorn
# replaces the shell as PID 1, so Cloud Run shutdown signals are delivered cleanly.
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
