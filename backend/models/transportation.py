from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String, Text
from database import Base


class Transportation(Base):
    __tablename__ = "transportations"

    id = Column(Integer, primary_key=True)
    from_destination_id = Column(Integer, nullable=False)
    to_destination_id = Column(Integer, nullable=False)
    type = Column(String(50), nullable=False)
    provider = Column(String(150))
    duration_minutes = Column(Integer)
    price = Column(Numeric(10, 2), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, nullable=False)
    created_at = Column(DateTime, nullable=False)