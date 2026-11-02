import json
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from secrets import token_hex
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text

from database import engine
from core.dependencies import (
    get_current_user,
    require_admin,
    ROLE_ADMIN,
    ROLE_AGENT,
)

# =========================================================
# Router configuration
# =========================================================

router = APIRouter(
    prefix="/bookings",
    tags=["Bookings"],
)

BookingStatus = Literal["pending", "confirmed", "rejected", "cancelled"]


# =========================================================
# Request models
# =========================================================

class HotelBookingRequest(BaseModel):
    hotel_id: int = Field(gt=0)
    check_in: date
    nights: int = Field(ge=1, le=14)


class TransportationBookingRequest(BaseModel):
    transportation_id: int = Field(gt=0)
    travel_date: date
    passengers: int = Field(ge=1, le=20)


class TourBookingRequest(BaseModel):
    tour_id: int = Field(gt=0)
    tour_date: date
    participants: int = Field(ge=1, le=50)


class ActivityBookingRequest(BaseModel):
    activity_id: int = Field(gt=0)
    activity_date: date
    participants: int = Field(ge=1, le=50)


class BookingStatusUpdate(BaseModel):
    # Adjust these values if your database uses different status names.
    status: BookingStatus


# =========================================================
# Permissions
# =========================================================

def _role(user: dict) -> str:
    """Normalise the role so 'Agent' / 'agent' / 'AGENT' all match."""
    return str(user.get("role", "")).strip().lower()


STAFF_ROLES = {str(ROLE_AGENT).lower(), str(ROLE_ADMIN).lower()}


def is_staff(user: dict) -> bool:
    return _role(user) in STAFF_ROLES


def is_admin(user: dict) -> bool:
    return _role(user) == str(ROLE_ADMIN).lower()


