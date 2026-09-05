"""
Single shared Supabase client (service role — bypasses RLS, server-side
only, same pattern as src/lib/supabase.ts on the Next.js side). Talks
directly to the NovaUser/NovaUsageLog/NovaSubscription tables created
by prisma/migration_19_nova_ai.sql in the SAME Supabase project as the
main Ttbik site.
"""
from supabase import Client, create_client

from app.config import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError(
                "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set — "
                "copy ai-system/.env.example to .env and fill them in."
            )
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _client
