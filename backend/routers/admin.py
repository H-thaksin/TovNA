"""Dashboard stats and user management. Agents get limited stats; admins get everything."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from database import engine
from core.dependencies import ROLE_ADMIN, require_admin, require_agent

router = APIRouter(prefix="/admin", tags=["Admin"])


# ---------- Dashboard ----------
@router.get("/stats")
def dashboard_stats(current_user: dict = Depends(require_agent)):
    with engine.connect() as connection:
        rows = connection.execute(text("""
            SELECT LOWER(status) AS status, COUNT(*) AS n
            FROM bookings GROUP BY LOWER(status)
        """)).fetchall()
        by_status = {r.status: r.n for r in rows}

        data = {
            "role": current_user["role"],
            "bookings": {
                "total": sum(by_status.values()),
                "pending": by_status.get("pending", 0),
                "confirmed": by_status.get("confirmed", 0),
                "rejected": by_status.get("rejected", 0),
                "cancelled": by_status.get("cancelled", 0),
            },
        }

        if current_user["role"] == ROLE_ADMIN:
            u = connection.execute(text("""
                SELECT COUNT(*) AS total,
                       COUNT(*) FILTER (WHERE LOWER(r.name) = 'customer') AS customers,
                       COUNT(*) FILTER (WHERE LOWER(r.name) IN ('agent', 'admin')) AS staff
                FROM users u JOIN roles r ON r.id = u.role_id
            """)).fetchone()
            revenue = connection.execute(text("""
                SELECT COALESCE(SUM(total_amount), 0) AS revenue
                FROM bookings WHERE LOWER(status) = 'confirmed'
            """)).scalar()
            data["users"] = {"total": u.total, "customers": u.customers, "staff": u.staff}
            data["revenue"] = str(revenue)  # confirmed bookings; switch to payments if you prefer

    return data


# ---------- Users (admin only) ----------
@router.get("/users")
def list_users(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(require_admin),
):
    with engine.connect() as connection:
        rows = connection.execute(
            text("""
                SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
                       u.role_id, r.name AS role, u.is_active
                FROM users u JOIN roles r ON r.id = u.role_id
                ORDER BY u.id LIMIT :limit OFFSET :offset
            """),
            {"limit": limit, "offset": offset},
        )
        return [dict(r._mapping) for r in rows]  # password_hash is never selected


class RoleUpdate(BaseModel):
    role_id: int


@router.patch("/users/{user_id}/role")
def change_user_role(user_id: int, body: RoleUpdate, current_user: dict = Depends(require_admin)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="You cannot change your own role")

    with engine.begin() as connection:
        role = connection.execute(
            text("SELECT id, name FROM roles WHERE id = :id"), {"id": body.role_id}
        ).fetchone()
        if role is None:
            raise HTTPException(status_code=400, detail="Unknown role")

        updated = connection.execute(
            text("UPDATE users SET role_id = :role_id WHERE id = :id RETURNING id"),
            {"role_id": body.role_id, "id": user_id},
        ).fetchone()
        if updated is None:
            raise HTTPException(status_code=404, detail="User not found")

    return {"message": "Role updated", "user_id": user_id, "role": str(role.name).lower()}


class ActiveUpdate(BaseModel):
    is_active: bool


@router.patch("/users/{user_id}/active")
def set_user_active(user_id: int, body: ActiveUpdate, current_user: dict = Depends(require_admin)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="You cannot disable your own account")

    with engine.begin() as connection:
        updated = connection.execute(
            text("UPDATE users SET is_active = :a WHERE id = :id RETURNING id"),
            {"a": body.is_active, "id": user_id},
        ).fetchone()
    if updated is None:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Account updated", "user_id": user_id, "is_active": body.is_active}