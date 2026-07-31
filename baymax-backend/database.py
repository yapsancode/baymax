from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session as OrmSession

from config import settings

# ==========================================
# 1. Base Declaration
# ==========================================
class Base(DeclarativeBase):
    """Base class for all database models utilizing Declarative Mapping.

    The ORM models themselves live in models.py; they import this Base.
    """
    pass


# ==========================================
# 2. Engine + per-request session
# ==========================================

# DATABASE_URL is the Postgres connection string (postgresql://...).
# Distinct from SUPABASE_URL, which is the https project API URL used by the
# supabase client / JWT verification in services/auth_service.py.
DATABASE_URL = settings.DATABASE_URL

_engine = create_engine(DATABASE_URL) if DATABASE_URL else None


def get_db():
    """FastAPI dependency: yields a SQLAlchemy session per request."""
    db = OrmSession(bind=_engine)
    try:
        yield db
    finally:
        db.close()


# ==========================================
# 3. Database Sync / Creation Initialization
# ==========================================

def init_db():
    """Establishes connection to Supabase and initializes all tables."""
    if not DATABASE_URL:
        print("❌ Error: DATABASE_URL variable missing from your .env file.")
        return

    print("🚀 Connecting to Supabase PostgreSQL database...")
    try:
        # Create the engine connection
        engine = create_engine(DATABASE_URL, echo=True)  # echo=True logs SQL queries to console

        # Import the ORM models so their tables register on Base.metadata
        # before create_all runs. (Deferred import avoids a circular import:
        # models.py imports Base from this module.)
        import models  # noqa: F401

        print("🧱 Creating tables based on schema mapping...")
        # Generates tables if they don't already exist
        Base.metadata.create_all(bind=engine)
        print("✅ Tables created successfully in Supabase!")

    except Exception as e:
        print(f"❌ Failed to connect or create tables: {e}")

if __name__ == "__main__":
    init_db()
