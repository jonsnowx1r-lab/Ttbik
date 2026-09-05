"""
Identity resolution + daily-quota/subscription enforcement against the
shared NovaUser table. Mirrors the ledger/quota patterns already used
in src/lib/adBotLogic.ts (isolated table, plain string status fields,
no automated payment/checkout — subscriptions start PENDING_APPROVAL
and the owner flips them to ACTIVE manually, same as this project's
standing product rule against auto-checkout).
"""
import uuid
from datetime import datetime, timedelta, timezone

from app.config import FREE_DAILY_QUOTA
from app.supabase_client import get_supabase


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_ts(value: str) -> datetime:
    """Parses a Postgres timestamp string from Supabase into a
    timezone-AWARE datetime. NovaUser.dailyResetAt/subscriptionExpiresAt
    are `TIMESTAMP(3)` columns (no time zone) — Supabase returns those
    as naive ISO strings with no "Z"/offset at all, so the old
    `.replace("Z", "+00:00")` was a no-op and datetime.fromisoformat()
    silently produced a naive datetime. Subtracting/comparing that
    against `_now()` (aware) then raised "can't subtract offset-naive
    and offset-aware datetimes" on every single request. Assume UTC for
    any naive value, since that's what CURRENT_TIMESTAMP stores."""
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def resolve_or_create_user(
    channel: str, telegram_id: str | None = None, email: str | None = None, api_key: str | None = None
) -> dict:
    """channel is one of TELEGRAM | WEB | API — picks the matching identity column."""
    db = get_supabase()

    if channel == "API":
        if not api_key:
            raise ValueError("API channel requires an apiKey")
        res = db.table("NovaUser").select("*").eq("apiKey", api_key).limit(1).execute()
        if not res.data:
            raise ValueError("invalid apiKey")
        return res.data[0]

    if channel == "TELEGRAM":
        if not telegram_id:
            raise ValueError("TELEGRAM channel requires telegram_id")
        res = db.table("NovaUser").select("*").eq("telegramId", telegram_id).limit(1).execute()
        if res.data:
            return res.data[0]
        new_row = {"id": str(uuid.uuid4()), "telegramId": telegram_id}
        return db.table("NovaUser").insert(new_row).execute().data[0]

    if channel == "WEB":
        if not email:
            raise ValueError("WEB channel requires email")
        res = db.table("NovaUser").select("*").eq("email", email).limit(1).execute()
        if res.data:
            return res.data[0]
        new_row = {"id": str(uuid.uuid4()), "email": email}
        return db.table("NovaUser").insert(new_row).execute().data[0]

    raise ValueError(f"unknown channel: {channel}")


def has_active_subscription(user: dict) -> bool:
    if user.get("plan") != "PRO":
        return False
    expires_at = user.get("subscriptionExpiresAt")
    if not expires_at:
        return False
    return _parse_ts(expires_at) > _now()


def check_and_reserve_quota(user: dict) -> tuple[bool, int, str]:
    """Returns (allowed, remaining_after, message). PRO users skip the
    daily cap entirely. FREE users reset at each new UTC day."""
    if has_active_subscription(user):
        return True, -1, "PRO — بلا حد يومي"

    db = get_supabase()
    reset_at = _parse_ts(user["dailyResetAt"])
    used = user["dailyUsed"]

    if _now() - reset_at > timedelta(days=1):
        used = 0
        reset_at = _now()

    if used >= FREE_DAILY_QUOTA:
        return False, 0, "انتهى حدك المجاني اليومي — أرسل /ترقية للاشتراك في الخطة المدفوعة لاستخدام غير محدود."

    used += 1
    db.table("NovaUser").update({"dailyUsed": used, "dailyResetAt": reset_at.isoformat()}).eq(
        "id", user["id"]
    ).execute()
    return True, FREE_DAILY_QUOTA - used, f"متبقٍ لك اليوم: {FREE_DAILY_QUOTA - used} رسالة"


def log_usage(user_id: str, channel: str, query_type: str, message: str | None = None, answer: str | None = None) -> None:
    # message/answer double as real training data for the Kaggle
    # notebook's scheduled LoRA fine-tuning run (fetched over Supabase's
    # REST API — see ai-system/colab/merge_and_finetune.ipynb), instead
    # of the old hand-typed placeholder example.
    db = get_supabase()
    db.table("NovaUsageLog").insert(
        {
            "id": str(uuid.uuid4()),
            "novaUserId": user_id,
            "channel": channel,
            "queryType": query_type,
            "message": message,
            "answer": answer,
        }
    ).execute()


def request_subscription(user_id: str, plan: str = "PRO_MONTHLY", amount_usd: float = 5.0) -> str:
    """Creates a PENDING_APPROVAL row — the owner approves it manually
    (no automated checkout), then flips status to ACTIVE and sets
    startedAt/expiresAt via the Supabase table editor or a future admin
    endpoint. Returns the subscription id to show the user as a
    reference."""
    db = get_supabase()
    sub_id = str(uuid.uuid4())
    db.table("NovaSubscription").insert(
        {"id": sub_id, "novaUserId": user_id, "plan": plan, "amountUsd": amount_usd}
    ).execute()
    return sub_id
