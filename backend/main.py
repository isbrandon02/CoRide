import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine, migrate_sqlite_schema
from app.demo_seed import seed_demo_accounts
from app.routers import auth, matches, profile

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    migrate_sqlite_schema()
    if get_settings().SEED_DEMO_ACCOUNTS:
        created, skipped = seed_demo_accounts()
        if created:
            logger.info("Startup demo seed: %s account(s) added (%s already existed)", created, skipped)
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


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "CoRide API"}
