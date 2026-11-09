
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from database import engine
from core.dependencies import require_admin


router = APIRouter(
    prefix="/hotels",
    tags=["Hotels"]
)


# -------------------------
# Request model
# -------------------------

class HotelCreate(BaseModel):
    destination_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    address: str | None = None
    image_url: str | None = None
    price_per_night: Decimal = Field(ge=0)
    rating: Decimal | None = Field(default=None, ge=0, le=5)
    total_rooms: int | None = Field(default=None, ge=0)
    is_active: bool = True


# -------------------------
# Helper
# -------------------------

def hotel_to_dict(row):
    return {
        "id": row.id,
        "destination_id": row.destination_id,
        "name": row.name,
        "description": row.description,
        "address": row.address,
        "image_url": row.image_url,
        "price_per_night": row.price_per_night,
        "rating": row.rating,
        "total_rooms": row.total_rooms,
        "is_active": row.is_active,
        "created_at": row.created_at
    }


# -------------------------
# GET all hotels
# Public endpoint
# -------------------------

@router.get("/")
def get_hotels():
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    destination_id,
                    name,
                    description,
                    address,
                    image_url,
                    price_per_night,
                    rating,
                    total_rooms,
                    is_active,
                    created_at
                FROM hotels
                ORDER BY id DESC
            """)
        )

        return [hotel_to_dict(row) for row in result]


# -------------------------
# GET hotel by ID
# Public endpoint
# -------------------------

@router.get("/{hotel_id}")
def get_hotel(hotel_id: int):
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    destination_id,
                    name,
                    description,
                    address,
                    image_url,
                    price_per_night,
                    rating,
                    total_rooms,
                    is_active,
                    created_at
                FROM hotels
                WHERE id = :hotel_id
            """),
            {"hotel_id": hotel_id}
        )

        row = result.fetchone()

        if row is None:
            return {"message": "Hotel not found"}

        return hotel_to_dict(row)


# -------------------------
# CREATE hotel
# Admin only
# -------------------------

@router.post("/", status_code=201)
def create_hotel(
    hotel: HotelCreate,
    current_user: dict = Depends(require_admin)
):
    hotel_data = hotel.model_dump()

    hotel_data["name"] = hotel_data["name"].strip()

    if not hotel_data["name"]:
        raise HTTPException(
            status_code=400,
            detail="Hotel name cannot be empty."
        )

    try:
        with engine.begin() as connection:
            result = connection.execute(
                text("""
                    INSERT INTO hotels (
                        destination_id,
                        name,
                        description,
                        address,
                        image_url,
                        price_per_night,
                        rating,
                        total_rooms,
                        is_active
                    )
                    VALUES (
                        :destination_id,
                        :name,
                        :description,
                        :address,
                        :image_url,
                        :price_per_night,
                        :rating,
                        :total_rooms,
                        :is_active
                    )
                    RETURNING *
                """),
                hotel_data
            )

            row = result.fetchone()

            return hotel_to_dict(row)

    except IntegrityError:
        raise HTTPException(
            status_code=400,
            detail="Invalid destination. Please select an existing destination."
        )


# -------------------------
# UPDATE hotel
# Admin only
# -------------------------

@router.put("/{hotel_id}")
def update_hotel(
    hotel_id: int,
    hotel: HotelCreate,
    current_user: dict = Depends(require_admin)
):
    hotel_data = hotel.model_dump()
    hotel_data["hotel_id"] = hotel_id
    hotel_data["name"] = hotel_data["name"].strip()

    if not hotel_data["name"]:
        raise HTTPException(
            status_code=400,
            detail="Hotel name cannot be empty."
        )

    try:
        with engine.begin() as connection:
            result = connection.execute(
                text("""
                    UPDATE hotels
                    SET
                        destination_id = :destination_id,
                        name = :name,
                        description = :description,
                        address = :address,
                        image_url = :image_url,
                        price_per_night = :price_per_night,
                        rating = :rating,
                        total_rooms = :total_rooms,
                        is_active = :is_active
                    WHERE id = :hotel_id
                    RETURNING *
                """),
                hotel_data
            )

            row = result.fetchone()

            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Hotel not found."
                )

            return hotel_to_dict(row)

    except IntegrityError:
        raise HTTPException(
            status_code=400,
            detail="Invalid destination. Please select an existing destination."
        )


# -------------------------
# DELETE hotel
# Admin only
# -------------------------

@router.delete("/{hotel_id}")
def delete_hotel(
    hotel_id: int,
    current_user: dict = Depends(require_admin)
):
    try:
        with engine.begin() as connection:
            result = connection.execute(
                text("""
                    DELETE FROM hotels
                    WHERE id = :hotel_id
                    RETURNING id
                """),
                {"hotel_id": hotel_id}
            )

            row = result.fetchone()

            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Hotel not found."
                )

            return {
                "message": "Hotel deleted successfully.",
                "id": row.id
            }

    except IntegrityError:
        raise HTTPException(
            status_code=409,
            detail=(
                "This hotel is already used in bookings or itineraries. "
                "Deactivate it instead of deleting it."
            )
        )
