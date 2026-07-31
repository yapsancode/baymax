"""Seed or refresh an OFFICIAL guide from a JSON file.

The ONLY path by which a guide becomes official — the /guides routes never set
is_official. Officials are visible to every signed-in user and matched by the
chat intent router; personal recordings are untouched.

Usage (from baymax-backend/, with .env present):

    python data/seed_official_guide.py path/to/guide.json --email you@example.com

The JSON file shape:

    {
      "title": "Host a backend on Cloud Run",
      "meta": {
        "task": "backend",
        "keywords": ["cloud run", "cloudrun"],
        "prerequisites": [{"label": "...", "hint": "..."}],
        "nextSteps": ["..."]
      },
      "steps": [ { ...full resolver step shape... } ]
    }

Upsert is matched on title: re-running with updated steps refreshes the guide
in place (same id), which is how console drift gets fixed for every user
without touching the extension.
"""

import argparse
import json
import sys
from pathlib import Path

# Allow running as `python data/seed_official_guide.py` from baymax-backend/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.orm import Session as OrmSession  # noqa: E402

import db_call  # noqa: E402
from database import _engine  # noqa: E402
from models import User  # noqa: E402
from services.embedding_service import get_embedding, guide_embed_text  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed/refresh an official guide.")
    parser.add_argument("guide_json", help="Path to the guide JSON file")
    parser.add_argument(
        "--email",
        required=True,
        help="Email of an existing user to own the guide (satisfies the user_id FK)",
    )
    args = parser.parse_args()

    payload = json.loads(Path(args.guide_json).read_text(encoding="utf-8"))
    title = payload.get("title")
    steps = payload.get("steps")
    meta = payload.get("meta")
    if not title or not isinstance(steps, list) or not steps:
        print("ERROR: Guide JSON must have a 'title' and a non-empty 'steps' list.")
        return 1

    if _engine is None:
        print("ERROR: DATABASE_URL missing — run from baymax-backend/ with .env present.")
        return 1

    with OrmSession(bind=_engine) as db:
        user = db.scalar(select(User).where(User.email == args.email))
        if not user:
            known = db.scalars(select(User.email)).all()
            print(f"ERROR: No user with email {args.email!r} — sign in once first so the user row exists.")
            print(f"Known user emails: {known}")
            return 1

        guide = db_call.upsert_official_guide(
            db, str(user.id), title, steps, meta
        )
        print(
            f"OK: Official guide {guide.id} — {guide.title!r} "
            f"({len(guide.steps)} steps, keywords={((guide.meta or {}).get('keywords'))})"
        )

        # Embed it, exactly as POST /guides does for a recording. Without this
        # the guide is INVISIBLE to chat: search_guides filters on
        # `embedding IS NOT NULL`, so an unembedded official guide can never be
        # matched and the chat falls through to a recording (or plain text).
        # Unlike the POST route, a failure here is fatal — a silently
        # unsearchable official guide is the bug this line exists to prevent.
        try:
            embedding = get_embedding(guide_embed_text(guide.title, guide.steps))
            db_call.set_guide_embedding(db, str(guide.id), embedding)
            print(f"OK: Embedded {guide.title!r} ({len(embedding)} dims) — searchable from chat.")
        except Exception as exc:
            print(f"ERROR: Guide saved but embedding FAILED: {exc}")
            print("The guide will NOT be matched by chat until re-seeded successfully.")
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
