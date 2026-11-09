from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from database import engine
from core.dependencies import get_current_user, ROLE_ADMIN, ROLE_CUSTOMER


router = APIRouter(prefix="/payments", tags=["Payments"])


# ---------------------------------------------------------
# REQUEST MODELS
# ---------------------------------------------------------

class PaymentCheckout(BaseModel):
    booking_id: int = Field(gt=0)
    method: Literal["Cash", "ABA KHQR"]


class PaymentReferenceUpdate(BaseModel):
    # Spaces are trimmed first, so "   " is rejected as empty (422).
    model_config = ConfigDict(str_strip_whitespace=True)

    transaction_reference: str = Field(min_length=1, max_length=100)


class PaymentStatusUpdate(BaseModel):
    status: Literal["pending", "paid", "failed", "refunded"]


# Which status changes an admin may make.
#   pending  -> paid or failed
#   failed   -> pending (lets the customer resubmit) or paid
#   paid     -> refunded
#   refunded -> final
ALLOWED_STATUS_CHANGES = {
    "pending": {"paid", "failed"},
    "failed": {"pending", "paid"},
    "paid": {"refunded"},
    "refunded": set(),
}


# ---------------------------------------------------------
# ACCESS HELPERS
# ---------------------------------------------------------

def check_payment_access(current_user: dict):
    if current_user["role"] not in [ROLE_ADMIN, ROLE_CUSTOMER]:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to access payments."
        )


def check_admin_access(current_user: dict):
    if current_user["role"] != ROLE_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Admin permission required."
        )


def check_customer_access(current_user: dict):
    if current_user["role"] != ROLE_CUSTOMER:
        raise HTTPException(
            status_code=403,
            detail="Customer permission required."
        )


# ---------------------------------------------------------
# COMMON PAYMENT SELECT
# ---------------------------------------------------------

PAYMENT_SELECT = """
    SELECT
        p.id,
        p.booking_id,
        b.booking_reference,
        b.status AS booking_status,
        b.total_amount AS booking_total,
        b.user_id,

        u.first_name,
        u.last_name,
        CONCAT_WS(' ', u.first_name, u.last_name) AS customer_name,
        u.email AS customer_email,

        p.amount,
        p.method,
        p.status,
        p.transaction_reference,
        p.paid_at

    FROM payments p
    JOIN bookings b ON p.booking_id = b.id
    JOIN users u ON b.user_id = u.id
"""


def fetch_payment(connection, payment_id: int):
    return connection.execute(
        text(PAYMENT_SELECT + " WHERE p.id = :payment_id"),
        {"payment_id": payment_id}
    ).mappings().fetchone()


# ---------------------------------------------------------
# ADMIN PAYMENT STATISTICS
# GET /payments/admin/stats
# ---------------------------------------------------------

@router.get("/admin/stats")
def get_payment_stats(
    current_user: dict = Depends(get_current_user)
):
    check_admin_access(current_user)

    # Revenue counts only paid payments whose booking is still confirmed,
    # so cancelled or rejected bookings never add to it.
    query = """
        SELECT
            COUNT(*) AS total_payments,

            COUNT(*) FILTER (WHERE p.status = 'paid') AS paid_count,
            COUNT(*) FILTER (WHERE p.status = 'pending') AS pending_count,
            COUNT(*) FILTER (WHERE p.status = 'failed') AS failed_count,
            COUNT(*) FILTER (WHERE p.status = 'refunded') AS refunded_count,

            COALESCE(
                SUM(p.amount) FILTER (
                    WHERE p.status = 'paid'
                    AND b.status = 'confirmed'
                ),
                0
            ) AS total_revenue,

            COALESCE(SUM(p.amount), 0) AS total_payment_amount

        FROM payments p
        JOIN bookings b ON p.booking_id = b.id
    """

    with engine.connect() as connection:
        row = connection.execute(text(query)).mappings().fetchone()

    return dict(row)


