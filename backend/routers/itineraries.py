from fastapi import APIRouter
from sqlalchemy import text

from database import engine


router = APIRouter(
    prefix="/itineraries",
    tags=["Itineraries"]
)


@router.get("/")
def get_itineraries():
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    user_id,
                    destination_id,
                    name,
                    start_date,
                    end_date,
                    estimated_cost,
                    notes,
                    created_at,
                    updated_at
                FROM itineraries
            """)
        )

        itineraries = []

        for row in result:
            itineraries.append({
                "id": row.id,
                "user_id": row.user_id,
                "destination_id": row.destination_id,
                "name": row.name,
                "start_date": row.start_date,
                "end_date": row.end_date,
                "estimated_cost": row.estimated_cost,
                "notes": row.notes,
                "created_at": row.created_at,
                "updated_at": row.updated_at
            })

        return itineraries


@router.get("/{itinerary_id}")
def get_itinerary(itinerary_id: int):
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    user_id,
                    destination_id,
                    name,
                    start_date,
                    end_date,
                    estimated_cost,
                    notes,
                    created_at,
                    updated_at
                FROM itineraries
                WHERE id = :itinerary_id
            """),
            {"itinerary_id": itinerary_id}
        )

        row = result.fetchone()

        if row is None:
            return {"message": "Itinerary not found"}

        return {
            "id": row.id,
            "user_id": row.user_id,
            "destination_id": row.destination_id,
            "name": row.name,
            "start_date": row.start_date,
            "end_date": row.end_date,
            "estimated_cost": row.estimated_cost,
            "notes": row.notes,
            "created_at": row.created_at,
            "updated_at": row.updated_at
        }