def require_staff(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Agent OR Admin. Defined here so this router does not depend on how
    require_agent is written in core/dependencies.py.
    """
    if not is_staff(current_user):
        raise HTTPException(
            status_code=403,
            detail="Agent or admin access required",
        )
    return current_user


# =========================================================
# Helper functions
# =========================================================

# Only these columns may be used as the service column in booking_items.
ITEM_COLUMNS = {"hotel_id", "transportation_id", "tour_id", "activity_id"}


def money(value: Decimal) -> Decimal:
    """Round a monetary value to two decimal places."""
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def validate_booking_id(booking_id: int) -> None:
    if booking_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Booking ID must be greater than zero",
        )


def validate_future_date(value: date, label: str) -> None:
    if value < date.today():
        raise HTTPException(
            status_code=400,
            detail=f"{label} cannot be in the past",
        )


def validate_price(price, label: str) -> Decimal:
    if price is None:
        raise HTTPException(
            status_code=400,
            detail=f"{label} has no price set",
        )
    value = Decimal(str(price))
    if value < 0:
        raise HTTPException(
            status_code=400,
            detail=f"{label} price cannot be negative",
        )
    return value


def create_booking_with_item(
    *,
    user_id: int,
    total: Decimal,
    notes: str,
    item_column: str,
    service_id: int,
    quantity: int,
    unit_price: Decimal,
    item_total: Decimal,
    service_date: date,
):
    """
    Insert a booking and its single booking item in one transaction.
    If either INSERT fails, both are rolled back.
    """
    if item_column not in ITEM_COLUMNS:
        raise ValueError(f"Invalid item column: {item_column}")

    booking_reference = f"TVN-{token_hex(6).upper()}"
    now = datetime.now()

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

        # item_column is checked against ITEM_COLUMNS above, so this is safe.
        connection.execute(
            text(f"""
                INSERT INTO booking_items (
                    booking_id,
                    {item_column},
                    quantity,
                    unit_price,
                    total_price,
                    service_date
                )
                VALUES (
                    :booking_id,
                    :service_id,
                    :quantity,
                    :unit_price,
                    :total_price,
                    :service_date
                )
            """),
            {
                "booking_id": booking.id,
                "service_id": service_id,
                "quantity": quantity,
                "unit_price": unit_price,
                "total_price": item_total,
                "service_date": service_date,
            },
        )

    return booking


def booking_to_dict(row) -> dict:
    """Convert a booking row and its items into a dictionary."""
    data = row._mapping

    items = data["items"] or []
    if isinstance(items, str):  # some drivers return jsonb as a string
        items = json.loads(items)

    # Prices are already text from SQL; str() keeps them consistent.
    for item in items:
        for key in ("unit_price", "total_price"):
            if item.get(key) is not None:
                item[key] = str(item[key])

    booking = {
        "id": data["id"],
        "user_id": data["user_id"],
        "booking_reference": data["booking_reference"],
        "booking_date": data["booking_date"],
        "total_amount": str(data["total_amount"]),
        "status": data["status"],
        "notes": data["notes"],
        "created_at": data["created_at"],
        "items": items,
    }

    # Keep the old fields for frontend compatibility.
    if items:
        first = items[0]
        kind = first.get("service_type")

        if kind == "hotel":
            booking.update({
                "hotel_id": first["service_id"],
                "hotel_name": first["service_name"],
                "hotel_image": first.get("image_url"),
                "nights": first["quantity"],
            })

        elif kind == "transportation":
            booking.update({
                "transportation_id": first["service_id"],
                "transport_type": first.get("service_type_name"),
                "transport_provider": first["service_name"],
                "transport_unit_price": first.get("unit_price"),
                "from_destination": first.get("from_destination"),
                "to_destination": first.get("to_destination"),
            })

        elif kind == "tour":
            booking.update({
                "tour_id": first["service_id"],
                "tour_name": first["service_name"],
                "tour_image": first.get("image_url"),
                "participants": first["quantity"],
            })

        elif kind == "activity":
            booking.update({
                "activity_id": first["service_id"],
                "activity_name": first["service_name"],
                "activity_image": first.get("image_url"),
                "participants": first["quantity"],
            })

    return booking


# Prices are cast to text inside the JSON so they keep their exact
# value (e.g. "150.00") instead of becoming a float (150.0).
BOOKING_SELECT_SQL = """
    SELECT
        b.id,
        b.user_id,
        b.booking_reference,
        b.booking_date,
        b.total_amount,
        b.status,
        b.notes,
        b.created_at,

        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'booking_item_id', bi.id,

                    'service_type',
                    CASE
                        WHEN bi.hotel_id IS NOT NULL THEN 'hotel'
                        WHEN bi.transportation_id IS NOT NULL THEN 'transportation'
                        WHEN bi.tour_id IS NOT NULL THEN 'tour'
                        WHEN bi.activity_id IS NOT NULL THEN 'activity'
                    END,

                    'service_id',
                    COALESCE(
                        bi.hotel_id,
                        bi.transportation_id,
                        bi.tour_id,
                        bi.activity_id
                    ),

                    'service_name',
                    COALESCE(
                        h.name,
                        tr.provider,
                        tour.name,
                        activity.name
                    ),

                    'service_type_name', tr.type,

                    'image_url',
                    COALESCE(
                        h.image_url,
                        tour.image_url,
                        activity.image_url
                    ),

                    'service_date', bi.service_date,
                    'quantity', bi.quantity,
                    'unit_price', bi.unit_price::text,
                    'total_price', bi.total_price::text,

                    'from_destination', fd.name,
                    'to_destination', td.name
                )
            ) FILTER (WHERE bi.id IS NOT NULL),
            '[]'::jsonb
        ) AS items

    FROM bookings AS b

    LEFT JOIN booking_items AS bi
        ON bi.booking_id = b.id

    LEFT JOIN hotels AS h
        ON h.id = bi.hotel_id

    LEFT JOIN transportations AS tr
        ON tr.id = bi.transportation_id

    LEFT JOIN tours AS tour
        ON tour.id = bi.tour_id

    LEFT JOIN activities AS activity
        ON activity.id = bi.activity_id

    LEFT JOIN destinations AS fd
        ON fd.id = tr.from_destination_id

    LEFT JOIN destinations AS td
        ON td.id = tr.to_destination_id
"""


def fetch_bookings(
    connection,
    *,
    user_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    """List bookings, newest first. Optionally filter by owner and status."""
    conditions = []
    params: dict = {"limit": limit, "offset": offset}

    if user_id is not None:
        conditions.append("b.user_id = :user_id")
        params["user_id"] = user_id

    if status is not None:
        conditions.append("LOWER(b.status) = :status")
        params["status"] = status.lower()

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    rows = connection.execute(
        text(
            f"""
            {BOOKING_SELECT_SQL}
            {where}
            GROUP BY b.id
            ORDER BY b.id DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        params,
    ).fetchall()

    return [booking_to_dict(row) for row in rows]


