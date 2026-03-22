import logging
import os
import stat
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

logger = logging.getLogger(__name__)

# Directory containing main.py (the `backend` folder), not the process cwd.
BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _prepare_sqlite_file(db_path: Path) -> Path:
    """Ensure parent dir exists, is writable, and the DB file is not read-only."""
    db_path = db_path.resolve()
    parent = db_path.parent
    parent.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(parent, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)
    except (OSError, NotImplementedError):
        pass

    if not os.access(parent, os.W_OK):
        raise RuntimeError(
            f"SQLite directory is not writable: {parent}. "
            "Fix permissions or set DATABASE_URL to a path outside synced/read-only folders."
        )

    if db_path.exists() and not os.access(db_path, os.W_OK):
        try:
            os.chmod(db_path, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)
        except OSError as e:
            raise RuntimeError(
                f"SQLite database file is read-only: {db_path}. "
                "Run: chmod u+w on the file, or delete it and retry."
            ) from e

    return db_path


def _normalized_database_url(url: str) -> str:
    """Use a writable absolute SQLite path so uvicorn cwd / reload does not break writes."""
    if not url.startswith("sqlite"):
        return url
    if ":memory:" in url:
        return url
    prefix = "sqlite:///"
    if not url.startswith(prefix):
        return url
    rest = url[len(prefix) :]
    if not rest:
        return url
    path = Path(rest)
    if not path.is_absolute():
        path = (BACKEND_ROOT / path).resolve()
    path = _prepare_sqlite_file(path)
    return f"sqlite:///{path.as_posix()}"


def _sqlite_on_connect(dbapi_conn, _connection_record) -> None:
    # DELETE journal avoids -wal / -shm sidecars; WAL often breaks on iCloud / synced folders.
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA foreign_keys=ON")
    cur.execute("PRAGMA journal_mode=DELETE")
    cur.execute("PRAGMA busy_timeout=5000")
    cur.close()


class Base(DeclarativeBase):
    pass


def _engine():
    url = _normalized_database_url(get_settings().DATABASE_URL)
    connect_args = {"check_same_thread": False, "timeout": 30.0} if url.startswith("sqlite") else {}
    eng = create_engine(url, connect_args=connect_args)
    if str(eng.url).startswith("sqlite"):
        event.listen(eng, "connect", _sqlite_on_connect)
        logger.info("SQLite URL: %s", eng.url)
    return eng


engine = _engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def migrate_sqlite_schema() -> None:
    """Align older SQLite files with the current model (e.g. legacy is_verified column)."""
    if not str(engine.url).startswith("sqlite"):
        return
    with engine.begin() as conn:
        try:
            rows = conn.execute(text("PRAGMA table_info(users)")).fetchall()
        except Exception:
            rows = []
        if rows:
            cols = {r[1] for r in rows}
            if "is_verified" not in cols:
                conn.execute(
                    text("ALTER TABLE users ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 1")
                )
            if "onboarding_completed" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE users ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0"
                    )
                )
        try:
            prows = conn.execute(text("PRAGMA table_info(user_profiles)")).fetchall()
        except Exception:
            prows = []
        if prows:
            pcols = {r[1] for r in prows}
            if "name" not in pcols:
                conn.execute(text("ALTER TABLE user_profiles ADD COLUMN name TEXT NOT NULL DEFAULT ''"))
            if "age" not in pcols:
                conn.execute(text("ALTER TABLE user_profiles ADD COLUMN age INTEGER"))
            if "gender" not in pcols:
                conn.execute(text("ALTER TABLE user_profiles ADD COLUMN gender VARCHAR(64) NOT NULL DEFAULT ''"))
            if "status" not in pcols:
                conn.execute(text("ALTER TABLE user_profiles ADD COLUMN status VARCHAR(64) NOT NULL DEFAULT ''"))
            if "hobbies" not in pcols:
                conn.execute(
                    text("ALTER TABLE user_profiles ADD COLUMN hobbies TEXT NOT NULL DEFAULT ''")
                )
            if "commute_route" not in pcols:
                conn.execute(
                    text(
                        "ALTER TABLE user_profiles ADD COLUMN commute_route TEXT NOT NULL DEFAULT ''"
                    )
                )
            if "avatar_url" not in pcols:
                conn.execute(text("ALTER TABLE user_profiles ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''"))
        try:
            crows = conn.execute(text("PRAGMA table_info(chat_conversations)")).fetchall()
        except Exception:
            crows = []
        if crows:
            ccols = {r[1] for r in crows}
            if "title" not in ccols:
                conn.execute(text("ALTER TABLE chat_conversations ADD COLUMN title TEXT NOT NULL DEFAULT ''"))


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
