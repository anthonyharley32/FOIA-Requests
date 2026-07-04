"""Request body schemas."""
from pydantic import BaseModel


class IntentCreate(BaseModel):
    intent_text: str


class ReplyCreate(BaseModel):
    content: str


class SubmitCreate(BaseModel):
    final_text: str | None = None
