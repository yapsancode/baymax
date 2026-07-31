from pydantic import BaseModel
from datetime import datetime
from uuid import UUID

# StepResponse now lives in schemas/step.py (single canonical definition,
# imported by both the sessions and steps routers).


class SessionCreate(BaseModel):
    title: str


class SessionStatusUpdate(BaseModel):
    status: str | None = None
    current_step_index: int | None = None


class SessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    status: str
    current_step_index: int = 0
    total_steps: int = 0
    completed_steps: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
