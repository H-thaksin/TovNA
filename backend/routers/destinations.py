
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from database import engine
from core.dependencies import require_admin


router = APIRouter(
    prefix="/destinations",
    tags=["Destinations"]
)


# ==========================================
# REQUEST MODEL
# ==========================================

class DestinationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    province: str = Field(min_length=1, max_length=100)
    description: str | None = None
    image_url: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    best_time: str | None = Field(default=None, max_length=100)
    is_active: bool = True


# ==========================================
# PUBLIC: GET ALL DESTINATIONS
# ==========================================

@router.get("/")
def get_destinations():
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    name,
                    province,
                    description,
                    image_url,
                    latitude,
                    longitude,
                    best_time,
                    is_active,
                    created_at
                FROM destinations
                ORDER BY id DESC
            """)
        )

        return [dict(row._mapping) for row in result]


# ==========================================
# PUBLIC: GET DESTINATION BY ID
# ==========================================

@router.get("/{destination_id}")
def get_destination(destination_id: int):
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    name,
                    province,
                    description,
                    image_url,
                    latitude,
                    longitude,
                    best_time,
                    is_active,
                    created_at
                FROM destinations
                WHERE id = :destination_id
            """),
            {"destination_id": destination_id}
        )

        row = result.fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Destination not found"
            )

        return dict(row._mapping)


# ==========================================
# ADMIN: CREATE DESTINATION
# ==========================================

@router.post("/", status_code=201)
def create_destination(
    destination: DestinationCreate,
    current_user: dict = Depends(require_admin)
):
    data = destination.model_dump()

    data["name"] = data["name"].strip()
    data["province"] = data["province"].strip()

    if not data["name"] or not data["province"]:
        raise HTTPException(
            status_code=422,
            detail="Destination name and province cannot be empty"
        )

    with engine.begin() as connection:
        result = connection.execute(
            text("""
                INSERT INTO destinations (
                    name,
                    province,
                    description,
                    image_url,
                    latitude,
                    longitude,
                    best_time,
                    is_active
                )
                VALUES (
                    :name,
                    :province,
                    :description,
                    :image_url,
                    :latitude,
                    :longitude,
                    :best_time,
                    :is_active
                )
                RETURNING *
            """),
            data
        )

        row = result.fetchone()

    return {
        "message": "Destination created successfully",
        "destination": dict(row._mapping)
    }


# ==========================================
# ADMIN: UPDATE DESTINATION
# ==========================================

@router.put("/{destination_id}")
def update_destination(
    destination_id: int,
    destination: DestinationCreate,
    current_user: dict = Depends(require_admin)
):
    data = destination.model_dump()

    data["name"] = data["name"].strip()
    data["province"] = data["province"].strip()

    if not data["name"] or not data["province"]:
        raise HTTPException(
            status_code=422,
            detail="Destination name and province cannot be empty"
        )

    data["destination_id"] = destination_id

    with engine.begin() as connection:
        result = connection.execute(
            text("""
                UPDATE destinations
                SET
                    name = :name,
                    province = :province,
                    description = :description,
                    image_url = :image_url,
                    latitude = :latitude,
                    longitude = :longitude,
                    best_time = :best_time,
                    is_active = :is_active
                WHERE id = :destination_id
                RETURNING *
            """),
            data
        )

        row = result.fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Destination not found"
            )

    return {
        "message": "Destination updated successfully",
        "destination": dict(row._mapping)
    }


# ==========================================
# ADMIN: DELETE DESTINATION
# ==========================================

@router.delete("/{destination_id}")
def delete_destination(
    destination_id: int,
    current_user: dict = Depends(require_admin)
):
    try:
        with engine.begin() as connection:
            result = connection.execute(
                text("""
                    DELETE FROM destinations
                    WHERE id = :destination_id
                    RETURNING id
                """),
                {"destination_id": destination_id}
            )

            row = result.fetchone()

            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Destination not found"
                )

    except IntegrityError:
        raise HTTPException(
            status_code=409,
            detail=(
                "This destination is being used by hotels, tours, "
                "activities, itineraries, or transportation. "
                "Deactivate it instead of deleting it."
            )
        )

    return {
        "message": "Destination deleted successfully",
        "destination_id": destination_id
    }
