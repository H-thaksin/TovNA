
from fastapi import APIRouter
from sqlalchemy import text

from database import engine


router = APIRouter(
    prefix="/destinations",
    tags=["Destinations"]
)


@router.get("/")
def get_destinations():
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT id, name, province FROM destinations")
        )

        destinations = []

        for row in result:
            destinations.append({
                "id": row.id,
                "name": row.name,
                "province": row.province
            })

        return destinations


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
            return {"message": "Destination not found"}

        return {
            "id": row.id,
            "name": row.name,
            "province": row.province,
            "description": row.description,
            "image_url": row.image_url,
            "latitude": row.latitude,
            "longitude": row.longitude,
            "best_time": row.best_time,
            "is_active": row.is_active,
            "created_at": row.created_at
        }

