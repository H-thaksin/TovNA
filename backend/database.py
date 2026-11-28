import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# Keep the existing local database as a fallback.
LOCAL_DATABASE_URL = (
    "postgresql+psycopg://cheang@/tovna_db?host=/tmp&connect_timeout=5"
)

DATABASE_URL = os.getenv("DATABASE_URL", LOCAL_DATABASE_URL)

# Normalize PostgreSQL URLs for the psycopg 3 driver.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://", "postgresql+psycopg://", 1
    )
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgresql://", "postgresql+psycopg://", 1
    )

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
Base = declarative_base()
