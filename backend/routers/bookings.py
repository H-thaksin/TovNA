from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import text

from database import engine
from core.security import decode_access_token


# =========================================================
# Router configuration
# =========================================================

router = APIRouter(
    prefix="/bookings",
    tags=["Bookings"],
)

security = HTTPBearer()


# =========================================================
# Request models
# =========================================================

class HotelBookingRequest(BaseModel):
    hotel_id: int = Field(gt=0)
    check_in: date
    nights: int = Field(ge=1, le=14)


# =========================================================
# Helper functions
# =========================================================

def money(value: Decimal) -> Decimal:
    """Round a monetary value to two decimal places."""
    return value.quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def get_authenticated_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> int:
    """
    Validate the access token and ensure the user account is active.
    """

    try:
        user_id = decode_access_token(credentials.credentials)

        # If your token decoder returns a payload dictionary,
        # extract its user ID here instead.
        if isinstance(user_id, dict):
            user_id = user_id.get("sub")

        user_id = int(user_id)

    except (Exception,):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    with engine.connect() as connection:
        user = connection.execute(
            text("""
                SELECT id
                FROM users
                WHERE id = :user_id
                  AND is_active = TRUE
            """),
            {"user_id": user_id},
        ).fetchone()

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User account is inactive or unavailable",
        )

    return user_id


def booking_to_dict(row) -> dict:
    """
    Convert a database row into a JSON-friendly dictionary.

    This function supports both:
    - Individual booking queries.
    - Booking-list queries that include hotel information.
    """

    data = row._mapping

    booking = {
        "id": data["id"],
        "user_id": data["user_id"],
        "booking_reference": data["booking_reference"],
        "booking_date": data["booking_date"],
        "total_amount": str(data["total_amount"]),
        "status": data["status"],
        "notes": data["notes"],
        "created_at": data["created_at"],
    }

    # These fields are present in the booking-list query,
    # but not in the individual booking query.
    optional_fields = (
        "hotel_id",
        "hotel_name",
        "hotel_image",
        "nights",
    )

    for field in optional_fields:
        if field in data:
            booking[field] = data[field]

    return booking


# =========================================================
# Create a hotel booking
# =========================================================

@router.post("/")
def create_hotel_booking(
    request: HotelBookingRequest,
    user_id: int = Depends(get_authenticated_user_id),
):
    """
    Create a hotel booking for the authenticated user.

    Prices are calculated using the hotel's database price.
    """

    # Validate the check-in date.
    if request.check_in < date.today():
        raise HTTPException(
            status_code=400,
            detail="Check-in date cannot be in the past",
        )

    # Retrieve the actual hotel price from the database.
    with engine.connect() as connection:
        hotel = connection.execute(
            text("""
                SELECT
                    id,
                    name,
                    price_per_night
                FROM hotels
                WHERE id = :hotel_id
                  AND is_active = TRUE
            """),
            {"hotel_id": request.hotel_id},
        ).fetchone()

    if hotel is None:
        raise HTTPException(
            status_code=404,
            detail="Hotel not found or unavailable",
        )

    # -----------------------------------------------------
    # Calculate booking prices
    # -----------------------------------------------------

    nightly_price = Decimal(str(hotel.price_per_night))

    base = money(
        nightly_price * request.nights
    )

    accommodation_tax = money(
        base * Decimal("0.02")
    )

    vat = money(
        base * Decimal("0.10")
    )

    service_charge = money(
        base * Decimal("0.10")
    )

    total = money(
        base
        + accommodation_tax
        + vat
        + service_charge
    )

    # Calculate the checkout date.
    check_out = request.check_in + timedelta(
        days=request.nights
    )

    # Generate a booking reference.
    booking_reference = f"TVN-{token_hex(6).upper()}"

    # Store the stay details in the booking notes because
    # the current booking model does not expose separate
    # check_in and check_out columns.
    notes = (
        f"Hotel: {hotel.name}; "
        f"Check-in: {request.check_in.isoformat()}; "
        f"Check-out: {check_out.isoformat()}; "
        f"Nights: {request.nights}; "
        f"Rooms: 1; "
        f"Base: {base}; "
        f"Accommodation tax: {accommodation_tax}; "
        f"VAT: {vat}; "
        f"Service charge: {service_charge}"
    )

    now = datetime.now()

    # -----------------------------------------------------
    # Save booking and booking item in one transaction
    # -----------------------------------------------------

    with engine.begin() as connection:

        booking = connection.execute(
            text("""
                INSERT INTO bookings (
                    user_id,
                    booking_reference,
                    booking_date,
                    total_amount,
                    status,
                    notes,
                    created_at
                )
                VALUES (
                    :user_id,
                    :reference,
                    :booking_date,
                    :total,
                    'pending',
                    :notes,
                    :created_at
                )
                RETURNING
                    id,
                    booking_reference,
                    total_amount,
                    status
            """),
            {
                "user_id": user_id,
                "reference": booking_reference,
                "booking_date": now,
                "total": total,
                "notes": notes,
                "created_at": now,
            },
        ).fetchone()

        # Save the hotel item associated with this booking.
        connection.execute(
            text("""
                INSERT INTO booking_items (
                    booking_id,
                    hotel_id,
                    quantity,
                    unit_price,
                    total_price
                )
                VALUES (
                    :booking_id,
                    :hotel_id,
                    :nights,
                    :nightly_price,
                    :base
                )
            """),
            {
                "booking_id": booking.id,
                "hotel_id": hotel.id,
                "nights": request.nights,
                "nightly_price": nightly_price,
                "base": base,
            },
        )

    # -----------------------------------------------------
    # Return the created booking
    # -----------------------------------------------------

    return {
        "message": "Hotel booking created successfully",
        "booking": {
            "id": booking.id,
            "booking_reference": booking.booking_reference,
            "hotel_id": hotel.id,
            "hotel_name": hotel.name,
            "check_in": request.check_in.isoformat(),
            "check_out": check_out.isoformat(),
            "nights": request.nights,
            "base": str(base),
            "accommodation_tax": str(accommodation_tax),
            "vat": str(vat),
            "service_charge": str(service_charge),
            "total_amount": str(booking.total_amount),
            "status": booking.status,
        },
    }


