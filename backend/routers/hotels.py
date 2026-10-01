
from fastapi import APIRouter
from sqlalchemy import text

from database import engine


router = APIRouter(
    prefix="/hotels",
    tags=["Hotels"]
)


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
            """)
        )

        hotels = []

        for row in result:
            hotels.append({
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
            })

        return hotels


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

