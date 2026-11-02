
from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from database import engine
from core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from core.dependencies import get_current_user as get_authenticated_user
from fastapi import Depends


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


# =========================
# Register
# =========================
@router.post("/register")
def register_user(
    first_name: str,
    last_name: str,
    email: str,
    password: str,
):
    email = email.strip().lower()
    first_name = first_name.strip()
    last_name = last_name.strip()

    if not first_name or not last_name:
        raise HTTPException(
            status_code=400,
            detail="First name and last name are required",
        )

    if not email or "@" not in email:
        raise HTTPException(
            status_code=400,
            detail="Please provide a valid email address",
        )

    if len(password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 8 characters",
        )

    hashed_password = hash_password(password)

    with engine.begin() as connection:

        # Check whether email already exists
        existing_user = connection.execute(
            text("""
                SELECT id
                FROM users
                WHERE email = :email
            """),
            {"email": email},
        ).fetchone()

        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Email already registered",
            )

        # Find the Customer role
        customer_role = connection.execute(
            text("""
                SELECT id
                FROM roles
                WHERE LOWER(TRIM(name)) = 'customer'
            """)
        ).fetchone()

        if customer_role is None:
            raise HTTPException(
                status_code=500,
                detail="Customer role is not configured",
            )

        # Create the new Customer account
        result = connection.execute(
            text("""
                INSERT INTO users (
                    role_id,
                    first_name,
                    last_name,
                    email,
                    password_hash,
                    is_active
                )
                VALUES (
                    :role_id,
                    :first_name,
                    :last_name,
                    :email,
                    :password_hash,
                    TRUE
                )
                RETURNING
                    id,
                    first_name,
                    last_name,
                    email,
                    role_id,
                    is_active
            """),
            {
                "role_id": customer_role.id,
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
                "password_hash": hashed_password,
            },
        )

        user = result.fetchone()

    return {
        "message": "Registration successful",
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "role_id": user.role_id,
            "role": "customer",
            "is_active": user.is_active,
        },
    }


# =========================
# Login
# =========================
@router.post("/login")
def login_user(
    email: str,
    password: str,
):
    email = email.strip().lower()

    with engine.connect() as connection:
        user = connection.execute(
            text("""
                SELECT
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.password_hash,
                    u.role_id,
                    r.name AS role,
                    u.is_active
                FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.email = :email
            """),
            {"email": email},
        ).fetchone()

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Account is inactive",
        )

    access_token = create_access_token(user.id)

    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "role_id": user.role_id,
            "role": str(user.role).strip().lower(),
            "is_active": user.is_active,
        },
    }


# =========================
# Get Current User
# =========================
@router.get("/me")
def get_me(
    current_user: dict = Depends(get_authenticated_user),
):
    return current_user
