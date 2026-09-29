from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base


DATABASE_URL = "postgresql+psycopg://cheang@/tovna_db?host=/tmp&connect_timeout=5"

engine = create_engine(DATABASE_URL)
Base = declarative_base()