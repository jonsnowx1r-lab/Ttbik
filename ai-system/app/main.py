"""
Nova AI — the single "brain" FastAPI service. Every client channel
(the NOVA_BOT Telegram template inside Ttbik, the Streamlit web UI, and
external API consumers) calls this same /chat endpoint — no AI logic
is duplicated anywhere else, so there is exactly one place to fix bugs
or improve the council/RAG/routing.

Run locally:  uvicorn app.main:app --reload --port 8000
Deploy free:  Render.com (Docker web service, free instance type) — see
              ai-system/README.md. (Not Hugging Face Spaces — HF now
              gates Docker/Gradio Spaces behind a paid PRO plan; HF is
              still used for free model storage only, via the Colab
              notebook pushing to HF Hub.)
"""
import logging

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app import council, quota, rag, router
from app.config import NOVA_INTERNAL_SECRET

logger = logging.getLogger("nova")
app = FastAPI(title="Nova AI")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Without this, any unhandled exception (e.g. a missing env var like
    # SUPABASE_URL) falls through to Starlette's default plain-text 500
    # response, which isn't valid JSON — every client here (novaBotLogic.ts,
    # streamlit_app.py) parses the body as JSON and reads `.detail`, so an
    # unparseable body silently became a generic "حدث خطأ" with zero
    # diagnostic info. This logs the real exception server-side (visible in
    # Render's logs) and returns a JSON body every caller can actually read.
    logger.exception("Unhandled exception on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {exc}"})


class ChatRequest(BaseModel):
    channel: str  # TELEGRAM | WEB | API
    message: str
    telegram_id: str | None = None
    email: str | None = None


class ChatResponse(BaseModel):
    answer: str
    query_type: str
    quota_message: str


@app.get("/health")
def health():
    return {"status": "ok"}


def _authorize(channel: str, authorization: str | None, x_internal_secret: str | None) -> str | None:
    """Returns the apiKey to use for API channel, or None. Raises 401
    on any authorization failure."""
    if channel in ("TELEGRAM", "WEB"):
        if not NOVA_INTERNAL_SECRET or x_internal_secret != NOVA_INTERNAL_SECRET:
            raise HTTPException(
                status_code=401,
                detail="missing/invalid X-Internal-Secret — only Ttbik's own NOVA_BOT/Streamlit servers may call this channel",
            )
        return None

    if channel == "API":
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="missing Authorization: Bearer <apiKey>")
        return authorization.removeprefix("Bearer ").strip()

    raise HTTPException(status_code=400, detail=f"unknown channel: {channel}")


@app.post("/chat", response_model=ChatResponse)
def chat(
    req: ChatRequest,
    background_tasks: BackgroundTasks,
    authorization: str | None = Header(default=None),
    x_internal_secret: str | None = Header(default=None),
):
    api_key = _authorize(req.channel, authorization, x_internal_secret)

    try:
        user = quota.resolve_or_create_user(
            req.channel, telegram_id=req.telegram_id, email=req.email, api_key=api_key
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    allowed, _remaining, quota_message = quota.check_and_reserve_quota(user)
    if not allowed:
        raise HTTPException(status_code=429, detail=quota_message)

    query_type = router.classify(req.message)
    context = rag.build_context(user["id"], req.message, query_type)
    final_answer = council.answer(req.message, context, query_type)

    # Neither of these needs to finish before the user gets their
    # answer — they're pure bookkeeping (a usage-log row, writing this
    # turn into vector memory for next time). Deferring them to run
    # after the response is sent shaves a Supabase round-trip and a
    # local embedding computation off every single reply's latency,
    # which matters a lot on Render's free-tier 0.1 CPU.
    background_tasks.add_task(quota.log_usage, user["id"], req.channel, query_type)
    background_tasks.add_task(rag.remember, user["id"], req.message, final_answer)

    return ChatResponse(answer=final_answer, query_type=query_type, quota_message=quota_message)


class SubscribeRequest(BaseModel):
    channel: str
    telegram_id: str | None = None
    email: str | None = None


@app.post("/subscribe")
def subscribe(
    req: SubscribeRequest,
    authorization: str | None = Header(default=None),
    x_internal_secret: str | None = Header(default=None),
):
    """Creates a PENDING_APPROVAL subscription request — no automated
    checkout, matches this project's standing product rule. The owner
    reviews and activates it manually (Supabase table editor for now)."""
    api_key = _authorize(req.channel, authorization, x_internal_secret)
    try:
        user = quota.resolve_or_create_user(
            req.channel, telegram_id=req.telegram_id, email=req.email, api_key=api_key
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    sub_id = quota.request_subscription(user["id"])
    return {"subscription_id": sub_id, "message": "تم إرسال طلب الترقية — سيتم تفعيله يدوياً من المالك."}
