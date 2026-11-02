
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

from database import engine
from core.dependencies import get_current_user, ROLE_ADMIN, ROLE_CUSTOMER


router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
)


# =========================
# Helper: Check payment access
# =========================
def check_payment_access(current_user: dict):
    role = current_user["role"]

    if role not in (ROLE_ADMIN, ROLE_CUSTOMER):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to access payments",
        )


# =========================
# Get payments
# Admin: all payments
# Customer: own payments
# =========================
@router.get("/")
def get_payments(
    current_user: dict = Depends(get_current_user),
):
    check_payment_access(current_user)

    is_admin = current_user["role"] == ROLE_ADMIN

    query = """
        SELECT
            p.id,
            p.booking_id,
            p.amount,
            p.method,
            p.status,
            p.transaction_reference,
            p.paid_at
        FROM payments AS p
        JOIN bookings AS b
            ON b.id = p.booking_id
    """

    params = {}

    if not is_admin:
        query += " WHERE b.user_id = :user_id"
        params["user_id"] = current_user["id"]

    query += " ORDER BY p.id DESC"

    with engine.connect() as connection:
        result = connection.execute(
            text(query),
            params,
        )

        return [
            {
                "id": row.id,
                "booking_id": row.booking_id,
                "amount": row.amount,
                "method": row.method,
                "status": row.status,
                "transaction_reference": row.transaction_reference,
                "paid_at": row.paid_at,
            }
            for row in result
        ]


# =========================
# Get one payment
# Admin: any payment
# Customer: own payment only
# =========================
@router.get("/{payment_id}")
def get_payment(
    payment_id: int,
    current_user: dict = Depends(get_current_user),
):
    check_payment_access(current_user)

    if payment_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Payment ID must be greater than zero",
        )

    is_admin = current_user["role"] == ROLE_ADMIN

    query = """
        SELECT
            p.id,
            p.booking_id,
            p.amount,
            p.method,
            p.status,
            p.transaction_reference,
            p.paid_at
        FROM payments AS p
        JOIN bookings AS b
            ON b.id = p.booking_id
        WHERE p.id = :payment_id
    """

    params = {"payment_id": payment_id}

    if not is_admin:
        query += " AND b.user_id = :user_id"
        params["user_id"] = current_user["id"]

    with engine.connect() as connection:
        row = connection.execute(
            text(query),
            params,
        ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Payment not found",
        )

    return {
        "id": row.id,
        "booking_id": row.booking_id,
        "amount": row.amount,
        "method": row.method,
        "status": row.status,
        "transaction_reference": row.transaction_reference,
        "paid_at": row.paid_at,
    }
