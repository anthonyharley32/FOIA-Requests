"""Auth dependency: validates a Supabase access token and loads the caller's
profile (id/email/role) from the `profiles` table.

Every endpoint except /health depends on `get_current_user`.
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.supabase_client import get_anon_client, get_service_client

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = credentials.credentials

    try:
        auth_response = get_anon_client().auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = getattr(auth_response, "user", None)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    try:
        profile_result = (
            get_service_client()
            .table("profiles")
            .select("id, email, role")
            .eq("id", user.id)
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=401, detail="No profile found for user")

    rows = profile_result.data or []
    if not rows:
        raise HTTPException(status_code=401, detail="No profile found for user")

    profile = rows[0]
    return {"id": profile["id"], "email": profile["email"], "role": profile["role"]}


def require_citizen(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "citizen":
        raise HTTPException(status_code=403, detail="Citizen role required")
    return user


def require_employee(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "employee":
        raise HTTPException(status_code=403, detail="Employee role required")
    return user
