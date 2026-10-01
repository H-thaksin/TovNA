from fastapi import APIRouter
from sqlalchemy import text

from database import engine


router = APIRouter(
    prefix="/bookings",
    tags=["Bookings"]
)


@router.get("/")
def get_bookings():
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    user_id,
                    booking_reference,
                    booking_date,
                    total_amount,
                    status,
                    notes,
                    created_at
                FROM bookings
            """)
        )

        bookings = []

        for row in result:
            bookings.append({
                "id": row.id,
                "user_id": row.user_id,
                "booking_reference": row.booking_reference,
                "booking_date": row.booking_date,
                "total_amount": row.total_amount,
                "status": row.status,
                "notes": row.notes,
                "created_at": row.created_at
            })

        return bookings


@router.get("/{booking_id}")
def get_booking(booking_id: int):
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    user_id,
                    booking_reference,
                    booking_date,
                    total_amount,
                    status,
                    notes,
                    created_at
                FROM bookings
                WHERE id = :booking_id
            """),
            {"booking_id": booking_id}
        )

        row = result.fetchone()

        if row is None:
            return {"message": "Booking not found"}

        return {
            "id": row.id,
            "user_id": row.user_id,
            "booking_reference": row.booking_reference,
            "booking_date": row.booking_date,
            "total_amount": row.total_amount,
            "status": row.status,
            "notes": row.notes,
            "created_at": row.created_at
        }