from datetime import datetime

from pydantic import BaseModel, field_validator

from app.models.project import ELECTION_TYPES


class ProjectCreate(BaseModel):
    name: str
    election_type: str
    state: str | None = None
    district: str | None = None
    constituency: str | None = None

    @field_validator("election_type")
    @classmethod
    def valid_election_type(cls, v: str) -> str:
        if v not in ELECTION_TYPES:
            raise ValueError(f"election_type must be one of: {', '.join(ELECTION_TYPES)}")
        return v


class ProjectUpdate(BaseModel):
    name: str | None = None
    election_type: str | None = None
    state: str | None = None
    district: str | None = None
    constituency: str | None = None
    is_active: bool | None = None


class ProjectOut(BaseModel):
    id: int
    org_id: int
    name: str
    election_type: str
    state: str | None
    district: str | None
    constituency: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
