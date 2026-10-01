from fastapi import APIRouter
from sqlalchemy import text

from database import engine


router = APIRouter(
    prefix="/transportations",
    tags=["Transportations"]
)


@router.get("/")
def get_transportations():
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    from_destination_id,
                    to_destination_id,
                    type,
                    provider,
                    duration_minutes,
                    price,
                    description,
                    is_active,
                    created_at
                FROM transportations
            """)
        )

        transportations = []

        for row in result:
            transportations.append({
                "id": row.id,
                "from_destination_id": row.from_destination_id,
                "to_destination_id": row.to_destination_id,
                "type": row.type,
                "provider": row.provider,
                "duration_minutes": row.duration_minutes,
                "price": row.price,
                "description": row.description,
                "is_active": row.is_active,
                "created_at": row.created_at
            })

        return transportations


@router.get("/{transportation_id}")
def get_transportation(transportation_id: int):
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    from_destination_id,
                    to_destination_id,
                    type,
                    provider,
                    duration_minutes,
                    price,
                    description,
                    is_active,
                    created_at
                FROM transportations
                WHERE id = :transportation_id
            """),
            {"transportation_id": transportation_id}
        )

        row = result.fetchone()

        if row is None:
            return {"message": "Transportation not found"}

        return {
            "id": row.id,
            "from_destination_id": row.from_destination_id,
            "to_destination_id": row.to_destination_id,
            "type": row.type,
            "provider": row.provider,
            "duration_minutes": row.duration_minutes,
            "price": row.price,
            "description": row.description,
            "is_active": row.is_active,
            "created_at": row.created_at
        }