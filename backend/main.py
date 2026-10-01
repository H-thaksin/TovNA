from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.destinations import router as destinations_router
from routers.hotels import router as hotels_router
from routers.tours import router as tours_router
from routers.activities import router as activities_router
from routers.transportations import router as transportations_router
from routers.itineraries import router as itineraries_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "message": "Welcome to TovNa API"
    }
app.include_router(destinations_router)
app.include_router(hotels_router)
app.include_router(tours_router)
app.include_router(activities_router)
app.include_router(transportations_router)  
app.include_router(itineraries_router)