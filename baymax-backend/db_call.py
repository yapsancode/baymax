from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, or_, text, func
from models import User, Step, Session as DBSession, Guide, Feedback
# --- User Database Actions ---
def create_user(db: Session, name: str, email: str):
    # Check if user exists
    existing = db.scalar(select(User).where(User.email == email))
    if existing:
        return existing

    new_user = User(name=name, email=email)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

def get_user(db: Session, user_id: str):
    return db.scalar(select(User).where(User.id == user_id))

def get_or_create_user(db: Session, user_id: str, name: str, email: str):
    """Mirror a Supabase auth user into our users table using the SAME id,
    so the sessions foreign key is satisfied. Idempotent."""
    existing = db.scalar(select(User).where(User.id == user_id))
    if existing:
        return existing

    new_user = User(id=user_id, name=name, email=email)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


# --- Session Database Actions ---
def create_session(db: Session, user_id: str, title: str):
    new_session = DBSession(user_id=user_id, title=title)
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

def get_sessions_by_user(db: Session, user_id: str):
    return db.scalars(
        select(DBSession)
        .where(DBSession.user_id == user_id)
        .options(selectinload(DBSession.steps))
    ).all()

def get_session(db: Session, session_id: str, user_id: str):
    """Fetch one session scoped to its owner. Returns None if not found."""
    return db.scalar(
        select(DBSession).where(DBSession.id == session_id, DBSession.user_id == user_id)
    )


def save_ai_step(
    db: Session,
    session_id: str,
    step_number: int,
    action: str,
    status: str,
    title: str | None = None,
    description: str | None = None,
    selector: str | None = None,
    url: str | None = None,
    url_pattern: str | None = None,
    advance_on_url_pattern: str | None = None,
    value: str | None = None
):
    """Save an AI-generated execution step."""

    new_step = Step(
        session_id=session_id, #
        step_number=step_number, #
        title=title, #
        description=description, #
        action=action, #
        selector=selector, #
        url=url, #
        url_pattern=url_pattern, #
        advance_on_url_pattern=advance_on_url_pattern, #
        status=status, 
        value=value,
    )

    db.add(new_step)
    db.commit()
    db.refresh(new_step)

    return new_step

# --- Step Database Actions ---

def get_steps_by_session(db: Session, session_id: str, user_id: str):
    """
    Return all steps for a session, but only if that session belongs to user_id.
    Returns None if the session doesn't exist or isn't owned by this user.
    """
    session = get_session(db, session_id, user_id)  # reuse existing ownership check
    if not session:
        return None

    return db.scalars(
        select(Step)
        .where(Step.session_id == session_id)
        .order_by(Step.step_number)
    ).all()


def update_session(db: Session, session_id: str, user_id: str, *, status: str | None = None, current_step_index: int | None = None):
    """
    Update a session's status and/or current_step_index.
    Validates ownership before touching anything.
    Returns the updated session, or None if not found / not authorised.
    """
    session = get_session(db, session_id, user_id)
    if not session:
        return None

    if status is not None:
        session.status = status
    if current_step_index is not None:
        session.current_step_index = current_step_index
    db.commit()
    db.refresh(session)
    return session


# Keep backward compat alias
def update_session_status(db: Session, session_id: str, status: str, user_id: str):
    return update_session(db, session_id, user_id, status=status)


def update_step_status(db: Session, session_id: str, step_id: str, status: str, user_id: str):
    """
    Update a step's status. Validates session ownership before touching anything.
    Returns the updated step, or None if not found / not authorised.
    """
    session = get_session(db, session_id, user_id)
    if not session:
        return None

    step = db.scalar(
        select(Step).where(Step.id == step_id, Step.session_id == session_id)
    )
    if not step:
        return None

    step.status = status
    db.commit()
    db.refresh(step)
    return step


# --- Recorded Guide Database Actions ---

def create_recorded_guide(db: Session, user_id: str, title: str, steps: list):
    """Save a guide the user recorded on the Recorder screen."""
    guide = Guide(user_id=user_id, title=title, steps=steps)
    db.add(guide)
    db.commit()
    db.refresh(guide)
    return guide


