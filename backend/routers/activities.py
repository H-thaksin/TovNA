from fastapi import APIRouter
from sqlalchemy import text

from database import engine


router = APIRouter(
    prefix="/activities",
    tags=["Activities"]
)


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
                    created_at
                FROM activities
            """)
        )

        activities = []

        for row in result:
            activities.append({
                "id": row.id,
                "destination_id": row.destination_id,
                "name": row.name,
                "description": row.description,
                "category": row.category,
                "duration_hours": row.duration_hours,
                "price": row.price,
                "image_url": row.image_url,
                "created_at": row.created_at
            })

        return activities


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
                    created_at
                FROM activities
                WHERE id = :activity_id
            """),
            {"activity_id": activity_id}
        )

        row = result.fetchone()

        if row is None:
            return {"message": "Activity not found"}

        return {
            "id": row.id,
            "destination_id": row.destination_id,
            "name": row.name,
            "description": row.description,
            "category": row.category,
            "duration_hours": row.duration_hours,
            "price": row.price,
            "image_url": row.image_url,
            "created_at": row.created_at
        }