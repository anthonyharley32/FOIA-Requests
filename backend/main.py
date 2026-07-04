"""Unredacted backend -- FastAPI app.

Owns the AI clarification loop and all reads/writes to Supabase (via the
service-role client, which bypasses RLS). See README.md for setup/run
instructions and notes on deviations from the original spec.
"""
from fastapi import Depends, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app import db
from app.ai import get_ai_response
from app.auth import get_current_user, require_citizen, require_employee
from app.config import CORS_ORIGIN, DOCUMENTS_BUCKET, SUPABASE_URL
from app.schemas import IntentCreate, ReplyCreate, SubmitCreate
from app.supabase_client import get_service_client

app = FastAPI(title="Unredacted API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/me")
def me(user: dict = Depends(get_current_user)):
    return user


@app.post("/requests")
async def create_request(body: IntentCreate, user: dict = Depends(require_citizen)):
    insert_result = (
        get_service_client()
        .table("requests")
        .insert({"citizen_id": user["id"], "status": "clarifying", "intent_text": body.intent_text})
        .execute()
    )
    request_row = insert_result.data[0]
    request_id = request_row["id"]

    db.insert_message(request_id, "user", body.intent_text)

    ai_result = await get_ai_response(db.thread_for_ai(request_id))
    db.insert_message(request_id, "ai", ai_result["message"])

    if ai_result["ready"]:
        request_row = db.update_request(request_id, {"final_text": ai_result["final_text"]})

    return {
        "request": request_row,
        "messages": db.fetch_messages(request_id),
        "ready": ai_result["ready"],
        "suggested_agency": ai_result["suggested_agency"],
        "already_public_hint": ai_result["already_public_hint"],
    }


@app.post("/requests/{request_id}/reply")
async def reply_to_request(request_id: str, body: ReplyCreate, user: dict = Depends(require_citizen)):
    request_row = db.fetch_request_or_404(request_id)
    if request_row["citizen_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your request")
    if request_row["status"] != "clarifying":
        raise HTTPException(status_code=400, detail="Request is no longer in clarifying status")

    db.insert_message(request_id, "user", body.content)

    ai_result = await get_ai_response(db.thread_for_ai(request_id))
    db.insert_message(request_id, "ai", ai_result["message"])

    final_text = request_row.get("final_text")
    if ai_result["ready"]:
        request_row = db.update_request(request_id, {"final_text": ai_result["final_text"]})
        final_text = request_row["final_text"]

    return {
        "messages": db.fetch_messages(request_id),
        "ready": ai_result["ready"],
        "final_text": final_text,
        "suggested_agency": ai_result["suggested_agency"],
        "already_public_hint": ai_result["already_public_hint"],
    }


@app.post("/requests/{request_id}/submit")
def submit_request(request_id: str, body: SubmitCreate, user: dict = Depends(require_citizen)):
    request_row = db.fetch_request_or_404(request_id)
    if request_row["citizen_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your request")

    updates = {"status": "submitted"}
    if body.final_text is not None:
        updates["final_text"] = body.final_text

    request_row = db.update_request(request_id, updates)
    return {"request": request_row}


@app.get("/requests")
def list_requests(user: dict = Depends(get_current_user)):
    query = get_service_client().table("requests").select("*")
    if user["role"] == "citizen":
        query = query.eq("citizen_id", user["id"])
    else:
        query = query.in_("status", ["submitted", "under_review", "fulfilled"])
    result = query.order("created_at", desc=True).execute()
    return {"requests": result.data or []}


@app.get("/requests/{request_id}")
def get_request_detail(request_id: str, user: dict = Depends(get_current_user)):
    request_row = db.fetch_request_or_404(request_id)
    if user["role"] == "citizen" and request_row["citizen_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your request")

    return {
        "request": request_row,
        "messages": db.fetch_messages(request_id),
        "documents": db.fetch_documents(request_id),
    }


@app.post("/requests/{request_id}/documents")
async def upload_document(request_id: str, file: UploadFile, user: dict = Depends(require_employee)):
    request_row = db.fetch_request_or_404(request_id)

    file_bytes = await file.read()
    storage_path = f"{request_id}/{file.filename}"

    get_service_client().storage.from_(DOCUMENTS_BUCKET).upload(
        storage_path,
        file_bytes,
        {"content-type": file.content_type or "application/octet-stream", "upsert": "true"},
    )

    insert_result = (
        get_service_client()
        .table("documents")
        .insert({"request_id": request_id, "storage_path": storage_path, "uploaded_by": user["id"]})
        .execute()
    )
    document = insert_result.data[0]

    if request_row["status"] == "submitted":
        db.update_request(request_id, {"status": "under_review"})

    document["url"] = f"{SUPABASE_URL}/storage/v1/object/public/{DOCUMENTS_BUCKET}/{storage_path}"
    document["filename"] = file.filename
    return {"document": document}


@app.post("/requests/{request_id}/fulfill")
def fulfill_request(request_id: str, user: dict = Depends(require_employee)):
    db.fetch_request_or_404(request_id)
    request_row = db.update_request(request_id, {"status": "fulfilled"})
    return {"request": request_row}