# ---------------------------------------------------------
# CUSTOMER CHECKOUT
# POST /payments/checkout
# ---------------------------------------------------------

@router.post("/checkout", status_code=201)
def create_payment(
    data: PaymentCheckout,
    current_user: dict = Depends(get_current_user)
):
    check_customer_access(current_user)

    user_id = current_user["id"]

    try:
        with engine.begin() as connection:

            # Lock the booking while checking and creating its payment.
            booking = connection.execute(
                text("""
                    SELECT id, user_id, status, total_amount
                    FROM bookings
                    WHERE id = :booking_id
                    FOR UPDATE
                """),
                {"booking_id": data.booking_id}
            ).mappings().fetchone()

            # Same answer for "missing" and "not yours" so IDs can't be probed.
            if not booking or booking["user_id"] != user_id:
                raise HTTPException(
                    status_code=404,
                    detail="Booking not found."
                )

            if booking["status"] != "confirmed":
                raise HTTPException(
                    status_code=400,
                    detail="You can only pay for confirmed bookings."
                )

            existing_payment = connection.execute(
                text("SELECT id FROM payments WHERE booking_id = :booking_id"),
                {"booking_id": data.booking_id}
            ).fetchone()

            if existing_payment:
                raise HTTPException(
                    status_code=409,
                    detail="A payment already exists for this booking."
                )

            # The amount always comes from the booking, never from the client.
            payment_id = connection.execute(
                text("""
                    INSERT INTO payments (booking_id, amount, method, status)
                    VALUES (:booking_id, :amount, :method, 'pending')
                    RETURNING id
                """),
                {
                    "booking_id": data.booking_id,
                    "amount": booking["total_amount"],
                    "method": data.method,
                }
            ).scalar_one()

            payment = fetch_payment(connection, payment_id)

            return {
                "message": "Payment created successfully.",
                "payment": dict(payment)
            }

    except IntegrityError:
        # The unique index on payments.booking_id catches a double click
        # or two requests arriving at the same moment.
        raise HTTPException(
            status_code=409,
            detail="A payment already exists for this booking."
        )


# ---------------------------------------------------------
# CUSTOMER SUBMITS ABA TRANSACTION REFERENCE
# PATCH /payments/{payment_id}/reference
# ---------------------------------------------------------

@router.patch("/{payment_id}/reference")
def update_payment_reference(
    payment_id: int,
    data: PaymentReferenceUpdate,
    current_user: dict = Depends(get_current_user)
):
    check_customer_access(current_user)

    user_id = current_user["id"]
    reference = data.transaction_reference

    try:
        with engine.begin() as connection:

            payment = connection.execute(
                text("""
                    SELECT
                        p.id,
                        p.status,
                        p.method,
                        b.user_id,
                        b.status AS booking_status
                    FROM payments p
                    JOIN bookings b ON p.booking_id = b.id
                    WHERE p.id = :payment_id
                    FOR UPDATE OF p
                """),
                {"payment_id": payment_id}
            ).mappings().fetchone()

            if not payment or payment["user_id"] != user_id:
                raise HTTPException(
                    status_code=404,
                    detail="Payment not found."
                )

            if payment["method"] != "ABA KHQR":
                raise HTTPException(
                    status_code=400,
                    detail="Transaction references are only accepted for ABA KHQR payments."
                )

            if payment["status"] != "pending":
                raise HTTPException(
                    status_code=400,
                    detail="You can only update the reference for pending payments."
                )

            if payment["booking_status"] != "confirmed":
                raise HTTPException(
                    status_code=400,
                    detail="This booking is no longer confirmed."
                )

            # One bank transaction can only back one payment.
            duplicate = connection.execute(
                text("""
                    SELECT 1
                    FROM payments
                    WHERE transaction_reference = :reference
                    AND id <> :payment_id
                """),
                {"reference": reference, "payment_id": payment_id}
            ).fetchone()

            if duplicate:
                raise HTTPException(
                    status_code=409,
                    detail="This transaction reference is already used by another payment."
                )

            connection.execute(
                text("""
                    UPDATE payments
                    SET transaction_reference = :reference
                    WHERE id = :payment_id
                """),
                {"reference": reference, "payment_id": payment_id}
            )

            updated_payment = fetch_payment(connection, payment_id)

    except IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="This transaction reference is already used by another payment."
        )

    return {
        "message": "Transaction reference submitted successfully.",
        "payment": dict(updated_payment)
    }


