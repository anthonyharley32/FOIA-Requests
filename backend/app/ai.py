"""OpenRouter integration for the AI clarification loop.

Given the message thread so far (user/ai turns, in order) for a FOIA request,
ask the model whether the request is specific enough for a FOIA officer to
act on immediately. The model must respond with strict JSON:

    {
      "ready": true|false,
      "message": "...",
      "final_text": "... or null",
      "suggested_agency": "... or null",
      "already_public_hint": "... or null"
    }

`suggested_agency` and `already_public_hint` are ephemeral -- they are never
persisted to the database, just returned to the frontend on each AI turn so
the tool stays useful even with zero real government integration (pointing
the citizen at the right agency, or flagging that similar records may already
be public).

Parsing is defensive: markdown code fences are stripped before json.loads,
and missing/malformed fields fall back to safe defaults so a single bad
model response never 500s the request flow.
"""
import json

import httpx

from app.config import OPENROUTER_API_KEY, OPENROUTER_MODEL

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

SYSTEM_PROMPT = """You are a FOIA (Freedom of Information Act) request assistant embedded in a \
platform called Unredacted. Citizens describe, in plain language, what government records they \
want. Your job is to decide whether their request is now specific enough for a FOIA officer to \
act on immediately -- i.e. it has a clear subject/agency, a reasonable and bounded date range, \
and a specific enough scope that an officer could identify custodians and start searching today \
without sending a clarification letter back.

If the request is NOT yet specific enough, ask exactly ONE clarifying question -- the single \
most important missing detail (usually date range, specific agency/office, or scope/subject). \
Do not ask multiple questions at once.

If the request IS specific enough, produce the final, well-structured FOIA request text: a clear \
description of the records sought, an explicit date range, suggested search terms/keywords, a \
polite but firm professional tone, and a placeholder note reminding the requester to fill in their \
contact information, fee category (e.g. journalist/non-commercial/commercial requester), and \
preferred format for records (e.g. electronic/PDF).

Additionally, on EVERY turn (whether or not the request is ready yet), do your best to help the \
citizen even without any real agency integration:
- suggested_agency: your best guess, from your own general knowledge, at the specific federal \
agency or office likely to hold these records (e.g. "Department of Energy, Loan Programs Office"). \
This is a best-effort guess, not a verified lookup -- give your best answer whenever you can \
reasonably infer one from the subject matter, null only if truly no reasonable guess is possible.
- already_public_hint: ONLY if you happen to know that this type of record is often already \
published somewhere public (e.g. an agency FOIA reading room, NARA, a public docket, FOIA.gov), \
give a short one-sentence note saying so. If you don't know of anything specific, return null -- \
do not force a guess or invent a source.

Examples of the judgment call:
- "Emails about the new highway project" -> NOT ready (no agency, no date range, no subject specificity).
- "Emails between the CHIPS Program Office and Intel discussing schedule delays on the Ohio fab \
project, sent between January 2025 and June 2025" -> READY. suggested_agency: "Department of \
Commerce, CHIPS Program Office".
- "Records about police misconduct" -> NOT ready (no department, no date range, no specific \
incident/officer/subject).

You must respond with ONLY a single JSON object, no markdown fences, no commentary, matching \
exactly this shape:
{"ready": true or false, "message": "...", "final_text": "... or null", "suggested_agency": "... or null", "already_public_hint": "... or null"}

Rules for the JSON fields:
- If ready is false: message = the one clarifying question to ask next; final_text = null.
- If ready is true: message = a short confirmation such as "Your request is ready to submit."; \
final_text = the full structured FOIA request text described above.
- suggested_agency and already_public_hint follow the rules above regardless of ready's value.
"""


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        # drop the opening fence line (``` or ```json)
        if lines:
            lines = lines[1:]
        # drop a trailing fence line if present
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def _parse_ai_json(raw: str) -> dict:
    cleaned = _strip_code_fences(raw)
    try:
        parsed = json.loads(cleaned)
    except (json.JSONDecodeError, TypeError):
        # Model didn't return valid JSON -- fail safe by treating the raw
        # text as a clarifying question rather than crashing the request.
        return {
            "ready": False,
            "message": raw.strip() or "Could you provide more detail?",
            "final_text": None,
            "suggested_agency": None,
            "already_public_hint": None,
        }

    ready = bool(parsed.get("ready", False))
    message = parsed.get("message") or ("Your request is ready to submit." if ready else "Could you provide more detail?")
    final_text = parsed.get("final_text") if ready else None
    suggested_agency = parsed.get("suggested_agency") or None
    already_public_hint = parsed.get("already_public_hint") or None
    return {
        "ready": ready,
        "message": message,
        "final_text": final_text,
        "suggested_agency": suggested_agency,
        "already_public_hint": already_public_hint,
    }


async def get_ai_response(thread: list[dict]) -> dict:
    """thread: list of {"sender": "user"|"ai", "content": str} in order."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for turn in thread:
        role = "assistant" if turn["sender"] == "ai" else "user"
        messages.append({"role": role, "content": turn["content"]})

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": messages,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://unredacted.hackathon.local",
        "X-Title": "Unredacted",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(OPENROUTER_URL, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    raw_content = data["choices"][0]["message"]["content"]
    return _parse_ai_json(raw_content)