# =========================================================
# Get all bookings for the authenticated user
# =========================================================

@router.get("/")
def get_bookings(
    user_id: int = Depends(get_authenticated_user_id),
):
    """
    Return the authenticated user's bookings,
    including associated hotel information.
    """

    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    b.id,
                    b.user_id,
                    b.booking_reference,
                    b.booking_date,
                    b.total_amount,
                    b.status,
                    b.notes,
                    b.created_at,

                    h.id AS hotel_id,
                    h.name AS hotel_name,
                    h.image_url AS hotel_image,

                    bi.quantity AS nights

                FROM bookings AS b

                LEFT JOIN booking_items AS bi
                    ON bi.booking_id = b.id

                LEFT JOIN hotels AS h
                    ON h.id = bi.hotel_id

                WHERE b.user_id = :user_id

                ORDER BY b.id DESC
            """),
            {"user_id": user_id},
        )

        return [
            booking_to_dict(row)
            for row in result
        ]


# =========================================================
# Get one booking belonging to the authenticated user
# =========================================================


@router.get("/{booking_id}")
def get_booking(
    booking_id: int,
    user_id: int = Depends(get_authenticated_user_id),
):
    """
    Return one booking only if it belongs to the logged-in user,
    including its associated hotel information.
    """

    if booking_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Booking ID must be greater than zero",
        )

    with engine.connect() as connection:
        booking = connection.execute(
            text("""
                SELECT
                    b.id,
                    b.user_id,
                    b.booking_reference,
                    b.booking_date,
                    b.total_amount,
                    b.status,
                    b.notes,
                    b.created_at,

                    h.id AS hotel_id,
                    h.name AS hotel_name,
                    h.image_url AS hotel_image,

                    bi.quantity AS nights

                FROM bookings AS b

                LEFT JOIN booking_items AS bi
                    ON bi.booking_id = b.id

                LEFT JOIN hotels AS h
                    ON h.id = bi.hotel_id

                WHERE b.id = :booking_id
                  AND b.user_id = :user_id
            """),
            {
                "booking_id": booking_id,
                "user_id": user_id,
            },
        ).fetchone()

    if booking is None:
        raise HTTPException(
            status_code=404,
            detail="Booking not found",
        )

    return booking_to_dict(booking)


@router.patch("/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    user_id: int = Depends(get_authenticated_user_id),
):
    """
    Cancel a pending booking belonging to the logged-in user.
    """

    if booking_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Booking ID must be greater than zero",
        )

    with engine.begin() as connection:
        result = connection.execute(
            text("""
                UPDATE bookings
                SET status = 'cancelled'
                WHERE id = :booking_id
                  AND user_id = :user_id
                  AND LOWER(status) = 'pending'
                RETURNING id, status
            """),
            {
                "booking_id": booking_id,
                "user_id": user_id,
            },
        ).fetchone()

        if result is None:
            existing_booking = connection.execute(
                text("""
                    SELECT status
                    FROM bookings
                    WHERE id = :booking_id
                      AND user_id = :user_id
                """),
                {
                    "booking_id": booking_id,
                    "user_id": user_id,
                },
            ).fetchone()

            if existing_booking is None:
                raise HTTPException(
                    status_code=404,
                    detail="Booking not found",
                )

            raise HTTPException(
                status_code=400,
                detail=f"Only pending bookings can be cancelled. Current status: {existing_booking.status}",
            )

    return {
        "message": "Booking cancelled successfully",
        "booking_id": result.id,
        "status": result.status,
    }
