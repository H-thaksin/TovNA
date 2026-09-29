from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String, Text
from database import Base


class Destination(Base):
    __tablename__ = "destinations"

    id = Column(Integer, primary_key=True)
    name = Column(String(150), nullable=False)
    province = Column(String(100), nullable=False)
    description = Column(Text)
    image_url = Column(Text)
    latitude = Column(Numeric(10, 7))
    longitude = Column(Numeric(10, 7))
    best_time = Column(String(100))
    is_active = Column(Boolean, nullable=False)
    created_at = Column(DateTime, nullable=False)