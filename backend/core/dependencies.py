from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text

from database import engine
from core.security import decode_access_token


security = HTTPBearer()

# Single source of truth for role names (always compared in lowercase).
ROLE_ADMIN = "admin"
ROLE_AGENT = "agent"
ROLE_CUSTOMER = "customer"


# =========================
# Get Current User
# =========================
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    try:
        user_id = int(decode_access_token(credentials.credentials))
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    with engine.connect() as connection:
        user = connection.execute(
            text("""
                SELECT
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.role_id,
                    r.name AS role,
                    u.is_active
                FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.id = :user_id
            """),
            {"user_id": user_id},
        ).fetchone()

    # A valid token for a deleted user is an authentication problem (401),
    # not a "resource not found" (404).
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")

    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "role_id": user.role_id,
        "role": str(user.role).strip().lower(),  # normalised once, here
        "is_active": user.is_active,
    }


def is_admin(user: dict) -> bool:
    return user["role"] == ROLE_ADMIN


# =========================
# Role guards
# =========================
def require_roles(*allowed_roles: str):
    """Build a dependency that only lets the given roles through."""
    allowed = {role.lower() for role in allowed_roles}

    def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in allowed:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return dependency


require_admin = require_roles(ROLE_ADMIN)
require_agent = require_roles(ROLE_AGENT, ROLE_ADMIN)
require_customer = require_roles(ROLE_CUSTOMER, ROLE_AGENT, ROLE_ADMIN)