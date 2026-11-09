from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from database import engine
from core.dependencies import require_admin


router = APIRouter(
    prefix="/transportations",
    tags=["Transportations"]
)

COLUMNS = """
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
"""


# ==========================================
# PYDANTIC MODEL
# ==========================================

class TransportationCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    from_destination_id: int = Field(gt=0)
    to_destination_id: int = Field(gt=0)
    type: str = Field(min_length=1, max_length=50)
    provider: str | None = Field(default=None, max_length=150)
    duration_minutes: int | None = Field(default=None, gt=0)
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    description: str | None = None
    is_active: bool = True

    # Blank text becomes NULL in the database.
    @field_validator("provider", "description")
    @classmethod
    def blank_to_none(cls, value):
        return value or None

    # Checked once here, so POST and PUT both get it.
    @model_validator(mode="after")
    def destinations_must_differ(self):
        if self.from_destination_id == self.to_destination_id:
            raise ValueError(
                "Starting and ending destinations cannot be the same"
            )
        return self


# ==========================================
# HELPER FUNCTIONS
# ==========================================

def transportation_to_dict(row):
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


def check_destinations_exist(connection, from_id: int, to_id: int):
    """Give a clear error that names the missing destination."""
    rows = connection.execute(
        text("SELECT id FROM destinations WHERE id IN (:a, :b)"),
        {"a": from_id, "b": to_id}
    ).fetchall()

    found = {row.id for row in rows}

    for label, destination_id in (
        ("Starting", from_id),
        ("Ending", to_id),
    ):
        if destination_id not in found:
            raise HTTPException(
                status_code=400,
                detail=f"{label} destination (ID {destination_id}) does not exist"
            )


# ==========================================
# ADMIN ROUTES (defined first so they are never confused with /{id})
# ==========================================

# GET all services, including inactive ones
@router.get("/admin/all")
def get_all_transportations(
    current_user=Depends(require_admin)
):
    with engine.connect() as connection:
        result = connection.execute(
            text(f"""
                SELECT {COLUMNS}
                FROM transportations
                ORDER BY id DESC
            """)
        )

        return [transportation_to_dict(row) for row in result]


# CREATE transportation service
@router.post("/")
def create_transportation(
    transportation: TransportationCreate,
    current_user=Depends(require_admin)
):
    try:
        with engine.begin() as connection:
            check_destinations_exist(
                connection,
                transportation.from_destination_id,
                transportation.to_destination_id
            )

            row = connection.execute(
                text(f"""
                    INSERT INTO transportations (
                        from_destination_id,
                        to_destination_id,
                        type,
                        provider,
                        duration_minutes,
                        price,
                        description,
                        is_active
                    )
                    VALUES (
                        :from_destination_id,
                        :to_destination_id,
                        :type,
                        :provider,
                        :duration_minutes,
                        :price,
                        :description,
                        :is_active
                    )
                    RETURNING {COLUMNS}
                """),
                transportation.model_dump()
            ).fetchone()

            return {
                "message": "Transportation created successfully",
                "transportation": transportation_to_dict(row)
            }

    except IntegrityError:
        raise HTTPException(
            status_code=400,
            detail="Invalid destination ID. Please select existing destinations."
        )


# UPDATE transportation service
@router.put("/{transportation_id}")
def update_transportation(
    transportation_id: int,
    transportation: TransportationCreate,
    current_user=Depends(require_admin)
):
    try:
        with engine.begin() as connection:
            check_destinations_exist(
                connection,
                transportation.from_destination_id,
                transportation.to_destination_id
            )

            row = connection.execute(
                text(f"""
                    UPDATE transportations
                    SET
                        from_destination_id = :from_destination_id,
                        to_destination_id = :to_destination_id,
                        type = :type,
                        provider = :provider,
                        duration_minutes = :duration_minutes,
                        price = :price,
                        description = :description,
                        is_active = :is_active
                    WHERE id = :transportation_id
                    RETURNING {COLUMNS}
                """),
                {
                    **transportation.model_dump(),
                    "transportation_id": transportation_id
                }
            ).fetchone()

            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Transportation not found"
                )

            return {
                "message": "Transportation updated successfully",
                "transportation": transportation_to_dict(row)
            }

    except IntegrityError:
        raise HTTPException(
            status_code=400,
            detail="Invalid destination ID. Please select existing destinations."
        )


# DELETE transportation service
@router.delete("/{transportation_id}")
def delete_transportation(
    transportation_id: int,
    current_user=Depends(require_admin)
):
    try:
        with engine.begin() as connection:
            row = connection.execute(
                text("""
                    DELETE FROM transportations
                    WHERE id = :transportation_id
                    RETURNING id
                """),
                {"transportation_id": transportation_id}
            ).fetchone()

            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Transportation not found"
                )

            return {
                "message": "Transportation deleted successfully",
                "transportation_id": row.id
            }

    except IntegrityError:
        raise HTTPException(
            status_code=409,
            detail=(
                "This transportation service is already used in bookings. "
                "Please deactivate it instead of deleting it."
            )
        )


# ==========================================
# PUBLIC ROUTES
# ==========================================

# GET active transportation services.
# Optional filters: /transportations/?from_destination_id=2&to_destination_id=4
@router.get("/")
def get_transportations(
    from_destination_id: int | None = None,
    to_destination_id: int | None = None
):
    conditions = ["is_active = TRUE"]
    params = {}

    if from_destination_id is not None:
        conditions.append("from_destination_id = :from_destination_id")
        params["from_destination_id"] = from_destination_id

    if to_destination_id is not None:
        conditions.append("to_destination_id = :to_destination_id")
        params["to_destination_id"] = to_destination_id

    with engine.connect() as connection:
        result = connection.execute(
            text(f"""
                SELECT {COLUMNS}
                FROM transportations
                WHERE {" AND ".join(conditions)}
                ORDER BY id DESC
            """),
            params
        )

        return [transportation_to_dict(row) for row in result]


# GET one active transportation service
@router.get("/{transportation_id}")
def get_transportation(transportation_id: int):
    with engine.connect() as connection:
        row = connection.execute(
            text(f"""
                SELECT {COLUMNS}
                FROM transportations
                WHERE id = :transportation_id
                AND is_active = TRUE
            """),
            {"transportation_id": transportation_id}
        ).fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Transportation not found"
            )

        return transportation_to_dict(row)