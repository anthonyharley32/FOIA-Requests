"""Thin data-access helpers around the Supabase service-role client.

Kept as plain functions (no ORM) since the spec calls for supabase-py only.
"""
from fastapi import HTTPException

from app.config import DOCUMENTS_BUCKET, SUPABASE_URL
from app.supabase_client import get_service_client


def fetch_request_or_404(request_id: str) -> dict:
    result = get_service_client().table("requests").select("*").eq("id", request_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Request not found")
    return result.data[0]


def fetch_messages(request_id: str) -> list[dict]:
    result = (
        get_service_client()
        .table("messages")
        .select("*")
        .eq("request_id", request_id)
        .order("created_at")
        .execute()
    )
    return result.data or []


def fetch_documents(request_id: str) -> list[dict]:
    result = (
        get_service_client()
        .table("documents")
        .select("*")
        .eq("request_id", request_id)
        .order("created_at")
        .execute()
    )
    docs = result.data or []
    for doc in docs:
        doc["url"] = f"{SUPABASE_URL}/storage/v1/object/public/{DOCUMENTS_BUCKET}/{doc['storage_path']}"
        doc["filename"] = doc["storage_path"].split("/")[-1]
    return docs


def insert_message(request_id: str, sender: str, content: str) -> dict:
    result = (
        get_service_client()
        .table("messages")
        .insert({"request_id": request_id, "sender": sender, "content": content})
        .execute()
    )
    return result.data[0]


def thread_for_ai(request_id: str) -> list[dict]:
    messages = fetch_messages(request_id)
    return [{"sender": m["sender"], "content": m["content"]} for m in messages if m["sender"] in ("user", "ai")]


def update_request(request_id: str, fields: dict) -> dict:
    result = get_service_client().table("requests").update(fields).eq("id", request_id).execute()
    if result.data:
        return result.data[0]
    return fetch_request_or_404(request_id)
