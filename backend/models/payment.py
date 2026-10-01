from sqlalchemy import Column, DateTime, Integer, Numeric, String
from database import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True)
    booking_id = Column(Integer, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    method = Column(String(50), nullable=False)
    status = Column(String(30), nullable=False)
    transaction_reference = Column(String(100))
    paid_at = Column(DateTime)