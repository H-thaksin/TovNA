
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from database import engine
from core.dependencies import require_admin


router = APIRouter(
    prefix="/activities",
    tags=["Activities"]
)


# -------------------------
# Request model
# -------------------------

class ActivityCreate(BaseModel):
    destination_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    category: str | None = Field(default=None, max_length=100)
    duration_hours: Decimal | None = Field(default=None, gt=0, max_digits=4, decimal_places=1)
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    image_url: str | None = None
    is_active: bool = True


# -------------------------
# Helper
# -------------------------

def activity_to_dict(row):
    return {
        "id": row.id,
        "destination_id": row.destination_id,
        "name": row.name,
        "description": row.description,
        "category": row.category,
        "duration_hours": row.duration_hours,
        "price": row.price,
        "image_url": row.image_url,
        "is_active": row.is_active,
        "created_at": row.created_at
    }


# -------------------------
# Public: Get active activities
# -------------------------

@router.get("/")
def get_activities():
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    destination_id,
                    name,
                    description,
                    category,
                    duration_hours,
                    price,
                    image_url,
                    is_active,
                    created_at
                FROM activities
                WHERE is_active = TRUE
                ORDER BY id DESC
            """)
        )

        return [activity_to_dict(row) for row in result]


# -------------------------
# Admin: Get all activities
# -------------------------

@router.get("/admin/all")
def get_all_activities(
    current_user: dict = Depends(require_admin)
):
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    destination_id,
                    name,
                    description,
                    category,
                    duration_hours,
                    price,
                    image_url,
                    is_active,
                    created_at
                FROM activities
                ORDER BY id DESC
            """)
        )

        return [activity_to_dict(row) for row in result]


# -------------------------
# Public: Get one active activity
# -------------------------

@router.get("/{activity_id}")
def get_activity(activity_id: int):
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    destination_id,
                    name,
                    description,
                    category,
                    duration_hours,
                    price,
                    image_url,
                    is_active,
                    created_at
                FROM activities
                WHERE id = :activity_id
                  AND is_active = TRUE
            """),
            {"activity_id": activity_id}
        )

        row = result.fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Activity not found"
            )

        return activity_to_dict(row)


# -------------------------
# Admin: Create activity
# -------------------------

@router.post("/")
def create_activity(
    activity: ActivityCreate,
    current_user: dict = Depends(require_admin)
):
    data = activity.model_dump()
    data["name"] = data["name"].strip()

    if not data["name"]:
        raise HTTPException(
            status_code=400,
            detail="Activity name cannot be empty"
        )

    with engine.begin() as connection:
        try:
            result = connection.execute(
                text("""
                    INSERT INTO activities (
                        destination_id,
                        name,
                        description,
                        category,
                        duration_hours,
                        price,
                        image_url,
                        is_active
                    )
                    VALUES (
                        :destination_id,
                        :name,
                        :description,
                        :category,
                        :duration_hours,
                        :price,
                        :image_url,
                        :is_active
                    )
                    RETURNING
                        id,
                        destination_id,
                        name,
                        description,
                        category,
                        duration_hours,
                        price,
                        image_url,
                        is_active,
                        created_at
                """),
                data
            )

            row = result.fetchone()
            return activity_to_dict(row)

        except IntegrityError:
            raise HTTPException(
                status_code=400,
                detail="Invalid destination ID"
            )


# -------------------------
# Admin: Update activity
# -------------------------

@router.put("/{activity_id}")
def update_activity(
    activity_id: int,
    activity: ActivityCreate,
    current_user: dict = Depends(require_admin)
):
    data = activity.model_dump()
    data["activity_id"] = activity_id
    data["name"] = data["name"].strip()

    if not data["name"]:
        raise HTTPException(
            status_code=400,
            detail="Activity name cannot be empty"
        )

    with engine.begin() as connection:
        try:
            result = connection.execute(
                text("""
                    UPDATE activities
                    SET
                        destination_id = :destination_id,
                        name = :name,
                        description = :description,
                        category = :category,
                        duration_hours = :duration_hours,
                        price = :price,
                        image_url = :image_url,
                        is_active = :is_active
                    WHERE id = :activity_id
                    RETURNING
                        id,
                        destination_id,
                        name,
                        description,
                        category,
                        duration_hours,
                        price,
                        image_url,
                        is_active,
                        created_at
                """),
                data
            )

            row = result.fetchone()

            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Activity not found"
                )

            return activity_to_dict(row)

        except IntegrityError:
            raise HTTPException(
                status_code=400,
                detail="Invalid destination ID"
            )


# -------------------------
# Admin: Delete activity
# -------------------------

@router.delete("/{activity_id}")
def delete_activity(
    activity_id: int,
    current_user: dict = Depends(require_admin)
):
    with engine.begin() as connection:
        try:
            result = connection.execute(
                text("""
                    DELETE FROM activities
                    WHERE id = :activity_id
                    RETURNING id
                """),
                {"activity_id": activity_id}
            )

            row = result.fetchone()

            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Activity not found"
                )

            return {
                "message": "Activity deleted successfully",
                "activity_id": row.id
            }

        except IntegrityError:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This activity is already used in bookings or itineraries. "
                    "Deactivate it instead of deleting it."
                )
            )
