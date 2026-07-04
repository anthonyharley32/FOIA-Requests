# Unredacted — Frontend

React + Vite frontend for Unredacted, a FOIA-request assistant. Plain JavaScript
(no TypeScript) — built fast for a hackathon demo.

Citizens describe records they want in plain language, an AI clarification loop
narrows it down to a well-scoped FOIA request, they submit it into this
platform's own review queue, and a FOIA-officer "employee" reviews it, attaches
documents, and marks it fulfilled. Both roles share this one app — what you see
after login depends on your role (`citizen` or `employee`), which comes from
the backend's `GET /me`.

## Stack

- React 19 + Vite 8 (plain JS, no TypeScript)
- React Router v7 (`react-router-dom`) for routing
- Tailwind CSS v4 (via `@tailwindcss/vite`) for styling
- `@supabase/supabase-js` for auth only (session/signup/login/logout) — all
  request/message/document data goes through the FastAPI backend
- `motion` (Framer Motion's successor) + `lucide-react` for the chat UI's
  animations/icons

## Setup

```bash
npm install
cp .env.example .env
# then fill in .env with real values (see below)
npm run dev
```

Runs on http://localhost:5173 by default.

To build for production: `npm run build` (outputs to `dist/`). `npm run preview`
serves the production build locally.

### Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable key |
| `VITE_API_URL` | Base URL of the FastAPI backend (default `http://localhost:8000`) |

Without real Supabase credentials, the app still boots (falls back to a
placeholder Supabase URL so `createClient` doesn't throw), but sign-in/sign-up
calls will fail until you provide real values and the backend is running.

## Pages

- `/login`, `/signup` — email/password auth. Signup includes a toggle for
  "I'm a citizen requesting records" vs "I'm a FOIA employee reviewing
  requests", passed as `options.data.role` on `supabase.auth.signUp` (a
  backend DB trigger uses this to set the profile's role).
- `/` — dashboard, role-based:
  - Citizen: list of their own requests with status, linking to
    `/requests/:id`, plus a "New Request" button.
  - Employee: the review queue (submitted/under_review/fulfilled).
- `/requests/new` (citizen only) — chat-style intent → AI clarification loop
  → editable final request text → submit. Includes a visible "Submit anyway"
  option to force-submit before the AI marks the request `ready`.
- `/requests/:id` — status, full message thread, and:
  - Citizen: download links for documents once `status === 'fulfilled'`.
  - Employee: file upload ("Attach Document") + "Mark Fulfilled" button.

## Structure

```
src/
  lib/
    supabaseClient.js   # Supabase client init
    animations.js       # shared Motion spring presets/variants
  context/
    AuthContext.jsx     # session state + fetchApi() helper (attaches bearer token + VITE_API_URL)
  components/
    ProtectedRoute.jsx  # redirects to /login if no session; optional role gate
    Navbar.jsx
    StatusBadge.jsx
    AgentStepper.jsx    # simulated "agent working" progress UI during AI turns
  pages/
    Login.jsx
    Signup.jsx
    Dashboard.jsx
    NewRequest.jsx
    RequestDetail.jsx
```

## Notable decisions / deviations from the original spec

- **`POST /requests/{id}/submit` body**: the API contract documents this
  endpoint as taking no body. Since the review step lets the citizen edit the
  AI-generated `final_text` before submitting, the frontend sends
  `{ final_text }` in the submit body anyway — additive and harmless if the
  backend ignores it (standard FastAPI/Pydantic behavior on an undeclared
  body), but it means edits during review can be persisted if the backend
  chooses to read them. If the backend does *not* read it, the edits are
  simply cosmetic for that request and the originally-generated `final_text`
  is what's stored server-side — worth confirming with the backend if the
  edit needs to be durable.
- **Message shape**: the API spec doesn't define the exact shape of message
  objects returned in `messages`. The frontend renders `message.content` and
  treats `message.role` (falling back to `message.sender`) as `'user'` /
  `'citizen'` for the right-aligned bubble, anything else as the AI's
  left-aligned bubble.
- **Document shape**: documents are rendered with `doc.url` (per spec) and a
  best-effort filename via `doc.filename ?? doc.name ?? "Document #<id>"`,
  since the exact document object shape wasn't specified beyond `url`.
- **`suggested_agency` / `already_public_hint`**: per an addendum to the
  original spec, `POST /requests` and `POST /requests/{id}/reply` may also
  return these two optional fields. When present, `suggested_agency` renders
  as a small "Likely agency: ..." label under the chat, and
  `already_public_hint` renders as a distinct amber callout banner — both are
  informational only and never block submitting.
- **"Agent working" stepper**: `AgentStepper.jsx` shows a simulated,
  time-based sequence of labels ("Checking if this is already public
  record...", "Identifying the likely agency...", "Drafting your
  request...") while a `POST /requests` or `/reply` call is in flight. These
  are not real backend tool-call/progress events (the API doesn't stream
  them) — purely a UX device adapted from a sibling project's
  `ToolCallStepper` pattern so the wait doesn't feel dead. It collapses and
  fades out automatically once the response arrives.
- **Role mismatch redirect**: if a logged-in user's role doesn't match a
  route's required role (e.g. an employee visiting `/requests/new`, which is
  citizen-only), they're redirected to `/` rather than shown an error page.
- **Supabase placeholder fallback**: `supabaseClient.js` falls back to a
  placeholder URL/key if env vars are missing, so the app can still boot for
  UI development before real credentials are wired up (real auth calls would
  fail against the placeholder, as expected).
- **Signup email confirmation**: if Supabase has email confirmation enabled,
  `signUp` won't return a session immediately; the signup page detects this
  and shows a "check your email" message instead of navigating into the app.

## Known limitations (hackathon scope)

- No automated tests.
- No TypeScript / prop-types — plain JS per the project constraint.
- Minimal error handling beyond surfacing the backend's error message.
- Real login/data calls will not work until real Supabase credentials and the
  backend (`http://localhost:8000` by default) are both running.
