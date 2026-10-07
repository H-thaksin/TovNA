from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text

from database import engine
from core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


security = HTTPBearer()

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
    # Check whether email already exists
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT id
                FROM users
                WHERE email = :email
            """),
            {
                "email": email
            }
        )

        existing_user = result.fetchone()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    # Hash password before saving
    hashed_password = hash_password(password)

    # Create user
    with engine.begin() as connection:
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
                    3,
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
                    is_active
            """),
            {
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
                "password_hash": hashed_password,
            }
        )

        user = result.fetchone()

    return {
        "message": "Registration successful",
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
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
    # Find user by email
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    first_name,
                    last_name,
                    email,
                    password_hash,
                    is_active
                FROM users
                WHERE email = :email
            """),
            {
                "email": email
            }
        )

        user = result.fetchone()

    # User does not exist
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    # Check password
    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    # Check account status
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Account is inactive",
        )

    # Create JWT access token
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
            "is_active": user.is_active,
        },
    }


# =========================
# Get Current User
# =========================
@router.get("/me")
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    # Get token from Authorization header
    token = credentials.credentials

    # Decode JWT token
    try:
        user_id = decode_access_token(token)
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    # Find user
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    first_name,
                    last_name,
                    email,
                    is_active
                FROM users
                WHERE id = :user_id
            """),
            {
                "user_id": user_id
            }
        )

        user = result.fetchone()

    # User does not exist
    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    # Check account status
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Account is inactive",
        )

    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "is_active": user.is_active,
    }