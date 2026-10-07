from sqlalchemy import Boolean, Column, Integer, String, Text

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    role_id = Column(Integer, nullable=False)

    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)

    email = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)

    phone = Column(String(30))
    profile_image = Column(Text)

    is_active = Column(Boolean, nullable=False)