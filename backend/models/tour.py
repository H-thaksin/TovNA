from sqlalchemy import Boolean, Column, Integer, Numeric, String, Text
from database import Base


class Tour(Base):
    __tablename__ = "tours"

    id = Column(Integer, primary_key=True)
    destination_id = Column(Integer, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    duration_days = Column(Integer, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    max_people = Column(Integer)
    image_url = Column(Text)
    is_active = Column(Boolean, nullable=False)