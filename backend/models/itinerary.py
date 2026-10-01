from sqlalchemy import Column, Date, DateTime, Integer, Numeric, String, Text
from database import Base


class Itinerary(Base):
    __tablename__ = "itineraries"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    destination_id = Column(Integer, nullable=False)
    name = Column(String(200), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    estimated_cost = Column(Numeric(10, 2))
    notes = Column(Text)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)