def get_recorded_guides_by_user(db: Session, user_id: str):
    """List the guides this user can run: official ones first, then their own,
    newest first within each group."""
    return db.scalars(
        select(Guide)
        .where(
            or_(
                Guide.user_id == user_id,
                Guide.is_official.is_(True),
            )
        )
        .order_by(Guide.is_official.desc(), Guide.created_at.desc())
    ).all()


def get_recorded_guide(db: Session, guide_id: str, user_id: str):
    """Fetch one guide the user may run: their own, or any official guide.
    Returns None if not found."""
    return db.scalar(
        select(Guide).where(
            Guide.id == guide_id,
            or_(
                Guide.user_id == user_id,
                Guide.is_official.is_(True),
            ),
        )
    )


def get_official_guides(db: Session):
    """All official (Baymax-curated) guides — used by chat intent matching and
    available to every signed-in user."""
    return db.scalars(
        select(Guide)
        .where(Guide.is_official.is_(True))
        .order_by(Guide.created_at.desc())
    ).all()


def upsert_official_guide(db: Session, user_id: str, title: str, steps: list, meta: dict | None = None):
    """Create or refresh an official guide, matched by title.

    The seed path (data/seed_official_guide.py) is the ONLY way a guide becomes
    official — routers never set is_official. Updating in place preserves the
    guide id, so extensions holding the old id keep working after a re-seed.
    """
    guide = db.scalar(
        select(Guide).where(
            Guide.title == title, Guide.is_official.is_(True)
        )
    )
    if guide:
        guide.steps = steps
        guide.meta = meta
    else:
        guide = Guide(
            user_id=user_id, title=title, steps=steps, meta=meta, is_official=True
        )
        db.add(guide)
    db.commit()
    db.refresh(guide)
    return guide


def set_guide_embedding(db: Session, guide_id: str, embedding: list[float]) -> None:
    """Store the vector embedding for a guide (fire-and-forget after save)."""
    vec_literal = "[" + ",".join(str(x) for x in embedding) + "]"
    db.execute(
        text("UPDATE guides SET embedding = cast(:emb AS vector) WHERE id = cast(:id AS uuid)"),
        {"emb": vec_literal, "id": guide_id},
    )
    db.commit()


def search_guides(
    db: Session,
    embedding: list[float],
    threshold: float = 0.5,
    limit: int = 3,
) -> list:
    """Return guides whose embedding is within `threshold` cosine similarity of
    `embedding`, ordered best-match first.

    Uses the pgvector <=> (cosine distance) operator directly via raw SQL so
    no extra Python package is required beyond psycopg2.
    """
    vec_literal = "[" + ",".join(str(x) for x in embedding) + "]"
    rows = db.execute(
        text("""
            SELECT id, title, steps, meta,
                   1 - (embedding <=> cast(:emb AS vector)) AS similarity
            FROM guides
            WHERE embedding IS NOT NULL
              AND 1 - (embedding <=> cast(:emb AS vector)) > :threshold
            ORDER BY similarity DESC
            LIMIT :limit
        """),
        {"emb": vec_literal, "threshold": threshold, "limit": limit},
    ).fetchall()
    return rows


def delete_recorded_guide(db: Session, guide_id: str, user_id: str):
    """Delete one saved guide. Strictly owner-scoped — being able to READ an
    official guide must not allow deleting it, so this does not reuse
    get_recorded_guide's own-or-official visibility rule.
    Returns True if deleted, False if not found/owned."""
    guide = db.scalar(
        select(Guide).where(
            Guide.id == guide_id, Guide.user_id == user_id
        )
    )
    if not guide:
        return False
    db.delete(guide)
    db.commit()
    return True


