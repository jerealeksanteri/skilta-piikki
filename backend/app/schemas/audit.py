from typing import Any

from pydantic import BaseModel

from app.schemas.common import UtcDatetime


class AuditEntryOut(BaseModel):
    id: int
    actor_id: int | None
    actor_name: str
    action: str
    target_type: str | None
    target_id: int | None
    target_label: str | None
    # {"field": {"from": old, "to": new}}
    changes: dict[str, dict[str, Any]] | None
    note: str | None
    created_at: UtcDatetime


class AuditLogPage(BaseModel):
    entries: list[AuditEntryOut]
    # Pass the last entry's id as `before_id` to load the next page.
    has_more: bool


class AuditActor(BaseModel):
    id: int
    name: str


class AuditFilters(BaseModel):
    actors: list[AuditActor]
    actions: list[str]
