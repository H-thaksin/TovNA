from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String, Text
from database import Base


class Hotel(Base):
    __tablename__ = "hotels"

    id = Column(Integer, primary_key=True)
    destination_id = Column(Integer, nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text)
    address = Column(Text)
    image_url = Column(Text)
    price_per_night = Column(Numeric(10, 2), nullable=False)
    rating = Column(Numeric(2, 1))
    total_rooms = Column(Integer)
    is_active = Column(Boolean, nullable=False)
    created_at = Column(DateTime, nullable=False)