def get_booking_or_404(connection, booking_id: int, user_id: Optional[int] = None):
    """
    Fetch one booking with all its items.
    Pass user_id to restrict the lookup to that owner (customers).
    """
    query = BOOKING_SELECT_SQL + " WHERE b.id = :booking_id"
    params: dict = {"booking_id": booking_id}

    if user_id is not None:
        query += " AND b.user_id = :user_id"
        params["user_id"] = user_id

    query += " GROUP BY b.id"

    row = connection.execute(text(query), params).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Booking not found")

    return booking_to_dict(row)


def change_pending_status(booking_id: int, new_status: str, past_tense: str):
    """Move a booking from 'pending' to new_status. Used by confirm/reject."""
    validate_booking_id(booking_id)

    with engine.begin() as connection:
        result = connection.execute(
            text("""
                UPDATE bookings
                SET status = :new_status
                WHERE id = :booking_id
                  AND LOWER(status) = 'pending'
                RETURNING id, status
            """),
            {"booking_id": booking_id, "new_status": new_status},
        ).fetchone()

        if result is None:
            existing = connection.execute(
                text("SELECT id, status FROM bookings WHERE id = :booking_id"),
                {"booking_id": booking_id},
            ).fetchone()

            if existing is None:
                raise HTTPException(status_code=404, detail="Booking not found")

            raise HTTPException(
                status_code=409,
                detail=(
                    f"Only pending bookings can be {past_tense}. "
                    f"Current status: {existing.status}"
                ),
            )

    return {
        "message": f"Booking {past_tense} successfully",
        "booking_id": result.id,
        "status": result.status,
    }


# =========================================================
# Create a hotel booking
# "" and "/" both work, so /bookings and /bookings/ behave the same
# (avoids the 307 redirect that can drop the Authorization header).
# =========================================================