def list_all_guides(
    db: Session,
    *,
    is_official: bool | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 25,
):
    """Admin-only, unscoped listing of every guide across all users.
    Joins User so the admin table can show the owner's email."""
    filters = []
    if is_official is not None:
        filters.append(Guide.is_official.is_(is_official))
    if search:
        filters.append(Guide.title.ilike(f"%{search}%"))

    total = db.scalar(select(func.count()).select_from(Guide).where(*filters)) or 0

    rows = db.execute(
        select(Guide, User.email)
        .join(User, User.id == Guide.user_id)
        .where(*filters)
        .order_by(Guide.is_official.desc(), Guide.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = []
    for guide, email in rows:
        guide.user_email = email  # transient attribute, read by AdminGuideSummary
        items.append(guide)

    return items, total


def admin_delete_guide(db: Session, guide_id: str) -> bool:
    """Admin-only delete — no owner checks. Returns True if deleted."""
    guide = db.scalar(select(Guide).where(Guide.id == guide_id))
    if not guide:
        return False
    db.delete(guide)
    db.commit()
    return True


# --- Feedback Database Actions ---

def is_admin(db: Session, user_id: str) -> bool:
    user = get_user(db, user_id)
    return bool(user and user.role == "admin")


def admin_delete_feedback(db: Session, feedback_id: str) -> bool:
    """Admin-only delete — no owner checks. Returns True if deleted."""
    row = db.scalar(select(Feedback).where(Feedback.id == feedback_id))
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True


def upsert_step_feedback(
    db: Session,
    user_id: str,
    session_id: str | None,
    guide_id: str,
    guide_title: str,
    step_index: int,
    step_title: str,
    status: str,
):
    """Create or update the one feedback row for (session_id, guide_id, step_index).
    A thumbs-down always wins: re-clicking the same step in the same session just
    refreshes the snapshot fields. The DB's uniqueness only applies when
    session_id is not null, so with no session (offline/trial runs) there is
    nothing to upsert against — every call inserts a fresh row."""
    existing = None
    if session_id is not None:
        existing = db.scalar(
            select(Feedback).where(
                Feedback.session_id == session_id,
                Feedback.guide_id == guide_id,
                Feedback.step_index == step_index,
            )
        )
    if existing:
        existing.guide_title = guide_title
        existing.step_title = step_title
        existing.status = status
        feedback = existing
    else:
        feedback = Feedback(
            user_id=user_id,
            session_id=session_id,
            guide_id=guide_id,
            guide_title=guide_title,
            step_index=step_index,
            step_title=step_title,
            status=status,
        )
        db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


def insert_success_feedback(
    db: Session,
    user_id: str,
    session_id: str,
    guide_id: str,
    guide_title: str,
    steps: list[dict],
) -> int:
    """Insert a single success row for the last step only. Steps already
    reported for this session+guide (e.g. thumbs-downed) are skipped, so a
    successful completion adds at most one feedback row."""
    if not steps:
        return 0

    last_step = max(steps, key=lambda s: s["step_index"])
    existing = db.scalar(
        select(Feedback).where(
            Feedback.session_id == session_id,
            Feedback.guide_id == guide_id,
            Feedback.step_index == last_step["step_index"],
        )
    )
    if existing:
        return 0

    db.add(
        Feedback(
            user_id=user_id,
            session_id=session_id,
            guide_id=guide_id,
            guide_title=guide_title,
            step_index=last_step["step_index"],
            step_title=last_step["step_title"],
            status="success",
        )
    )
    db.commit()
    return 1


def list_feedback(
    db: Session,
    *,
    status: str | None = None,
    guide_id: str | None = None,
    guide_title: str | None = None,
    step_index: int | None = None,
    date_from=None,
    date_to=None,
    page: int = 1,
    page_size: int = 25,
):
    """Admin-only, unscoped listing (every user's feedback), newest first.
    Joins User for the admin table's "User" column (email)."""
    filters = []
    if status:
        filters.append(Feedback.status == status)
    if guide_id:
        filters.append(Feedback.guide_id == guide_id)
    if guide_title:
        filters.append(Feedback.guide_title.ilike(f"%{guide_title}%"))
    if step_index is not None:
        filters.append(Feedback.step_index == step_index)
    if date_from is not None:
        filters.append(Feedback.created_at >= date_from)
    if date_to is not None:
        filters.append(Feedback.created_at <= date_to)

    total = db.scalar(select(func.count()).select_from(Feedback).where(*filters)) or 0

    rows = db.execute(
        select(Feedback, User.email)
        .join(User, User.id == Feedback.user_id)
        .where(*filters)
        .order_by(Feedback.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = []
    for feedback, email in rows:
        feedback.user_email = email  # transient attribute — read by FeedbackResponse.from_attributes
        items.append(feedback)

    return items, total