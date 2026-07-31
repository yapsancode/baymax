"""SQLAlchemy ORM models — the shape of the database.

Pydantic request/response shapes live in schemas/ (don't confuse the two).
The engine, Base, and get_db dependency live in database.py.
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, ForeignKey, String, Text, Integer, DateTime, Index, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # Not written by the backend today — mirrors the `role` column already
    # present on the live Supabase `users` table (read directly by the
    # frontend, e.g. BottomNav.jsx's useUserRole) so server-side admin checks
    # (require_admin in services/auth_service.py) can read it too.
    role: Mapped[str] = mapped_column(String, nullable=False, default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationship linking back to Sessions (One-to-Many)
    # cascade="all, delete-orphan" ensures if a user is deleted, their sessions are also deleted
    sessions: Mapped[list["Session"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    # Guides the user recorded themselves (saved from the Recorder screen).
    guides: Mapped[list["Guide"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default='in_progress')
    current_step_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="sessions")
    steps: Mapped[list["Step"]] = relationship(back_populates="session", cascade="all, delete-orphan")

    @property
    def total_steps(self) -> int:
        return len(self.steps or [])

    @property
    def completed_steps(self) -> int:
        return self.current_step_index


class Step(Base):
    __tablename__ = "steps"

    # [Keep] Existing unique identifiers & sequence tracking
    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=True) # or nullable=False if always required
    description: Mapped[str] = mapped_column(Text, nullable=True)
    action: Mapped[str] = mapped_column(String, nullable=False)
    selector: Mapped[str] = mapped_column(Text, nullable=True)
    url: Mapped[str] = mapped_column(Text, nullable=True)
    url_pattern: Mapped[str] = mapped_column(Text, nullable=True)
    advance_on_url_pattern: Mapped[str] = mapped_column(Text, nullable=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)

    # [Keep] Description & Status fields

    status: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationship linking back to Session (Many-to-One)
    session: Mapped["Session"] = relationship(back_populates="steps")


class Guide(Base):
    """A guide the user authored by demonstration on the Recorder screen.

    Unlike Step (one row per AI step, a fixed column set), a guide keeps its
    whole step array as JSONB. The resolver intent fields the guide engine
    relies on — role, name, text, href, extraSelector, isParameter,
    exactName, … — live in the frontend's step shape and evolve there, so we
    store them losslessly as JSON rather than mapping each to a column.

    The `embedding` column (VECTOR(768)) is managed via raw SQL only — it is
    not mapped here to avoid a pgvector Python package dependency.
    """

    __tablename__ = "guides"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    steps: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    # Official = curated by the Baymax team (seeded via data/seed_official_guide.py)
    # and visible to EVERY user; personal recordings stay owner-only.
    # POST /guides can never set this — there is no client path to promote a guide.
    is_official: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Guide-level extras that aren't steps: prerequisites, nextSteps, chat intent
    # keywords, the Home task id. JSONB for the same lossless reason as steps.
    # (Named meta, not metadata — `metadata` is reserved by SQLAlchemy's Base.)
    meta: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="guides")

    @property
    def step_count(self) -> int:
        """Convenience for the list view (GuideSummary) — no need to ship steps."""
        return len(self.steps or [])


class Feedback(Base):
    """One thumbs-down (fail) or implicit-success outcome for a single guide
    step in a single session. guide_id/guide_title/step_title are snapshotted
    at write time (not FKs to Guide) since guide_id may be a local/bundled
    guide's string id, not always a `guides` row.

    Table + indexes were created directly in Supabase; this mirrors that DDL
    exactly (see schema.sql) rather than being the source of truth.
    """

    __tablename__ = "guide_feedback"
    __table_args__ = (
        Index(
            "guide_feedback_one_outcome_per_session_step_idx",
            "session_id", "guide_id", "step_index",
            unique=True,
            postgresql_where=text("session_id IS NOT NULL"),
        ),
        Index("guide_feedback_status_idx", "status"),
        Index("guide_feedback_guide_id_idx", "guide_id"),
        Index("guide_feedback_created_at_idx", "created_at"),
        Index("guide_feedback_guide_status_idx", "guide_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    session_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True
    )
    guide_id: Mapped[str] = mapped_column(Text, nullable=False)
    guide_title: Mapped[str] = mapped_column(Text, nullable=False)
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    step_title: Mapped[str] = mapped_column(Text, nullable=False)
    # "success" | "fail" — enforced by a DB check constraint, validated again
    # in routers/feedback.py before insert.
    status: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
