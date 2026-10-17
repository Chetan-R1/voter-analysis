from datetime import datetime

from pydantic import BaseModel, field_validator


class OrganizationCreate(BaseModel):
    name: str
    slug: str
    voter_symbol: str | None = None

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: str) -> str:
        v = v.strip().lower().replace(" ", "_")
        if not v:
            raise ValueError("slug cannot be empty")
        return v


class OrganizationUpdate(BaseModel):
    name: str | None = None
    voter_symbol: str | None = None
    is_active: bool | None = None


class OrganizationOut(BaseModel):
    id: int
    name: str
    slug: str
    voter_symbol: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
