from fastapi import APIRouter
from sqlalchemy import text

from database import engine


router = APIRouter(
    prefix="/payments",
    tags=["Payments"]
)


@router.get("/")
def get_payments():
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    booking_id,
                    amount,
                    method,
                    status,
                    transaction_reference,
                    paid_at
                FROM payments
            """)
        )

        payments = []

        for row in result:
            payments.append({
                "id": row.id,
                "booking_id": row.booking_id,
                "amount": row.amount,
                "method": row.method,
                "status": row.status,
                "transaction_reference": row.transaction_reference,
                "paid_at": row.paid_at
            })

        return payments


@router.get("/{payment_id}")
def get_payment(payment_id: int):
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    booking_id,
                    amount,
                    method,
                    status,
                    transaction_reference,
                    paid_at
                FROM payments
                WHERE id = :payment_id
            """),
            {"payment_id": payment_id}
        )

        row = result.fetchone()

        if row is None:
            return {"message": "Payment not found"}

        return {
            "id": row.id,
            "booking_id": row.booking_id,
            "amount": row.amount,
            "method": row.method,
            "status": row.status,
            "transaction_reference": row.transaction_reference,
            "paid_at": row.paid_at
        }