@router.post("")
@router.post("/", include_in_schema=False)
def create_hotel_booking(
    request: HotelBookingRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a hotel booking for the authenticated user."""
    validate_future_date(request.check_in, "Check-in date")

    with engine.connect() as connection:
        hotel = connection.execute(
            text("""
                SELECT id, name, price_per_night
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

    nightly_price = validate_price(hotel.price_per_night, "Hotel")

    base = money(nightly_price * request.nights)
    accommodation_tax = money(base * Decimal("0.02"))
    vat = money(base * Decimal("0.10"))
    service_charge = money(base * Decimal("0.10"))
    total = money(base + accommodation_tax + vat + service_charge)

    check_out = request.check_in + timedelta(days=request.nights)

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

    booking = create_booking_with_item(
        user_id=current_user["id"],
        total=total,
        notes=notes,
        item_column="hotel_id",
        service_id=hotel.id,
        quantity=request.nights,
        unit_price=nightly_price,
        item_total=base,  # taxes/charges are only in bookings.total_amount
        service_date=request.check_in,
    )

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
# Create a transportation booking
# =========================================================

@router.post("/transportation")
def create_transportation_booking(
    request: TransportationBookingRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a transportation booking for the authenticated user."""
    validate_future_date(request.travel_date, "Travel date")

    with engine.connect() as connection:
        transportation = connection.execute(
            text("""
                SELECT
                    t.id,
                    t.type,
                    t.provider,
                    t.price,
                    fd.name AS from_destination,
                    td.name AS to_destination
                FROM transportations AS t
                JOIN destinations AS fd
                    ON fd.id = t.from_destination_id
                JOIN destinations AS td
                    ON td.id = t.to_destination_id
                WHERE t.id = :transportation_id
                  AND t.is_active = TRUE
            """),
            {"transportation_id": request.transportation_id},
        ).fetchone()

    if transportation is None:
        raise HTTPException(
            status_code=404,
            detail="Transportation service not found or unavailable",
        )

    unit_price = validate_price(transportation.price, "Transportation")
    total = money(unit_price * request.passengers)

    notes = (
        f"Transportation: {transportation.type}; "
        f"Provider: {transportation.provider or 'N/A'}; "
        f"Route: {transportation.from_destination} to "
        f"{transportation.to_destination}; "
        f"Travel date: {request.travel_date.isoformat()}; "
        f"Passengers: {request.passengers}"
    )

    booking = create_booking_with_item(
        user_id=current_user["id"],
        total=total,
        notes=notes,
        item_column="transportation_id",
        service_id=transportation.id,
        quantity=request.passengers,
        unit_price=unit_price,
        item_total=total,
        service_date=request.travel_date,
    )

    return {
        "message": "Transportation booking created successfully",
        "booking": {
            "id": booking.id,
            "booking_reference": booking.booking_reference,
            "transportation_id": transportation.id,
            "transport_type": transportation.type,
            "provider": transportation.provider,
            "from_destination": transportation.from_destination,
            "to_destination": transportation.to_destination,
            "travel_date": request.travel_date.isoformat(),
            "passengers": request.passengers,
            "unit_price": str(unit_price),
            "total_amount": str(booking.total_amount),
            "status": booking.status,
        },
    }


# =========================================================
# Create a tour booking
# =========================================================

@router.post("/tours")
def create_tour_booking(
    request: TourBookingRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a tour booking for the authenticated user."""
    validate_future_date(request.tour_date, "Tour date")

    with engine.connect() as connection:
        tour = connection.execute(
            text("""
                SELECT id, name, price, max_people
                FROM tours
                WHERE id = :tour_id
                  AND is_active = TRUE
            """),
            {"tour_id": request.tour_id},
        ).fetchone()

    if tour is None:
        raise HTTPException(
            status_code=404,
            detail="Tour not found or unavailable",
        )

    if tour.max_people is not None and request.participants > tour.max_people:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum participants allowed: {tour.max_people}",
        )

    unit_price = validate_price(tour.price, "Tour")
    total = money(unit_price * request.participants)

    notes = (
        f"Tour: {tour.name}; "
        f"Tour date: {request.tour_date.isoformat()}; "
        f"Participants: {request.participants}"
    )

    booking = create_booking_with_item(
        user_id=current_user["id"],
        total=total,
        notes=notes,
        item_column="tour_id",
        service_id=tour.id,
        quantity=request.participants,
        unit_price=unit_price,
        item_total=total,
        service_date=request.tour_date,
    )

    return {
        "message": "Tour booking created successfully",
        "booking": {
            "id": booking.id,
            "booking_reference": booking.booking_reference,
            "tour_id": tour.id,
            "tour_name": tour.name,
            "tour_date": request.tour_date.isoformat(),
            "participants": request.participants,
            "unit_price": str(unit_price),
            "total_amount": str(booking.total_amount),
            "status": booking.status,
        },
    }


# =========================================================
# Create an activity booking
# =========================================================

@router.post("/activities")
def create_activity_booking(
    request: ActivityBookingRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create an activity booking for the authenticated user."""
    validate_future_date(request.activity_date, "Activity date")

    with engine.connect() as connection:
        activity = connection.execute(
            text("""
                SELECT id, name, price
                FROM activities
                WHERE id = :activity_id
                  AND is_active = TRUE
            """),
            {"activity_id": request.activity_id},
        ).fetchone()

    if activity is None:
        raise HTTPException(
            status_code=404,
            detail="Activity not found or unavailable",
        )

    unit_price = validate_price(activity.price, "Activity")
    total = money(unit_price * request.participants)

    notes = (
        f"Activity: {activity.name}; "
        f"Activity date: {request.activity_date.isoformat()}; "
        f"Participants: {request.participants}"
    )

    booking = create_booking_with_item(
        user_id=current_user["id"],
        total=total,
        notes=notes,
        item_column="activity_id",
        service_id=activity.id,
        quantity=request.participants,
        unit_price=unit_price,
        item_total=total,
        service_date=request.activity_date,
    )

    return {
        "message": "Activity booking created successfully",
        "booking": {
            "id": booking.id,
            "booking_reference": booking.booking_reference,
            "activity_id": activity.id,
            "activity_name": activity.name,
            "activity_date": request.activity_date.isoformat(),
            "participants": request.participants,
            "unit_price": str(unit_price),
            "total_amount": str(booking.total_amount),
            "status": booking.status,
        },
    }


# =========================================================
# Current user's bookings (any role)
# Static paths (/my, /admin, "") must stay above /{booking_id}.
# =========================================================

@router.get("/my")
def get_my_bookings(
    status: Optional[BookingStatus] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    """Return all bookings that belong to the authenticated user."""
    with engine.connect() as connection:
        return fetch_bookings(
            connection,
            user_id=current_user["id"],
            status=status,
            limit=limit,
            offset=offset,
        )


# =========================================================
# Agent and Admin: booking management list
# Optional filters: ?status=pending&limit=50&offset=0
# =========================================================

@router.get("")
@router.get("/", include_in_schema=False)
def get_all_bookings(
    status: Optional[BookingStatus] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(require_staff),
):
    """Return all customers' bookings. Agent and Admin."""
    with engine.connect() as connection:
        return fetch_bookings(
            connection,
            status=status,
            limit=limit,
            offset=offset,
        )


# =========================================================
# Admin routes (kept for backward compatibility)
# =========================================================

@router.get("/admin")
def admin_get_all_bookings(
    status: Optional[BookingStatus] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(require_admin),
):
    """Return all bookings. Admin only."""
    with engine.connect() as connection:
        return fetch_bookings(
            connection,
            status=status,
            limit=limit,
            offset=offset,
        )


@router.get("/admin/{booking_id}")
def admin_get_booking(
    booking_id: int,
    current_user: dict = Depends(require_admin),
):
    """Return any booking by ID. Admin only."""
    validate_booking_id(booking_id)

    with engine.connect() as connection:
        return get_booking_or_404(connection, booking_id)


# The /admin/... confirm and reject URLs now allow agents too, so any
# frontend code that still calls them keeps working for agents.
@router.patch("/admin/{booking_id}/confirm")
def admin_confirm_booking(
    booking_id: int,
    current_user: dict = Depends(require_staff),
):
    """Confirm a pending booking. Agent and Admin (legacy URL)."""
    return change_pending_status(booking_id, "confirmed", "confirmed")


@router.patch("/admin/{booking_id}/reject")
def admin_reject_booking(
    booking_id: int,
    current_user: dict = Depends(require_staff),
):
    """Reject a pending booking. Agent and Admin (legacy URL)."""
    return change_pending_status(booking_id, "rejected", "rejected")


@router.patch("/admin/{booking_id}/status")
def admin_update_booking_status(
    booking_id: int,
    request: BookingStatusUpdate,
    current_user: dict = Depends(require_admin),
):
    """Set any booking status. Admin only ("edit any booking")."""
    validate_booking_id(booking_id)

    with engine.begin() as connection:
        result = connection.execute(
            text("""
                UPDATE bookings
                SET status = :status
                WHERE id = :booking_id
                RETURNING id, status
            """),
            {"booking_id": booking_id, "status": request.status},
        ).fetchone()

        if result is None:
            raise HTTPException(status_code=404, detail="Booking not found")

    return {
        "message": "Booking status updated successfully",
        "booking_id": result.id,
        "status": result.status,
    }


# =========================================================
# Get one booking
# Customers see only their own. Agents and admins see any.
# =========================================================

@router.get("/{booking_id}")
def get_booking(
    booking_id: int,
    current_user: dict = Depends(get_current_user),
):
    validate_booking_id(booking_id)

    owner_id = None if is_staff(current_user) else current_user["id"]

    with engine.connect() as connection:
        return get_booking_or_404(connection, booking_id, user_id=owner_id)


# =========================================================
# Agent and Admin: confirm / reject any pending booking
# =========================================================

@router.patch("/{booking_id}/confirm")
def confirm_booking(
    booking_id: int,
    current_user: dict = Depends(require_staff),
):
    """Confirm a pending booking. Agent and Admin."""
    return change_pending_status(booking_id, "confirmed", "confirmed")


@router.patch("/{booking_id}/reject")
def reject_booking(
    booking_id: int,
    current_user: dict = Depends(require_staff),
):
    """Reject a pending booking. Agent and Admin."""
    return change_pending_status(booking_id, "rejected", "rejected")


# =========================================================
# Cancel a pending booking
# Any user can cancel their OWN pending booking (agents book too).
# Admin can cancel any pending booking.
# =========================================================

@router.patch("/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Cancel a pending booking you own, or any pending booking (admin)."""
    validate_booking_id(booking_id)

    admin = is_admin(current_user)
    owner_filter = "" if admin else "AND user_id = :user_id"

    params = {"booking_id": booking_id}
    if not admin:
        params["user_id"] = current_user["id"]

    with engine.begin() as connection:
        result = connection.execute(
            text(f"""
                UPDATE bookings
                SET status = 'cancelled'
                WHERE id = :booking_id
                  {owner_filter}
                  AND LOWER(status) = 'pending'
                RETURNING id, status
            """),
            params,
        ).fetchone()

        if result is None:
            existing = connection.execute(
                text(f"""
                    SELECT id, status
                    FROM bookings
                    WHERE id = :booking_id
                      {owner_filter}
                """),
                params,
            ).fetchone()

            if existing is None:
                raise HTTPException(status_code=404, detail="Booking not found")

            raise HTTPException(
                status_code=409,
                detail=(
                    "Only pending bookings can be cancelled. "
                    f"Current status: {existing.status}"
                ),
            )

    return {
        "message": "Booking cancelled successfully",
        "booking_id": result.id,
        "status": result.status,
    }