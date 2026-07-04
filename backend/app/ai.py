"""OpenRouter integration: grounded-answer-or-FOIA clarification loop.

Given the message thread so far, we first run lightweight keyword retrieval
over our small public-records corpus (app/corpus.py). We hand the retrieved
documents to the model and ask it to decide between two modes:

  mode == "answer": the retrieved public records actually answer the user's
    question. The model writes a concise answer with inline [1] [2] markers
    that reference the numbered documents we provided. The citation CARDS
    (title/source/url) are attached by THIS backend from the corpus, never by
    the model, so citations can't be hallucinated.

  mode == "foia": the records don't answer it (or the user wants records that
    aren't public), so we fall back to the original behavior -- ask one
    clarifying question at a time, then produce a structured FOIA request.

Strict JSON shape returned to callers (all keys always present):
  {
    "mode": "answer" | "foia",
    "answer": "... or null",           # answer-mode text with [n] markers
    "citations": [ {n,title,snippet,source,url}, ... ],  # [] unless answer mode
    "ready": true|false,               # foia mode: request ready to submit
    "message": "...",                  # foia mode: question or confirmation
    "final_text": "... or null",       # foia mode: structured request text
    "suggested_agency": "... or null",
    "already_public_hint": "... or null"
  }
"""
import json

import httpx

from app.config import OPENROUTER_API_KEY, OPENROUTER_MODEL
from app.corpus import retrieve

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

SYSTEM_PROMPT = """You are Unredacted, a government-transparency assistant. A citizen asks about \
government records. You have TWO jobs and must choose the right one each turn.

You will be given a numbered list of PUBLIC RECORDS retrieved from our corpus (may be empty).

JOB 1 -- ANSWER FROM PUBLIC RECORDS (mode = "answer"):
If the retrieved records actually contain enough information to answer the user's question, answer \
it directly and concisely, like a research assistant. Cite your sources INLINE using bracketed \
numbers that refer to the numbered documents provided, e.g. "Oswald was found to have acted alone \
[1], though a later committee suggested a probable conspiracy [2]." Only cite document numbers that \
were actually provided to you. Set mode = "answer" and put the answer in "answer". This helps the \
citizen avoid filing a FOIA request for something already public.

JOB 2 -- HELP FILE A FOIA REQUEST (mode = "foia"):
If the retrieved records are empty or do NOT answer the question, or the user clearly wants records \
that aren't in the public set, switch to helping them file a FOIA request. Decide if their request \
is specific enough for a FOIA officer to act on immediately (clear subject/agency, bounded date \
range, specific scope). If NOT specific enough, ask exactly ONE clarifying question (the single most \
important missing detail). If it IS specific enough, set ready = true and write the full structured \
FOIA request text in "final_text": clear description of records sought, explicit date range, \
suggested search terms, polite-but-firm tone, and placeholders reminding the requester to add their \
contact info, fee category, and preferred format. Set mode = "foia".

On EVERY foia-mode turn also provide:
- suggested_agency: your best guess at the specific federal agency/office likely to hold the records \
(e.g. "National Archives and Records Administration"), or null if no reasonable guess.
- already_public_hint: a short note ONLY if you know this record type is often already public, else null.

Respond with ONLY a single JSON object, no markdown fences, exactly this shape:
{"mode":"answer" or "foia","answer":"... or null","ready":true or false,"message":"...","final_text":"... or null","suggested_agency":"... or null","already_public_hint":"... or null"}

Rules:
- mode="answer": fill "answer" (with [n] citations); set ready=false, message="Answered from public \
records.", final_text=null.
- mode="foia", not ready: answer=null, ready=false, message=the one clarifying question, final_text=null.
- mode="foia", ready: answer=null, ready=true, message="Your request is ready to submit.", \
final_text=the full request text.
"""


def _format_docs(docs: list[dict]) -> str:
    if not docs:
        return "(no matching public records found)"
    lines = []
    for i, d in enumerate(docs, start=1):
        lines.append(f"[{i}] {d['title']} — {d['source']}\n{d['text']}")
    return "\n\n".join(lines)


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines:
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def _parse_ai_json(raw: str, docs: list[dict]) -> dict:
    cleaned = _strip_code_fences(raw)
    try:
        parsed = json.loads(cleaned)
    except (json.JSONDecodeError, TypeError):
        return _foia_result(
            ready=False,
            message=raw.strip() or "Could you provide more detail?",
        )

    mode = "answer" if parsed.get("mode") == "answer" and parsed.get("answer") else "foia"

    if mode == "answer":
        # Citation cards come from OUR corpus, not the model -- integrity.
        citations = [
            {
                "n": i,
                "title": d["title"],
                "snippet": d["text"],
                "source": d["source"],
                "url": d["url"],
            }
            for i, d in enumerate(docs, start=1)
        ]
        return {
            "mode": "answer",
            "answer": parsed.get("answer"),
            "citations": citations,
            "ready": False,
            "message": parsed.get("message") or "Answered from public records.",
            "final_text": None,
            "suggested_agency": None,
            "already_public_hint": None,
        }

    ready = bool(parsed.get("ready", False))
    return _foia_result(
        ready=ready,
        message=parsed.get("message")
        or ("Your request is ready to submit." if ready else "Could you provide more detail?"),
        final_text=parsed.get("final_text") if ready else None,
        suggested_agency=parsed.get("suggested_agency") or None,
        already_public_hint=parsed.get("already_public_hint") or None,
    )


def _foia_result(ready, message, final_text=None, suggested_agency=None, already_public_hint=None) -> dict:
    return {
        "mode": "foia",
        "answer": None,
        "citations": [],
        "ready": ready,
        "message": message,
        "final_text": final_text,
        "suggested_agency": suggested_agency,
        "already_public_hint": already_public_hint,
    }


async def get_ai_response(thread: list[dict]) -> dict:
    """thread: list of {"sender": "user"|"ai", "content": str} in order."""
    last_user = next((t["content"] for t in reversed(thread) if t["sender"] == "user"), "")
    docs = retrieve(last_user)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for turn in thread:
        role = "assistant" if turn["sender"] == "ai" else "user"
        messages.append({"role": role, "content": turn["content"]})
    messages.append(
        {"role": "user", "content": f"RETRIEVED PUBLIC RECORDS:\n{_format_docs(docs)}"}
    )

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

    async with httpx.AsyncClient(timeout=45) as client:
        response = await client.post(OPENROUTER_URL, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    raw_content = data["choices"][0]["message"]["content"]
    return _parse_ai_json(raw_content, docs)
