from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text
from database import Base


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True)
    destination_id = Column(Integer, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    duration_hours = Column(Numeric(4, 1))
    price = Column(Numeric(10, 2), nullable=False)
    image_url = Column(Text)
    created_at = Column(DateTime, nullable=False)