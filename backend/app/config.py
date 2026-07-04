"""Environment configuration for the Unredacted backend.

Loads .env (if present) and exposes the handful of env vars the app needs.
Kept intentionally simple for the hackathon timeline -- no pydantic-settings,
just plain os.environ reads with sane fallbacks where the spec allows one.
"""
import os

from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY", "")
SUPABASE_PUBLISHABLE_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-sonnet-5")

CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "http://localhost:5173")

DOCUMENTS_BUCKET = "documents"
