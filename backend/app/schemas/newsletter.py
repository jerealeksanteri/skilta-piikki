from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import UtcDatetime

Audience = Literal["everyone", "admins"]


class NewsletterCreate(BaseModel):
    audience: Audience
    # Generous caps: the real limit (4096 visible characters) is checked after sanitizing.
    markup: str = Field(max_length=20_000)
    html: str = Field(max_length=50_000)


class NewsletterOut(BaseModel):
    id: int
    audience: Audience
    markup: str
    html: str
    recipient_count: int
    delivered_count: int
    failed_count: int
    created_by_id: int
    created_by_name: str | None
    created_at: UtcDatetime


class AudienceCounts(BaseModel):
    everyone: int
    admins: int