# ---------------------------------------------------------
# GET ALL PAYMENTS
# GET /payments/
# ---------------------------------------------------------

@router.get("/")
def get_payments(
    current_user: dict = Depends(get_current_user)
):
    check_payment_access(current_user)

    query = PAYMENT_SELECT
    params = {}

    # Customers only ever see their own payments.
    if current_user["role"] != ROLE_ADMIN:
        query += " WHERE b.user_id = :user_id"
        params["user_id"] = current_user["id"]

    query += " ORDER BY p.id DESC"

    with engine.connect() as connection:
        rows = connection.execute(text(query), params).mappings().fetchall()

    return [dict(row) for row in rows]


# ---------------------------------------------------------
# GET PAYMENT DETAIL
# GET /payments/{payment_id}
# ---------------------------------------------------------

@router.get("/{payment_id}")
def get_payment(
    payment_id: int,
    current_user: dict = Depends(get_current_user)
):
    check_payment_access(current_user)

    query = PAYMENT_SELECT + " WHERE p.id = :payment_id"
    params = {"payment_id": payment_id}

    if current_user["role"] != ROLE_ADMIN:
        query += " AND b.user_id = :user_id"
        params["user_id"] = current_user["id"]

    with engine.connect() as connection:
        row = connection.execute(text(query), params).mappings().fetchone()

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Payment not found."
        )

    return dict(row)


# ---------------------------------------------------------
# ADMIN UPDATE PAYMENT STATUS
# PATCH /payments/{payment_id}/status
# ---------------------------------------------------------

@router.patch("/{payment_id}/status")
def update_payment_status(
    payment_id: int,
    data: PaymentStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    check_admin_access(current_user)

    with engine.begin() as connection:

        payment = connection.execute(
            text("""
                SELECT
                    p.id,
                    p.status AS payment_status,
                    b.status AS booking_status
                FROM payments p
                JOIN bookings b ON p.booking_id = b.id
                WHERE p.id = :payment_id
                FOR UPDATE OF p
            """),
            {"payment_id": payment_id}
        ).mappings().fetchone()

        if not payment:
            raise HTTPException(
                status_code=404,
                detail="Payment not found."
            )

        current_status = payment["payment_status"]

        if data.status == current_status:
            raise HTTPException(
                status_code=400,
                detail=f"Payment is already {current_status}."
            )

        if data.status not in ALLOWED_STATUS_CHANGES.get(current_status, set()):
            raise HTTPException(
                status_code=400,
                detail=f"A {current_status} payment cannot be changed to {data.status}."
            )

        if data.status == "paid":
            if payment["booking_status"] in ("cancelled", "rejected"):
                raise HTTPException(
                    status_code=400,
                    detail="Payments for cancelled or rejected bookings cannot be marked as paid."
                )

            if payment["booking_status"] != "confirmed":
                raise HTTPException(
                    status_code=400,
                    detail="Payment cannot be marked as paid unless the booking is confirmed."
                )

        # paid_at is set once, the first time a payment becomes paid.
        paid_at_sql = (
            ", paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP)"
            if data.status == "paid"
            else ""
        )

        connection.execute(
            text(f"""
                UPDATE payments
                SET status = :new_status{paid_at_sql}
                WHERE id = :payment_id
            """),
            {"new_status": data.status, "payment_id": payment_id}
        )

        updated_payment = fetch_payment(connection, payment_id)

    return {
        "message": "Payment status updated successfully.",
        "payment": dict(updated_payment)
    }