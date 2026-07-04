"""Supabase client factories.

Two clients:
- service client (secret key): bypasses RLS, used for ALL reads/writes
  from the backend per the project spec.
- publishable client (publishable key): used only to validate a citizen/
  employee's access token via `auth.get_user(token)`.

Clients are created lazily (not at import time) so that `import main` still
works even before real Supabase credentials are configured in `.env` -- handy
for the hackathon "does it at least boot" smoke test.
"""
from functools import lru_cache

from supabase import Client, create_client

from app.config import SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_URL


@lru_cache
def get_service_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)


@lru_cache
def get_anon_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
