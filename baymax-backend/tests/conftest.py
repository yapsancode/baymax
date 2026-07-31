"""pytest configuration for the baymax-backend test suite.

IMPORTANT: run pytest from inside baymax-backend/ so that pydantic-settings
can find .env in the current working directory.

    cd baymax-backend
    pytest tests/ -v

This conftest adds baymax-backend/ to sys.path so bare imports
(config, db_call, models, ...) resolve from any invocation location.
"""
import sys
import os

# baymax-backend/ is one directory above this conftest file.
BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)
