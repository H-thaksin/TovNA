from fastapi import APIRouter
from sqlalchemy import text

from database import engine


router = APIRouter(
    prefix="/tours",
    tags=["Tours"]
)


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
            """)
        )

        tours = []

        for row in result:
            tours.append({
                "id": row.id,
                "destination_id": row.destination_id,
                "name": row.name,
                "description": row.description,
                "duration_days": row.duration_days,
                "price": row.price,
                "max_people": row.max_people,
                "image_url": row.image_url,
                "is_active": row.is_active
            })

        return tours


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
            return {"message": "Tour not found"}

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