
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from database import engine
from core.dependencies import require_admin


router = APIRouter(
    prefix="/tours",
    tags=["Tours"]
)


# -----------------------------
# Request Model
# -----------------------------

class TourCreate(BaseModel):
    destination_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    duration_days: int = Field(ge=1)
    price: Decimal = Field(ge=0)
    max_people: int | None = Field(default=None, ge=1)
    image_url: str | None = None
    is_active: bool = True


# -----------------------------
# Helper Function
# -----------------------------

def tour_to_dict(row):
    return {
        "id": row.id,
        "destination_id": row.destination_id,
        "name": row.name,
        "description": row.description,
        "duration_days": row.duration_days,
        "price": row.price,
        "max_people": row.max_people,
        "image_url": row.image_url,
        "is_active": row.is_active
    }


# -----------------------------
# GET: All Tours (Public)
# -----------------------------

@router.get("/")
def get_tours():
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    destination_id,
                    name,
                    description,
                    duration_days,
                    price,
                    max_people,
                    image_url,
                    is_active
                FROM tours
                ORDER BY id DESC
            """)
        )

        return [tour_to_dict(row) for row in result]


# -----------------------------
# GET: Tour by ID (Public)
# -----------------------------

@router.get("/{tour_id}")
def get_tour(tour_id: int):
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    destination_id,
                    name,
                    description,
                    duration_days,
                    price,
                    max_people,
                    image_url,
                    is_active
                FROM tours
                WHERE id = :tour_id
            """),
            {"tour_id": tour_id}
        )

        row = result.fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Tour not found"
            )

        return tour_to_dict(row)


# -----------------------------
# POST: Create Tour (Admin)
# -----------------------------

@router.post("/", status_code=201)
def create_tour(
    tour: TourCreate,
    current_user: dict = Depends(require_admin)
):
    tour_data = tour.model_dump()

    tour_data["name"] = tour_data["name"].strip()

    if not tour_data["name"]:
        raise HTTPException(
            status_code=400,
            detail="Tour name cannot be empty"
        )

    try:
        with engine.begin() as connection:
            result = connection.execute(
                text("""
                    INSERT INTO tours (
                        destination_id,
                        name,
                        description,
                        duration_days,
                        price,
                        max_people,
                        image_url,
                        is_active
                    )
                    VALUES (
                        :destination_id,
                        :name,
                        :description,
                        :duration_days,
                        :price,
                        :max_people,
                        :image_url,
                        :is_active
                    )
                    RETURNING
                        id,
                        destination_id,
                        name,
                        description,
                        duration_days,
                        price,
                        max_people,
                        image_url,
                        is_active
                """),
                tour_data
            )

            row = result.fetchone()

            return tour_to_dict(row)

    except IntegrityError:
        raise HTTPException(
            status_code=400,
            detail="Invalid destination. Please select an existing destination."
        )


# -----------------------------
# PUT: Update Tour (Admin)
# -----------------------------

@router.put("/{tour_id}")
def update_tour(
    tour_id: int,
    tour: TourCreate,
    current_user: dict = Depends(require_admin)
):
    tour_data = tour.model_dump()
    tour_data["name"] = tour_data["name"].strip()
    tour_data["tour_id"] = tour_id

    if not tour_data["name"]:
        raise HTTPException(
            status_code=400,
            detail="Tour name cannot be empty"
        )

    try:
        with engine.begin() as connection:
            result = connection.execute(
                text("""
                    UPDATE tours
                    SET
                        destination_id = :destination_id,
                        name = :name,
                        description = :description,
                        duration_days = :duration_days,
                        price = :price,
                        max_people = :max_people,
                        image_url = :image_url,
                        is_active = :is_active
                    WHERE id = :tour_id
                    RETURNING
                        id,
                        destination_id,
                        name,
                        description,
                        duration_days,
                        price,
                        max_people,
                        image_url,
                        is_active
                """),
                tour_data
            )

            row = result.fetchone()

            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Tour not found"
                )

            return tour_to_dict(row)

    except IntegrityError:
        raise HTTPException(
            status_code=400,
            detail="Invalid destination. Please select an existing destination."
        )


# -----------------------------
# DELETE: Delete Tour (Admin)
# -----------------------------

@router.delete("/{tour_id}")
def delete_tour(
    tour_id: int,
    current_user: dict = Depends(require_admin)
):
    try:
        with engine.begin() as connection:
            result = connection.execute(
                text("""
                    DELETE FROM tours
                    WHERE id = :tour_id
                    RETURNING id
                """),
                {"tour_id": tour_id}
            )

            row = result.fetchone()

            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Tour not found"
                )

            return {
                "message": "Tour deleted successfully",
                "tour_id": row.id
            }

    except IntegrityError:
        raise HTTPException(
            status_code=409,
            detail=(
                "This tour cannot be deleted because it is used in "
                "bookings or itineraries. Please deactivate it instead."
            )
        )
