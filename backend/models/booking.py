from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text
from database import Base


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    booking_reference = Column(String(50), nullable=False, unique=True)
    booking_date = Column(DateTime, nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)
    status = Column(String(30), nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime, nullable=False)