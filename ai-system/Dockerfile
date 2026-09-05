FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Render (Docker web services) injects a $PORT env var and routes
# external traffic to whatever port the container actually listens on
# — there's no fixed platform-required port like Hugging Face Spaces'
# 7860, so this must read $PORT at container start (shell form CMD,
# not exec form, so the env var actually expands). 10000 is just a
# sane local-run fallback.
EXPOSE 10000
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}
