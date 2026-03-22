import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine, migrate_sqlite_schema
from app.demo_seed import (
    apply_demo_profile_photos,
    ensure_sample_rides_for_users_without_rides,
    ensure_upcoming_week_sample_rides,
    seed_demo_accounts,
    seed_demo_chats,
    seed_demo_rides,
)
from app.routers import auth, chats, impact, matches, profile, rides

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    migrate_sqlite_schema()
    if get_settings().SEED_DEMO_ACCOUNTS:
        created, skipped = seed_demo_accounts()
        if created:
            logger.info("Startup demo seed: %s account(s) added (%s already existed)", created, skipped)
        photo_n, _ = apply_demo_profile_photos()
        if photo_n:
            logger.info("Startup demo profile photos: %s profile(s) updated", photo_n)
        ride_n, _ = seed_demo_rides()
        if ride_n:
            logger.info("Startup demo ride seed: %s ride(s) added", ride_n)
        extra_n = ensure_sample_rides_for_users_without_rides()
        if extra_n:
            logger.info("Startup sample rides for empty accounts: %s ride(s) added", extra_n)
        up_n = ensure_upcoming_week_sample_rides()
        if up_n:
            logger.info("Startup upcoming-week sample rides: %s ride(s) added", up_n)
        chat_n, _ = seed_demo_chats()
        if chat_n:
            logger.info("Startup demo chat seed: %s message(s) added", chat_n)
    yield


app = FastAPI(title="CoRide API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(profile.router)
app.include_router(matches.router)
app.include_router(rides.router)
app.include_router(impact.router)
app.include_router(chats.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "CoRide API"}
