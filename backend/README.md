# Unredacted — Backend

FastAPI backend for the Unredacted FOIA-request assistant (hackathon build). Owns the AI
clarification loop and all reads/writes to Supabase Postgres/Storage via the secret-key client
(bypasses RLS by design — see `supabase/schema.sql` at the repo root for the RLS policies, which
exist only as a safety net in case the frontend ever queries Supabase directly).

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and fill in real values (see below)
```

### `.env` values

- `SUPABASE_URL` / `SUPABASE_SECRET_KEY` / `SUPABASE_PUBLISHABLE_KEY` — from Supabase
  Settings → API Keys. The secret key (replaces the legacy service_role key) is used for **all**
  DB reads/writes and Storage uploads from this backend; the publishable key (replaces the legacy
  anon key) is used only to validate a caller's access token via `supabase.auth.get_user(token)`.
- `OPENROUTER_API_KEY` — from https://openrouter.ai/keys
- `OPENROUTER_MODEL` — defaults to `anthropic/claude-3.5-sonnet` if unset. **Verify this slug is
  available on your OpenRouter account** (model availability/naming can change) and adjust the
  env var if the default 404s.

You'll also need a **public** Supabase Storage bucket named `documents` (created by you in the
Supabase dashboard) — the backend builds public URLs directly rather than using signed URLs.

## Run

```bash
uvicorn main:app --reload --port 8000
```

Then check `curl http://localhost:8000/health` → `{"status": "ok"}`.

Without real Supabase/OpenRouter credentials, `/health` still works but every other endpoint will
fail at call time (401 from Supabase auth validation, or connection errors from OpenRouter) — that
is expected until `.env` has real values. The app is verified to **import and boot cleanly** even
with placeholder/empty env values (clients are created lazily, not at import time).

## Project layout

```
backend/
  main.py              FastAPI app + all route handlers
  app/
    config.py          env var loading (python-dotenv)
    supabase_client.py  lazy secret / publishable Supabase client factories
    auth.py             get_current_user / require_citizen / require_employee dependencies
    ai.py                OpenRouter call + system prompt + defensive JSON parsing
    db.py                thin Supabase query helpers (requests/messages/documents)
    schemas.py           Pydantic request bodies (IntentCreate, ReplyCreate)
  requirements.txt
  .env.example
  README.md
```

## Auth model

Every endpoint except `GET /health` requires `Authorization: Bearer <supabase_access_token>`.
`get_current_user` validates the token via `supabase.auth.get_user()` (anon client), then looks up
the caller's row in `profiles` (service client) to get `{id, email, role}`. `require_citizen` /
`require_employee` are thin wrappers that additionally 403 on the wrong role.

## AI clarification loop

`app/ai.py` calls OpenRouter's OpenAI-compatible chat completions endpoint with
`response_format: {"type": "json_object"}` and a system prompt instructing the model to return:

```json
{
  "ready": true,
  "message": "...",
  "final_text": "... or null",
  "suggested_agency": "... or null",
  "already_public_hint": "... or null"
}
```

- `ready` / `message` / `final_text` are exactly per spec: one clarifying question at a time until
  the request is specific enough (clear subject, bounded date range, specific scope), then a full
  structured FOIA request text.
- `suggested_agency` and `already_public_hint` are an **additive, ephemeral** feature (added after
  initial spec, per a follow-up product note): the AI's best-guess federal agency/office likely to
  hold the records, and — only when the model actually knows of one — a short note that similar
  records may already be public (e.g. an agency FOIA reading room, NARA, FOIA.gov). Both are based
  purely on the model's own general knowledge, **not** a real retrieval/corpus lookup (RAG was cut
  for time per the PRD). Neither field is persisted to the DB — they're recomputed on every AI turn
  and returned directly in the response body of `POST /requests` and `POST /requests/{id}/reply`.

Model JSON parsing is defensive: markdown code fences (```` ```json ... ``` ````) are stripped
before `json.loads`, and any missing/malformed field falls back to a safe default (e.g. a bad
response degrades to "treat it as a clarifying question" rather than 500ing).

## Deviations / decisions made without asking (hackathon time constraints)

- **`reply` precondition status code**: returns `400` (not `409`) if the request is no longer in
  `clarifying` status. Spec didn't pin an exact code; 400 was simplest.
- **`submit` has no status precondition**: per spec text, force-submit is allowed regardless of
  whether the AI ever marked the request `ready`. It's also allowed regardless of current status
  (idempotent set to `submitted`) since the spec didn't say to restrict it further and the citizen
  flow never exposes this once already submitted.
- **Employee-facing endpoints don't check ownership**: the document upload/fulfill endpoints don't
  re-check ownership beyond the role check, since any FOIA officer can act on any queued request
  (matches the `GET /requests` employee queue semantics).
- **Document upload `upsert: true`**: uploads use `{"content-type": ..., "upsert": "true"}` so a
  demo re-upload of the same filename to the same request doesn't hard-fail; not in the original
  spec but avoids an easy-to-hit demo-day error.
- **Auth profile/user lookups use list `select()` instead of `.single()`**: avoids
  version-specific `PostgrestAPIError` behavior when 0 rows match, in favor of an explicit
  `if not rows: raise 401/404` check.
- **CORS origin is env-overridable** (`CORS_ORIGIN`, default `http://localhost:5173`) — spec only
  required the localhost:5173 default, kept that as default but made it a one-line env override in
  case the deployed frontend URL differs at demo time.
